<script lang="ts">
	import { onDestroy } from 'svelte';
	import {
		FORECAST_SCENARIOS,
		forecastData,
		LinearForecaster,
		type ForecastModel
	} from '$lib/ml/forecast';
	import PatternIcon from './PatternIcon.svelte';
	import ChoiceGroup from './ChoiceGroup.svelte';
	let scenario = $state(0),
		kind = $state<ForecastModel>('exponential');
	let noise = $state(1),
		trend = $state(1),
		seasonality = $state(1);
	const initialValues = forecastData(0, 1, 1, 1);
	let values = $state.raw(initialValues);
	let model = $state.raw(new LinearForecaster('exponential', initialValues.slice(0, 42), 12));
	let revision = $state(0),
		running = $state(false),
		selected = $state(30),
		inspect = $state(63),
		edited = $state(0);
	let timer: ReturnType<typeof setInterval> | undefined;
	let chart: SVGSVGElement;
	let chartWidth = $state(1000);
	function attachChart(node: SVGSVGElement) {
		chart = node;
		let frame = 0;
		const observer = new ResizeObserver(() => {
			const width = Math.max(300, Math.round(node.getBoundingClientRect().width));
			if (width === chartWidth) return;
			cancelAnimationFrame(frame);
			frame = requestAnimationFrame(() => {
				chartWidth = width;
			});
		});
		observer.observe(node);
		return () => {
			observer.disconnect();
			cancelAnimationFrame(frame);
		};
	}
	let drag = $state(false);
	let dragScale = 1;
	let dragMin = 0;
	const steps = $derived.by(() => {
		void revision;
		return model.step;
	});
	const s = $derived(FORECAST_SCENARIOS[scenario]);
	const future = $derived(Math.min(14, s.period));
	const total = $derived(s.count + future);
	const predictions = $derived.by(() => {
		void revision;
		return Array.from({ length: total }, (_, i) => model.predict(i));
	});
	const ymax = $derived(
		drag ? dragScale : Math.ceil((Math.max(...values, ...predictions) * 1.18) / 10) * 10
	);
	const x = (i: number) => 44 + (i / (total - 1)) * (chartWidth - 64);
	const ymin = $derived(drag ? dragMin : Math.min(0, ...predictions) * 1.1);
	const y = (v: number) => 288 - ((v - ymin) / (ymax - ymin)) * 240;
	const path = (start: number, end: number) =>
		predictions
			.slice(start, end)
			.map((v, j) => `${j ? 'L' : 'M'}${x(start + j).toFixed(2)},${y(v).toFixed(2)}`)
			.join(' ');
	const expTerms = $derived.by(() => {
		void revision;
		return model.exponentialTerms(inspect);
	});
	const terms = $derived.by(() => {
		void revision;
		return model.contributions(inspect);
	});
	const metrics = $derived.by(() => {
		void revision;
		return {
			train: model.mae(values, 0, s.train),
			validation: model.mae(values, s.train, s.train + s.validation),
			test: model.mae(values, s.train + s.validation, s.count)
		};
	});
	function stop() {
		clearInterval(timer);
		running = false;
	}
	function reset() {
		stop();
		model = new LinearForecaster(kind, values.slice(0, s.train), s.period);
		revision++;
	}
	function regenerate() {
		values = forecastData(scenario, noise, trend, seasonality);
		edited = 0;
		selected = Math.min(selected, s.train - 1);
		inspect = s.train + Math.floor(s.validation / 2);
		reset();
	}
	function chooseScenario(index: number) {
		scenario = index;
		kind = FORECAST_SCENARIOS[index].family;
		noise = trend = seasonality = 1;
		regenerate();
	}
	function trainModel() {
		if (running) {
			stop();
			return;
		}
		running = true;
		timer = setInterval(() => {
			model.train(8);
			revision++;
		}, 40);
	}
	function edit(index: number, value: number) {
		const next = values.slice();
		next[index] = Math.max(0.01, value);
		values = next;
		selected = index;
		edited++;
		reset();
	}
	function move(event: PointerEvent) {
		if (!drag) return;
		const matrix = chart.getScreenCTM();
		if (!matrix) return;
		const localY = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse()).y;
		edit(selected, Math.max(0, Math.min(ymax, ymin + ((288 - localY) / 240) * (ymax - ymin))));
	}
	function startDrag(event: PointerEvent, index: number) {
		event.preventDefault();
		selected = index;
		dragScale = ymax;
		dragMin = ymin;
		drag = true;
		chart.setPointerCapture(event.pointerId);
		stop();
	}
	function finish() {
		drag = false;
	}
	onDestroy(stop);
