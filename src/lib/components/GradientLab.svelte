<script lang="ts">
	const uid = $props.id();
	import {
		INITIAL_TINY_WEIGHTS,
		TINY_EXAMPLES,
		WEIGHT_NAMES,
		finiteDifferenceTiny,
		tinyMeanLoss,
		traceTiny,
		updateTiny,
		type TinyWeights,
		type WeightName
	} from '$lib/ml/gradient-lab';
	let weights = $state<TinyWeights>({ ...INITIAL_TINY_WEIGHTS });
	let selected = $state(5);
	let rate = $state(0.1);
	let inspected = $state<WeightName>('w');
	let nudge = $state(0.01);
	let updates = $state(0);
	let lastAction = $state(
		'Choose a weight. Predict which direction would reduce this example’s loss.'
	);
	const example = $derived(TINY_EXAMPLES[selected]);
	const trace = $derived(traceTiny(weights, example));
	const nextWeights = $derived(updateTiny(weights, example, rate));
	const nextTrace = $derived(traceTiny(nextWeights, example));
	const measuredSlope = $derived(finiteDifferenceTiny(weights, example, inspected));
	const nudgedTrace = $derived(
		traceTiny({ ...weights, [inspected]: weights[inspected] + nudge }, example)
	);
	const meanLoss = $derived(tinyMeanLoss(weights));
	const curve = $derived(
		Array.from({ length: 81 }, (_, index) => {
			const x = -1.2 + index * 0.03;
			return `${index ? 'L' : 'M'}${px(x)},${py(traceTiny(weights, { x, y: 0 }).prediction)}`;
		}).join(' ')
	);
	const names: Record<WeightName, string> = {
		w: 'Input weight w',
		b: 'Hidden bias b',
		v: 'Output weight v',
		c: 'Output bias c'
	};
	const f = (value: number) => value.toFixed(4);
	const px = (value: number) => 30 + ((value + 1.2) / 2.4) * 540;
	const py = (value: number) => 210 - ((Math.max(-1.5, Math.min(1.5, value)) + 1.5) / 3) * 180;
	function accept(next: TinyWeights) {
		if (Object.values(next).every((value) => Number.isFinite(value) && Math.abs(value) < 1000))
			return true;
		lastAction =
			'This learning rate is causing runaway weights. The lab stopped before any parameter exceeded 1,000. Lower the learning rate or reset the weights.';
		return false;
	}
	function step() {
		const before = trace.loss;
		if (!accept(nextWeights)) return;
		weights = nextWeights;
		updates++;
		lastAction = `Updated all four parameters using this example. Its squared error changed from ${f(before)} to ${f(traceTiny(weights, example).loss)}.`;
	}
	function epoch() {
		let next = { ...weights };
		for (const item of TINY_EXAMPLES) {
			next = updateTiny(next, item, rate);
			if (!accept(next)) return;
		}
		weights = next;
		updates += TINY_EXAMPLES.length;
		lastAction =
			'One pass complete: seven separate SGD updates, one per example, in left-to-right order. The displayed derivatives now use the selected example.';
	}
	function applyNudge(direction: number) {
		const before = trace.loss;
		weights = { ...weights, [inspected]: weights[inspected] + direction * nudge };
		const after = traceTiny(weights, example).loss;
		lastAction = `${names[inspected]} ${direction > 0 ? 'increased' : 'decreased'} by ${nudge}. Loss ${after < before ? 'fell' : after > before ? 'rose' : 'stayed equal'}: ${f(before)} → ${f(after)}. Other parameters stayed fixed.`;
	}
	function reset() {
		weights = { ...INITIAL_TINY_WEIGHTS };
		updates = 0;
		lastAction = 'Weights reset. No training has run.';
	}
</script>

