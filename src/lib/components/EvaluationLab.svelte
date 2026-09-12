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
	import ModelConnection from './ModelConnection.svelte';
	import PatternIcon from './PatternIcon.svelte';
	let { ai }: { ai: AiSession } = $props();
	type CaseResult = {
		id: string;
		output: string;
		status: 'waiting' | 'running' | 'passed' | 'failed' | 'error' | 'stopped';
		elapsedMs: number;
		error?: string;
	};
	type Run = {
		id: number;
		style: EvaluationStyle;
		model: string;
		provider: string;
		startedAt: string;
		prompt: string;
		status: 'running' | 'complete' | 'stopped' | 'error';
		elapsedMs: number;
		results: CaseResult[];
	};
	let style = $state<EvaluationStyle>('brief');
	let runs = $state<Run[]>([]);
	let running = $state(false);
	let error = $state('');
	let selectedId = $state(0);
	let serial = 0;
	let controller: AbortController | undefined;
	const selected = $derived(runs.find((run) => run.id === selectedId));
	const latestBrief = $derived(runs.find((run) => run.style === 'brief'));
	const latestCareful = $derived(runs.find((run) => run.style === 'careful'));
	const activeCount = $derived(
		selected?.results.filter((result) => ['passed', 'failed'].includes(result.status)).length ?? 0
	);
	function countPassed(run: Run) {
		return run.results.filter((result) => result.status === 'passed').length;
	}
	function readableStatus(status: CaseResult['status']) {
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
		selectedId = ++serial;
		const nextRun: Run = {
			id: selectedId,
			style,
			model: ai.label,
			provider: ai.provider,
			startedAt: new Date().toISOString(),
			prompt: evaluationPrompts[style],
			status: 'running',
			elapsedMs: 0,
			results: evaluationCases.map((item) => ({
				id: item.id,
				output: '',
				status: 'waiting',
				elapsedMs: 0
			}))
		};
		runs = [nextRun, ...runs].slice(0, 6);
		const run = runs[0];
		const start = performance.now();
		try {
			for (const item of evaluationCases) {
				signal.throwIfAborted();
				const result = run.results.find((entry) => entry.id === item.id)!;
				result.status = 'running';
				const caseStart = performance.now();
				try {
					const completion = await ai.generate({
						messages: [
							{ role: 'system', content: run.prompt },
							{ role: 'user', content: item.prompt }
						],
						temperature: 0,
						maxTokens: 140,
						signal,
						onText: (chunk) => (result.output += chunk)
					});
					result.output = completion.text;
					result.status = scoreEvaluation(item.criterion, result.output) ? 'passed' : 'failed';
				} catch (cause) {
					if (signal.aborted) result.status = 'stopped';
					else {
						result.status = 'error';
						result.error = cause instanceof Error ? cause.message : String(cause);
					}
					throw cause;
				} finally {
					result.elapsedMs = Math.round(performance.now() - caseStart);
				}
			}
			run.status = 'complete';
		} catch (cause) {
			run.status = signal.aborted ? 'stopped' : 'error';
			if (!signal.aborted) error = cause instanceof Error ? cause.message : String(cause);
		} finally {
			run.elapsedMs = Math.round(performance.now() - start);
			running = false;
		}
	}
	function saveRun() {
		if (!selected) return;
		const artifact = {
			...$state.snapshot(selected),
			cases: evaluationCases,
			note: 'Six visible teaching cases; this is not an estimate of general model reliability.'
		};
		const url = URL.createObjectURL(
			new Blob([JSON.stringify(artifact, null, 2)], { type: 'application/json' })
		);
		const link = document.createElement('a');
		link.href = url;
		link.download = `pattern-evaluation-${selected.style}-${selected.startedAt.replaceAll(':', '-')}.json`;
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
			<p>Give the same six tasks to two prompts. Check what actually came back.</p>
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
			<div class="evaluation-actions">
				<button
					class="primary-button"
					disabled={!running && ai.busy}
					onclick={() => (running ? controller?.abort() : runSuite())}
				>
					{running ? 'Stop evaluation' : ai.ready ? 'Run six checks' : 'Connect a model'}
					{#if !running}<PatternIcon name="arrowRight" size={17} />{/if}
				</button>
				<span>Six real requests · no model judge</span>
			</div>
		</div>
	</div>
	<div class="comparison-strip">
		{#each [{ name: 'Brief prompt', run: latestBrief }, { name: 'Careful prompt', run: latestCareful }] as item (item.name)}
			<button
				disabled={!item.run || running}
				class:chosen={!!item.run && selectedId === item.run.id}
				onclick={() => {
					if (item.run) selectedId = item.run.id;
				}}
				aria-label={`View ${item.name.toLowerCase()} results`}
			>
				<span>{item.name}</span>
				<strong>{item.run ? countPassed(item.run) : '—'}<small>/ 6</small></strong>
				<span
					>{item.run
						? item.run.status === 'complete'
							? 'checks passed'
							: item.run.status === 'running'
								? 'in progress'
								: `${item.run.status} · partial run`
						: 'ready to test'}</span
				>
			</button>
		{/each}
		<p>
			Six visible cases reveal specific failures. They cannot establish how reliable a model is on
			every future task.
		</p>
	</div>
	{#if runs.length > 1}
		<div class="run-history" role="group" aria-label="Recent evaluation runs">
			<span>Recent runs</span>
			{#each runs as run (run.id)}
				<button
					disabled={running}
					aria-pressed={selectedId === run.id}
					aria-label={`View run ${run.id}: ${run.style} prompt, ${run.status}`}
					onclick={() => (selectedId = run.id)}
				>
					Run {run.id} · {run.style} · {run.status === 'complete'
						? `${countPassed(run)}/6`
						: run.status}
				</button>
			{/each}
		</div>
	{/if}
	{#if error}<p class="error-notice" role="alert">{error}</p>{/if}
	<div class="evaluation-progress" role="status">
		<span
			>{selected
				? `${activeCount} of 6 checks completed${selected.status === 'running' ? '…' : ''}`
				: 'The expectations are visible before you run.'}</span
		>
		{#if selected}<span
				>{selected.model} · {selected.elapsedMs
					? `${(selected.elapsedMs / 1000).toFixed(1)} s`
					: 'running'}</span
			>{/if}
	</div>
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
				</details>
			</article>
		{/each}
	</div>
	{#if selected}
		<div class="run-record">
			<div>
				<strong>Run record</strong>
				<p>
					{new Date(selected.startedAt).toLocaleString()} · {selected.provider} · {selected.model}
				</p>
			</div>
			<button class="record-download" onclick={saveRun} disabled={running}
				>Save results as JSON <PatternIcon name="arrowRight" size={16} /></button
			>
		</div>
		<details class="saved-prompt">
			<summary>Prompt used for this run</summary>
			<p>{selected.prompt}</p>
		</details>
	{/if}
	<p class="evaluation-takeaway">
		A prompt change is a hypothesis. Tests help you check it. Once you tune against these cases, use
		fresh examples for the final evaluation.
	</p>
</div>

<style>
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
