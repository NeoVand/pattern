<script lang="ts">
	import { fitChallenge, repeatChallenge } from '$lib/ml/generalization-challenge';
	import PatternIcon from './PatternIcon.svelte';
	let count = $state(12),
		degree = $state(10),
		penalty = $state(0),
		seed = $state(6);
	let committed = $state(false),
		trials = $state(0);
	let prediction = $state(''),
		reflection = $state('');
	let repetitions = $state<{ test: number; training: number }[]>([]);
	const result = $derived(fitChallenge({ count, degree, penalty, seed }));
	const px = (x: number) => 30 + (x + 1) * 260;
	const py = (y: number) => 150 - Math.max(-1.5, Math.min(1.5, y)) * 75;
	const path = $derived(
		Array.from({ length: 241 }, (_, i) => {
			const x = -1 + i / 120;
			return `${i ? 'L' : 'M'}${px(x)},${py(result.predict(x))}`;
		}).join(' ')
	);
	const average = $derived(
		repetitions.length ? repetitions.reduce((s, r) => s + r.test, 0) / repetitions.length : 0
	);
	function changed() {
		trials++;
		repetitions = [];
	}
	function restart() {
		seed++;
		committed = false;
		trials = 0;
		repetitions = [];
	}
</script>

<section class="challenge" aria-label="Independent model selection experiment">
	<header>
		<span class="small-overline">YOUR TURN · CHOOSE BEFORE YOU LOOK</span>
		<h3>Can you repair the fit?</h3>
		<p>Use training and validation to choose. Commit once to reveal 200 untouched test examples.</p>
	</header>
	<div class="workspace">
		<div class="figure">
			<svg
				viewBox="0 0 580 280"
				role="img"
				aria-label="Fitted curve with training circles and validation squares. Vertical range minus 1.5 to 1.5; extreme predictions are clipped visually but errors use full values."
			>
				<line x1="30" x2="550" y1="150" y2="150" stroke="var(--plot-line)" />
				<path d={path} fill="none" stroke="var(--chart-lavender)" stroke-width="2.5" />
				{#each result.data.validation as p, i (i)}<rect
						x={px(p.x) - 2}
						y={py(p.y) - 2}
						width="4"
						height="4"
						fill="var(--chart-lavender)"
					/>{/each}
				{#each result.data.train as p, i (i)}<circle
						cx={px(p.x)}
						cy={py(p.y)}
						r="4"
						fill="var(--chart-blue)"
					/>{/each}
				<text x="30" y="270">−1</text><text x="540" y="270">+1</text><text x="270" y="270"
					>Input</text
				>
			</svg>
			<p>● Training · ■ Validation · same input range and noise process</p>
			<div class="metrics">
				<div><span>Training MSE</span><strong>{result.training.toFixed(3)}</strong></div>
				<div><span>Validation MSE</span><strong>{result.validation.toFixed(3)}</strong></div>
				<div>
					<span>Test MSE</span><strong data-testid="independent-test"
						>{committed ? result.test.toFixed(3) : 'Sealed'}</strong
					>
				</div>
			</div>
		</div>
		<div class="controls">
			<label
				>Training examples<select bind:value={count} disabled={committed} onchange={changed}
					>{#each [12, 24, 60, 120] as n (n)}<option value={n}>{n}</option>{/each}</select
				></label
			>
			<label
				>Polynomial degree<select bind:value={degree} disabled={committed} onchange={changed}
					>{#each [1, 2, 3, 5, 10] as n (n)}<option value={n}>{n}</option>{/each}</select
				></label
			>
			<label
				>Weight penalty<select bind:value={penalty} disabled={committed} onchange={changed}
					>{#each [0, 0.001, 0.01, 0.1, 1] as n (n)}<option value={n}>{n}</option>{/each}</select
				></label
			>
			<p>
				The objective is mean squared error + penalty × sum of squared coefficients, including the
				intercept. A larger penalty discourages large weights. It can also underfit.
			</p>
			<button class="primary-button" disabled={committed} onclick={() => (committed = true)}
				><PatternIcon name="lock" size={15} />{committed
					? 'Choice committed'
					: 'Commit & reveal test'}</button
			>
			<button class="text-button" onclick={restart}
				><PatternIcon name="shuffle" size={14} />Fresh experiment</button
			>
		</div>
	</div>
	<p class="explanation">
		{trials} setting changes consulted this validation set. Repeated tuning can fit its quirks. The test
		score is hidden until the choice is fixed; continuing the experiment requires a fresh sample. More
		examples preserve the training prefix and leave both held-out sets unchanged.
	</p>
	{#if committed}<div class="repeat">
			<button
				class="text-button"
				onclick={() => (repetitions = repeatChallenge({ count, degree, penalty, seed }))}
				>Repeat this fixed choice on 20 samples</button
			>{#if repetitions.length}<p>
					Mean test MSE <strong>{average.toFixed(3)}</strong> · range {Math.min(
						...repetitions.map((r) => r.test)
					).toFixed(3)}–{Math.max(...repetitions.map((r) => r.test)).toFixed(3)}. These are now
					exploratory results; selecting another configuration needs new final evidence.
				</p>
				<div class="replicates">
					{#each repetitions as r, i (i)}<span
							title={`Sample ${i + 1}: test MSE ${r.test.toFixed(4)}`}
							style:height={`${10 + 60 * Math.min(1, r.test / Math.max(...repetitions.map((t) => t.test)))}px`}
						></span>{/each}
				</div>{/if}
		</div>{/if}
	<div class="reflection">
		<label
			>Predict before changing a setting<textarea
				bind:value={prediction}
				placeholder="Which change should help, and why?"
				rows="2"></textarea></label
		><label
			>Explain the result<textarea
				bind:value={reflection}
				placeholder="What changed? What evidence could overturn your explanation?"
				rows="2"></textarea></label
		>
	</div>
</section>

<style>
	.challenge {
		margin-top: 32px;
		padding: clamp(20px, 3vw, 34px);
		border-radius: 24px;
		background: var(--surface);
		color: var(--ink);
	}
	h3 {
		font: italic clamp(28px, 3vw, 40px)/1.15 var(--serif);
		margin: 10px 0;
	}
	.challenge p {
		font-size: 12px;
		line-height: 1.7;
		color: var(--muted);
	}
	.workspace {
		display: grid;
		grid-template-columns: minmax(0, 1.65fr) minmax(210px, 1fr);
		gap: 24px;
		margin-top: 24px;
	}
	.figure {
		min-width: 0;
	}
	svg {
		width: 100%;
		background: var(--plot);
		border-radius: 16px;
	}
	svg text {
		fill: var(--plot-muted);
		font: 11px var(--sans);
	}
	.metrics {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 12px;
		margin-top: 20px;
	}
	.metrics span {
		display: block;
		color: var(--muted);
		font-size: 10px;
	}
	.metrics strong {
		font: 22px var(--mono);
	}
	.controls {
		display: grid;
		gap: 12px;
		align-content: start;
	}
	label {
		display: grid;
		gap: 7px;
		font-size: 12px;
		color: var(--muted);
	}
	select,
	textarea {
		width: 100%;
		background: var(--input);
		color: var(--ink);
		border: 1px solid var(--line);
		border-radius: 10px;
		padding: 10px;
		font: 12px var(--sans);
	}
	.explanation {
		margin-top: 22px;
	}
	.reflection {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 18px;
		margin-top: 24px;
	}
	.repeat {
		background: var(--lab-inset);
		padding: 16px;
		border-radius: 14px;
	}
	.replicates {
		display: flex;
		gap: 5px;
		align-items: end;
		height: 75px;
	}
	.replicates span {
		flex: 1;
		background: var(--chart-lavender);
		border-radius: 3px;
	}
	@media (max-width: 680px) {
		.workspace,
		.reflection {
			grid-template-columns: 1fr;
		}
		.metrics {
			gap: 8px;
		}
		.metrics strong {
			font-size: 19px;
		}
	}
</style>
