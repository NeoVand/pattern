<script lang="ts">
	import PatternIcon from './PatternIcon.svelte';
	import ChoiceGroup from './ChoiceGroup.svelte';
	import {
		BENCHMARK_CALIBRATION_START,
		BENCHMARK_EVALUATION_START,
		benchmarkDefaults,
		runForecastBenchmark,
		type BenchmarkModel,
		type ForecastBenchmarkSettings
	} from '$lib/ml/forecast-benchmark';

	let settings = $state<ForecastBenchmarkSettings>({ ...benchmarkDefaults });
	let model = $state<BenchmarkModel>('seasonal');
	let inspect = $state(64);
	const result = $derived(runForecastBenchmark(settings));
	const selected = $derived(result.candidates.find((candidate) => candidate.id === model)!);
	const point = $derived(selected.evaluation[inspect - BENCHMARK_EVALUATION_START]);
	const bounds = $derived.by(() => {
		const values = [
			...result.values,
			...selected.evaluation.flatMap((p) => [
				p.prediction - selected.radius,
				p.prediction + selected.radius
			])
		];
		return {
			min: Math.floor((Math.min(...values) - 20) / 50) * 50,
			max: Math.ceil((Math.max(...values) + 20) / 50) * 50
		};
	});
	const x = (month: number) => 44 + (month / 71) * 504;
	const y = (value: number) => 270 - ((value - bounds.min) / (bounds.max - bounds.min)) * 225;
	const observedPath = $derived(
		result.values.map((value, i) => `${i ? 'L' : 'M'}${x(i)},${y(value)}`).join(' ')
	);
	const forecastPath = $derived(
		selected.evaluation.map((p, i) => `${i ? 'L' : 'M'}${x(p.target)},${y(p.prediction)}`).join(' ')
	);
	const interval = $derived(
		[
			...selected.evaluation.map((p) => `${x(p.target)},${y(p.prediction + selected.radius)}`),
			...selected.evaluation
				.toReversed()
				.map((p) => `${x(p.target)},${y(p.prediction - selected.radius)}`)
		].join(' ')
	);
	const percent = (value: number) => `${Math.round(value * 100)}%`;
</script>

