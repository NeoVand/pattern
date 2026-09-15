<script lang="ts">
	import { onDestroy } from 'svelte';
	import type { AiSession } from '$lib/ai/session.svelte';
	import { fieldNotes, groundedMessages } from '$lib/ai/retrieval';
	import {
		RETRIEVAL_AUDIT_CASES,
		auditPassages,
		gradeAuditAnswer,
		runEmbeddedAudit,
		runKeywordAudit,
		summarizeAudit,
		type AuditAnswerGrade,
		type AuditSearchResult,
		type RetrievalAuditMode
	} from '$lib/ai/retrieval-audit';
	import PatternIcon from './PatternIcon.svelte';
	import ChoiceGroup from './ChoiceGroup.svelte';

	let { ai }: { ai: AiSession } = $props();
	let mode = $state<RetrievalAuditMode>('keyword');
	let topK = $state(2);
	let withheld = $state('');
	let selected = $state('doors');
	let results = $state.raw<AuditSearchResult[]>([]);
	interface Answer {
		text: string;
		model: string;
		status: 'running' | 'complete' | 'stopped' | 'failed';
		grade?: AuditAnswerGrade;
	}
	let answers = $state.raw<Record<string, Answer>>({});
	let running = $state<'search' | 'answers' | null>(null);
	let status = $state('');
	let error = $state('');
	let controller: AbortController | undefined;
	const canEmbed = $derived(ai.provider === 'openai' && ai.ready);
	const summary = $derived(summarizeAudit(results));
	const current = $derived(results.find((result) => result.test.id === selected));
	const answer = $derived(answers[selected]);
	const completed = $derived(
		Object.values(answers).filter((entry) => entry.status === 'complete').length
	);
	const percent = (value: number | null) =>
		value === null ? 'Not applicable' : `${Math.round(value * 100)}%`;
	function reset() {
		results = [];
		answers = {};
		status = '';
		error = '';
	}
	async function search() {
		if (running || (mode === 'semantic' && ai.busy)) return;
		if (mode === 'semantic' && !canEmbed) {
			ai.settingsOpen = true;
			return;
		}
		reset();
		const operation = new AbortController();
		controller = operation;
		running = 'search';
		status =
			mode === 'semantic'
				? 'Embedding the sources and all four questions…'
				: 'Checking keyword retrieval…';
		try {
			if (mode === 'semantic') {
				const passages = auditPassages(withheld);
				const vectors = await ai.embed(
					[
						...passages.map((passage) => `${passage.title}\n${passage.body}`),
						...RETRIEVAL_AUDIT_CASES.map((test) => test.question)
					],
					operation.signal
				);
				if (!operation.signal.aborted) results = runEmbeddedAudit(topK, withheld, vectors);
			} else results = runKeywordAudit(topK, withheld);
			status = operation.signal.aborted
				? 'Search stopped. Run again to start fresh.'
				: 'Four searches complete. No answers have been generated.';
		} catch (caught) {
			if (!operation.signal.aborted)
				error = caught instanceof Error ? caught.message : String(caught);
			status = operation.signal.aborted
				? 'Search stopped. Run again to start fresh.'
				: 'Search did not complete.';
		} finally {
			running = null;
		}
	}
	async function generateAnswers() {
		if (running || ai.busy || !results.length) return;
		if (!ai.ready) {
			ai.settingsOpen = true;
			return;
		}
		const operation = new AbortController();
		controller = operation;
		running = 'answers';
		error = '';
		answers = {};
		try {
			for (const [index, result] of results.entries()) {
				if (operation.signal.aborted) break;
				const id = result.test.id;
				const usedModel = ai.label;
				selected = id;
				answers = { ...answers, [id]: { text: '', model: usedModel, status: 'running' } };
				status = `Generating answer ${index + 1} of 4…`;
				const response = await ai.generate({
					messages: groundedMessages(
						result.test.question,
						result.hits.map((hit) => hit.passage)
					),
					maxTokens: 360,
					temperature: 0.2,
					signal: operation.signal,
					onText: (chunk) => {
						if (!operation.signal.aborted)
							answers = { ...answers, [id]: { ...answers[id], text: answers[id].text + chunk } };
					}
				});
				if (operation.signal.aborted) {
					answers = { ...answers, [id]: { ...answers[id], status: 'stopped' } };
					break;
				}
				answers = {
					...answers,
					[id]: {
						text: response.text,
						model: usedModel,
						status: 'complete',
						grade: gradeAuditAnswer(result, response.text)
					}
				};
			}
			status = operation.signal.aborted
				? 'Generation stopped. Completed answers remain available.'
				: 'Four answers generated. Inspect the wording against each source.';
		} catch (caught) {
			answers = Object.fromEntries(
				Object.entries(answers).map(([id, entry]) => [
					id,
					entry.status === 'running'
						? { ...entry, status: operation.signal.aborted ? 'stopped' : 'failed' }
						: entry
				])
			);
			if (!operation.signal.aborted)
				error = caught instanceof Error ? caught.message : String(caught);
			status = operation.signal.aborted
				? 'Generation stopped. Completed answers remain available.'
				: 'Generation did not complete. Completed answers remain available.';
		} finally {
			running = null;
		}
	}
	onDestroy(() => controller?.abort());
