<script lang="ts">
	import { Tween, prefersReducedMotion } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import PatternIcon from './PatternIcon.svelte';
	import {
		generalizationData,
		generalizationModels,
		underlyingPattern
	} from '$lib/ml/generalization';

	let selected = $state(2),
		noise = $state(1),
		seed = $state(6);
	let showTruth = $state(false),
		residuals = $state(true);
	let plotWidth = $state(800);
	const uid = $props.id();
	const data = $derived(generalizationData(noise, seed));
	const models = $derived(generalizationModels(data));
	const labels = $derived(['Underfit', 'Generalize', noise === 0 ? 'Flexible fit' : 'Overfit']);
	const descriptions = $derived([
		'Too simple to follow the pattern.',
		'Enough flexibility to follow the pattern, without chasing every dot.',
		noise === 0
			? 'Without noise, the flexible model recovers the pattern too.'
			: 'Every training dot is right. The predictions between them go wrong.'
	]);
	const glyphs = [
		'M2 23L38 9',
		'M2 25Q20 -8 38 25',
		'M2 24C7 -16 9 40 15 18S23 34 28 15S33 -8 38 25'
	];
	const samples = Array.from({ length: 801 }, (_, i) => -1 + i / 400);
	const extent = $derived.by(() => {
		const values = [...data.map((p) => p.y), ...models.flatMap((m) => samples.map(m.predict))];
		return {
			min: Math.floor(Math.min(...values) - 0.1),
			max: Math.ceil(Math.max(...values) + 0.1)
		};
	});
	// One tween keeps the curve, observations, residuals and axes in the same frame.
	const frame = Tween.of(
		() => ({
			curve: samples.map(models[selected].predict),
			observations: data.map((p) => p.y),
			predictions: data.map((p) => models[selected].predict(p.x)),
			min: extent.min,
			max: extent.max
		}),
		{ duration: () => (prefersReducedMotion.current ? 0 : 480), easing: cubicInOut }
	);
	const chartWidth = $derived(Math.max(240, plotWidth));
	// Keep the plotted area near 2:1 on desktop so vertical errors stay legible.
	const chartHeight = $derived(Math.max(280, Math.min(520, chartWidth * 0.56)));
	const left = 32,
		right = 16,
		top = 16;
	const bottom = $derived(chartHeight - 30);
	const x = (v: number) => left + ((v + 1) / 2) * (chartWidth - left - right);
	const y = (v: number) =>
		bottom - ((v - frame.current.min) / (frame.current.max - frame.current.min)) * (bottom - top);
	const path = $derived(
		frame.current.curve.map((v, i) => `${i ? 'L' : 'M'}${x(samples[i])},${y(v)}`).join(' ')
	);
	const truth = $derived(
		samples.map((v, i) => `${i ? 'L' : 'M'}${x(v)},${y(underlyingPattern(v))}`).join(' ')
	);
	const best = $derived(
		models.reduce((a, m, i) => (m.validation < models[a].validation - 1e-8 ? i : a), 0)
	);
	const scores = $derived([
		{
			name: 'Training',
			count: 11,
			purpose: 'Used to fit',
			value: models[selected].train,
			color: 'var(--chart-blue)',
			shape: 'circle'
		},
		{
			name: 'Validation',
			count: 20,
			purpose: 'Used to choose',
			value: models[selected].validation,
			color: 'var(--muted)',
			shape: 'square'
		},
		{
			name: 'Test',
			count: 20,
			purpose: 'Never used to fit',
			value: models[selected].test,
			color: 'var(--chart-lavender)',
			shape: 'diamond'
		}
	]);
	const largestError = $derived(
		Math.max(0.01, ...models.flatMap((m) => [m.train, m.validation, m.test]))
	);
	const comparison = $derived(
		noise === 0 ? null : models[selected].test / Math.max(1e-12, models[best].test)
	);
</script>

