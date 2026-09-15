<script lang="ts">
	import { onDestroy } from 'svelte';
	import type { AiSession } from '$lib/ai/session.svelte';
	import {
		evaluationCases,
		evaluationPrompts,
		criterionDescription,
		expectedAnswer,
		scoreEvaluation,
		type EvaluationStyle
	} from '$lib/ai/evaluation-suite';
	import {
		countEvaluationPasses,
		evaluationCohort,
		evaluationSuiteSignature,
		isCompleteEvaluation,
		type EvaluationCaseResult,
		type EvaluationRun
	} from '$lib/ai/evaluation-runs';
	import ModelConnection from './ModelConnection.svelte';
	import PatternIcon from './PatternIcon.svelte';
	let { ai }: { ai: AiSession } = $props();
	const uid = $props.id();
	let style = $state<EvaluationStyle>('brief');
	let repeats = $state(1);
	let runs = $state<EvaluationRun[]>([]);
	let running = $state(false);
	let error = $state('');
	let selectedId = $state(0);
	let activeBatch = $state(0);
	let serial = 0,
		batchSerial = 0;
	let controller: AbortController | undefined;
	const currentModelId = $derived(ai.provider === 'openai' ? ai.openaiModel : ai.localModel);
	const selected = $derived(runs.find((run) => run.id === selectedId));
	const cohort = $derived(selected ? evaluationCohort(runs, selected) : null);
	const comparison = $derived(
		['brief', 'careful'].map((promptStyle) => {
			const matching = runs.filter(
				(run) =>
					run.style === promptStyle &&
					run.provider === ai.provider &&
					run.modelId === currentModelId &&
					run.prompt === evaluationPrompts[promptStyle as EvaluationStyle]
			);
			const reference = matching.find(isCompleteEvaluation) ?? matching[0];
			return {
				name: promptStyle === 'brief' ? 'Brief prompt' : 'Careful prompt',
				run: reference,
				summary: reference ? evaluationCohort(runs, reference) : null
			};
		})
	);
	const activeCount = $derived(
		selected?.results.filter((result) => ['passed', 'failed'].includes(result.status)).length ?? 0
	);
	const batchRuns = $derived(runs.filter((run) => run.batchId === activeBatch));
	const batchCompleted = $derived(
		batchRuns.reduce(
			(sum, run) =>
				sum + run.results.filter((result) => ['passed', 'failed'].includes(result.status)).length,
			0
		)
	);
	function readableStatus(status: EvaluationCaseResult['status']) {
		return {
			waiting: 'Not run',
			running: 'Generating…',
			passed: 'Passed',
			failed: 'Did not pass',
			error: 'Request error',
			stopped: 'Stopped'
		}[status];
	}
	async function runSuite() {
		if (running || ai.busy) return;
		if (!ai.ready) {
			ai.settingsOpen = true;
			return;
		}
		running = true;
		error = '';
		controller = new AbortController();
		const signal = controller.signal;
		activeBatch = ++batchSerial;
		const planned: EvaluationRun[] = Array.from({ length: repeats }, (_, index) => ({
			id: ++serial,
			batchId: activeBatch,
			trial: index + 1,
			requestedTrials: repeats,
			style,
			model: ai.label,
			modelId: currentModelId,
			provider: ai.provider,
			startedAt: null,
			prompt: evaluationPrompts[style],
			temperature: 0,
			maxTokens: 140,
			suiteSignature: evaluationSuiteSignature,
			status: 'queued',
			elapsedMs: 0,
			results: evaluationCases.map((item) => ({
				id: item.id,
				output: '',
				status: 'waiting',
				elapsedMs: 0
			}))
		}));
		runs = [...planned.toReversed(), ...runs];
		selectedId = planned[0].id;
		try {
			for (const plannedRun of planned) {
				signal.throwIfAborted();
				const run = runs.find((entry) => entry.id === plannedRun.id)!;
				selectedId = run.id;
				run.status = 'running';
				run.startedAt = new Date().toISOString();
				const start = performance.now();
				try {
					for (const item of evaluationCases) {
						signal.throwIfAborted();
						if (ai.provider !== run.provider || currentModelId !== run.modelId)
							throw new Error(
								'The connected model changed. This batch stopped so different models are not mixed in one trial.'
							);
						const result = run.results.find((entry) => entry.id === item.id)!;
						result.status = 'running';
						const caseStart = performance.now();
						try {
							const completion = await ai.generate({
								messages: [
									{ role: 'system', content: run.prompt },
									{ role: 'user', content: item.prompt }
								],
								temperature: run.temperature,
								maxTokens: run.maxTokens,
								signal,
								onText: (chunk) => {
									if (!signal.aborted) result.output += chunk;
								},
								onRequest: (request) => {
									result.request = request;
								}
							});
							signal.throwIfAborted();
							result.output = completion.text;
							if (result.request?.model && result.request.model !== run.modelId)
								throw new Error(
									'The request used a different model than the recorded trial. This trial is excluded.'
								);
							result.status = scoreEvaluation(item.criterion, result.output) ? 'passed' : 'failed';
						} catch (cause) {
							result.status = signal.aborted ? 'stopped' : 'error';
							if (!signal.aborted)
								result.error = cause instanceof Error ? cause.message : String(cause);
							throw cause;
						} finally {
							result.elapsedMs = Math.round(performance.now() - caseStart);
						}
					}
					run.status = 'complete';
				} catch (cause) {
					run.status = signal.aborted ? 'stopped' : 'error';
					run.stopReason = signal.aborted
						? 'Cancelled by the learner.'
						: cause instanceof Error
							? cause.message
							: String(cause);
					throw cause;
				} finally {
					run.elapsedMs = Math.round(performance.now() - start);
				}
			}
		} catch (cause) {
			if (!signal.aborted) error = cause instanceof Error ? cause.message : String(cause);
			for (const run of runs.filter(
				(entry) => entry.batchId === activeBatch && entry.status === 'queued'
			)) {
				run.status = 'stopped';
				run.stopReason = signal.aborted
					? 'Cancelled before this trial started.'
					: 'Not started because an earlier trial encountered an error.';
			}
		} finally {
			running = false;
		}
	}
	function saveRun() {
		const artifact = {
			schemaVersion: 2,
			exportedAt: new Date().toISOString(),
			selectedRunId: selectedId,
			runs: $state.snapshot(runs),
			cases: evaluationCases,
			note: 'Repeated fixed teaching cases measure output variability on these cases, not population reliability. Aggregates exclude incomplete trials and separate provider, model ID, exact system prompt, suite, and generation settings.'
		};
		const url = URL.createObjectURL(
			new Blob([JSON.stringify(artifact, null, 2)], { type: 'application/json' })
		);
		const link = document.createElement('a');
		link.href = url;
		link.download = `pattern-evaluation-trials-${new Date().toISOString().replaceAll(':', '-')}.json`;
		link.click();
		setTimeout(() => URL.revokeObjectURL(url), 1000);
	}
	onDestroy(() => controller?.abort());
