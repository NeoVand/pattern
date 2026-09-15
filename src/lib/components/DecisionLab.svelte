<script lang="ts">
	import PatternIcon from './PatternIcon.svelte';
	import {
		costThreshold,
		decisionCalibration,
		decisionMetrics,
		decisionPopulation
	} from '$lib/ml/decisions';
	let prevalence = $state(1);
	let threshold = $state(1);
	let noise = $state(1);
	let confidence = $state(1);
	let count = $state(1000);
	let falsePositiveCost = $state(1);
	let falseNegativeCost = $state(10);
	let seed = $state(42);
	let prediction = $state('');
	let explanation = $state('');
	const examples = $derived(decisionPopulation(count, prevalence / 100, noise, confidence, seed));
	const metrics = $derived(
		decisionMetrics(examples, threshold, falsePositiveCost, falseNegativeCost)
	);
	const calibration = $derived(decisionCalibration(examples));
	const recommended = $derived(costThreshold(falsePositiveCost, falseNegativeCost));
	const actualPrevalence = $derived(
		examples.reduce((sum, example) => sum + example.label, 0) / count
	);
	const percent = (value: number | null) => (value === null ? '—' : `${(value * 100).toFixed(1)}%`);
	const x = (value: number) => 48 + 292 * value;
	const y = (value: number) => 286 - 242 * value;
	function rareExample() {
		prevalence = 1;
		threshold = 1;
		count = 1000;
		noise = confidence = 1;
		falsePositiveCost = 1;
		falseNegativeCost = 10;
		seed = 42;
	}
</script>