<section class="generalization-lab" aria-label="Generalization with exact fitted curves">
	<header class="fit-header">
		<h3>Learning, or just remembering?</h3>
		<p>{descriptions[selected]}</p>
		<p>
			This worked example exposes all three splits to explain the fit. Use the sealed-test challenge
			below to make an independent final choice.
		</p>
	</header>

	<div class="fit-toolbar">
		<div class="fit-choices" role="group" aria-label="Model flexibility">
			{#each labels as label, i (i)}
				<button aria-pressed={selected === i} onclick={() => (selected = i)}>
					<svg viewBox="0 0 40 32" aria-hidden="true"><path d={glyphs[i]} /></svg>
					<span>{label}</span>
				</button>
			{/each}
		</div>
		<div class="data-controls">
			<label class="noise-control"
				><span>Noise <output>{noise.toFixed(1)}×</output></span>
				<input
					type="range"
					min="0"
					max="2"
					step="0.1"
					aria-label="Observation noise"
					bind:value={noise}
				/>
			</label>
			<button
				class="resample"
				aria-label="Draw another noise sample"
				title="Draw another noise sample"
				onclick={() => seed++}><PatternIcon name="shuffle" size={17} /></button
			>
		</div>
	</div>

	<div class="fit-figure">
		<div class="plot-heading">
			<div class="model-description">
				<span class="model-formula" aria-label={`Polynomial of degree ${models[selected].degree}`}>
					<i>ŷ</i> = <i>w</i><sub>0</sub> + <i>w</i><sub>1</sub><i>x</i>{#if selected === 1}
						+ <i>w</i><sub>2</sub><i>x</i><sup>2</sup>{:else if selected === 2}
						+ … + <i>w</i><sub>10</sub><i>x</i><sup>10</sup>{/if}
				</span>
				<span class="parameter-count">{models[selected].degree + 1} learned weights</span>
			</div>
			<span class="axis-note">Shared scale</span>
		</div>
		<div class="chart-container" bind:clientWidth={plotWidth}>
			<svg
				class="fit-chart"
				viewBox={`0 0 ${chartWidth} ${chartHeight}`}
				role="img"
				aria-label={`${labels[selected]}: training error ${models[selected].train.toFixed(4)}, test error ${models[selected].test.toFixed(4)}. Filled circles are training observations, small squares are validation observations, and open diamonds are unseen test observations.`}
			>
				<defs
					><clipPath id={`${uid}-plot`}
						><rect
							x={left - 6}
							y="4"
							width={chartWidth - left - right + 12}
							height={bottom + 2}
						/></clipPath
					></defs
				>
				{#each [0, 1, 2, 3, 4] as tick (tick)}
					{@const value = frame.current.min + ((frame.current.max - frame.current.min) * tick) / 4}
					<line x1={left} x2={chartWidth - right} y1={y(value)} y2={y(value)} class="grid-line" />
					<text x={left - 10} y={y(value) + 3.5} text-anchor="end">{value.toFixed(1)}</text>
				{/each}
				<g clip-path={`url(#${uid}-plot)`}>
					{#if showTruth}<path d={truth} class="truth" />{/if}
					{#if residuals}
						{#each data as p, i (i)}
							{#if p.split === 'test'}<line
									class="residual"
									x1={x(p.x)}
									x2={x(p.x)}
									y1={y(frame.current.observations[i])}
									y2={y(frame.current.predictions[i])}
								/>{/if}
						{/each}
					{/if}
					<path d={path} class="fit-line" />
					{#each data as p, i (i)}
						{@const py = y(frame.current.observations[i])}
						{#if p.split === 'train'}
							<circle cx={x(p.x)} cy={py} r="4" class="train-point"
								><title
									>Training: {p.y.toFixed(3)}; predicted {models[selected]
										.predict(p.x)
										.toFixed(3)}</title
								></circle
							>
						{:else if p.split === 'test'}
							<path d={`M${x(p.x)},${py - 4.3}l4.3,4.3 -4.3,4.3 -4.3,-4.3Z`} class="test-point"
								><title
									>Unseen test: {p.y.toFixed(3)}; predicted {models[selected]
										.predict(p.x)
										.toFixed(3)}</title
								></path
							>
						{:else}<rect x={x(p.x) - 2} y={py - 2} width="4" height="4" class="val-point" />{/if}
					{/each}
				</g>
				{#each [-1, -0.5, 0, 0.5, 1] as tick (tick)}<text
						x={x(tick)}
						y={chartHeight - 8}
						text-anchor="middle">{tick}</text
					>{/each}
			</svg>
		</div>
		<div class="plot-tools">
			<span class="error-key"><i></i> Distance from prediction to test point</span>
			<div role="group" aria-label="Chart overlays">
				<button aria-pressed={residuals} onclick={() => (residuals = !residuals)}
					><span class="toggle-mark"><PatternIcon name="check" size={11} /></span>Test errors</button
				>
				<button aria-pressed={showTruth} onclick={() => (showTruth = !showTruth)}
					><span class="toggle-mark"><PatternIcon name="check" size={11} /></span>True pattern</button
				>
			</div>
		</div>
	</div>

	<div class="error-summary">
		<div class="score-strip">
			{#each scores as score (score.name)}
				<div class="error-metric" style:--score-color={score.color}>
					<div class="metric-label">
						<i class={score.shape}></i><span>{score.name}</span><small>{score.count}</small>
					</div>
					<strong data-testid={score.name === 'Test' ? 'generalization-test-error' : undefined}
						>{score.value.toFixed(3)}</strong
					>
					<div class="error-track" aria-hidden="true">
						<i style:width={`${(100 * score.value) / largestError}%`}></i>
					</div>
					<span class="metric-purpose">{score.purpose}</span>
				</div>
			{/each}
		</div>
		<div class="score-caption">
			<span>Mean squared error <span aria-hidden="true">↓</span></span><span>Lower is better</span>
		</div>
	</div>

	<footer>
		<PatternIcon name="generalization" size={18} />
		<p>
			{#if comparison !== null && comparison > 1.05}<strong
					>{comparison.toFixed(0)}× the test error</strong
				> of the model favored by validation.{:else if noise === 0 && selected === 0}Even without
				noise, a straight line cannot follow the arch.{:else if noise === 0}No noise to memorize.
				Flexibility alone does not cause overfitting.{:else}Validation favors this model. The test
				set independently checks how well it generalizes.{/if}
			<span class="sampling-note"
				>{noise === 0
					? 'Near ties favor fewer weights.'
					: 'A deliberately difficult noise sample; only training points determine the curves.'}</span
			>
		</p>
	</footer>
</section>

<style>
	.generalization-lab {
		width: 100%;
		max-width: 1040px;
		margin-inline: auto;
		background: var(--surface);
		border-radius: 24px;
		padding: clamp(20px, 3vw, 36px);
		container-type: inline-size;
	}
	.fit-header {
		margin-bottom: 22px;
	}
	h3 {
		margin: 0 0 8px;
		font: italic clamp(30px, 3vw, 43px)/1.1 var(--serif);
		letter-spacing: -0.025em;
	}
	.fit-header p {
		color: var(--muted);
		font-size: 13px;
		line-height: 1.6;
		margin: 0;
	}
	.fit-toolbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 24px;
		margin-bottom: 20px;
	}
	.fit-choices {
		display: flex;
		gap: 3px;
		padding: 4px;
		background: var(--lab-inset);
		border-radius: 13px;
	}
	.fit-choices button {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		padding: 6px 15px;
		min-height: 40px;
		border: 0;
		border-radius: 10px;
		background: transparent;
		color: var(--muted);
		font-size: 12px;
		font-weight: 550;
		white-space: nowrap;
		transition:
			color 180ms,
			background 180ms,
			box-shadow 180ms;
	}
	.fit-choices button:hover {
		color: var(--ink);
	}
	.fit-choices button[aria-pressed='true'] {
		background: var(--action-gradient);
		color: var(--control-ink);
		box-shadow:
			inset 0 1px 0 #ffffff24,
			0 2px 5px #14243f12;
	}
	.fit-choices svg {
		width: 28px;
		height: 27px;
		fill: none;
		stroke: currentColor;
		stroke-width: 2;
		stroke-linecap: round;
	}
	.data-controls {
		display: flex;
		align-items: center;
		gap: 14px;
	}
	.noise-control {
		display: flex;
		align-items: center;
		gap: 14px;
	}
	.noise-control > span {
		display: grid;
		gap: 2px;
		font-size: 11px;
		color: var(--muted);
	}
	.noise-control output {
		color: var(--ink);
		font: 10px var(--mono);
	}
	.noise-control input {
		width: 110px;
		height: 22px;
		min-height: 22px;
		padding: 0;
		margin: 0;
	}
	.resample {
		display: grid;
		place-items: center;
		width: 36px;
		height: 36px;
		padding: 0;
		border: 0;
		border-radius: 50%;
		color: var(--muted);
		background: transparent;
	}
	.resample:hover {
		color: var(--ink);
		background: var(--lab-inset);
	}
	.fit-figure {
		min-width: 0;
	}
	.plot-heading {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		margin-bottom: 12px;
	}
	.model-description {
		display: flex;
		align-items: center;
		gap: 14px;
	}
	.model-formula {
		font: 17px var(--serif);
		color: var(--ink);
		white-space: nowrap;
	}
	.model-formula sub,
	.model-formula sup {
		font-size: 10px;
	}
	.parameter-count,
	.axis-note {
		font-size: 10px;
		color: var(--quiet);
	}
	.chart-container {
		width: 100%;
		min-width: 0;
	}
	.fit-chart {
		display: block;
		width: 100%;
		height: auto;
		overflow: visible;
	}
	.fit-chart text {
		font: 10px var(--mono);
		fill: var(--quiet);
	}
	.grid-line {
		stroke: var(--line);
		stroke-width: 1;
		stroke-dasharray: 2 5;
	}
	.fit-line {
		fill: none;
		stroke: var(--chart-blue);
		stroke-width: 2.5;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.truth {
		fill: none;
		stroke: var(--muted);
		stroke-dasharray: 7 6;
		stroke-width: 1.5;
		opacity: 0.7;
	}
	.train-point {
		fill: var(--chart-blue);
		stroke: var(--surface);
		stroke-width: 1.5;
	}
	.test-point {
		fill: var(--surface);
		stroke: var(--chart-lavender);
		stroke-width: 1.6;
	}
	.val-point {
		fill: var(--muted);
		opacity: 0.6;
	}
	.residual {
		stroke: var(--chart-lavender);
		stroke-dasharray: 2 4;
		stroke-width: 1.2;
		opacity: 0.7;
	}
	.plot-tools {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		margin: 8px 0 18px;
	}
	.error-key {
		display: flex;
		align-items: center;
		gap: 7px;
		font-size: 10px;
		color: var(--quiet);
	}
	.error-key i {
		width: 20px;
		border-top: 1px dashed var(--chart-lavender);
	}
	.plot-tools > div {
		display: flex;
		gap: 15px;
	}
	.plot-tools button {
		display: flex;
		gap: 6px;
		align-items: center;
		border: 0;
		background: none;
		color: var(--muted);
		padding: 4px 0;
		font-size: 11px;
		min-height: 32px;
		white-space: nowrap;
	}
	.plot-tools button:hover {
		color: var(--ink);
	}
	.toggle-mark {
		width: 15px;
		height: 15px;
		border-radius: 5px;
		display: grid;
		place-items: center;
		box-shadow: inset 0 0 0 1px var(--line);
		color: transparent;
		background: var(--lab-inset);
	}
	button[aria-pressed='true'] .toggle-mark {
		background: var(--action-gradient);
		color: var(--control-ink);
		box-shadow: none;
	}
	.error-summary {
		padding: 16px 22px 12px;
		background: var(--lab-inset);
		border-radius: 15px;
	}
	.score-strip {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: clamp(18px, 5cqw, 70px);
	}
	.error-metric {
		min-width: 0;
		display: grid;
		grid-template-columns: 1fr auto;
		align-items: center;
		column-gap: 10px;
	}
	.metric-label {
		display: flex;
		align-items: center;
		gap: 7px;
		font-size: 12px;
		color: var(--muted);
	}
	.metric-label i {
		display: block;
		width: 6px;
		height: 6px;
		background: var(--score-color);
		flex-shrink: 0;
	}
	.metric-label .circle {
		border-radius: 50%;
	}
	.metric-label .diamond {
		transform: rotate(45deg);
		background: transparent;
		box-shadow: inset 0 0 0 1.5px var(--score-color);
	}
	.metric-label small {
		margin-left: 2px;
		font: 10px var(--mono);
		color: var(--quiet);
	}
	.error-metric strong {
		display: block;
		font: 25px var(--mono);
		letter-spacing: -0.055em;
		color: var(--score-color);
		margin: 0;
		font-variant-numeric: tabular-nums;
	}
	.error-track {
		grid-column: 1 / -1;
		margin-top: 10px;
		height: 3px;
		border-radius: 3px;
		overflow: hidden;
		background: color-mix(in srgb, var(--score-color) 9%, transparent);
	}
	.error-track i {
		display: block;
		height: 100%;
		border-radius: inherit;
		background: var(--score-color);
		transition: width 480ms cubic-bezier(0.65, 0, 0.35, 1);
	}
	.metric-purpose {
		grid-column: 1 / -1;
		display: block;
		margin-top: 9px;
		font-size: 10px;
		color: var(--quiet);
	}
	.score-caption {
		display: flex;
		justify-content: space-between;
		font-size: 9px;
		color: var(--quiet);
		margin-top: 12px;
	}
	footer {
		display: flex;
		gap: 10px;
		align-items: flex-start;
		color: var(--muted);
		margin-top: 20px;
	}
	footer :global(svg) {
		flex-shrink: 0;
		margin-top: 2px;
		color: var(--lavender);
	}
	footer p {
		margin: 0;
		font-size: 12px;
		line-height: 1.65;
	}
	footer strong {
		color: var(--ink);
		font-weight: 550;
	}
	.sampling-note {
		display: block;
		font-size: 10px;
		color: var(--quiet);
		margin-top: 3px;
	}
	@container (max-width: 740px) {
		.error-metric {
			display: block;
		}
		.error-metric strong {
			margin-top: 8px;
		}
		.fit-toolbar {
			gap: 18px;
		}
		.fit-choices button {
			padding-inline: 11px;
		}
		.fit-choices svg {
			width: 22px;
		}
		.noise-control {
			gap: 8px;
		}
		.noise-control input {
			width: 80px;
		}
		.data-controls {
			gap: 6px;
		}
		.error-key {
			display: none;
		}
		.plot-tools {
			justify-content: flex-end;
			margin-top: 4px;
		}
	}
	@container (max-width: 580px) {
		.fit-toolbar {
			flex-wrap: wrap;
			gap: 14px;
			margin-bottom: 18px;
		}
		.fit-choices {
			width: 100%;
		}
		.fit-choices button {
			flex: 1;
			padding-inline: 6px;
			gap: 6px;
		}
		.data-controls {
			width: 100%;
			justify-content: space-between;
		}
		.noise-control {
			flex: 1;
			gap: 16px;
		}
		.noise-control > span {
			display: flex;
			gap: 10px;
			align-items: center;
		}
		.noise-control input {
			flex: 1;
			max-width: 180px;
		}
		.model-description {
			gap: 5px;
			align-items: flex-start;
			flex-direction: column;
		}
		.model-formula {
			font-size: 16px;
		}
		.axis-note {
			font-size: 9px;
			white-space: nowrap;
			line-height: 1.5;
			text-align: right;
		}
		.fit-header {
			margin-bottom: 20px;
		}
		.fit-header p {
			font-size: 12px;
		}
		.error-summary {
			padding: 17px 14px 12px;
		}
		.score-strip {
			gap: 16px;
		}
		.metric-label {
			font-size: 10px;
			gap: 5px;
		}
		.metric-label small {
			display: none;
		}
		.error-metric strong {
			font-size: 21px;
			margin-block: 9px;
		}
		.metric-purpose {
			font-size: 9px;
			line-height: 1.5;
			min-height: 27px;
		}
		.score-caption {
			margin-top: 12px;
		}
		footer p {
			font-size: 11px;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.fit-choices button,
		.error-track i {
			transition: none;
		}
	}
</style>