<section class="benchmark-lab" aria-label="Forecast baseline benchmark">
	<header>
		<span class="small-overline">A FORECAST HAS TO EARN ITS COMPLEXITY</span>
		<h3>Can it beat “same month last year”?</h3>
	</header>
	<p class="intro">
		Compare five models on the same monthly sales history. Each prediction is made from a new
		starting date using only observations already available then. Change how far ahead they predict,
		or let the future change its pattern.
	</p>
	<div class="toolbar">
		<ChoiceGroup
			label="How far ahead?"
			value={settings.horizon}
			options={[
				{ value: 1, label: '1 month' },
				{ value: 6, label: '6 months' },
				{ value: 12, label: '12 months' }
			]}
			onchange={(value) => (settings.horizon = value)}
		/>
		<ChoiceGroup
			label="From month 58 onward"
			value={settings.regime}
			options={[
				{ value: 'stable', label: 'Same pattern' },
				{ value: 'level', label: 'Level jumps' },
				{ value: 'seasonality', label: 'Seasons reverse' }
			]}
			onchange={(value) => {
				settings.regime = value;
				if (value === 'seasonality') settings.shift = 90;
			}}
		/>
	</div>
	{#if settings.regime !== 'stable'}<label class="shift-control"
			><span
				>{settings.regime === 'level'
					? 'Added monthly sales'
					: 'Strength of season reversal'}<output
					>{settings.regime === 'level'
						? `+$${settings.shift}k`
						: percent(settings.shift / 90)}</output
				></span
			><input
				type="range"
				aria-label={settings.regime === 'level'
					? 'Added monthly sales'
					: 'Strength of season reversal'}
				min="0"
				max={settings.regime === 'level' ? 180 : 90}
				step="15"
				bind:value={settings.shift}
			/></label
		>{/if}

	<div class="workspace">
		<div class="chart-panel">
			<div class="chart-heading">
				<strong>{selected.label}</strong><span>{settings.horizon}-month-ahead forecasts</span>
			</div>
			<svg
				viewBox="0 0 575 316"
				class="forecast-chart"
				role="img"
				aria-label={`Monthly sales, ${selected.label} rolling forecasts, and an interval based on 15 earlier forecast errors. ${selected.covered} of 15 later outcomes fall inside the interval.`}
			>
				<rect
					x={x(BENCHMARK_CALIBRATION_START) - 3}
					y="34"
					width={x(BENCHMARK_EVALUATION_START) - x(BENCHMARK_CALIBRATION_START)}
					height="236"
					fill="var(--validation)"
					opacity="0.035"
				/>
				<rect
					x={x(BENCHMARK_EVALUATION_START) - 3}
					y="34"
					width={x(71) - x(BENCHMARK_EVALUATION_START) + 6}
					height="236"
					fill="var(--test)"
					opacity="0.055"
				/>
				<text x="47" y="20">Earlier history</text><text x={x(48)} y="20" text-anchor="middle"
					>Calibration</text
				><text x={x(64)} y="20" text-anchor="middle">Evaluation</text>
				{#each [0, 0.25, 0.5, 0.75, 1] as fraction (fraction)}{@const value =
						bounds.min + fraction * (bounds.max - bounds.min)}<line
						x1="44"
						x2="551"
						y1={y(value)}
						y2={y(value)}
						class="grid-line"
					/><text x="35" y={y(value) + 3} text-anchor="end">{Math.round(value)}</text>{/each}
				<polygon points={interval} fill="var(--lavender)" opacity="0.18" />
				<path d={observedPath} fill="none" stroke="var(--chart-blue)" stroke-width="1.7" />
				<path d={forecastPath} fill="none" stroke="var(--lavender)" stroke-width="2" />
				<line
					x1={x(point.origin - 1)}
					x2={x(point.origin - 1)}
					y1="35"
					y2="270"
					stroke="var(--quiet)"
					stroke-dasharray="3 4"
					opacity="0.7"
				/>
				<line
					x1={x(point.target)}
					x2={x(point.target)}
					y1="35"
					y2="270"
					stroke="var(--lavender)"
					stroke-dasharray="3 4"
					opacity="0.8"
				/>
				<circle
					cx={x(point.target)}
					cy={y(point.actual)}
					r="4"
					fill="var(--chart-blue)"
					stroke="var(--surface)"
					stroke-width="1.5"
				/>
				<circle
					cx={x(point.target)}
					cy={y(point.prediction)}
					r="4"
					fill="var(--lavender)"
					stroke="var(--surface)"
					stroke-width="1.5"
				/>
				{#each [0, 12, 24, 36, 48, 60, 71] as month (month)}<text
						x={x(month)}
						y="288"
						text-anchor="middle">{month + 1}</text
					>{/each}<text x="294" y="310" text-anchor="middle">MONTH · SALES IN $k</text>
			</svg>
			<div class="legend">
				<span><i class="actual"></i>Observed</span><span><i class="predicted"></i>Forecast</span
				><span><i class="interval"></i>Earlier-error interval</span>
			</div>
			<label class="inspect"
				><span>Inspect forecast for month <output>{inspect + 1}</output></span><input
					type="range"
					aria-label="Inspect benchmark forecast month"
					min={BENCHMARK_EVALUATION_START}
					max="71"
					step="1"
					bind:value={inspect}
				/></label
			>
			<div class="origin-reading" data-testid="forecast-origin">
				<PatternIcon name="lock" size={16} />
				<p>
					Known through month <strong>{point.origin}</strong><PatternIcon
						name="arrowRight"
						size={13}
					/>predict month <strong>{point.target + 1}</strong>. Its actual outcome is excluded from
					training.
				</p>
			</div>
		</div>
		<aside class="comparison">
			<div class="comparison-heading">
				<strong>Compare later errors</strong><span>MAE · $k ↓</span>
			</div>
			{#each result.candidates as candidate (candidate.id)}<button
					aria-pressed={model === candidate.id}
					aria-label={`Inspect ${candidate.label}`}
					onclick={() => (model = candidate.id)}
					><span>{candidate.label}</span><strong>{candidate.mae.toFixed(1)}</strong></button
				>{/each}
			<p>{selected.description}</p>
			<small
				>MAE averages the 15 absolute forecast errors for months 58–72. All models use identical
				origins and available history.</small
			>
		</aside>
	</div>

	<div class="interval-summary" aria-live="polite">
		<div>
			<span>Earlier error radius</span><strong>±{selected.radius.toFixed(1)}</strong><small
				>$k · calibrated on 15 earlier forecasts</small
			>
		</div>
		<div>
			<span>Later interval coverage</span><strong data-testid="forecast-coverage"
				>{percent(selected.coverage)}</strong
			><small>{selected.covered} of 15 actual outcomes inside</small>
		</div>
		<p>
			The interval uses the 90th percentile of earlier absolute errors. It assumes those errors
			remain representative. A new regime can make the interval much too narrow.
		</p>
	</div>
	<div class="practice">
		<PatternIcon name="idea" size={19} />
		<p>
			<strong>Predict → observe → explain.</strong> Predict which baseline will recover fastest after
			a level jump at a one-month horizon. Then try a twelve-month horizon and inspect the starting dates.
			Explain why the model cannot learn an event it has not yet observed.
		</p>
	</div>
	<details class="method">
		<summary>How chronological evaluation and intervals are computed</summary>
		<p>
			The series uses this course’s seasonal-sales generator: 72 months, a linear trend, a yearly
			cycle, and fixed synthetic noise. The final 15 months receive the selected level or seasonal
			change. Each horizon-h prediction for month t is fitted using only months through t − h. The
			origin moves forward for every target. Later fits may therefore use earlier revealed outcomes
			from the evaluation period, exactly as a repeatedly updated forecast would. No fit can use its
			own target or any later observation.
		</p>
		<p>
			Each candidate gets its own 15 calibration forecasts for months 43–57, using the same horizon
			and chronological rule. Their sorted absolute residuals supply the empirical 90th percentile
			(the 14th of 15 values). That fixed radius is added to and subtracted from all 15 later
			predictions. This is a small-sample empirical interval, not a guaranteed 90% coverage
			statement. Serial dependence, changing error size, and distribution shift can all invalidate
			the assumption that past errors predict future errors.
		</p>
		<p>
			The fitted candidates use the same LinearForecaster as the main lab, trained for 600 gradient
			updates at each origin. Baselines compute an average, a last observation, or the latest known
			matching calendar month. The period of 12 is supplied to both seasonal methods. These
			displayed results support exploration; choosing a model by these scores requires another
			untouched evaluation before a final performance claim.
		</p>
	</details>
</section>

<style>
	.benchmark-lab {
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
		max-width: 800px;
	}
	.toolbar {
		display: flex;
		gap: 24px;
		flex-wrap: wrap;
		padding: 19px 21px;
		background: var(--lab-inset);
		border-radius: 14px;
	}
	.toolbar :global(.choice-group) {
		margin: 0;
	}
	.toolbar :global(.choice-group legend) {
		font-size: 11px;
		margin-bottom: 10px;
	}
	.toolbar :global(.choice-group button) {
		font-size: 11px;
		padding: 9px 12px;
	}
	.shift-control {
		display: block;
		margin: 20px 0 0;
		max-width: 420px;
	}
	.shift-control span,
	.inspect span {
		display: flex;
		justify-content: space-between;
		color: var(--muted);
		font-size: 11px;
	}
	.shift-control output,
	.inspect output {
		color: var(--blue);
		font-family: var(--mono);
	}
	input[type='range'] {
		width: 100%;
		min-height: 25px;
		margin-top: 7px;
	}
	input:focus-visible {
		outline: 2px solid var(--focus);
		outline-offset: 3px;
	}
	.workspace {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 250px;
		gap: 24px;
		margin-top: 25px;
	}
	.chart-panel {
		min-width: 0;
	}
	.chart-heading {
		display: flex;
		justify-content: space-between;
		align-items: center;
		flex-wrap: wrap;
		gap: 8px;
		margin: 0 0 19px;
	}
	.chart-heading strong {
		font-size: 12px;
		color: var(--ink);
		font-weight: 550;
	}
	.chart-heading > span {
		font-size: 10px;
		color: var(--quiet);
	}
	.forecast-chart {
		display: block;
		width: 100%;
		height: auto;
	}
	.forecast-chart text {
		fill: var(--plot-muted);
		font: 10px var(--sans);
	}
	.grid-line {
		stroke: var(--plot-line);
		stroke-width: 0.5;
		opacity: 0.55;
	}
	.legend {
		display: flex;
		flex-wrap: wrap;
		gap: 15px;
		color: var(--muted);
		font-size: 10px;
		margin: 13px 0 20px;
	}
	.legend span {
		display: flex;
		gap: 6px;
		align-items: center;
	}
	.legend i {
		width: 13px;
		height: 2px;
		display: block;
	}
	.actual {
		background: var(--chart-blue);
	}
	.predicted {
		background: var(--lavender);
	}
	.legend .interval {
		height: 7px;
		background: color-mix(in srgb, var(--lavender) 25%, transparent);
	}
	.inspect {
		display: block;
	}
	.origin-reading {
		display: flex;
		gap: 9px;
		align-items: flex-start;
		color: var(--blue);
		margin-top: 9px;
	}
	.origin-reading > :global(svg) {
		flex-shrink: 0;
		margin-top: 3px;
	}
	.origin-reading p {
		color: var(--muted);
		font-size: 11px;
		line-height: 1.8;
		margin: 0;
	}
	.origin-reading p :global(svg) {
		display: inline-block;
		margin: 0 5px;
		vertical-align: middle;
	}
	.origin-reading strong {
		color: var(--ink);
		font-weight: 550;
	}
	.comparison {
		background: var(--lab-inset);
		padding: 19px;
		border-radius: 16px;
	}
	.comparison-heading {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 15px;
		margin-bottom: 16px;
	}
	.comparison-heading strong {
		font-weight: 550;
		font-size: 11px;
		color: var(--ink);
	}
	.comparison-heading span {
		font: 9px var(--mono);
		color: var(--quiet);
		white-space: nowrap;
	}
	.comparison button {
		width: 100%;
		display: flex;
		gap: 12px;
		align-items: center;
		justify-content: space-between;
		color: var(--muted);
		border: 1px solid transparent;
		background: transparent;
		text-align: left;
		border-radius: 9px;
		padding: 13px 10px;
		margin: 4px 0;
	}
	.comparison button[aria-pressed='true'] {
		background: var(--surface);
		border-color: var(--lavender);
		color: var(--lavender);
	}
	.comparison button span {
		font-size: 11px;
		line-height: 1.5;
	}
	.comparison button strong {
		font: 14px var(--mono);
	}
	.comparison p {
		color: var(--muted);
		font-size: 11px;
		line-height: 1.7;
		margin: 19px 0 12px;
		border-top: 1px solid var(--line);
		padding-top: 17px;
	}
	.comparison small {
		display: block;
		color: var(--quiet);
		font-size: 10px;
		line-height: 1.7;
	}
	.interval-summary {
		display: grid;
		grid-template-columns: 1fr 1fr 1.4fr;
		gap: 22px;
		align-items: center;
		border: 1px solid var(--line);
		border-radius: 16px;
		margin-top: 24px;
		padding: 23px;
	}
	.interval-summary span {
		font-size: 11px;
		color: var(--muted);
	}
	.interval-summary strong {
		display: block;
		font: 28px var(--mono);
		color: var(--lavender);
		margin: 10px 0;
	}
	.interval-summary > div:nth-child(2) strong {
		color: var(--test);
	}
	.interval-summary small {
		font-size: 10px;
		color: var(--quiet);
		line-height: 1.6;
		display: block;
	}
	.interval-summary p {
		color: var(--muted);
		font-size: 11px;
		line-height: 1.8;
		margin: 0;
	}
	.practice {
		display: flex;
		gap: 12px;
		color: var(--lavender);
		margin-top: 22px;
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
	summary {
		color: var(--blue);
		font-size: 11px;
		line-height: 1.7;
		cursor: pointer;
	}
	.method p {
		color: var(--muted);
		font-size: 11px;
		line-height: 1.8;
		margin: 12px 0 0;
	}
	@container (max-width: 740px) {
		.workspace {
			grid-template-columns: 1fr;
		}
		.comparison {
			display: grid;
			grid-template-columns: 1fr 1fr;
			gap: 0 12px;
		}
		.comparison-heading,
		.comparison p,
		.comparison small {
			grid-column: 1/-1;
		}
		.interval-summary {
			grid-template-columns: 1fr 1fr;
		}
		.interval-summary p {
			grid-column: 1/-1;
		}
	}
	@container (max-width: 440px) {
		.toolbar {
			padding: 16px;
			gap: 20px;
		}
		.toolbar :global(.choice-group button) {
			padding: 9px 10px;
			font-size: 10px;
		}
		.comparison {
			display: block;
			padding: 17px;
		}
		.interval-summary {
			padding: 17px;
			gap: 17px;
		}
		.interval-summary strong {
			font-size: 25px;
		}
		.interval-summary span {
			display: block;
			font-size: 10px;
			min-height: 28px;
		}
		.forecast-chart text {
			font-size: 9px;
		}
	}
</style>
