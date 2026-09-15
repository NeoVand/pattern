<script lang="ts">
	import PatternIcon from './PatternIcon.svelte';
	import ChoiceGroup from './ChoiceGroup.svelte';
	import {
		causalIntervention,
		runDistributionShift,
		shiftDefaults,
		shiftProbability,
		type ShiftSettings
	} from '$lib/ml/distribution-shift';

	let settings = $state<ShiftSettings>({ ...shiftDefaults });
	let view = $state<'source' | 'shift'>('source');
	let extraDrinks = $state(20);
	const result = $derived(runDistributionShift(settings));
	const shown = $derived(view === 'source' ? result.sourceScore : result.shiftScore);
	const chartPoints = $derived(shown.predictions.slice(0, 120));
	const colors = ['var(--chart-blue)', 'var(--chart-lavender)'];
	const x = (core: number) => 44 + ((core + 3.8) / 7.6) * 454;
	const y = (background: number) => 268 - ((background + 1.4) / 2.8) * 236;
	const percent = (value: number | null) => (value === null ? '—' : `${Math.round(value * 100)}%`);
	const regions = $derived(
		Array.from({ length: 24 * 14 }, (_, id) => {
			const col = id % 24,
				row = Math.floor(id / 24);
			const core = -3.8 + ((col + 0.5) * 7.6) / 24;
			const background = 1.4 - ((row + 0.5) * 2.8) / 14;
			const probability = shiftProbability(result.model, { core, background });
			return { id, x: 44 + (col * 454) / 24, y: 32 + (row * 236) / 14, probability };
		})
	);
	const causal = $derived(causalIntervention(extraDrinks));
</script>