<section class="decision-lab" aria-label="Uncertainty and decisions lab">
	<header>
		<div>
			<span class="small-overline">PROBABILITY → DECISION</span>
			<h3>Correct isn't the whole story.</h3>
		</div>
		<button class="reset-button" onclick={rareExample}
			><PatternIcon name="reset" size={16} />The 99% example</button
		>
	</header>
	<p class="intro">
		A fictional factory checks parcels for damage. The starting rule clears every parcel: 99%
		accuracy, and every damaged parcel slips through. Change the rule, count the consequences.
	</p>
	<div class="decision-workspace">
		<aside class="controls">
			<label
				><span>Damaged parcels <output>{prevalence}%</output></span><input
					aria-label="Damaged parcels"
					type="range"
					min="1"
					max="50"
					step="1"
					bind:value={prevalence}
				/></label
			>
			<label
				><span>Flag above probability <output>{percent(threshold)}</output></span><input
					aria-label="Decision threshold"
					type="range"
					min="0"
					max="1"
					step="0.01"
					bind:value={threshold}
				/></label
			>
			<p class="control-note">
				{threshold === 1
					? 'At 100%, the rule clears every parcel.'
					: 'A score at or above the threshold flags the parcel.'}
			</p>
			<div class="cost-controls">
				<strong>What does a mistake cost?</strong>
				<label
					><span>Unneeded inspection <output>{falsePositiveCost} units</output></span><input
						aria-label="False positive cost"
						type="range"
						min="1"
						max="20"
						step="1"
						bind:value={falsePositiveCost}
					/></label
				>
				<label
					><span>Missed damage <output>{falseNegativeCost} units</output></span><input
						aria-label="False negative cost"
						type="range"
						min="1"
						max="50"
						step="1"
						bind:value={falseNegativeCost}
					/></label
				>
				<button class="cost-button" onclick={() => (threshold = recommended)}
					>Use cost-based threshold · {percent(recommended)}</button
				>
				<p class="control-note">
					If probabilities are calibrated and correct decisions cost zero, flag when p ≥ {falsePositiveCost}
					/ ({falsePositiveCost} + {falseNegativeCost}). This minimizes expected cost under those
					assumptions, not necessarily this sample's cost.
				</p>
			</div>
		</aside>
		<div class="decision-results">
			<div class="result-heading">
				<strong>Every outcome counted</strong><span
					>{count.toLocaleString()} synthetic parcels · {percent(actualPrevalence)} damaged</span
				>
			</div>
			<table class="confusion-matrix">
				<caption class="visually-hidden">Confusion matrix for the current threshold</caption>
				<thead
					><tr
						><th scope="col">Our decision</th><th scope="col">Actually damaged</th><th scope="col"
							>Actually sound</th
						></tr
					></thead
				>
				<tbody>
					<tr
						><th scope="row">Flag</th><td
							><strong data-testid="decision-tp">{metrics.tp}</strong><span>True positives</span
							></td
						><td class="mistake"
							><strong data-testid="decision-fp">{metrics.fp}</strong><span>False positives</span
							></td
						></tr
					>
					<tr
						><th scope="row">Clear</th><td class="mistake"
							><strong data-testid="decision-fn">{metrics.fn}</strong><span>False negatives</span
							></td
						><td
							><strong data-testid="decision-tn">{metrics.tn}</strong><span>True negatives</span
							></td
						></tr
					>
				</tbody>
			</table>
			<div class="metrics" aria-live="polite">
				<div>
					<span>Accuracy</span><strong data-testid="decision-accuracy"
						>{percent(metrics.accuracy)}</strong
					><small>All correct decisions</small>
				</div>
				<div>
					<span>Precision</span><strong>{percent(metrics.precision)}</strong><small
						>Damage among flags</small
					>
				</div>
				<div>
					<span>Recall</span><strong data-testid="decision-recall">{percent(metrics.recall)}</strong
					><small>Damage we caught</small>
				</div>
				<div>
					<span>Total cost</span><strong data-testid="decision-cost">{metrics.cost}</strong><small
						>{metrics.fp} × {falsePositiveCost} + {metrics.fn} × {falseNegativeCost}</small
					>
				</div>
			</div>
			<p class="result-note">
				A dash means the denominator is zero. Precision is undefined when no parcels are flagged.
				Changing the threshold changes decisions; it leaves probability scores and calibration
				unchanged.
			</p>
		</div>
	</div>
	<div class="calibration-workspace">
		<div class="reliability-panel">
			<h4>Do the percentages mean what they say?</h4>
			<p>
				Each dot groups similar scores. A group near 80% should contain about 80% damaged parcels.
				The diagonal represents that agreement.
			</p>
			<svg
				class="reliability-chart"
				viewBox="0 0 380 335"
				role="img"
				aria-label="Reliability diagram: average predicted damage probability versus observed damaged fraction, with approximate 95 percent Wilson intervals"
			>
				<title>Reliability of the displayed probability scores</title>
				{#each [0, 0.25, 0.5, 0.75, 1] as tick (tick)}
					<line x1="48" x2="340" y1={y(tick)} y2={y(tick)} stroke="var(--line)" />
					<text x="39" y={y(tick) + 4} text-anchor="end">{tick * 100}%</text>
					<text x={x(tick)} y="306" text-anchor="middle">{tick * 100}%</text>
				{/each}
				<text x="48" y="22">Observed damage rate</text>
				<text x="194" y="329" text-anchor="middle">Average predicted probability</text>
				<path d="M48,286 L340,44" fill="none" stroke="var(--quiet)" stroke-dasharray="4 5" />
				{#each calibration.bins as bin (bin.index)}
					<line
						x1={x(bin.meanScore)}
						x2={x(bin.meanScore)}
						y1={y(bin.interval[0])}
						y2={y(bin.interval[1])}
						stroke="var(--lavender)"
						stroke-width="2"
					/>
					<circle
						cx={x(bin.meanScore)}
						cy={y(bin.observedRate)}
						r={3.5 + Math.sqrt(bin.count / count) * 6}
						fill="var(--blue)"
						><title
							>{bin.count} parcels: {percent(bin.meanScore)} predicted, {percent(bin.observedRate)} observed.
							Approximate 95% interval: {percent(bin.interval[0])}–{percent(
								bin.interval[1]
							)}.</title
						></circle
					>
				{/each}
			</svg>
			<div class="calibration-metrics">
				<span
					>Calibration gap <strong data-testid="calibration-gap">{percent(calibration.ece)}</strong
					></span
				><span>Brier score <strong>{calibration.brier.toFixed(3)}</strong></span>
			</div>
			<details>
				<summary>Read the chart as a table</summary>
				<div class="table-wrap">
					<table class="bin-table">
						<thead
							><tr><th>Parcels</th><th>Predicted</th><th>Observed</th><th>95% interval</th></tr
							></thead
						><tbody
							>{#each calibration.bins as bin (bin.index)}<tr
									><td>{bin.count}</td><td>{percent(bin.meanScore)}</td><td
										>{percent(bin.observedRate)}</td
									><td>{percent(bin.interval[0])}–{percent(bin.interval[1])}</td></tr
								>{/each}</tbody
						>
					</table>
				</div>
			</details>
		</div>
		<div class="uncertainty-controls">
			<h4>Separate two kinds of uncertainty.</h4>
			<label
				><span>Outcome noise <output>{noise.toFixed(1)}×</output></span><input
					aria-label="Outcome noise"
					type="range"
					min="0.5"
					max="2.5"
					step="0.1"
					bind:value={noise}
				/></label
			>
			<p>
				More noise makes the damage signals overlap. Even the supplied probability model cannot
				identify every parcel. More observations do not remove this overlap.
			</p>
			<label
				><span>Observed sample size</span><select
					aria-label="Observed sample size"
					bind:value={count}
					><option value={100}>100 parcels</option><option value={1000}>1,000 parcels</option
					><option value={5000}>5,000 parcels</option></select
				></label
			>
			<button class="reset-button" onclick={() => seed++}
				><PatternIcon name="shuffle" size={15} />Draw another sample</button
			>
			<p>
				The vertical bars show uncertainty about each group's observed rate. More evidence usually
				narrows them. Empty groups have no dot. These approximate binomial intervals are
				descriptive: this population fixes the overall class count.
			</p>
			<label
				><span>Stretch the score's log odds</span><select
					aria-label="Score confidence"
					bind:value={confidence}
					><option value={1}>Original probability model · 1×</option><option value={3}
						>Push toward 0% and 100% · 3×</option
					><option value={0.4}>Pull toward 50% · 0.4×</option></select
				></label
			>
			<p>
				At a 50% threshold these transformations preserve every decision, but change probability
				quality. A confident score is not evidence that a model is right.
			</p>
		</div>
	</div>
	<div class="experiment-prompt">
		<PatternIcon name="idea" size={20} />
		<div>
			<strong>Predict → observe → explain</strong><label
				>Predict what a lower threshold will change.<textarea
					rows="2"
					bind:value={prediction}
					placeholder="Which mistake becomes less common? Which becomes more common?"
				></textarea></label
			>
			<p>
				Try the 99% example, apply the cost-based threshold, then increase missed-damage cost. Set
				the threshold to 50% and stretch the scores.
			</p>
			<label
				>Explain why accuracy, cost, and calibration can move differently.<textarea
					rows="2"
					bind:value={explanation}
					placeholder="Use the counts and one probability group as evidence."></textarea></label
			>
		</div>
	</div>
	<details class="model-details">
		<summary>What is calculated here, and what carries over to forecasting?</summary>
		<p>
			This is a supplied mathematical model, not a trained classifier. Sound-parcel signals follow a
			normal distribution centered on −1; damaged-parcel signals center on +1, both with the
			selected noise as standard deviation. Bayes' rule combines signal and prevalence into a
			probability. Samples use seeded randomness and exactly the rounded requested class count. All
			displayed metrics come from those samples.
		</p>
		<p>
			The calibration gap averages each of ten score groups' absolute predicted-versus-observed
			difference, weighted by group size. The Brier score averages (probability − outcome)²; lower
			is better, but it measures more than calibration. Neither is a guarantee about an individual
			parcel. These visible samples support exploration; a deployed threshold needs independent
			evaluation.
		</p>
		<p>
			For forecasting, distinguish an interval for the average expected demand from a prediction
			interval for one future day's demand. The latter must include day-to-day noise as well as
			estimation uncertainty. Check interval coverage on later observations; calling a band “90%”
			does not establish that 90% of future outcomes fall inside it.
		</p>
	</details>
</section>

<style>
	.decision-lab {
		background: var(--surface);
		color: var(--ink);
		border-radius: 24px;
		padding: clamp(20px, 3vw, 38px);
		container-type: inline-size;
	}
	header,
	.result-heading {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 18px;
	}
	h3 {
		font: italic 400 clamp(30px, 3.2vw, 44px) var(--serif);
		margin: 9px 0 0;
	}
	h4 {
		font-size: 15px;
		font-weight: 550;
		margin: 0 0 10px;
	}
	p {
		font-size: 12px;
		line-height: 1.8;
		color: var(--muted);
	}
	.intro {
		max-width: 800px;
		font-size: 13px;
		margin: 18px 0 28px;
	}
	.reset-button,
	.cost-button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		border: 1px solid var(--line);
		background: var(--lab-inset);
		color: var(--blue);
		border-radius: 10px;
		padding: 11px 13px;
		min-height: 42px;
		font-size: 12px;
	}
	.decision-workspace {
		display: grid;
		grid-template-columns: 250px minmax(0, 1fr);
		gap: 30px;
	}
	.controls,
	.uncertainty-controls {
		min-width: 0;
	}
	label {
		display: block;
		margin: 0 0 18px;
		font-size: 12px;
		color: var(--muted);
	}
	label > span {
		display: flex;
		justify-content: space-between;
		gap: 12px;
		margin-bottom: 9px;
	}
	output {
		font-family: var(--mono);
		color: var(--blue);
	}
	input[type='range'] {
		width: 100%;
		min-height: 24px;
	}
	.control-note {
		font-size: 11px;
		margin-top: -5px;
	}
	.cost-controls {
		border-top: 1px solid var(--line);
		margin-top: 22px;
		padding-top: 22px;
	}
	.cost-controls > strong {
		display: block;
		font-size: 12px;
		font-weight: 550;
		margin-bottom: 18px;
	}
	.cost-button {
		width: 100%;
		margin: 0 0 16px;
	}
	.result-heading {
		flex-wrap: wrap;
		font-size: 12px;
		margin-bottom: 18px;
	}
	.result-heading span {
		color: var(--quiet);
		font-size: 10px;
	}
	.confusion-matrix {
		width: 100%;
		border-collapse: separate;
		border-spacing: 5px;
		table-layout: fixed;
	}
	.confusion-matrix th {
		font-size: 11px;
		color: var(--muted);
		font-weight: 500;
		text-align: left;
		padding: 8px;
	}
	.confusion-matrix th:first-child {
		width: 21%;
	}
	.confusion-matrix td {
		background: var(--lab-inset);
		border-radius: 12px;
		padding: 21px 15px;
	}
	.confusion-matrix td strong {
		display: block;
		color: var(--blue);
		font: 27px var(--mono);
	}
	.confusion-matrix td span {
		display: block;
		color: var(--muted);
		font-size: 10px;
		margin-top: 8px;
	}
	.confusion-matrix td.mistake strong {
		color: var(--orange);
	}
	.metrics {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 12px;
		padding-top: 22px;
	}
	.metrics span,
	.metrics small {
		display: block;
		color: var(--muted);
		font-size: 10px;
		line-height: 1.5;
	}
	.metrics strong {
		display: block;
		font: 20px var(--mono);
		margin: 9px 0;
	}
	.result-note {
		font-size: 11px;
	}
	.calibration-workspace {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(260px, 1fr);
		gap: 36px;
		border-top: 1px solid var(--line);
		margin-top: 30px;
		padding-top: 28px;
	}
	.reliability-panel {
		min-width: 0;
	}
	.reliability-chart {
		width: 100%;
		max-height: 350px;
		margin: 8px 0;
	}
	.reliability-chart text {
		font: 10px var(--sans);
		fill: var(--muted);
	}
	.calibration-metrics {
		display: flex;
		justify-content: space-between;
		gap: 16px;
		font-size: 11px;
		color: var(--muted);
		flex-wrap: wrap;
	}
	.calibration-metrics strong {
		color: var(--ink);
		margin-left: 6px;
		font-family: var(--mono);
	}
	select,
	textarea {
		width: 100%;
		border: 1px solid var(--line);
		background: var(--input);
		color: var(--ink);
		border-radius: 8px;
		padding: 10px;
		font: 12px var(--sans);
		line-height: 1.5;
	}
	textarea {
		resize: vertical;
		margin-top: 8px;
	}
	select {
		min-height: 42px;
	}
	details {
		margin-top: 20px;
	}
	summary {
		cursor: pointer;
		color: var(--muted);
		font-size: 12px;
		line-height: 1.7;
	}
	.table-wrap {
		overflow-x: auto;
	}
	.bin-table {
		width: 100%;
		border-collapse: collapse;
		margin-top: 12px;
		font-size: 10px;
		text-align: left;
	}
	.bin-table th,
	.bin-table td {
		padding: 7px;
		border-bottom: 1px solid var(--line);
	}
	.experiment-prompt {
		display: flex;
		align-items: start;
		gap: 13px;
		padding: 22px;
		margin-top: 30px;
		background: var(--lab-inset);
		border-radius: 14px;
	}
	.experiment-prompt > div {
		flex: 1;
		min-width: 0;
	}
	.experiment-prompt strong {
		display: block;
		font-size: 12px;
		margin-bottom: 14px;
		color: var(--blue);
	}
	.experiment-prompt label:last-child {
		margin-bottom: 0;
	}
	.model-details {
		border-top: 1px solid var(--line);
		padding-top: 20px;
	}
	@container (max-width: 720px) {
		.decision-workspace {
			grid-template-columns: 1fr;
		}
		.calibration-workspace {
			grid-template-columns: 1fr;
		}
		header {
			align-items: start;
			flex-direction: column;
		}
	}
	@container (max-width: 400px) {
		.metrics {
			grid-template-columns: 1fr 1fr;
		}
		.confusion-matrix td {
			padding: 16px 9px;
		}
		.confusion-matrix td strong {
			font-size: 22px;
		}
		.confusion-matrix th {
			padding: 4px;
			font-size: 10px;
		}
		.experiment-prompt {
			padding: 16px;
		}
	}
</style>