</script>

<section class="forecast-lab" aria-label="Time series forecasting lab">
	<header>
		<div>
			<span class="small-overline">PATTERNS THROUGH TIME</span>
			<h3>What comes next?</h3>
		</div>
		<div class="forecast-actions">
			<button class="primary-button" onclick={trainModel}
				><PatternIcon name={running ? 'pause' : 'play'} size={16} />{running
					? 'Pause learning'
					: steps
						? 'Keep learning'
						: 'Train forecast'}</button
			><button class="icon-button" aria-label="Reset forecast weights" onclick={reset}
				><PatternIcon name="reset" size={18} /></button
			>
		</div>
	</header>
	<div class="scenario-tabs" role="group" aria-label="Forecasting dataset">
		{#each FORECAST_SCENARIOS as item, i (item.id)}<button
				aria-pressed={scenario === i}
				onclick={() => chooseScenario(i)}
				><PatternIcon
					name={i === 0 ? 'forecasting' : i === 1 ? 'arrowDown' : 'training'}
					size={17}
				/>{item.label}</button
			>{/each}
	</div>
	<div class="forecast-intro">
		<p>{s.description}</p>
		<span>Synthetic data · {s.unit} per {s.time}</span>
	</div>
	<div class="forecast-workspace">
		<div class="forecast-chart">
			<div class="chart-label">
				<strong>{s.label}</strong><span>{steps} gradient updates</span>
			</div>
			<svg
				{@attach attachChart}
				class="time-chart"
				viewBox={`0 0 ${chartWidth} 340`}
				role="group"
				aria-label="Observed values and the learned forecast over time"
				onpointermove={move}
				onpointerup={finish}
				onpointercancel={finish}
				onlostpointercapture={finish}
			>
				<rect
					x={x(s.train - 0.5)}
					y="26"
					width={x(s.train + s.validation - 0.5) - x(s.train - 0.5)}
					height="262"
					fill="var(--validation)"
					opacity=".055"
				/>
				<rect
					x={x(s.train + s.validation - 0.5)}
					y="26"
					width={x(s.count - 0.5) - x(s.train + s.validation - 0.5)}
					height="262"
					fill="var(--test)"
					opacity=".055"
				/>
				{#each [0, 0.25, 0.5, 0.75, 1] as fraction (fraction)}<line
						x1="44"
						x2={chartWidth - 20}
						y1={y(ymin + (ymax - ymin) * fraction)}
						y2={y(ymin + (ymax - ymin) * fraction)}
						stroke="var(--line)"
					/><text x="35" y={y(ymin + (ymax - ymin) * fraction) + 4} text-anchor="end"
						>{Math.round(ymin + (ymax - ymin) * fraction)}</text
					>{/each}
				<text x={x(s.train / 2)} y="16" text-anchor="middle" class="train-label"
					>{chartWidth < 500 ? 'TRAIN' : `TRAIN · ${s.train}`}</text
				><text x={x(s.train + s.validation / 2)} y="16" text-anchor="middle" class="val-label"
					>{chartWidth < 500 ? 'VAL' : 'VALIDATE'}</text
				><text
					x={x(s.train + s.validation + (s.count - s.train - s.validation) / 2)}
					y="16"
					text-anchor="middle"
					class="test-label">TEST</text
				><text x={x(s.count + future / 2 - 1)} y="16" text-anchor="middle"
					>{chartWidth < 500 ? 'NEXT' : 'FUTURE'}</text
				>
				<path d={path(0, s.train)} fill="none" stroke="var(--blue)" stroke-width="2.5" />
				<path
					d={path(s.train - 1, total)}
					fill="none"
					stroke="var(--lavender)"
					stroke-width="2.5"
					stroke-dasharray="6 4"
				/>
				{#each values as value, i (i)}
					{#if i < s.train}<circle
							cx={x(i)}
							cy={y(value)}
							r={chartWidth < 500 ? 2 : 3.2}
							fill="var(--training)"
							opacity=".8"
						/><circle
							cx={x(i)}
							cy={y(value)}
							r="9"
							fill="transparent"
							class="data-handle"
							role="button"
							tabindex="0"
							aria-label={`Edit ${s.time} ${i + 1}: ${Math.round(value)} ${s.unit}`}
							onpointerdown={(e) => startDrag(e, i)}
							onclick={() => (selected = i)}
							onkeydown={(e) => {
								if (e.key === 'Enter' || e.key === ' ') {
									e.preventDefault();
									selected = i;
								} else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
									e.preventDefault();
									edit(i, value + ((e.key === 'ArrowUp' ? 1 : -1) * s.noise) / 2);
								}
							}}
						/>
					{:else if i < s.train + s.validation}<path
							d={`M${x(i)},${y(value) - 4}l4,4 -4,4 -4,-4z`}
							fill="var(--validation)"
						/>
					{:else}<circle
							cx={x(i)}
							cy={y(value)}
							r={chartWidth < 500 ? 2.5 : 3.5}
							fill="none"
							stroke="var(--test)"
							stroke-width="1.5"
						/>{/if}
				{/each}
				<circle
					cx={x(selected)}
					cy={y(values[selected])}
					r="7"
					fill="none"
					stroke="var(--locator)"
					stroke-width="1.5"
					pointer-events="none"
				/>
				<line
					x1={x(inspect)}
					x2={x(inspect)}
					y1="32"
					y2="288"
					stroke="var(--lavender)"
					stroke-dasharray="2 5"
					opacity=".6"
				/>
				<circle
					cx={x(inspect)}
					cy={y(predictions[inspect])}
					r="6"
					fill="none"
					stroke="var(--lavender)"
					stroke-width="2"
				/>
				{#each [0, Math.floor(total * 0.25), Math.floor(total * 0.5), Math.floor(total * 0.75), total - 1] as tick (tick)}<text
						x={x(tick)}
						y="313"
						text-anchor="middle">{tick + 1}</text
					>{/each}<text x={chartWidth / 2} y="337" text-anchor="middle">{s.time.toUpperCase()}</text
				>
			</svg>
			<div class="chart-legend">
				<span><i class="observed"></i>Observed</span><span
					><i class="prediction"></i>Model prediction</span
				><span>Drag a blue observation to edit it</span>
			</div>
			<div class="forecast-scores">
				<div><span>Training MAE</span><strong>{metrics.train.toFixed(1)}</strong></div>
				<div><span>Validation MAE</span><strong>{metrics.validation.toFixed(1)}</strong></div>
				<div><span>Test MAE</span><strong>{metrics.test.toFixed(1)}</strong></div>
				<small>{s.unit} · Lower is better</small>
			</div>
		</div>
		<aside class="forecast-controls">
			<ChoiceGroup
				label="Model"
				value={kind}
				options={[
					{ value: 'level', label: 'Level' },
					{ value: 'trend', label: '+ Trend' },
					{ value: 'seasonal', label: 'Seasonal' },
					{ value: 'exponential', label: 'Exponential' }
				]}
				onchange={(value) => {
					kind = value;
					reset();
				}}
			/>
			<p class="model-description">
				{kind === 'exponential'
					? 'A learned starting value and percentage rate. Fits a straight line to log(value), then exponentiates.'
					: kind === 'level'
						? 'One learned average, repeated into the future.'
						: kind === 'trend'
							? 'A learned starting level and slope through time.'
							: 'A learned level, trend, and repeating sine/cosine pair.'}
			</p>
			<div class="data-controls">
				<strong>Shape the observations</strong
				>{#each [{ key: 'noise', label: 'Noise', value: noise }, { key: 'trend', label: scenario === 1 ? 'Decay rate' : 'Growth rate', value: trend }, ...(s.family === 'seasonal' ? [{ key: 'season', label: 'Seasonality', value: seasonality }] : [])] as control (control.key)}<label
						><span>{control.label}<output>{control.value.toFixed(1)}×</output></span><input
							type="range"
							aria-label={control.label}
							min="0"
							max="2"
							step="0.1"
							value={control.value}
							oninput={(e) => {
								const v = +e.currentTarget.value;
								if (control.key === 'noise') noise = v;
								else if (control.key === 'trend') trend = v;
								else seasonality = v;
								regenerate();
							}}
						/></label
					>{/each}
			</div>
			<label class="edit-observation"
				><span
					>Edit {s.time} {selected + 1}<output>{values[selected].toFixed(0)} {s.unit}</output></span
				><input
					type="range"
					min="0.01"
					max={Math.ceil(Math.max(...values.slice(0, s.train)) * 1.5)}
					step="1"
					value={values[selected]}
					aria-label={`Edit ${s.time} ${selected + 1}`}
					oninput={(e) => edit(selected, +e.currentTarget.value)}
				/></label
			>
			<p class="edit-note">
				{edited
					? 'Observations changed. Train again to learn from your edits.'
					: 'Select a blue point, then drag it or adjust its value here.'}
			</p>
			<button class="text-button" onclick={regenerate}
				><PatternIcon name="reset" size={14} />Restore observations</button
			>
		</aside>
	</div>
	<div class="forecast-model">
		<div class="model-heading">
			<div>
				<PatternIcon name="neural" size={18} /><strong>Inside this model</strong><span
					>{model.weights.length} learned coefficients · {kind === 'exponential'
						? 'log-linear regression'
						: 'linear regression'}</span
				>
			</div>
			<label
				>Inspect {s.time} <output>{inspect + 1}</output><input
					type="range"
					min="0"
					max={total - 1}
					step="1"
					aria-label="Inspect forecast month"
					bind:value={inspect}
				/></label
			>
		</div>
		<div class="forecast-equation">
			{#if kind === 'exponential'}
				<div><span>Learned initial value</span><strong>{expTerms.base.toFixed(1)}</strong></div>
				<b>×</b>
				<div>
					<span>Compound factor · month {inspect + 1}</span><strong
						>{expTerms.factor.toFixed(3)}</strong
					>
				</div>
				<b>=</b>
				<div class="equation-result">
					<span>Predicted {s.unit}</span><strong>{predictions[inspect].toFixed(1)}</strong>
				</div>
			{:else}
				<div><span>Level</span><strong>{terms.level.toFixed(1)}</strong></div>
				{#if kind !== 'level'}<b>+</b>
					<div>
						<span>Trend × time</span><strong>{terms.trend.toFixed(1)}</strong>
					</div>{/if}{#if kind === 'seasonal'}<b>+</b>
					<div><span>Seasonal cycle</span><strong>{terms.season.toFixed(1)}</strong></div>{/if}<b
					>=</b
				>
				<div class="equation-result">
					<span>Predicted {s.unit}</span><strong>{predictions[inspect].toFixed(1)}</strong>
				</div>
			{/if}
		</div>
		{#if kind === 'exponential'}<p class="rate-reading">
				Learned monthly change <strong>{((Math.exp(expTerms.rate) - 1) * 100).toFixed(2)}%</strong> ·
				value(t) = initial × exp(rate × t), with t = 0 in month 1.
			</p>{/if}
		<div class="learning-explanation">
			<p>
				<strong>What training changes.</strong> Gradient descent adjusts the coefficients to reduce
				squared error {kind === 'exponential' ? 'in log(value)' : 'in value'} on the first {s.train} observations.
				All three displayed MAEs are in {s.unit}. The time and seasonal inputs are known calendar
				features.
			</p>
			<p>
				<strong>What the future checks.</strong> Validation and test observations are visible, but never
				enter the weight updates. Compare model choices using validation; reserve test data for the final
				assessment.
			</p>
		</div>
		<details>
			<summary>The equation and its limits</summary>
			<p>
				{#if kind === 'exponential'}log ŷ(t) = b + wₜ × time. Exponentiation returns the forecast to
					its original units. This predicts a typical multiplicative trajectory, not a
					bias-corrected expected value.
				{:else}ŷ(t) = b {kind !== 'level' ? '+ wₜ × time' : ''}
					{kind === 'seasonal' ? '+ wₛ × sin(2πt / period) + w꜀ × cos(2πt / period)' : ''}.{/if} Time
				is centered and scaled for training. {#if kind === 'seasonal'}The seasonal period is {s.period}
					{s.time}s, supplied by this scenario.{/if} Every future value is computed from the learned coefficients,
				without future observations. This model cannot anticipate an event missing from its inputs. Repeatedly
				choosing settings based on the test score turns the test set into another validation set.
			</p>
		</details>
	</div>
</section>

<style>
	.rate-reading {
		font-size: 12px;
		color: var(--muted);
		line-height: 1.6;
	}
	.rate-reading strong {
		color: var(--blue);
		font-family: var(--mono);
	}
	.forecast-controls :global(.choice-group > div) {
		display: grid;
		grid-template-columns: 1fr 1fr;
	}
	.forecast-lab {
		background: var(--surface);
		border-radius: 24px;
		padding: clamp(20px, 3vw, 38px);
		container-type: inline-size;
	}
	.forecast-lab header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 20px;
		margin-bottom: 24px;
	}
	.forecast-lab h3 {
		font-family: var(--serif);
		font-style: italic;
		font-size: clamp(30px, 3.2vw, 44px);
		font-weight: 400;
		margin: 9px 0 0;
	}
	.forecast-actions {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.forecast-actions .primary-button {
		font-size: 13px;
		min-height: 42px;
		padding: 11px 16px;
		white-space: nowrap;
	}
	.scenario-tabs {
		display: flex;
		gap: 7px;
		flex-wrap: wrap;
	}
	.scenario-tabs button {
		display: flex;
		align-items: center;
		gap: 8px;
		border: 0;
		border-radius: 10px;
		background: var(--lab-inset);
		color: var(--muted);
		font-size: 12px;
		padding: 11px 14px;
	}
	.scenario-tabs button[aria-pressed='true'] {
		color: var(--blue);
		box-shadow: inset 0 0 0 1px var(--blue);
	}
	.forecast-intro {
		display: flex;
		justify-content: space-between;
		gap: 18px;
		align-items: center;
		margin: 14px 0 22px;
	}
	.forecast-intro p {
		font-size: 13px;
		color: var(--muted);
		line-height: 1.7;
		margin: 0;
	}
	.forecast-intro > span {
		font-size: 10px;
		color: var(--quiet);
		white-space: nowrap;
	}
	.forecast-workspace {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 244px;
		gap: 24px;
	}
	.forecast-chart {
		min-width: 0;
	}
	.chart-label {
		display: flex;
		justify-content: space-between;
		font-size: 12px;
		color: var(--muted);
		margin: 8px 0 16px;
	}
	.chart-label strong {
		color: var(--ink);
		font-weight: 550;
	}
	.time-chart {
		width: 100%;
		overflow: visible;
		touch-action: pan-y;
	}
	.time-chart text {
		font: 11px var(--sans);
		fill: var(--muted);
	}
	.time-chart .train-label {
		fill: var(--training);
	}
	.time-chart .val-label {
		fill: var(--validation);
	}
	.time-chart .test-label {
		fill: var(--test);
	}
	.data-handle {
		cursor: ns-resize;
		touch-action: none;
	}
	.data-handle:focus-visible {
		outline: none;
		stroke: var(--focus);
		stroke-width: 1.5;
	}
	.chart-legend {
		display: flex;
		gap: 16px;
		flex-wrap: wrap;
		color: var(--muted);
		font-size: 10px;
		margin: 6px 0 22px;
	}
	.chart-legend > span {
		display: flex;
		align-items: center;
		gap: 6px;
	}
	.chart-legend > span:last-child {
		margin-left: auto;
	}
	.observed {
		width: 5px;
		height: 5px;
		border-radius: 50%;
		background: var(--blue);
	}
	.prediction {
		width: 14px;
		height: 2px;
		background: var(--lavender);
	}
	.forecast-scores {
		display: grid;
		grid-template-columns: repeat(3, 1fr) auto;
		gap: 18px;
		align-items: center;
		background: var(--lab-inset);
		padding: 17px 20px;
		border-radius: 14px;
	}
	.forecast-scores span {
		font-size: 10px;
		color: var(--muted);
	}
	.forecast-scores strong {
		display: block;
		font: 22px var(--mono);
		color: var(--training);
		margin-top: 7px;
	}
	.forecast-scores > div:nth-child(2) strong {
		color: var(--validation);
	}
	.forecast-scores > div:nth-child(3) strong {
		color: var(--test);
	}
	.forecast-scores small {
		font-size: 10px;
		color: var(--muted);
		line-height: 1.7;
	}
	.forecast-controls {
		background: var(--lab-inset);
		padding: 19px;
		border-radius: 16px;
	}
	.forecast-controls :global(.choice-group) {
		margin: 0;
	}
	.forecast-controls :global(.choice-group legend) {
		font-size: 12px;
		margin-bottom: 9px;
	}
	.forecast-controls :global(.choice-group button) {
		font-size: 11px;
		padding: 9px 5px;
	}
	.model-description,
	.edit-note {
		font-size: 11px;
		color: var(--muted);
		line-height: 1.6;
		margin: 12px 0 18px;
	}
	.data-controls > strong {
		font-size: 12px;
		font-weight: 550;
		display: block;
		margin: 18px 0;
	}
	.forecast-controls label {
		display: block;
		margin: 14px 0;
	}
	.forecast-controls label > span {
		display: flex;
		justify-content: space-between;
		font-size: 11px;
		color: var(--muted);
		margin-bottom: 6px;
	}
	.forecast-controls output {
		color: var(--blue);
		font: 10px var(--mono);
	}
	.forecast-controls input {
		width: 100%;
		height: 16px;
		accent-color: var(--blue);
	}
	.forecast-controls .text-button {
		font-size: 11px;
		padding: 0;
	}
	.forecast-model {
		margin-top: 22px;
		background: var(--lab-inset);
		border-radius: 16px;
		padding: 22px;
	}
	.model-heading {
		display: flex;
		justify-content: space-between;
		gap: 22px;
		align-items: center;
	}
	.model-heading > div {
		display: flex;
		align-items: center;
		gap: 9px;
		flex-wrap: wrap;
		color: var(--lavender);
	}
	.model-heading strong {
		font-size: 13px;
		font-weight: 550;
		color: var(--ink);
	}
	.model-heading span {
		font-size: 10px;
		color: var(--muted);
	}
	.model-heading label {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 6px;
		width: 170px;
		font-size: 11px;
		color: var(--muted);
		flex-shrink: 0;
	}
	.model-heading input {
		grid-column: 1/-1;
		width: 100%;
		height: 16px;
		accent-color: var(--lavender);
	}
	.forecast-equation {
		display: flex;
		align-items: center;
		gap: clamp(14px, 3vw, 40px);
		padding: 16px 0;
	}
	.forecast-equation > div {
		flex: 1;
		min-width: 0;
	}
	.forecast-equation span {
		font-size: 10px;
		color: var(--muted);
		display: block;
	}
	.forecast-equation strong {
		font: clamp(17px, 2vw, 26px) var(--mono);
		font-weight: 400;
		margin-top: 9px;
		display: block;
	}
	.forecast-equation > b {
		font-size: 20px;
		font-weight: 400;
		color: var(--quiet);
	}
	.equation-result strong {
		color: var(--lavender);
	}
	.learning-explanation {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 24px;
	}
	.learning-explanation p,
	details p {
		font-size: 11px;
		line-height: 1.8;
		color: var(--muted);
		margin: 0;
	}
	.learning-explanation strong {
		color: var(--ink);
		font-weight: 550;
	}
	details {
		margin-top: 16px;
	}
	summary {
		color: var(--blue);
		font-size: 11px;
		cursor: pointer;
	}
	details p {
		margin-top: 12px;
	}
	@container (max-width:820px) {
		.forecast-workspace {
			grid-template-columns: 1fr;
		}
		.forecast-controls {
			display: grid;
			grid-template-columns: 1fr 1fr;
			gap: 0 24px;
		}
		.forecast-controls .data-controls {
			grid-column: 2;
			grid-row: 1/5;
		}
		.forecast-intro {
			align-items: flex-start;
			flex-direction: column;
			gap: 7px;
		}
		.model-heading {
			align-items: flex-start;
			flex-direction: column;
		}
		.model-heading label {
			width: 100%;
		}
	}
	@container (max-width:500px) {
		.forecast-lab header {
			flex-direction: column;
			align-items: flex-start;
		}
		.forecast-controls {
			display: block;
		}
		.forecast-scores {
			gap: 10px;
			padding: 14px 12px;
			grid-template-columns: repeat(3, 1fr);
		}
		.forecast-scores small {
			grid-column: 1/-1;
		}
		.forecast-equation {
			gap: 9px;
			flex-wrap: wrap;
		}
		.forecast-equation strong {
			font-size: 16px;
		}
		.forecast-equation span {
			font-size: 9px;
		}
		.learning-explanation {
			grid-template-columns: 1fr;
			gap: 12px;
		}
		.forecast-model {
			padding: 16px;
		}
		.time-chart {
			min-height: 180px;
		}
		.time-chart text {
			font-size: 13px;
		}
		.chart-legend > span:last-child {
			margin-left: 0;
		}
	}

	.forecast-controls label {
		margin: 10px 0;
	}
	.forecast-controls input {
		margin: 0;
		min-height: 20px;
	}
	.data-controls > strong {
		margin: 14px 0 10px;
	}
	.model-description,
	.edit-note {
		margin: 10px 0 12px;
	}
	.forecast-controls .text-button {
		padding: 5px 0;
	}

	.time-chart {
		display: block;
		min-height: 0;
		height: auto;
	}
	.time-chart text {
		font-size: 10px;
	}
	.forecast-equation > div {
		display: grid;
		grid-template-rows: 28px auto;
	}
	.forecast-equation span {
		align-self: end;
	}
	.forecast-scores small {
		max-width: 90px;
	}
	@container (max-width:500px) {
		.forecast-scores small {
			max-width: none;
		}
		.time-chart text {
			font-size: 9px;
		}
		.chart-legend {
			margin-top: 12px;
		}
	}
</style>
