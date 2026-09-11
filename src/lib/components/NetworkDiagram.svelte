<script lang="ts">
	import { onDestroy } from 'svelte';
	import PatternIcon from './PatternIcon.svelte';
	import type { Network } from '$lib/ml/models';
	import { inspectNetwork, neuronResponse } from '$lib/ml/network-inspection';

	let {
		network,
		revision = 0,
		input,
		oninput,
		onpause
	}: {
		network: Network;
		revision?: number;
		input: number[];
		oninput: (input: number[]) => void;
		onpause: () => void;
	} = $props();
	let selection = $state({ layer: 1, index: 0 });
	let traceStep = $state(-1);
	let traceRevision = $state(-1);
	let tracing = $state(false);
	let timer: ReturnType<typeof setInterval> | undefined;
	const uid = $props.id();
	const lastLayer = $derived(network.sizes.length - 1);
	const selectedLayer = $derived(Math.min(selection.layer, lastLayer));
	const selectedIndex = $derived(Math.min(selection.index, network.sizes[selectedLayer] - 1));
	const layers = $derived.by(() => {
		void revision;
		return inspectNetwork(network, input);
	});
	const selected = $derived(layers[selectedLayer][selectedIndex]);
	const output = $derived(layers[lastLayer][0].activation);
	const weightCount = $derived(
		network.sizes.slice(1).reduce((sum, size, i) => sum + size * network.sizes[i], 0)
	);
	const biasCount = $derived(network.sizes.slice(1).reduce((sum, size) => sum + size, 0));
	const stage = $derived(traceRevision === revision ? traceStep : -1);
	const response = $derived.by(() => {
		void revision;
		return neuronResponse(network, selectedLayer, selectedIndex);
	});
	const responseScale = $derived(Math.max(1, ...response.map((point) => Math.abs(point.value))));
	const inputCount = $derived(network.sizes[0]);
	const edgeScale = $derived.by(() => {
		void revision;
		return Math.max(1, ...network.weights.flat(2).map(Math.abs));
	});
	const x = (layer: number) => 100 + (layer / lastLayer) * 840;
	const y = (index: number, count: number) =>
		310 + (index - (count - 1) / 2) * (count > 2 ? 42 : 88);
	const fixed = (value: number, digits = 3) => value.toFixed(digits);
	const probability = (value: number) =>
		value < 0.01 ? '<1%' : value > 0.99 ? '>99%' : `${Math.round(value * 100)}%`;
	const signed = (value: number) => `${value >= 0 ? '+' : '−'}${Math.abs(value).toFixed(3)}`;
	const tint = (value: number) =>
		value >= 0 ? 'var(--neural-positive)' : 'var(--neural-negative)';
	const nodeName = (layer: number, index: number) =>
		!layer
			? `Input x${index + 1}`
			: layer === lastLayer
				? 'Output neuron'
				: `Hidden layer ${layer}, neuron ${index + 1}`;
	const sourceName = (index: number) =>
		selectedLayer === 1 ? `x${index + 1}` : `h${selectedLayer - 1}.${index + 1}`;
	function stopTrace() {
		if (timer) clearInterval(timer);
		timer = undefined;
		tracing = false;
	}
	function moveInput(index: number, value: number) {
		stopTrace();
		traceStep = -1;
		oninput(input.map((old, i) => (i === index ? value : old)));
	}
	function select(layer: number, index: number) {
		stopTrace();
		traceStep = -1;
		selection = { layer, index };
	}
	function step() {
		onpause();
		stopTrace();
		traceRevision = revision;
		traceStep = stage < 0 || stage === lastLayer ? 0 : stage + 1;
		selection = { layer: traceStep, index: 0 };
	}
	function playTrace() {
		onpause();
		stopTrace();
		traceRevision = revision;
		traceStep = 0;
		selection = { layer: 0, index: 0 };
		tracing = true;
		timer = setInterval(() => {
			if (traceRevision !== revision || traceStep === lastLayer) {
				stopTrace();
				return;
			}
			traceStep += 1;
			selection = { layer: traceStep, index: 0 };
		}, 1200);
	}
	onDestroy(stopTrace);