</script>

<div class="evaluation-lab">
	<ModelConnection {ai} />
	<div class="evaluation-workbench">
		<div class="evaluation-intro">
			<h2>A beautiful answer<br /><em>is only the beginning.</em></h2>
			<p>
				Give the same six tasks to two prompts. Repeat a trial to see whether the outputs and scores
				vary.
			</p>
		</div>
		<div class="evaluation-controls">
			<div class="prompt-styles" role="group" aria-label="Evaluation prompt style">
				<button
					aria-pressed={style === 'brief'}
					disabled={running}
					onclick={() => (style = 'brief')}>Brief prompt</button
				>
				<button
					aria-pressed={style === 'careful'}
					disabled={running}
					onclick={() => (style = 'careful')}>Careful prompt</button
				>
			</div>
			<p class="system-preview">{evaluationPrompts[style]}</p>
			<div class="trial-controls">
				<label for={`${uid}-repeats`}>Repeated trials</label><select
					id={`${uid}-repeats`}
					bind:value={repeats}
					disabled={running}
					><option value={1}>1 trial · 6 real requests</option><option value={3}
						>3 trials · 18 real requests</option
					></select
				>
				<p>
					Each trial makes six separate calls. Temperature is requested at 0; local decoding is
					greedy. Some model endpoints omit temperature. Every transmitted request is saved below.
				</p>
			</div>
			<div class="evaluation-actions">
				<button
					class="primary-button"
					disabled={!running && ai.busy}
					onclick={() => (running ? controller?.abort() : runSuite())}
				>
					{running
						? 'Stop evaluation'
						: ai.ready
							? repeats === 1
								? 'Run six checks'
								: 'Run three trials'
							: 'Connect a model'}
					{#if !running}<PatternIcon name="arrowRight" size={17} />{/if}
				</button>
				<span>{repeats * 6} real requests · no model judge</span>
			</div>
		</div>
	</div>
	<div class="comparison-strip">
		{#each comparison as item (item.name)}
			<button
				disabled={!item.run || running}
				class:chosen={!!item.run && selectedId === item.run.id}
				onclick={() => {
					if (item.run) selectedId = item.run.id;
				}}
				aria-label={`View ${item.name.toLowerCase()} results`}
			>
				<span>{item.name}</span>
				<strong>{item.summary?.mean?.toFixed(1) ?? '—'}<small>/ 6</small></strong>
				<span>{item.summary?.completed.length ?? 0} completed trials · mean checks passed</span>
			</button>
		{/each}
		<p>
			Cards compare completed trials for the currently connected provider and model. Repeating these
			fixed cases measures output variability, not reliability across future tasks.
		</p>
	</div>
	{#if runs.length > 1}
		<div class="run-history" role="group" aria-label="All evaluation trials">
			<span>All trials</span>
			{#each runs as run (run.id)}
				<button
					disabled={running}
					aria-pressed={selectedId === run.id}
					aria-label={`View run ${run.id}: batch ${run.batchId}, trial ${run.trial}, ${run.style} prompt, ${run.status}`}
					onclick={() => (selectedId = run.id)}
				>
					Batch {run.batchId} / trial {run.trial} · {run.style} · {run.status === 'complete'
						? `${countEvaluationPasses(run)}/6`
						: run.status}
				</button>
			{/each}
		</div>
	{/if}
	{#if error}<p class="error-notice" role="alert">{error}</p>{/if}
	<div class="evaluation-progress" role="status" aria-label="Evaluation progress">
		<span
			>{selected
				? `Batch ${selected.batchId}, trial ${selected.trial} of ${selected.requestedTrials}: ${activeCount} of 6 checks completed${selected.status === 'running' ? '…' : ''}`
				: 'The expectations are visible before you run.'}</span
		>
		{#if selected}<span
				>{selected.model} · {selected.elapsedMs
					? `${(selected.elapsedMs / 1000).toFixed(1)} s`
					: 'running'}</span
			>{/if}
	</div>
	{#if running}<p class="batch-progress">
			Batch progress: {batchCompleted} / {batchRuns.length * 6} checks completed.
		</p>{/if}
	{#if selected?.stopReason}<p class="error-notice">{selected.stopReason}</p>{/if}
	{#if cohort && selected}<section class="trial-summary" aria-label="Matching trial summary">
			<div class="summary-heading">
				<h3>Variation across matching trials</h3>
				<span
					>{cohort.completed.length} complete · {cohort.excluded} incomplete excluded{cohort.differentSettings
						? ` · ${cohort.differentSettings} with different transmitted settings excluded`
						: ''}</span
				>
			</div>
			<p>
				{selected.provider} · {selected.modelId} · {selected.style} prompt · requested temperature {selected.temperature}.
				Only the same exact prompt, provider, model, suite, and generation settings are combined.
			</p>
			{#if cohort.completed.length}<div class="trial-scores">
					<span>Checks passed in each complete trial:</span
					>{#each cohort.scores as trial (trial.id)}<button
							disabled={running}
							onclick={() => (selectedId = trial.id)}
							aria-label={`Inspect completed trial ${trial.id}`}
							>Batch {trial.batchId} / {trial.trial}<strong>{trial.passed} / 6</strong></button
						>{/each}
				</div>
				<p class="variation">
					Mean {cohort.mean?.toFixed(2)} / 6 · observed range {cohort.minimum}–{cohort.maximum} / 6
				</p>
				<div class="case-counts">
					{#each cohort.cases as item (item.id)}<div>
							<span>{item.title}</span><strong>{item.passed} / {item.total} passed</strong>
						</div>{/each}
				</div>{:else}<p>
					No complete matching trial is available. Partial runs remain inspectable and are excluded
					from these counts.
				</p>{/if}
			<p>
				Repeated fixed teaching cases measure output variability on these prompts. These counts are
				not an estimate of population reliability. Temperature zero can still produce variation on
				some systems; identical repeats do not establish general reliability.
			</p>
		</section>{/if}
	<div class="evaluation-cases">
		{#each evaluationCases as item, index (item.id)}
			{@const result = selected?.results.find((entry) => entry.id === item.id)}
			<article class="evaluation-case" class:is-running={result?.status === 'running'}>
				<div class="case-kicker">
					<span>{String(index + 1).padStart(2, '0')} / {item.skill}</span><span
						class={`case-status ${result?.status ?? 'waiting'}`}
						>{readableStatus(result?.status ?? 'waiting')}</span
					>
				</div>
				<h3>{item.title}</h3>
				<div class="answer-pair">
					<div><span>Expected</span><code>{expectedAnswer(item.criterion)}</code></div>
					<div>
						<span>Model returned</span><code class:empty={!result?.output}
							>{result?.output ||
								(result?.status === 'running' ? 'Waiting for the first token…' : '—')}</code
						>
					</div>
				</div>
				{#if result?.error}<p class="case-error">{result.error}</p>{/if}
				<details>
					<summary>Question & scoring rule</summary>
					<p class="case-question">{item.prompt}</p>
					<p><strong>Check:</strong> {criterionDescription(item.criterion)}</p>
					<p>{item.explanation}</p>
					{#if result?.request}<details class="request-record">
							<summary>Actual request for this case</summary>
							<pre>{JSON.stringify(result.request, null, 2)}</pre>
						</details>{/if}
				</details>
			</article>
		{/each}
	</div>
	{#if selected}
		<div class="run-record">
			<div>
				<strong>Run record</strong>
				<p>
					{selected.startedAt ? new Date(selected.startedAt).toLocaleString() : 'Not started'} · {selected.provider}
					· {selected.modelId} · batch {selected.batchId}, trial {selected.trial} · requested temperature
					{selected.temperature}
				</p>
			</div>
			<button class="record-download" onclick={saveRun} disabled={running}
				>Save all trials as JSON <PatternIcon name="arrowRight" size={16} /></button
			>
		</div>
		<details class="saved-prompt">
			<summary>Prompt used for this trial</summary>
			<p>{selected.prompt}</p>
		</details>
	{/if}
	<p class="evaluation-takeaway">
		A prompt change is a hypothesis. Tests help you check it. Once you tune against these cases, use
		fresh examples for the final evaluation.
	</p>
</div>

<style>
	.trial-controls {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 8px 14px;
		align-items: center;
		margin-top: 20px;
	}
	.trial-controls label {
		font-size: 11px;
		color: var(--muted);
	}
	.trial-controls select {
		min-width: 0;
		color: var(--ink);
		background: var(--surface);
		padding: 10px 12px;
		border: 1px solid var(--line);
		border-radius: 10px;
		font-size: 11px;
	}
	.trial-controls p {
		grid-column: 1 / -1;
		color: var(--quiet);
		font-size: 10px;
		line-height: 1.7;
		margin: 3px 0;
	}
	.batch-progress {
		font-size: 11px;
		color: var(--blue);
		margin: 0 4px 20px;
	}
	.trial-summary {
		background: var(--surface);
		border-radius: 22px;
		padding: 24px;
		margin: 24px 0;
		min-width: 0;
	}
	.summary-heading {
		display: flex;
		gap: 16px;
		align-items: center;
		justify-content: space-between;
		flex-wrap: wrap;
	}
	.summary-heading h3 {
		margin: 0;
	}
	.summary-heading > span {
		font-size: 10px;
		color: var(--lavender);
	}
	.trial-summary > p {
		font-size: 11px;
		line-height: 1.8;
		color: var(--muted);
		overflow-wrap: anywhere;
	}
	.trial-scores {
		display: flex;
		flex-wrap: wrap;
		gap: 9px;
		align-items: center;
		margin-top: 20px;
	}
	.trial-scores > span {
		color: var(--muted);
		font-size: 11px;
	}
	.trial-scores button {
		border: 1px solid var(--line);
		border-radius: 10px;
		background: var(--lab-inset);
		color: var(--muted);
		font-size: 10px;
		padding: 10px 14px;
	}
	.trial-scores strong {
		display: block;
		font: 19px var(--mono);
		color: var(--blue);
		margin-top: 7px;
	}
	.trial-summary .variation {
		color: var(--lavender);
		font-family: var(--mono);
	}
	.case-counts {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 7px 24px;
		margin: 20px 0;
	}
	.case-counts > div {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 15px;
		border-bottom: 1px solid var(--line);
		padding: 10px 0;
	}
	.case-counts span {
		color: var(--muted);
		font-size: 11px;
	}
	.case-counts strong {
		color: var(--blue);
		font: 11px var(--mono);
		white-space: nowrap;
	}
	.request-record pre {
		white-space: pre-wrap;
		overflow-wrap: anywhere;
		font: 10px/1.7 var(--mono);
		color: var(--muted);
		max-height: 320px;
		overflow-y: auto;
	}
	@media (max-width: 760px) {
		.case-counts {
			grid-template-columns: 1fr;
		}
	}
	@media (max-width: 420px) {
		.trial-controls {
			grid-template-columns: 1fr;
		}
		.trial-summary {
			padding: 18px;
		}
	}
	.evaluation-lab {
		margin-top: 24px;
	}
	.evaluation-workbench {
		display: grid;
		grid-template-columns: 1fr 1.1fr;
		gap: 40px;
		align-items: start;
		padding: 28px 0;
	}
	h2 {
		font-size: clamp(25px, 2.8vw, 39px);
		font-weight: 450;
		line-height: 1.18;
		letter-spacing: -1.5px;
		margin: 0 0 18px;
	}
	h2 em {
		font-family: 'Instrument Serif', serif;
		font-weight: 400;
		color: var(--green);
	}
	.evaluation-intro p,
	.system-preview {
		color: var(--muted);
		font-size: 14px;
		line-height: 1.7;
		margin: 0;
	}
	.prompt-styles {
		display: flex;
		gap: 5px;
		padding: 5px;
		border-radius: 100px;
		background: var(--surface);
		width: fit-content;
		margin-bottom: 20px;
	}
	.prompt-styles button {
		border: 0;
		background: transparent;
		border-radius: 100px;
		padding: 10px 17px;
		color: var(--muted);
		font-size: 12px;
	}
	.prompt-styles button[aria-pressed='true'] {
		color: var(--ink);
		background: var(--surface-raised);
		box-shadow: 0 3px 12px #0000000a;
	}
	.system-preview {
		min-height: 98px;
		font-size: 12px;
	}
	.evaluation-actions {
		display: flex;
		align-items: center;
		gap: 16px;
		margin-top: 20px;
	}
	.evaluation-actions .primary-button {
		width: auto;
		margin: 0;
		white-space: nowrap;
	}
	.evaluation-actions > span {
		color: var(--quiet);
		font-size: 11px;
		line-height: 1.5;
	}
	.comparison-strip {
		display: grid;
		grid-template-columns: 1fr 1fr 1.15fr;
		gap: 12px;
		align-items: center;
		margin: 10px 0 34px;
	}
	.comparison-strip button {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 9px;
		border: 0;
		border-radius: 22px;
		padding: 25px 28px;
		background: var(--surface);
		color: var(--ink);
		text-align: left;
		opacity: 1;
	}
	.comparison-strip button.chosen {
		background: color-mix(in srgb, var(--green) 12%, var(--surface));
	}
	.comparison-strip button > span {
		font-size: 12px;
		color: var(--muted);
	}
	.comparison-strip strong {
		font-family: 'Instrument Serif', serif;
		font-size: 56px;
		font-weight: 400;
		line-height: 1;
	}
	.comparison-strip strong small {
		font-family: 'DM Sans Variable', sans-serif;
		font-size: 18px;
		color: var(--quiet);
		margin-left: 9px;
	}
	.comparison-strip > p {
		color: var(--muted);
		font-size: 12px;
		line-height: 1.75;
		padding: 0 20px;
	}
	.evaluation-progress {
		display: flex;
		justify-content: space-between;
		gap: 18px;
		color: var(--muted);
		font-size: 11px;
		margin: 0 4px 17px;
	}
	.run-history {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 8px;
		margin: -8px 0 24px;
		font-size: 10px;
		color: var(--quiet);
	}
	.run-history > span {
		margin-right: 5px;
	}
	.run-history button {
		border: 0;
		border-radius: 24px;
		padding: 8px 11px;
		background: var(--surface);
		color: var(--muted);
		font-size: 10px;
	}
	.run-history button[aria-pressed='true'] {
		background: var(--accent-bg);
		color: var(--green);
	}
	.evaluation-cases {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 16px;
	}
	.evaluation-case {
		background: var(--surface);
		padding: 28px;
		border-radius: 22px;
		min-width: 0;
	}
	.evaluation-case.is-running {
		background: color-mix(in srgb, var(--green) 9%, var(--surface));
	}
	.case-kicker {
		display: flex;
		justify-content: space-between;
		align-items: center;
		flex-wrap: wrap;
		gap: 12px;
		color: var(--quiet);
		font-size: 10px;
	}
	.case-status {
		padding: 5px 9px;
		border-radius: 20px;
		background: var(--surface-raised);
	}
	.case-status.passed {
		color: var(--green);
		background: color-mix(in srgb, var(--green) 10%, var(--surface));
	}
	.case-status.failed,
	.case-status.error {
		color: var(--orange);
		background: color-mix(in srgb, var(--orange) 9%, var(--surface));
	}
	h3 {
		font-size: 17px;
		line-height: 1.4;
		font-weight: 500;
		letter-spacing: -0.35px;
		margin: 20px 0 25px;
	}
	.answer-pair {
		display: grid;
		gap: 18px;
	}
	.answer-pair > div > span {
		display: block;
		color: var(--quiet);
		font-size: 10px;
		margin-bottom: 7px;
	}
	.answer-pair code {
		display: block;
		color: var(--ink);
		font-size: 12px;
		line-height: 1.6;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
		font-family: 'JetBrains Mono Variable', monospace;
	}
	.answer-pair code.empty {
		color: var(--quiet);
	}
	details {
		margin-top: 25px;
	}
	summary {
		cursor: pointer;
		color: var(--muted);
		font-size: 11px;
		padding: 6px 0;
	}
	details p {
		color: var(--muted);
		font-size: 12px;
		line-height: 1.75;
		margin: 12px 0 0;
	}
	details p.case-question {
		color: var(--ink);
	}
	.case-error {
		color: var(--orange);
		font-size: 12px;
	}
	.run-record {
		display: flex;
		justify-content: space-between;
		gap: 20px;
		align-items: center;
		margin-top: 28px;
		padding: 8px;
	}
	.run-record strong {
		font-size: 12px;
		font-weight: 500;
	}
	.run-record p {
		color: var(--quiet);
		font-size: 11px;
		margin: 6px 0 0;
	}
	.record-download {
		display: flex;
		align-items: center;
		gap: 9px;
		background: transparent;
		border: 0;
		color: var(--green);
		font-size: 12px;
		padding: 10px 0;
	}
	.saved-prompt {
		margin: 8px;
	}
	.evaluation-takeaway {
		font-family: 'Instrument Serif', serif;
		font-size: 27px;
		line-height: 1.4;
		text-align: center;
		max-width: 730px;
		color: var(--muted);
		margin: 52px auto 15px;
	}
	@media (max-width: 1150px) {
		.evaluation-workbench {
			gap: 34px;
		}
		.evaluation-actions {
			flex-wrap: wrap;
			gap: 12px;
		}
	}
	@media (max-width: 760px) {
		.evaluation-workbench {
			grid-template-columns: 1fr;
			gap: 26px;
			padding: 32px 0;
		}
		.system-preview {
			min-height: 0;
		}
		.comparison-strip {
			grid-template-columns: 1fr 1fr;
		}
		.comparison-strip > p {
			grid-column: 1 / -1;
			padding: 0 5px;
			margin: 8px 0 0;
		}
		.evaluation-cases {
			grid-template-columns: 1fr;
		}
		.run-record {
			align-items: flex-start;
			flex-direction: column;
			gap: 8px;
		}
		.evaluation-progress {
			flex-wrap: wrap;
			gap: 7px;
		}
	}
	@media (max-width: 420px) {
		.comparison-strip button {
			padding: 23px 20px;
		}
		.evaluation-case {
			padding: 23px;
		}
		.case-kicker {
			font-size: 9px;
		}
	}
</style>