</script>

<section class="retrieval-audit" aria-label="Retrieval and grounding audit">
	<header>
		<span class="small-overline">RETRIEVE · ANSWER · CHECK THE EVIDENCE</span>
		<h3>Which part of the answer failed?</h3>
	</header>
	<p class="intro">
		Test search and answer generation separately on the same eight original Glasshouse field notes.
		One question needs two sources. Another has no answer anywhere in this collection.
	</p>
	<div class="controls">
		<fieldset class="mode-control" disabled={!!running}>
			<legend>Search method</legend>
			<div>
				<button
					aria-pressed={mode === 'keyword'}
					onclick={() => {
						mode = 'keyword';
						reset();
					}}>Keyword overlap</button
				><button
					aria-pressed={mode === 'semantic'}
					disabled={!canEmbed}
					onclick={() => {
						mode = 'semantic';
						reset();
					}}>Real embeddings</button
				>
			</div>
		</fieldset>
		<ChoiceGroup
			label="Maximum sources per question"
			value={topK}
			options={[
				{ value: 1, label: '1' },
				{ value: 2, label: '2' },
				{ value: 3, label: '3' },
				{ value: 4, label: '4' }
			]}
			disabled={!!running}
			onchange={(value) => {
				topK = value;
				reset();
			}}
		/>
		<label class="withhold"
			>Remove one source<select
				aria-label="Withheld source"
				disabled={!!running}
				bind:value={withheld}
				onchange={reset}
				><option value="">Keep all sources</option>{#each fieldNotes as passage (passage.id)}<option
						value={passage.id}>[{passage.id}] {passage.title}</option
					>{/each}</select
			></label
		>
	</div>
	<div class="run-row">
		<button
			class="primary-button"
			disabled={!!running || (mode === 'semantic' && ai.busy)}
			onclick={search}><PatternIcon name="retrieval" size={16} />Run search checks</button
		><span
			>{mode === 'keyword'
				? 'Runs locally · no model requests'
				: `1 embedding request · ${auditPassages(withheld).length + 4} texts`}</span
		>{#if !canEmbed}<button class="text-button" onclick={() => (ai.settingsOpen = true)}
				>Connect for embeddings</button
			>{/if}
	</div>
	{#if error}<p class="error" role="alert">{error}</p>{/if}
	{#if status}<p class="status" role="status">{status}</p>{/if}
	{#if running}<button class="text-button stop-button" onclick={() => controller?.abort()}
			><PatternIcon name="stop" size={14} />Stop audit</button
		>{/if}
	{#if results.length}
		<div class="summary">
			<div>
				<span>Required sources retrieved</span><strong data-testid="retrieval-recall"
					>{summary.found} / {summary.required}</strong
				><small>{percent(summary.recall)} source recall</small>
			</div>
			<p>
				Count the required source IDs found in the top {topK} results. Withheld sources remain in the
				denominator. The unanswered-attendance question has no relevant source, so recall is not defined
				for it.
			</p>
		</div>
		<div class="workspace">
			<div class="cases" role="group" aria-label="Inspect retrieval test cases">
				{#each results as result (result.test.id)}<button
						aria-pressed={selected === result.test.id}
						onclick={() => (selected = result.test.id)}
						><span
							>{result.test.label}<small
								>{result.test.requiredSources.length
									? `Needs ${result.test.requiredSources.map((id) => `[${id}]`).join(' + ')}`
									: 'No source contains the answer'}</small
							></span
						><b
							>{result.recall === null
								? '—'
								: `${result.requiredFound}/${result.test.requiredSources.length}`}</b
						></button
					>{/each}
			</div>
			{#if current}<div class="case-detail">
					<h4>{current.test.question}</h4>
					<p class="evidence-state">
						{current.test.requiredSources.length === 0
							? 'Missing evidence: a good answer acknowledges that attendance is not recorded.'
							: !current.evidenceAvailable
								? 'At least one required source was removed from the collection.'
								: current.requiredFound < current.test.requiredSources.length
									? 'The collection has the evidence, but this search did not retrieve all of it.'
									: 'Search found the required source IDs. The answer still needs checking.'}
					</p>
					<div class="source-list">
						<strong>Actually retrieved</strong>{#each current.hits as hit (hit.passage.id)}<details>
								<summary
									><span>[{hit.passage.id}] {hit.passage.title}</span><small
										>{mode === 'keyword' ? 'overlap' : 'cosine'} {hit.score.toFixed(3)}</small
									></summary
								>
								<p>{hit.passage.body}</p>
							</details>{:else}<p>
								No source had a positive keyword match. An answer can still acknowledge missing
								evidence.
							</p>{/each}
					</div>
					{#if answer}<div class="answer">
							<div class="answer-heading">
								<PatternIcon name="language" size={16} /><strong>Actual model output</strong><span
									>{answer.model} · {answer.status}</span
								>
							</div>
							<p class="answer-text">
								{answer.text ||
									(answer.status === 'running' ? 'Waiting for model output…' : 'No text received.')}
							</p>
							{#if answer.grade}<div class="grade-list">
									{#if answer.grade.expectation === 'facts'}<div>
											<span>Expected fact tokens</span><b
												>{answer.grade.factTokens ? 'Found' : 'Not found'}</b
											>
										</div>
										<div>
											<span>Required citation IDs</span><b
												>{answer.grade.requiredCitationIds ? 'Present' : 'Missing'}</b
											>
										</div>{:else}<div>
											<span>Missing-evidence language</span><b
												>{answer.grade.abstentionLanguage ? 'Found' : 'Not found'}</b
											>
										</div>{/if}
									<div>
										<span>Citations outside retrieved notes</span><b
											>{answer.grade.unknownCitationIds.length
												? answer.grade.unknownCitationIds.map((id) => `[${id}]`).join(', ')
												: 'None'}</b
										>
									</div>
								</div>
								<p class="grade-caveat">
									These are narrow text checks. Fact tokens can appear in a wrong sentence; a
									citation can be attached to an unsupported claim. Missing-evidence wording can
									coexist with a guess. Read the answer and the cited source to decide whether each
									claim is supported.
								</p>{/if}
						</div>{/if}
					<details class="reference">
						<summary>Inspect the scoring reference</summary>
						<p>{current.test.expected}</p>
						<p>
							When any required passage is absent from the retrieved context, this check expects the
							model to acknowledge missing evidence rather than guess the complete answer.
						</p>
					</details>
				</div>{/if}
		</div>
		<div class="generation-row">
			<button class="primary-button" disabled={!!running || ai.busy} onclick={generateAnswers}
				><PatternIcon name="language" size={16} />{ai.ready
					? 'Generate 4 answers'
					: 'Connect to generate answers'}</button
			>
			<p>
				{completed ? `${completed} of 4 answers complete. ` : ''}Uses the selected language model.
				Four sequential requests, each with only its retrieved notes. No answers are generated
				automatically.
			</p>
		</div>
	{:else}<div class="empty">
			<PatternIcon name="evaluation" size={25} />
			<p>
				Start with keyword search. Predict what will happen to source recall when you remove the
				ticket note [B].
			</p>
		</div>{/if}
	<div class="practice">
		<PatternIcon name="idea" size={18} />
		<p>
			<strong>Predict → observe → explain.</strong> Remove [B], then run the searches again. Explain whether
			the failure is missing information, search ranking, or answer generation. When a model includes
			a citation, open that note and check one complete claim.
		</p>
	</div>
	<details class="method">
		<summary>What these checks establish</summary>
		<p>
			Keyword search uses the same unique-word overlap score as the main retrieval lab, excludes
			zero matches, and returns up to k sources. Embedding mode sends the original available sources
			and four questions in one request, then ranks actual returned vectors by cosine similarity.
			Similarity scores are not calibrated answer probabilities. The four questions and required
			source IDs are curated references, not generated judgments.
		</p>
		<p>
			Source recall measures retrieval coverage of those reference IDs. Answer checks look only for
			a few expected fact patterns, literal bracketed source IDs, or missing-evidence phrases. None
			tests entailment: whether a particular source actually supports the precise claim. One
			response per question cannot establish reliability across repeated generations. Inspect the
			source/claim relationship and broaden the examples before relying on a system.
		</p>
	</details>
</section>

<style>
	.retrieval-audit {
		background: var(--surface);
		border-radius: 24px;
		padding: clamp(20px, 3vw, 38px);
		container-type: inline-size;
	}
	h3 {
		font: italic 400 clamp(30px, 3.2vw, 44px) var(--serif);
		margin: 9px 0 0;
	}
	.intro {
		color: var(--muted);
		font-size: 13px;
		line-height: 1.8;
		margin: 17px 0 24px;
		max-width: 790px;
	}
	.controls {
		display: flex;
		flex-wrap: wrap;
		gap: 24px;
		padding: 20px;
		background: var(--lab-inset);
		border-radius: 16px;
	}
	.mode-control {
		border: 0;
		padding: 0;
		margin: 0;
		min-width: 0;
	}
	.mode-control legend,
	.withhold {
		font-size: 11px;
		color: var(--muted);
	}
	.mode-control legend {
		margin-bottom: 10px;
	}
	.mode-control > div {
		display: flex;
		gap: 5px;
	}
	.mode-control button {
		font-size: 11px;
		color: var(--muted);
		padding: 9px 12px;
		border: 1px solid transparent;
		border-radius: 8px;
		background: var(--surface);
	}
	.mode-control button[aria-pressed='true'] {
		color: var(--blue);
		border-color: var(--blue);
	}
	.mode-control button:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}
	.controls :global(.choice-group) {
		margin: 0;
	}
	.controls :global(.choice-group legend) {
		font-size: 11px;
		margin-bottom: 10px;
	}
	.controls :global(.choice-group button) {
		font-size: 11px;
		padding: 9px 13px;
	}
	.withhold {
		min-width: 180px;
		flex: 1;
		max-width: 290px;
	}
	.withhold select {
		display: block;
		width: 100%;
		background: var(--surface);
		color: var(--ink);
		border: 1px solid var(--line);
		border-radius: 8px;
		padding: 9px 10px;
		font-size: 11px;
		margin-top: 10px;
	}
	select:focus-visible {
		outline: 2px solid var(--focus);
		outline-offset: 3px;
	}
	.run-row {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 16px;
		margin: 20px 0;
	}
	.primary-button {
		font-size: 12px;
		padding: 12px 17px;
	}
	.run-row > span {
		color: var(--quiet);
		font-size: 11px;
	}
	.run-row .text-button,
	.stop-button {
		font-size: 11px;
	}
	.run-row .text-button {
		margin-left: auto;
	}
	.error {
		color: var(--orange);
		font-size: 12px;
		line-height: 1.7;
	}
	.status {
		color: var(--muted);
		font-size: 11px;
		line-height: 1.7;
		margin: 15px 0;
	}
	.summary {
		display: grid;
		grid-template-columns: 180px 1fr;
		align-items: center;
		gap: 30px;
		border: 1px solid var(--line);
		border-radius: 16px;
		padding: 23px;
		margin: 23px 0;
	}
	.summary span {
		color: var(--muted);
		font-size: 11px;
	}
	.summary strong {
		color: var(--blue);
		font: 32px var(--mono);
		display: block;
		margin: 9px 0;
	}
	.summary small {
		color: var(--quiet);
		font-size: 10px;
	}
	.summary p {
		color: var(--muted);
		font-size: 12px;
		line-height: 1.8;
		margin: 0;
	}
	.workspace {
		display: grid;
		grid-template-columns: 230px minmax(0, 1fr);
		gap: 23px;
	}
	.cases {
		display: flex;
		flex-direction: column;
		gap: 7px;
	}
	.cases button {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 14px;
		padding: 16px;
		border: 1px solid transparent;
		color: var(--muted);
		background: var(--lab-inset);
		border-radius: 11px;
		text-align: left;
	}
	.cases button[aria-pressed='true'] {
		border-color: var(--lavender);
		color: var(--lavender);
	}
	.cases button span {
		font-size: 12px;
	}
	.cases small {
		color: var(--quiet);
		font-size: 10px;
		display: block;
		line-height: 1.7;
		margin-top: 5px;
	}
	.cases b {
		font: 15px var(--mono);
	}
	.case-detail {
		background: var(--lab-inset);
		border-radius: 16px;
		padding: 23px;
		min-width: 0;
	}
	h4 {
		font-size: 16px;
		line-height: 1.6;
		color: var(--ink);
		font-weight: 500;
		margin: 0;
	}
	.evidence-state {
		font-size: 11px;
		line-height: 1.8;
		color: var(--muted);
		margin: 12px 0 20px;
	}
	.source-list > strong {
		font-size: 11px;
		color: var(--ink);
		font-weight: 550;
		display: block;
		margin-bottom: 9px;
	}
	summary {
		color: var(--blue);
		font-size: 11px;
		line-height: 1.8;
		cursor: pointer;
	}
	.source-list details {
		border-top: 1px solid var(--line);
		padding: 10px 0;
	}
	.source-list summary small {
		display: block;
		margin-left: 14px;
		color: var(--quiet);
		font: 9px var(--mono);
	}
	.source-list p,
	.reference p {
		font-size: 11px;
		color: var(--muted);
		line-height: 1.8;
		margin: 10px 0 0;
	}
	.answer {
		margin-top: 20px;
		border-top: 1px solid var(--line);
		padding-top: 18px;
	}
	.answer-heading {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
		color: var(--lavender);
	}
	.answer-heading strong {
		color: var(--ink);
		font-size: 11px;
		font-weight: 550;
	}
	.answer-heading > span {
		color: var(--quiet);
		font-size: 9px;
	}
	.answer-text {
		white-space: pre-wrap;
		overflow-wrap: anywhere;
		color: var(--ink);
		font-size: 12px;
		line-height: 1.8;
		margin: 14px 0;
	}
	.grade-list {
		display: grid;
		gap: 8px;
		padding: 13px;
		border-radius: 10px;
		background: var(--surface);
	}
	.grade-list > div {
		display: flex;
		justify-content: space-between;
		gap: 15px;
		color: var(--muted);
		font-size: 10px;
		line-height: 1.6;
	}
	.grade-list b {
		font-weight: 500;
		color: var(--lavender);
		flex-shrink: 0;
	}
	.grade-caveat {
		color: var(--quiet);
		font-size: 10px;
		line-height: 1.8;
		margin: 12px 0;
	}
	.reference {
		margin-top: 17px;
	}
	.generation-row {
		display: flex;
		align-items: center;
		gap: 22px;
		margin-top: 23px;
	}
	.generation-row button {
		flex-shrink: 0;
	}
	.generation-row p {
		color: var(--quiet);
		font-size: 11px;
		line-height: 1.8;
		margin: 0;
	}
	.empty {
		padding: 25px;
		background: var(--lab-inset);
		border-radius: 16px;
		display: flex;
		gap: 16px;
		align-items: center;
		color: var(--lavender);
	}
	.empty :global(svg) {
		flex-shrink: 0;
	}
	.empty p {
		color: var(--muted);
		font-size: 12px;
		line-height: 1.8;
		margin: 0;
	}
	.practice {
		display: flex;
		gap: 12px;
		color: var(--lavender);
		margin: 23px 0 0;
		align-items: flex-start;
	}
	.practice :global(svg) {
		flex-shrink: 0;
		margin-top: 3px;
	}
	.practice p {
		color: var(--muted);
		font-size: 12px;
		line-height: 1.8;
		margin: 0;
	}
	.practice strong {
		font-weight: 550;
		color: var(--ink);
	}
	.method {
		border-top: 1px solid var(--line);
		margin-top: 22px;
		padding-top: 16px;
	}
	.method p {
		color: var(--muted);
		font-size: 11px;
		line-height: 1.8;
		margin: 12px 0 0;
	}
	@container (max-width: 710px) {
		.workspace {
			grid-template-columns: 1fr;
		}
		.cases {
			display: grid;
			grid-template-columns: 1fr 1fr;
		}
		.summary {
			grid-template-columns: 150px 1fr;
			gap: 23px;
		}
		.generation-row {
			flex-direction: column;
			align-items: flex-start;
			gap: 13px;
		}
	}
	@container (max-width: 440px) {
		.controls {
			padding: 17px;
			gap: 20px;
		}
		.mode-control button {
			padding: 9px 10px;
			font-size: 10px;
		}
		.withhold {
			max-width: none;
		}
		.run-row {
			gap: 12px;
		}
		.run-row .text-button {
			margin-left: 0;
		}
		.summary {
			grid-template-columns: 1fr;
			gap: 15px;
			padding: 18px;
		}
		.cases button {
			padding: 12px;
			gap: 8px;
		}
		.cases button span {
			font-size: 10px;
		}
		.cases small {
			font-size: 9px;
		}
		.case-detail {
			padding: 18px;
		}
		.grade-list > div {
			flex-direction: column;
			gap: 2px;
		}
	}
</style>