</script>

<section class="neural-observatory" aria-label="Explore the actual neural network">
	<div class="observatory-heading">
		<div>
			<div class="observatory-kicker">
				<PatternIcon name="neural" size={20} /> EVERY CONNECTION, EXPOSED
			</div>
			<h3>Inside this network.</h3>
			<p>Move an input. Select a neuron. Follow the numbers.</p>
		</div>
		<div class="architecture-count">
			<strong>{network.sizes.join(' → ')}</strong><span
				>{weightCount} weights + {biasCount} biases</span
			><small
				>All {network.sizes.reduce((sum, size) => sum + size, 0)} nodes shown · epoch {revision}</small
			>
		</div>
	</div>

	<div class="signal-controls">
		<div class="input-sliders">
			{#each input as value, index (index)}
				<label for={`${uid}-input-${index}`}>
					<span>Input x{index + 1} <strong>{fixed(value, 2)}</strong></span>
					<input
						id={`${uid}-input-${index}`}
						aria-label={`Network input x${index + 1}`}
						type="range"
						min="-1"
						max="1"
						step="0.01"
						{value}
						oninput={(event) => moveInput(index, Number(event.currentTarget.value))}
					/>
				</label>
			{/each}
		</div>
		<div class="trace-buttons">
			<button class="trace-primary" onclick={playTrace}
				><PatternIcon name={tracing ? 'reset' : 'play'} size={17} />{tracing
					? 'Replay'
					: 'Trace a prediction'}</button
			>
			<button class="trace-step" onclick={step} aria-label="Advance one layer"
				><PatternIcon name="next" size={18} /> Step</button
			>
		</div>
	</div>

	<!-- svelte-ignore a11y_no_noninteractive_tabindex (Keyboard focus lets users pan the complete network on narrow screens.) -->
	<div
		class="diagram-scroll"
		role="region"
		aria-label="Complete network. Scroll horizontally on small screens."
		tabindex="0"
	>
		<svg
			class="complete-network"
			viewBox="0 0 1040 616"
			aria-label={`${inputCount} input nodes, ${network.sizes.slice(1, -1).join(' and ') || 'no'} hidden neurons per layer, 1 output neuron, and ${weightCount} learned connections.`}
			role="group"
		>
			{#each layers as layer, layerIndex (layerIndex)}
				<text x={x(layerIndex)} y="29" text-anchor="middle" class="layer-title"
					>{layerIndex === 0
						? 'INPUT'
						: layerIndex === lastLayer
							? 'PREDICTION'
							: `HIDDEN LAYER ${layerIndex}`}</text
				>
				<text x={x(layerIndex)} y="52" text-anchor="middle" class="layer-subtitle"
					>{layerIndex === 0
						? `${layer.length} ${layer.length === 1 ? 'coordinate' : 'coordinates'}`
						: layerIndex === lastLayer
							? network.classification
								? 'sigmoid · 0 to 1'
								: 'linear · a number'
							: `${layer.length} neurons · tanh`}</text
				>
			{/each}
			{#each layers.slice(1) as layer (layer[0].layer)}
				{#each layer as neuron (neuron.id)}
					{#each neuron.contributions as edge, source (edge.id)}
						{@const incoming = selected.id === neuron.id}
						{@const outgoing = selected.id === edge.id}
						<path
							data-weight={`${edge.id}:${neuron.id}`}
							d={`M${x(neuron.layer - 1)},${y(source, layers[neuron.layer - 1].length)} C${x(neuron.layer - 1) + (x(neuron.layer) - x(neuron.layer - 1)) * 0.48},${y(source, layers[neuron.layer - 1].length)} ${x(neuron.layer) - (x(neuron.layer) - x(neuron.layer - 1)) * 0.48},${y(neuron.index, layer.length)} ${x(neuron.layer)},${y(neuron.index, layer.length)}`}
							fill="none"
							stroke={tint(edge.weight)}
							stroke-width={(incoming ? 1.5 : 0.65) +
								(Math.abs(edge.weight) / edgeScale) * (incoming ? 3 : 1.5)}
							opacity={stage >= 0 && neuron.layer > stage
								? 0.045
								: incoming
									? 0.85
									: outgoing
										? 0.36
										: 0.14}
							class:signal-arriving={tracing && neuron.layer === stage}
						>
							<title
								>{nodeName(neuron.layer - 1, source)} → {nodeName(neuron.layer, neuron.index)}:
								weight {fixed(edge.weight, 5)}, contribution {fixed(edge.product, 5)}</title
							>
						</path>
					{/each}
				{/each}
			{/each}
			{#each layers as layer, layerIndex (layerIndex)}
				{#each layer as neuron (neuron.id)}
					{@const active = neuron.id === selected.id}
					{@const radius = layerIndex === 0 ? 27 : layerIndex === lastLayer ? 36 : 20}
					<g
						data-neuron={neuron.id}
						role="button"
						tabindex="0"
						aria-label={`${nodeName(layerIndex, neuron.index)}, activation ${fixed(neuron.activation, 4)}`}
						aria-pressed={active}
						onclick={() => select(layerIndex, neuron.index)}
						onkeydown={(event) => {
							if (event.key === 'Enter' || event.key === ' ') {
								event.preventDefault();
								select(layerIndex, neuron.index);
							}
						}}
						class="neuron"
						class:selected-neuron={active}
						class:future-neuron={stage >= 0 && layerIndex > stage}
					>
						<circle
							class="node-halo"
							cx={x(layerIndex)}
							cy={y(neuron.index, layer.length)}
							r={radius + 4}
						/>
						<circle
							class="node-base"
							cx={x(layerIndex)}
							cy={y(neuron.index, layer.length)}
							r={radius}
						/>
						<circle
							cx={x(layerIndex)}
							cy={y(neuron.index, layer.length)}
							r={radius}
							fill={tint(neuron.activation)}
							fill-opacity={0.14 + Math.min(1, Math.abs(neuron.activation)) * 0.7}
							stroke={tint(neuron.activation)}
							stroke-opacity={0.45 + Math.min(1, Math.abs(neuron.activation)) * 0.55}
							stroke-width="1.5"
						/>
						<text
							class="node-value"
							class:bright-node={Math.abs(neuron.activation) >=
								(neuron.activation >= 0 ? 0.62 : 0.65)}
							x={x(layerIndex)}
							y={y(neuron.index, layer.length) + 4}
							text-anchor="middle"
							>{layerIndex === lastLayer && network.classification
								? probability(neuron.activation)
								: fixed(neuron.activation, 2).replace(/^(-?)0\./, '$1.')}</text
						>
						{#if layerIndex < lastLayer}<text
								class="node-index"
								x={x(layerIndex) - radius - 12}
								y={y(neuron.index, layer.length) + 4}
								text-anchor="end"
								>{layerIndex === 0
									? `x${neuron.index + 1}`
									: String(neuron.index + 1).padStart(2, '0')}</text
							>{/if}
					</g>
				{/each}
			{/each}
			<text x={x(lastLayer)} y="377" text-anchor="middle" class="output-description"
				>{network.classification ? 'P(outer ring)' : 'Predicted value'}</text
			>
			<text x="520" y="590" text-anchor="middle" class="network-footnote"
				>{network.sizes.length === 2
					? 'No hidden layer: one weighted sum goes straight to the output.'
					: 'Every hidden neuron receives every value from the preceding layer.'}</text
			>
		</svg>
	</div>
	<div class="network-key">
		<span><i class="positive"></i>Positive</span><span><i class="negative"></i>Negative</span><span
			>Node fill = activation · line width = |weight|</span
		><span class="mobile-pan">Swipe to explore the whole network</span>
	</div>
	<div class="forward-story" aria-live="polite">
		<PatternIcon name="arrowRight" size={19} />
		<p>
			{stage < 0
				? `These are the actual values for this input. ${network.classification ? `The network assigns ${probability(output)} to the outer ring.` : `The network predicts ${fixed(output)}.`}`
				: stage === 0
					? 'Start with the input coordinates. Inference changes activations, not the learned weights.'
					: stage < lastLayer
						? `Layer ${stage}: each neuron multiplies its inputs by weights, adds a bias, then applies tanh. Its result becomes an input to the next layer.`
						: network.classification
							? `The output neuron applies sigmoid to its weighted sum: ${probability(output)} outer ring, ${probability(1 - output)} inner circle.`
							: `The final neuron keeps its weighted sum as a number: ${fixed(output)}. No sigmoid is applied in regression.`}
		</p>
	</div>

	<div class="neuron-inspector">
		<div class="neuron-arithmetic">
			<div class="inspector-heading">
				<span class="inspector-tag"
					>{selected.function === 'input' ? 'THE INPUT' : 'UNDER THE SURFACE'}</span
				>
				<h4>{nodeName(selectedLayer, selectedIndex)}</h4>
			</div>
			{#if selected.function === 'input'}
				<p class="inspector-description">
					This value comes from the input slider. It has no learned weights or bias of its own. The
					next layer receives it.
				</p>
				<div class="calculation">
					<span>Input coordinate</span><strong data-testid="neuron-activation"
						>{fixed(selected.activation, 4)}</strong
					>
				</div>
			{:else}
				<div class="calculation-flow">
					<div class="calculation">
						<span>Weighted inputs</span><strong>{fixed(selected.sum - selected.bias, 4)}</strong>
					</div>
					<span class="calculation-symbol">+</span>
					<div class="calculation"><span>Bias</span><strong>{fixed(selected.bias, 4)}</strong></div>
					<span class="calculation-symbol">=</span>
					<div class="calculation">
						<span>Weighted sum z</span><strong data-testid="neuron-sum"
							>{fixed(selected.sum, 4)}</strong
						>
					</div>
				</div>
				<div class="activation-result">
					<span
						>{selected.function === 'tanh'
							? 'tanh squashes the sum to −1 … +1'
							: selected.function === 'sigmoid'
								? 'sigmoid converts the sum to 0 … 1'
								: 'A linear output keeps the weighted sum'}</span
					><strong data-testid="neuron-activation"
						>{selected.function === 'linear' ? 'z' : `${selected.function}(z)`} = {fixed(
							selected.activation,
							4
						)}</strong
					>
				</div>
				<details class="contribution-details" open>
					<summary>Every incoming contribution <span>{selected.contributions.length}</span></summary
					>
					<div class="contribution-grid">
						{#each selected.contributions as term, index (term.id)}<div
								class="contribution"
								data-contribution={term.id}
							>
								<span>{sourceName(index)}</span><span
									>{fixed(term.input)} × {fixed(term.weight)}</span
								><strong style:color={tint(term.product)}>{signed(term.product)}</strong>
							</div>{/each}
					</div>
				</details>
			{/if}
		</div>
		<div class="neuron-response">
			<h4>What this neuron responds to</h4>
			<p>Same weights, many inputs. {inputCount === 2 ? 'The cross' : 'The dot'} marks yours.</p>
			<svg
				viewBox="0 0 230 230"
				role="img"
				aria-label={`Activation map of ${nodeName(selectedLayer, selectedIndex)} across inputs from minus one to one. Current activation ${fixed(selected.activation, 4)}.`}
			>
				{#if inputCount === 2}
					{#each response as point (point.id)}<rect
							x={16 + (point.id % 21) * 9.43}
							y={10 + Math.floor(point.id / 21) * 9.43}
							width="9.6"
							height="9.6"
							fill={tint(point.value)}
							fill-opacity={0.12 + (Math.abs(point.value) / responseScale) * 0.8}
						/>{/each}
					<path
						d={`M${21 + (input[0] + 1) * 94.3 - 6},${15 + (1 - input[1]) * 94.3}h12 M${21 + (input[0] + 1) * 94.3},${15 + (1 - input[1]) * 94.3 - 6}v12`}
						class="probe-cross-shadow"
					/><path
						d={`M${21 + (input[0] + 1) * 94.3 - 6},${15 + (1 - input[1]) * 94.3}h12 M${21 + (input[0] + 1) * 94.3},${15 + (1 - input[1]) * 94.3 - 6}v12`}
						class="probe-cross"
					/>
				{:else}
					<line x1="16" y1="109" x2="214" y2="109" stroke="var(--line)" />
					<path
						d={response
							.map(
								(point, i) =>
									`${i ? 'L' : 'M'}${16 + (point.x + 1) * 99},${109 - (point.value / responseScale) * 90}`
							)
							.join(' ')}
						fill="none"
						stroke="var(--neural-positive)"
						stroke-width="3"
					/>
					<circle
						cx={16 + (input[0] + 1) * 99}
						cy={109 - (selected.activation / responseScale) * 90}
						r="5"
						fill="var(--ink)"
					/>
				{/if}
				<text x="16" y="227">−1</text><text x="115" y="227" text-anchor="middle">x1 →</text><text
					x="214"
					y="227"
					text-anchor="end">+1</text
				>
			</svg>
			<span class="response-caption"
				>{inputCount === 2
					? 'x2 increases from bottom to top'
					: `Vertical range: −${responseScale.toFixed(1)} to +${responseScale.toFixed(1)}`}</span
			>
		</div>
	</div>
</section>

<style>
	.neural-observatory {
		--neural-positive: #7bcbb8;
		--neural-negative: #e8aa87;
		--neural-node-text: #fff;
		--neural-node-bright-text: #000;
		margin: 0 0 28px;
		padding: 32px;
		border-radius: 24px;
		background: var(--surface);
		overflow: hidden;
	}
	:global([data-theme='light']) .neural-observatory {
		--neural-positive: #237d69;
		--neural-negative: #b16538;
		--neural-node-text: #000;
		--neural-node-bright-text: #000;
	}
	.observatory-heading {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 24px;
	}
	.observatory-kicker {
		display: flex;
		align-items: center;
		gap: 10px;
		color: var(--muted);
		font: 10px var(--mono);
		letter-spacing: 0.12em;
	}
	h3 {
		margin: 15px 0 8px;
		font: italic clamp(34px, 3.5vw, 48px)/1 var(--serif);
		color: var(--ink);
	}
	.observatory-heading p {
		margin: 0;
		font-size: 14px;
		color: var(--muted);
	}
	.architecture-count {
		text-align: right;
		display: grid;
		gap: 7px;
	}
	.architecture-count strong {
		font: 22px var(--mono);
		color: var(--ink);
	}
	.architecture-count span {
		font-size: 12px;
		color: var(--muted);
	}
	.architecture-count small {
		font-size: 11px;
		color: var(--quiet);
	}
	.signal-controls {
		margin-top: 28px;
		padding: 20px 22px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 32px;
		border-radius: 16px;
		background: var(--input);
	}
	.input-sliders {
		display: flex;
		gap: 32px;
		flex: 1;
		max-width: 440px;
	}
	.input-sliders label {
		display: grid;
		gap: 10px;
		flex: 1;
		min-width: 0;
		font-size: 12px;
		color: var(--muted);
	}
	.input-sliders label span {
		display: flex;
		justify-content: space-between;
	}
	.input-sliders strong {
		font: 12px var(--mono);
		color: var(--ink);
	}
	.input-sliders input {
		width: 100%;
		margin: 0;
		accent-color: var(--neural-positive);
	}
	.trace-buttons {
		display: flex;
		gap: 8px;
	}
	.trace-buttons button {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		min-height: 42px;
		border: 0;
		border-radius: 12px;
		cursor: pointer;
		font-size: 12px;
		padding: 10px 14px;
	}
	.trace-primary {
		background: var(--surface-raised);
		color: var(--ink);
	}
	.trace-step {
		background: transparent;
		color: var(--muted);
	}
	.trace-buttons button:hover {
		background: color-mix(in srgb, var(--neural-positive) 20%, var(--surface-raised));
	}
	.diagram-scroll {
		overflow-x: auto;
		overscroll-behavior-inline: contain;
		margin: 24px -12px 0;
		scrollbar-width: thin;
	}
	.complete-network {
		width: 100%;
		min-width: 940px;
		display: block;
	}
	.layer-title {
		fill: var(--ink);
		font: 11px var(--mono);
		letter-spacing: 0.08em;
	}
	.layer-subtitle {
		fill: var(--muted);
		font:
			12px 'DM Sans Variable',
			sans-serif;
	}
	.neuron {
		cursor: pointer;
		outline: none;
	}
	.node-base {
		fill: var(--input);
	}
	.node-halo {
		fill: none;
		stroke: var(--ink);
		stroke-width: 1.2;
		opacity: 0;
	}
	.neuron:hover .node-halo,
	.neuron:focus-visible .node-halo,
	.selected-neuron .node-halo {
		opacity: 0.85;
	}
	.node-value {
		fill: var(--neural-node-text);
		font: 12px var(--mono);
		pointer-events: none;
	}
	.bright-node {
		fill: var(--neural-node-bright-text);
	}
	.node-index {
		fill: var(--muted);
		font: 10px var(--mono);
	}
	.future-neuron {
		opacity: 0.25;
	}
	.output-description {
		fill: var(--muted);
		font:
			13px 'DM Sans Variable',
			sans-serif;
	}
	.network-footnote {
		fill: var(--muted);
		font:
			12px 'DM Sans Variable',
			sans-serif;
	}
	.signal-arriving {
		animation: signal 1.2s ease-out;
	}
	@keyframes signal {
		from {
			stroke-dasharray: 5 12;
			stroke-dashoffset: 64;
		}
		to {
			stroke-dasharray: 5 12;
			stroke-dashoffset: 0;
		}
	}
	.network-key {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		align-items: center;
		gap: 10px 20px;
		color: var(--muted);
		font-size: 11px;
		padding: 6px 0 24px;
	}
	.network-key span {
		display: flex;
		align-items: center;
		gap: 6px;
	}
	.network-key i {
		width: 7px;
		height: 7px;
		border-radius: 50%;
	}
	.positive {
		background: var(--neural-positive);
	}
	.negative {
		background: var(--neural-negative);
	}
	.mobile-pan {
		display: none !important;
	}
	.forward-story {
		display: flex;
		align-items: center;
		gap: 14px;
		padding: 17px 20px;
		background: color-mix(in srgb, var(--neural-positive) 8%, var(--input));
		border-radius: 14px;
		color: var(--neural-positive);
	}
	.forward-story :global(svg) {
		flex: none;
	}
	.forward-story p {
		margin: 0;
		color: var(--muted);
		font-size: 13px;
		line-height: 1.6;
	}
	.neuron-inspector {
		margin-top: 28px;
		display: grid;
		grid-template-columns: minmax(0, 1fr) 240px;
		gap: 34px;
	}
	.inspector-tag {
		color: var(--quiet);
		font: 9px var(--mono);
		letter-spacing: 0.12em;
	}
	h4 {
		margin: 8px 0 20px;
		color: var(--ink);
		font-size: 16px;
		font-weight: 500;
	}
	.calculation-flow {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}
	.calculation {
		display: grid;
		gap: 10px;
	}
	.calculation span {
		color: var(--muted);
		font-size: 11px;
	}
	.calculation strong {
		font: clamp(15px, 1.75vw, 23px) var(--mono);
		color: var(--ink);
	}
	.calculation-symbol {
		color: var(--quiet);
		font-size: 18px;
	}
	.activation-result {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 14px;
		background: var(--input);
		border-radius: 12px;
		padding: 16px;
		margin-top: 20px;
	}
	.activation-result span {
		font-size: 11px;
		line-height: 1.6;
		color: var(--muted);
		max-width: 200px;
	}
	.activation-result strong {
		color: var(--neural-positive);
		font: 14px var(--mono);
		white-space: nowrap;
	}
	.contribution-details {
		margin-top: 20px;
	}
	.contribution-details summary {
		color: var(--muted);
		font-size: 12px;
		cursor: pointer;
	}
	.contribution-details summary span {
		color: var(--quiet);
		padding-left: 5px;
	}
	.contribution-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(125px, 1fr));
		gap: 8px;
		margin-top: 13px;
	}
	.contribution {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 5px;
		padding: 10px 12px;
		border-radius: 10px;
		background: var(--input);
		font: 10px var(--mono);
	}
	.contribution > span:first-child {
		color: var(--ink);
	}
	.contribution > span:nth-child(2) {
		grid-row: 2;
		grid-column: 1 / -1;
		color: var(--muted);
	}
	.contribution strong {
		grid-row: 1;
		grid-column: 2;
		font-weight: 400;
	}
	.neuron-response {
		min-width: 0;
		background: var(--input);
		padding: 17px;
		border-radius: 16px;
		align-self: start;
	}
	.neuron-response h4 {
		margin: 0 0 6px;
		font-size: 13px;
	}
	.neuron-response p {
		color: var(--muted);
		font-size: 10px;
		line-height: 1.6;
		margin: 0 0 10px;
	}
	.neuron-response svg {
		width: 100%;
		display: block;
		border-radius: 6px;
	}
	.neuron-response svg text {
		fill: var(--muted);
		font: 9px var(--mono);
	}
	.response-caption {
		font-size: 10px;
		color: var(--quiet);
		display: block;
		text-align: center;
		margin-top: 8px;
	}
	.probe-cross-shadow {
		stroke: var(--input);
		stroke-width: 5;
	}
	.probe-cross {
		stroke: var(--ink);
		stroke-width: 2;
	}
	.inspector-description {
		color: var(--muted);
		font-size: 13px;
		line-height: 1.8;
		max-width: 420px;
	}
	@media (max-width: 1100px) {
		.neural-observatory {
			padding: 26px;
		}
		.signal-controls {
			gap: 20px;
		}
		.input-sliders {
			gap: 22px;
		}
		.neuron-inspector {
			grid-template-columns: minmax(0, 1fr) 200px;
			gap: 22px;
		}
		.activation-result {
			align-items: flex-start;
			flex-direction: column;
			gap: 6px;
		}
		.activation-result span {
			max-width: none;
		}
	}
	@media (max-width: 760px) {
		.observatory-heading {
			align-items: flex-start;
			flex-direction: column;
			gap: 20px;
		}
		.architecture-count {
			text-align: left;
			gap: 6px;
		}
		.architecture-count strong {
			font-size: 18px;
		}
		.signal-controls {
			flex-direction: column;
			align-items: stretch;
			padding: 17px;
		}
		.input-sliders {
			max-width: none;
		}
		.trace-buttons button {
			flex: 1;
		}
		.neuron-inspector {
			grid-template-columns: 1fr;
		}
		.neuron-response {
			max-width: 270px;
			width: 100%;
			justify-self: center;
			box-sizing: border-box;
		}
		.mobile-pan {
			display: flex !important;
			flex-basis: 100%;
			justify-content: center;
			color: var(--quiet);
		}
		.calculation strong {
			font-size: 16px;
		}
		.calculation-flow {
			gap: 9px;
		}
		.calculation span {
			font-size: 10px;
		}
		.neural-observatory {
			padding: 22px 18px;
		}
		.forward-story {
			padding: 14px;
		}
		.forward-story p {
			font-size: 12px;
		}
		.network-key {
			font-size: 10px;
			gap: 8px 12px;
		}
		.neuron-response h4 {
			font-size: 14px;
		}
		.neuron-response p {
			font-size: 11px;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.signal-arriving {
			animation: none;
		}
	}
</style>