<section class="gradient-lab" aria-label="One visible gradient update">
	<header>
		<span class="small-overline">FOLLOW THE ERROR BACKWARD</span>
		<h3>How does one weight learn?</h3>
		<p>
			One input, one tanh neuron, one linear output. Every number below comes from this tiny
			network.
		</p>
	</header>
	<div class="workspace">
		<div class="plot-panel">
			<svg
				viewBox="0 0 600 245"
				role="img"
				aria-label="Seven training targets and the current prediction curve. The selected example is outlined. Vertical scale is minus 1.5 to 1.5; values outside are clipped."
			>
				<line x1="30" x2="570" y1={py(0)} y2={py(0)} stroke="var(--plot-line)" />
				<line x1={px(0)} x2={px(0)} y1="30" y2="210" stroke="var(--plot-line)" />
				<path d={curve} fill="none" stroke="var(--lavender)" stroke-width="3" />
				{#each TINY_EXAMPLES as item (item.x)}<circle
						cx={px(item.x)}
						cy={py(item.y)}
						r="4"
						fill="var(--blue)"
					/>{/each}
				<line
					x1={px(example.x)}
					x2={px(example.x)}
					y1={py(example.y)}
					y2={py(trace.prediction)}
					stroke="var(--orange)"
					stroke-width="2"
					stroke-dasharray="4 4"
				/>
				<circle
					cx={px(example.x)}
					cy={py(example.y)}
					r="9"
					fill="none"
					stroke="var(--blue)"
					stroke-width="2"
				/>
				<text x="30" y="234">−1.2</text><text x="287" y="234">input x</text><text x="552" y="234"
					>1.2</text
				>
			</svg>
			<p class="legend">
				<span>● Training targets</span><span>— Current prediction</span><span>⋮ Selected error</span
				>
			</p>
			<label for={`${uid}-control-1`}
				>Inspect example <output>{selected + 1} of 7</output><input
					id={`${uid}-control-1`}
					type="range"
					min="0"
					max="6"
					step="1"
					bind:value={selected}
				/></label
			>
		</div>
		<div class="controls">
			<label for={`${uid}-control-2`}
				>Learning rate <output>{rate.toFixed(2)}</output><input
					id={`${uid}-control-2`}
					type="range"
					min="0.01"
					max="0.8"
					step="0.01"
					bind:value={rate}
				/></label
			>
			<button class="primary-button" onclick={step}>Apply one SGD update</button>
			<button class="secondary" onclick={epoch}>Train one pass · 7 updates</button>
			<button class="text-button" onclick={reset}>Reset weights</button>
			<div class="metric">
				<span>Mean squared error · 7 training examples</span><strong>{f(meanLoss)}</strong><small
					>{updates} SGD updates · no test set in this mechanism demo</small
				>
			</div>
		</div>
	</div>
	<div class="flow" aria-label="Computed forward pass">
		<div>
			<span>1 · Input & target</span><code>x = {f(example.x)}<br />y = {f(example.y)}</code>
		</div>
		<div><span>2 · Weighted sum</span><code>z = w × x + b<br />= {f(trace.z)}</code></div>
		<div><span>3 · Activation</span><code>h = tanh(z)<br />= {f(trace.h)}</code></div>
		<div><span>4 · Prediction</span><code>ŷ = v × h + c<br />= {f(trace.prediction)}</code></div>
		<div><span>5 · Squared error</span><code>L = (ŷ − y)²<br />= {f(trace.loss)}</code></div>
	</div>
	<div class="inspection">
		<h4>Follow one parameter</h4>
		<div class="weight-choices" role="group" aria-label="Parameter to inspect">
			{#each WEIGHT_NAMES as key (key)}<button
					class:chosen={inspected === key}
					aria-pressed={inspected === key}
					onclick={() => (inspected = key)}
					><span>{names[key]}</span><strong>{f(weights[key])}</strong></button
				>{/each}
		</div>
		<p>
			The gradient is the local slope: how fast this example’s loss changes when this parameter
			increases by a tiny amount. A positive slope tells gradient descent to decrease the parameter.
		</p>
		<div class="derivative">
			<span>Chain rule for {inspected}</span>
			{#if inspected === 'w'}<code
					>∂L/∂w = 2(ŷ − y) × v × (1 − h²) × x<br />= {f(trace.outputSlope)} × {f(weights.v)} × {f(
						trace.activationSlope
					)} × {f(example.x)}</code
				>
			{:else if inspected === 'b'}<code
					>∂L/∂b = 2(ŷ − y) × v × (1 − h²)<br />= {f(trace.outputSlope)} × {f(weights.v)} × {f(
						trace.activationSlope
					)}</code
				>
			{:else if inspected === 'v'}<code
					>∂L/∂v = 2(ŷ − y) × h<br />= {f(trace.outputSlope)} × {f(trace.h)}</code
				>
			{:else}<code>∂L/∂c = 2(ŷ − y) = {f(trace.outputSlope)}</code>{/if}
			<strong>Gradient = {f(trace.gradients[inspected])}</strong>
		</div>
		<div class="comparison">
			<div>
				<span>Check it by changing the weight</span><strong>{f(measuredSlope)}</strong>
				<p>
					[L({inspected} + ε) − L({inspected} − ε)] / (2ε), with ε = 0.00001. This independent numerical
					check should match the chain rule.
				</p>
			</div>
			<div>
				<span>Preview the next update</span><code
					>{inspected}′ = {f(weights[inspected])} − {rate.toFixed(2)} × {f(
						trace.gradients[inspected]
					)}<br />= {f(nextWeights[inspected])}</code
				>
				<p>
					Updating all four parameters together gives prediction {f(nextTrace.prediction)} and loss {f(
						nextTrace.loss
					)}. A large step can overshoot.
				</p>
			</div>
		</div>
		<label for={`${uid}-control-3`}
			>Nudge size <output>{nudge.toFixed(2)}</output><input
				id={`${uid}-control-3`}
				type="range"
				min="0.01"
				max="0.5"
				step="0.01"
				bind:value={nudge}
			/></label
		>
		<p>
			Predict before clicking: increasing {inspected} by {nudge.toFixed(2)} has a first-order loss-change
			estimate of {f(trace.gradients[inspected] * nudge)}. The actual change would be {f(
				nudgedTrace.loss - trace.loss
			)}. Larger nudges make the local approximation less reliable.
		</p>
		<div class="nudge-actions">
			<button class="secondary" onclick={() => applyNudge(-1)}>Decrease {inspected}</button><button
				class="secondary"
				onclick={() => applyNudge(1)}>Increase {inspected}</button
			>
		</div>
		<p class="status" role="status" aria-label="Gradient result">{lastAction}</p>
	</div>
</section>

<style>
	.gradient-lab {
		background: var(--surface);
		border-radius: 24px;
		padding: clamp(20px, 3vw, 38px);
		container-type: inline-size;
	}
	h3 {
		font: italic 400 clamp(30px, 3.2vw, 44px) var(--serif);
		margin: 10px 0;
	}
	h4 {
		font-size: 15px;
		font-weight: 550;
		margin: 0 0 15px;
	}
	p {
		color: var(--muted);
		font-size: 12px;
		line-height: 1.8;
	}
	.workspace {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 235px;
		gap: 24px;
		margin: 24px 0;
	}
	.plot-panel,
	.controls,
	.inspection {
		background: var(--lab-inset);
		border-radius: 16px;
		padding: 20px;
		min-width: 0;
	}
	svg {
		width: 100%;
		display: block;
	}
	svg text {
		fill: var(--muted);
		font: 11px var(--sans);
	}
	.legend {
		display: flex;
		flex-wrap: wrap;
		gap: 12px;
		font-size: 10px;
	}
	.legend span:first-child {
		color: var(--blue);
	}
	.legend span:nth-child(2) {
		color: var(--lavender);
	}
	.legend span:last-child {
		color: var(--orange);
	}
	label {
		display: block;
		font-size: 12px;
		color: var(--muted);
	}
	output {
		float: right;
		font: 11px var(--mono);
		color: var(--blue);
	}
	input {
		width: 100%;
		display: block;
		margin: 12px 0 18px;
	}
	button {
		cursor: pointer;
	}
	.controls button {
		width: 100%;
		margin-bottom: 8px;
		font-size: 11px;
	}
	.secondary {
		padding: 12px 16px;
		color: var(--blue);
		border: 1px solid var(--line);
		background: var(--surface);
		border-radius: 10px;
		font-size: 12px;
	}
	.metric {
		margin-top: 14px;
	}
	.metric span,
	.metric small {
		display: block;
		font-size: 10px;
		color: var(--muted);
		line-height: 1.6;
	}
	.metric strong {
		display: block;
		font: 25px var(--mono);
		color: var(--blue);
		margin: 8px 0;
	}
	.flow {
		display: grid;
		grid-template-columns: repeat(5, 1fr);
		gap: 10px;
		margin-bottom: 22px;
	}
	.flow > div {
		padding: 15px;
		background: var(--lab-inset);
		border-radius: 12px;
		min-width: 0;
	}
	.flow span,
	.derivative > span,
	.comparison span {
		display: block;
		color: var(--muted);
		font-size: 10px;
		margin-bottom: 10px;
	}
	code {
		font: 11px/1.9 var(--mono);
		color: var(--ink);
		overflow-wrap: anywhere;
	}
	.weight-choices {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 8px;
	}
	.weight-choices button {
		text-align: left;
		border: 1px solid var(--line);
		background: var(--surface);
		color: var(--muted);
		padding: 12px;
		border-radius: 10px;
	}
	.weight-choices .chosen {
		border-color: var(--blue);
		color: var(--blue);
	}
	.weight-choices span {
		display: block;
		font-size: 10px;
	}
	.weight-choices strong {
		display: block;
		font: 17px var(--mono);
		margin-top: 6px;
	}
	.derivative {
		border-left: 2px solid var(--lavender);
		padding: 10px 16px;
	}
	.derivative strong {
		display: block;
		color: var(--lavender);
		font: 14px var(--mono);
		margin-top: 12px;
	}
	.comparison {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 24px;
		margin: 25px 0;
	}
	.comparison strong {
		color: var(--blue);
		font: 22px var(--mono);
	}
	.nudge-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
	}
	.status {
		color: var(--blue);
		margin-bottom: 0;
	}
	@container (max-width: 740px) {
		.workspace {
			grid-template-columns: 1fr;
		}
		.flow {
			grid-template-columns: repeat(3, 1fr);
		}
	}
	@container (max-width: 470px) {
		.flow,
		.weight-choices,
		.comparison {
			grid-template-columns: 1fr 1fr;
		}
		.comparison {
			grid-template-columns: 1fr;
			gap: 10px;
		}
		.plot-panel,
		.controls,
		.inspection {
			padding: 14px;
		}
		.flow > div {
			padding: 11px;
		}
	}
</style>