<section class="shift-lab" aria-label="Distribution shift experiment">
	<header>
		<div>
			<span class="small-overline">SAME TASK · DIFFERENT CONDITIONS</span>
			<h3>Did it learn the shape, or the background?</h3>
		</div>
		<button class="text-button" onclick={() => settings.seed++}
			><PatternIcon name="shuffle" size={15} />New sample</button
		>
	</header>
	<p class="intro">
		Two classes have different, noisy shape measurements. In the source collection, a background
		color usually gives away the class. Train a small classifier, then take the same model somewhere
		that relationship reverses.
	</p>

	<div class="workspace">
		<div class="chart-panel">
			<ChoiceGroup
				label="Inspect independent examples"
				value={view}
				options={[
					{ value: 'source', label: 'Original setting' },
					{ value: 'shift', label: 'Reversed background' }
				]}
				onchange={(value) => (view = value)}
			/>
			<svg
				class="shift-chart"
				viewBox="0 0 528 313"
				role="img"
				aria-label={`First 120 evaluation examples from the ${view === 'source' ? 'original' : 'reversed-background'} setting. Circles are class A, squares class B. Horizontal position is the shape measurement; vertical position is the background. Pale regions show the learned prediction.`}
			>
				{#each regions as region (region.id)}<rect
						x={region.x}
						y={region.y}
						width={454 / 24 + 0.1}
						height={236 / 14 + 0.1}
						fill={colors[Number(region.probability >= 0.5)]}
						opacity={0.025 + Math.abs(region.probability - 0.5) * 0.15}
					/>{/each}
				{#each [-3, -1.5, 0, 1.5, 3] as tick (tick)}<line
						x1={x(tick)}
						x2={x(tick)}
						y1="32"
						y2="268"
						class="grid-line"
					/><text x={x(tick)} y="286" text-anchor="middle">{tick}</text>{/each}
				<text x="49" y="21">Lavender background</text><text x="49" y="258">Blue background</text>
				{#each chartPoints as point (point.id)}
					{#if point.label === 0}<circle
							cx={x(point.core)}
							cy={y(point.background)}
							r="4"
							fill={colors[0]}
							stroke={point.prediction !== point.label ? 'var(--plot-ink)' : 'none'}
							stroke-width="1.2"
						/>
					{:else}<rect
							x={x(point.core) - 3.6}
							y={y(point.background) - 3.6}
							width="7.2"
							height="7.2"
							rx="1"
							fill={colors[1]}
							stroke={point.prediction !== point.label ? 'var(--plot-ink)' : 'none'}
							stroke-width="1.2"
						/>{/if}
				{/each}
				<text x="270" y="310" text-anchor="middle">Shape measurement →</text>
			</svg>
			<div class="chart-legend">
				<span><i class="class-a"></i>Class A</span><span><i class="class-b"></i>Class B</span><span
					><i class="mistake"></i>Wrong prediction</span
				>
			</div>
			<p class="chart-note">
				120 of 400 independent examples shown. All 400 count toward the score. Switching the view
				keeps the learned weights fixed.
			</p>
		</div>
		<aside class="controls">
			<ChoiceGroup
				label="Training examples"
				value={settings.size}
				options={[
					{ value: 120, label: '120' },
					{ value: 960, label: '960 · 8× more' }
				]}
				onchange={(value) => (settings.size = value)}
			/>
			<ChoiceGroup
				label="Where training data comes from"
				value={settings.diverse}
				options={[
					{ value: false, label: 'Original only' },
					{ value: true, label: 'Varied backgrounds' }
				]}
				onchange={(value) => (settings.diverse = value)}
			/>
			<p>
				{settings.diverse
					? 'Backgrounds match classes about half the time. The model must find a more reliable relationship.'
					: 'Backgrounds match classes about 95% of the time. The shortcut works here.'}
			</p>
			<label class="feature-toggle"
				><input type="checkbox" bind:checked={settings.useBackground} /><span
					>Let the model use background</span
				></label
			>
			<div class="weights">
				<strong>Learned coefficients</strong><span
					>Shape <b>{result.model.weights[0].toFixed(2)}</b></span
				><span>Background <b>{result.model.weights[1].toFixed(2)}</b></span><span
					>Bias <b>{result.model.bias.toFixed(2)}</b></span
				><small>500 gradient updates · logistic regression</small>
			</div>
		</aside>
	</div>

	<div class="scores" aria-live="polite">
		<div>
			<span>Original setting</span><strong data-testid="shift-source-score"
				>{percent(result.sourceScore.accuracy)}</strong
			><small>{result.sourceScore.correct} / 400 correct</small>
		</div>
		<PatternIcon name="arrowRight" size={23} />
		<div>
			<span>Reversed background</span><strong data-testid="shift-target-score"
				>{percent(result.shiftScore.accuracy)}</strong
			><small>{result.shiftScore.correct} / 400 correct</small>
		</div>
		<p>
			The shape relationship stays the same. Only the link between class and background changes.
		</p>
	</div>
	<div class="practice">
		<PatternIcon name="idea" size={19} />
		<p>
			<strong>Predict → observe → explain.</strong> Predict whether eight times as much source data will
			fix the reversed-background score. Compare that with 120 varied examples. Explain which relationship
			the additional examples teach.
		</p>
	</div>

	<details class="group-details">
		<summary>Who gets the mistakes? Inspect all four groups</summary>
		<div
			class="group-table"
			role="table"
			aria-label="Accuracy for each class and background group in reversed conditions"
		>
			<div class="group-row group-head" role="row">
				<span role="columnheader">Class &amp; background</span><span role="columnheader"
					>In training</span
				><span role="columnheader">Reversed setting</span>
			</div>
			{#each result.groups as group (group.id)}<div class="group-row" role="row">
					<span role="cell"
						>Class {group.label === 0 ? 'A' : 'B'}<small
							>{group.backgroundClass === 0 ? 'Blue' : 'Lavender'} background</small
						></span
					><span role="cell">{group.source}<small>examples</small></span><span role="cell"
						><b>{percent(group.accuracy)}</b><small>{group.correct} / {group.total} correct</small
						></span
					>
				</div>{/each}
		</div>
		<p>
			Overall accuracy averages across these groups. A small, poorly served group can disappear
			inside an impressive average. Small groups also produce less stable estimates; check their
			counts.
		</p>
	</details>

	<div class="causal-panel">
		<div class="causal-heading">
			<PatternIcon name="forecasting" size={19} />
			<div>
				<span class="small-overline">A DIFFERENT QUESTION</span>
				<h4>Will changing the input change the outcome?</h4>
			</div>
		</div>
		<p>
			In this invented café, warm days cause more cold-drink sales and more patio visits. A
			regression of visits on drinks learns a useful association. Now intervene on drink sales while
			keeping the weather fixed.
		</p>
		<div
			class="mechanism"
			aria-label="Temperature causes both drink sales and patio visits. Drinks have no direct effect on visits in this supplied mechanism."
		>
			<span>Cold-drink sales</span><PatternIcon name="arrowLeft" size={17} /><strong
				>Temperature</strong
			><PatternIcon name="arrowRight" size={17} /><span>Patio visits</span>
		</div>
		<label class="intervention"
			><span>Extra drinks sold per day<output>+{extraDrinks}</output></span><input
				type="range"
				aria-label="Extra drinks sold per day"
				min="0"
				max="40"
				step="5"
				bind:value={extraDrinks}
			/></label
		>
		<div class="causal-results">
			<div>
				<span>Regression predicts</span><strong data-testid="causal-prediction"
					>{causal.predictedVisits.toFixed(1)}</strong
				><small>visits per day</small>
			</div>
			<div>
				<span>Supplied mechanism produces</span><strong data-testid="causal-intervention"
					>{causal.intervenedVisits.toFixed(1)}</strong
				><small>visits per day</small>
			</div>
		</div>
		<p class="causal-reading">
			The prediction changes by {(causal.slope * extraDrinks).toFixed(1)} visits. The intervention changes
			visits by {(causal.intervenedVisits - causal.meanVisits).toFixed(1)}.
			<strong
				>This conclusion comes from the specified mechanism, not from the correlation alone.</strong
			> Real causal claims need justified assumptions or an appropriate experiment.
		</p>
	</div>
	<details class="method">
		<summary>The two synthetic mechanisms, and their limits</summary>
		<p>
			<strong>Classification:</strong> class A and B are equally frequent. Shape = −0.8 or +0.8 according
			to class, plus the sum of six independent uniform random values minus 3. Background = −1 or +1 plus
			small noise. It agrees with class with probability 0.95 in the original setting, 0.05 in the changed
			setting, and 0.5 in varied training. Training minimizes binary cross-entropy with an L2 weight penalty
			of 0.015; no evaluation examples enter gradient updates. The model is fitted again whenever training
			controls change. Scores are exploratory evaluations; using them repeatedly for choices would require
			another untouched test before deployment.
		</p>
		<p>
			<strong>Causal illustration:</strong> for 160 generated days, temperature T ranges from 10 to 30.
			Drinks = 30 + 2(T − 20) + independent noise; visits = 45 + 3(T − 20) + independent noise. Ordinary
			least squares fits visits from drinks. The intervention replaces each day’s drink value with drinks
			+ your increment, preserving its temperature and visit noise. There is no drinks → visits term in
			this mechanism. Changing drinks would have a different effect in a world with that causal link;
			observational association alone cannot settle which world applies.
		</p>
	</details>
</section>

<style>
	.shift-lab {
		background: var(--surface);
		border-radius: 24px;
		padding: clamp(20px, 3vw, 38px);
		container-type: inline-size;
	}
	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 20px;
	}
	h3 {
		font: italic 400 clamp(30px, 3.2vw, 44px) var(--serif);
		margin: 9px 0 0;
	}
	header button {
		white-space: nowrap;
		font-size: 12px;
	}
	.intro {
		color: var(--muted);
		font-size: 13px;
		line-height: 1.8;
		margin: 17px 0 24px;
		max-width: 800px;
	}
	.workspace {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 258px;
		gap: 24px;
	}
	.chart-panel {
		min-width: 0;
	}
	.chart-panel :global(.choice-group) {
		margin: 0 0 14px;
	}
	.chart-panel :global(.choice-group legend) {
		font-size: 11px;
	}
	.chart-panel :global(.choice-group button) {
		font-size: 11px;
		padding: 9px 12px;
	}
	.shift-chart {
		display: block;
		width: 100%;
		height: auto;
	}
	.shift-chart text {
		font: 10px var(--sans);
		fill: var(--plot-muted);
	}
	.grid-line {
		stroke: var(--plot-line);
		stroke-width: 0.5;
		opacity: 0.55;
	}
	.chart-legend {
		display: flex;
		flex-wrap: wrap;
		gap: 16px;
		font-size: 10px;
		color: var(--muted);
		margin: 14px 0 10px;
	}
	.chart-legend > span {
		display: flex;
		align-items: center;
		gap: 6px;
	}
	.chart-legend i {
		width: 7px;
		height: 7px;
		display: block;
	}
	.class-a {
		border-radius: 50%;
		background: var(--chart-blue);
	}
	.class-b {
		border-radius: 1px;
		background: var(--chart-lavender);
	}
	.mistake {
		border: 1px solid var(--plot-ink);
		border-radius: 50%;
	}
	.chart-note {
		color: var(--quiet);
		font-size: 10px;
		line-height: 1.7;
		margin: 0;
	}
	.controls {
		background: var(--lab-inset);
		border-radius: 16px;
		padding: 20px;
	}
	.controls :global(.choice-group) {
		margin: 0 0 22px;
	}
	.controls :global(.choice-group legend) {
		font-size: 11px;
		margin-bottom: 10px;
	}
	.controls :global(.choice-group button) {
		font-size: 10px;
		padding: 9px 10px;
	}
	.controls p {
		font-size: 11px;
		color: var(--muted);
		line-height: 1.7;
		margin: -9px 0 18px;
	}
	.feature-toggle {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 11px;
		color: var(--muted);
		cursor: pointer;
		line-height: 1.5;
	}
	.feature-toggle input {
		min-width: 16px;
		min-height: 16px;
	}
	input:focus-visible {
		outline: 2px solid var(--focus);
		outline-offset: 3px;
	}
	.weights {
		display: grid;
		gap: 10px;
		border-top: 1px solid var(--line);
		padding-top: 16px;
		margin-top: 20px;
	}
	.weights strong {
		font-size: 11px;
		color: var(--ink);
		font-weight: 550;
		margin-bottom: 4px;
	}
	.weights > span {
		display: flex;
		justify-content: space-between;
		color: var(--muted);
		font-size: 11px;
	}
	.weights b {
		color: var(--lavender);
		font: 12px var(--mono);
	}
	.weights small {
		color: var(--quiet);
		font-size: 9px;
		line-height: 1.7;
	}
	.scores {
		display: grid;
		grid-template-columns: 1fr auto 1fr 1.2fr;
		gap: 25px;
		align-items: center;
		margin-top: 24px;
		padding: 23px;
		border: 1px solid var(--line);
		border-radius: 16px;
		color: var(--quiet);
	}
	.scores span,
	.causal-results span {
		font-size: 11px;
		color: var(--muted);
	}
	.scores strong {
		display: block;
		font: 34px var(--mono);
		color: var(--training);
		margin: 8px 0;
	}
	.scores > div:nth-of-type(2) strong {
		color: var(--test);
	}
	.scores small {
		font-size: 10px;
		color: var(--quiet);
	}
	.scores p {
		margin: 0;
		font-size: 11px;
		color: var(--muted);
		line-height: 1.8;
	}
	.practice {
		display: flex;
		gap: 12px;
		color: var(--lavender);
		margin: 22px 0;
		align-items: flex-start;
	}
	.practice :global(svg) {
		flex-shrink: 0;
		margin-top: 3px;
	}
	.practice p {
		margin: 0;
		font-size: 12px;
		color: var(--muted);
		line-height: 1.8;
	}
	.practice strong,
	.method strong,
	.causal-reading strong {
		font-weight: 550;
		color: var(--ink);
	}
	summary {
		color: var(--blue);
		font-size: 11px;
		cursor: pointer;
		line-height: 1.7;
	}
	.group-details {
		padding-top: 16px;
		border-top: 1px solid var(--line);
	}
	.group-table {
		margin-top: 17px;
	}
	.group-row {
		display: grid;
		grid-template-columns: 1.4fr 1fr 1fr;
		gap: 15px;
		align-items: center;
		border-bottom: 1px solid var(--line);
		padding: 12px 0;
		font-size: 12px;
		color: var(--ink);
	}
	.group-row small {
		display: block;
		color: var(--quiet);
		font-size: 10px;
		margin-top: 5px;
	}
	.group-row b {
		font: 14px var(--mono);
		color: var(--test);
	}
	.group-head {
		color: var(--muted);
		font-size: 10px;
	}
	.group-details p {
		font-size: 11px;
		color: var(--muted);
		line-height: 1.8;
	}
	.causal-panel {
		background: var(--lab-inset);
		padding: 24px;
		margin-top: 24px;
		border-radius: 16px;
	}
	.causal-heading {
		display: flex;
		align-items: center;
		gap: 12px;
		color: var(--lavender);
	}
	.causal-heading :global(svg) {
		flex-shrink: 0;
	}
	.causal-heading .small-overline {
		font-size: 9px;
	}
	h4 {
		margin: 5px 0 0;
		font-size: 15px;
		font-weight: 500;
		color: var(--ink);
	}
	.causal-panel p {
		color: var(--muted);
		font-size: 12px;
		line-height: 1.8;
		margin: 17px 0;
	}
	.mechanism {
		display: grid;
		grid-template-columns: 1fr auto 1fr auto 1fr;
		gap: 12px;
		align-items: center;
		color: var(--quiet);
		margin: 24px 0;
	}
	.mechanism > span,
	.mechanism > strong {
		border: 1px solid var(--line);
		background: var(--surface);
		padding: 15px 10px;
		text-align: center;
		color: var(--muted);
		font-size: 11px;
		font-weight: 400;
		border-radius: 10px;
	}
	.mechanism > strong {
		color: var(--lavender);
	}
	.intervention {
		display: block;
		max-width: 380px;
		margin: 22px 0;
	}
	.intervention > span {
		display: flex;
		justify-content: space-between;
		color: var(--muted);
		font-size: 11px;
	}
	.intervention output {
		font-family: var(--mono);
		color: var(--blue);
	}
	.intervention input {
		display: block;
		width: 100%;
		min-height: 28px;
		margin: 6px 0 0;
	}
	.causal-results {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 20px;
	}
	.causal-results > div {
		border-left: 2px solid var(--lavender);
		padding-left: 15px;
	}
	.causal-results > div:last-child {
		border-color: var(--blue);
	}
	.causal-results strong {
		display: block;
		color: var(--lavender);
		font: 28px var(--mono);
		margin: 9px 0 6px;
	}
	.causal-results > div:last-child strong {
		color: var(--blue);
	}
	.causal-results small {
		color: var(--quiet);
		font-size: 10px;
	}
	.causal-panel .causal-reading {
		margin-bottom: 0;
		font-size: 11px;
	}
	.method {
		border-top: 1px solid var(--line);
		margin-top: 22px;
		padding-top: 16px;
	}
	.method p {
		margin: 12px 0 0;
		color: var(--muted);
		font-size: 11px;
		line-height: 1.8;
	}
	@container (max-width: 730px) {
		.workspace {
			grid-template-columns: 1fr;
		}
		.controls {
			display: grid;
			grid-template-columns: 1fr 1fr;
			gap: 0 24px;
		}
		.controls p {
			grid-column: 2;
		}
		.feature-toggle {
			grid-column: 1;
			grid-row: 2;
		}
		.weights {
			grid-column: 1/-1;
			grid-template-columns: 1fr 1fr 1fr;
			margin-top: 10px;
		}
		.weights strong,
		.weights small {
			grid-column: 1/-1;
		}
		.weights > span {
			gap: 14px;
		}
		.scores {
			grid-template-columns: 1fr auto 1fr;
		}
		.scores p {
			grid-column: 1/-1;
		}
	}
	@container (max-width: 450px) {
		header {
			flex-direction: column;
			align-items: flex-start;
			gap: 12px;
		}
		.controls {
			display: block;
			padding: 17px;
		}
		.weights {
			margin-top: 18px;
		}
		.scores {
			padding: 17px;
			gap: 16px;
		}
		.scores span {
			font-size: 10px;
		}
		.scores strong {
			font-size: 28px;
		}
		.scores small {
			font-size: 9px;
		}
		.causal-panel {
			padding: 17px;
		}
		.mechanism {
			gap: 5px;
			grid-template-columns: 1fr auto 1fr auto 1fr;
		}
		.mechanism > span,
		.mechanism > strong {
			padding: 12px 4px;
			font-size: 9px;
		}
		.causal-results {
			gap: 12px;
		}
		.causal-results span {
			display: block;
			min-height: 30px;
			font-size: 10px;
		}
		.group-row {
			gap: 10px;
			font-size: 11px;
		}
		.group-head {
			font-size: 9px;
		}
	}
</style>
