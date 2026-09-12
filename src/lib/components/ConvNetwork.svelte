<script lang="ts">
	import { onDestroy } from 'svelte';
	import KernelAtlas from './KernelAtlas.svelte';
	import { featurePatch, type FeatureAtlas } from '$lib/ml/feature-hierarchy';
	import ConvHeatmap from './ConvHeatmap.svelte';
	import PatternIcon from './PatternIcon.svelte';
	import {
		CONV_CLASSES,
		CONV_SHAPES,
		convMap,
		type ConvTrace,
		type ConvWeights
	} from '$lib/ml/convnet';
	import { inspectConvNeuron, kernelMagnitude } from '$lib/ml/conv-neuron';
	let {
		weights,
		trace,
		pixels,
		layer,
		channel,
		cellX,
		cellY,
		onselect,
		onlayer,
		atlas,
		trainingPixels
	}: {
		weights: ConvWeights;
		trace: ConvTrace;
		pixels: Float32Array;
		layer: number;
		channel: number;
		cellX: number;
		cellY: number;
		onselect: (layer: number, channel: number) => void;
		onlayer: (layer: number) => void;
		atlas?: FeatureAtlas;
		trainingPixels?: Float32Array;
	} = $props();
	let view = $state<'activations' | 'kernels' | 'examples'>('activations');
	function strongest(atLayer: number, atChannel: number) {
		const match = atlas?.layers[atLayer].channels[atChannel].examples[0];
		return match && trainingPixels
			? featurePatch(
					trainingPixels.subarray(match.index * 784, (match.index + 1) * 784),
					atLayer,
					match.x,
					match.y
				)
			: new Float32Array((2 ** (atLayer + 2) - 1) ** 2);
	}
	type Box = { x: number; y: number; width: number; height: number };
	let boxes = $state.raw<Record<string, Box>>({});
	let vertical = $state(false),
		source = $state(0),
		neuronOpen = $state(false);
	let phase = $state(-1),
		playing = $state(false);
	let timer: ReturnType<typeof setInterval> | undefined;
	const names = ['Edges', 'Contours', 'Parts'];
	const descriptions = [
		'784 brightness values enter the network.',
		'Eight learned filters scan 3 × 3 patches. ReLU keeps positive responses.',
		'Each new neuron combines a 3 × 3 patch from all eight previous maps.',
		'The next layer combines all sixteen maps. Its neurons can see 15 × 15 input pixels.',
		'Flattening keeps all 384 values. It changes their arrangement, not their values.',
		'Ten output neurons weigh all 384 values. Softmax converts their scores to probabilities.'
	];
	const scales = $derived(trace.maps.map((map) => Math.max(0.001, ...map)));
	const unit = $derived(inspectConvNeuron(weights, trace, pixels, layer, channel, cellX, cellY));
	const sourceIndex = $derived(Math.min(source, unit.sources.length - 1));
	const incoming = $derived(unit.sources[sourceIndex]);
	const weightScale = $derived(Math.max(0.001, ...incoming.kernel.map(Math.abs)));
	const inputScale = $derived(layer ? scales[layer - 1] : 1);
	const selectedMap = $derived(convMap(trace, layer, channel));
	function stop() {
		clearInterval(timer);
		playing = false;
		phase = -1;
	}
	function select(atLayer: number, atChannel: number) {
		stop();
		source = 0;
		onselect(atLayer, atChannel);
	}
	function selectLayer(atLayer: number) {
		stop();
		source = 0;
		onlayer(atLayer);
	}
	function play() {
		if (playing) {
			stop();
			return;
		}
		playing = true;
		phase = 0;
		timer = setInterval(() => {
			if (phase === 5) stop();
			else phase++;
		}, 1400);
	}
	onDestroy(() => clearInterval(timer));
	function measure(scene: HTMLDivElement) {
		const update = () => {
			const root = scene.getBoundingClientRect();
			const next: Record<string, Box> = {};
			for (const element of scene.querySelectorAll<HTMLElement>('[data-port]')) {
				const r = element.getBoundingClientRect();
				next[element.dataset.port!] = {
					x: r.x - root.x,
					y: r.y - root.y,
					width: r.width,
					height: r.height
				};
			}
			boxes = next;
			vertical = root.width < 720;
		};
		const observer = new ResizeObserver(update);
		observer.observe(scene);
		update();
		return () => observer.disconnect();
	}
	function route(from: string, to: string) {
		const a = boxes[from],
			b = boxes[to];
		if (!a || !b) return '';
		if (vertical) {
			const x1 = a.x + a.width / 2,
				y1 = a.y + a.height,
				x2 = b.x + b.width / 2,
				y2 = b.y;
			const mid = (y1 + y2) / 2;
			return `M ${x1} ${y1} C ${x1} ${mid}, ${x2} ${mid}, ${x2} ${y2}`;
		}
		const x1 = a.x + a.width,
			y1 = a.y + a.height / 2,
			x2 = b.x,
			y2 = b.y + b.height / 2;
		const mid = (x1 + x2) / 2;
		return `M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`;
	}
	const topology = [
		...CONV_SHAPES.flatMap((shape, atLayer) =>
			Array.from({ length: shape.output }, (_, output) =>
				Array.from({ length: shape.input }, (_, input) => ({
					from: atLayer ? `map-${atLayer - 1}-${input}` : 'input',
					to: `map-${atLayer}-${output}`
				}))
			).flat()
		),
		...Array.from({ length: 24 }, (_, i) => ({ from: `map-2-${i}`, to: 'flatten' }))
	];
	const headTopology = $derived(
		vertical
			? [{ from: 'flatten', to: 'head' }]
			: Array.from({ length: 10 }, (_, i) => ({ from: 'flatten', to: `output-${i}` }))
	);
	const diagram = $derived(
		vertical
			? {
					width: 330,
					height: 260,
					inputX: 34,
					firstY: 37,
					step: 23,
					sumX: 167,
					sumY: 129,
					outX: 286,
					r: 25
				}
			: {
					width: 600,
					height: 230,
					inputX: 61,
					firstY: 30,
					step: 21,
					sumX: 345,
					sumY: 114,
					outX: 540,
					r: 32
				}
	);

	const connections = $derived.by(() => {
		const lines: { from: string; to: string; strength: number }[] = [];
		const target = `map-${layer}-${channel}`;
		for (let i = 0; i < CONV_SHAPES[layer].input; i++)
			lines.push({
				from: layer ? `map-${layer - 1}-${i}` : 'input',
				to: target,
				strength: kernelMagnitude(weights, layer, channel, i)
			});
		if (layer < 2)
			for (let i = 0; i < CONV_SHAPES[layer + 1].output; i++)
				lines.push({
					from: target,
					to: `map-${layer + 1}-${i}`,
					strength: kernelMagnitude(weights, layer + 1, i, channel)
				});
		else {
			lines.push({ from: target, to: 'flatten', strength: 1 });
			for (const edge of headTopology) lines.push({ ...edge, strength: 1 });
		}
		const max = Math.max(0.001, ...lines.map((line) => line.strength));
		return lines.map((line) => ({ ...line, opacity: 0.18 + (0.62 * line.strength) / max }));
	});
</script>

<div class="conv-network" aria-label="The actual convolutional neural network">
	<div class="network-toolbar">
		<div>
			<PatternIcon name="neural" size={19} /><span
				>One connected network <small>8,578 learned parameters</small></span
			>
		</div>
		<button
			onclick={play}
			aria-label={playing ? 'Stop signal walkthrough' : 'Follow the signal through the network'}
		>
			<PatternIcon name={playing ? 'pause' : 'play'} size={14} />{playing
				? 'Stop'
				: 'Follow the signal'}
		</button>
	</div>
	<div class="network-views" role="group" aria-label="Network visualization type">
		<button aria-pressed={view === 'activations'} onclick={() => (view = 'activations')}
			><PatternIcon name="eye" size={16} />Activations</button
		>
		<button aria-pressed={view === 'kernels'} onclick={() => (view = 'kernels')}
			><PatternIcon name="grid" size={16} />Learned kernels</button
		>
		{#if atlas}<button aria-pressed={view === 'examples'} onclick={() => (view = 'examples')}
				><PatternIcon name="classification" size={16} />Strongest inputs</button
			>{/if}
	</div>
	<p class="view-explanation">
		{view === 'activations'
			? 'Responses to your chosen image. Each tile is one feature map; every cell is a neuron.'
			: view === 'kernels'
				? 'The actual learned weights. Each tiny 3 × 3 square connects one incoming map to this filter. Blue is negative; lavender is positive.'
				: 'The training-image patch that most excites each filter. These are evidence for an interpretation, not the weights or responses to your chosen image.'}
	</p>
	<div class="network-scene" {@attach measure} class:walking={playing}>
		<svg class="network-wires" aria-hidden="true">
			{#each [...topology, ...headTopology] as edge (`${edge.from}-${edge.to}`)}
				<path class="base-wire" d={route(edge.from, edge.to)} />
			{/each}
			{#each connections as edge (`${edge.from}-${edge.to}`)}
				<path d={route(edge.from, edge.to)} style:opacity={edge.opacity} />
			{/each}
		</svg>
		<div class="network-stage input-stage" class:lit={phase === 0}>
			<div class="stage-title"><strong>Image</strong><span>28 × 28 pixels</span></div>
			<div class="stage-body">
				<div class="input-tile" data-port="input">
					<ConvHeatmap
						values={pixels}
						side={28}
						kind="image"
						label="Image flowing through this network"
					/>
				</div>
			</div>
			<small>784 inputs</small>
		</div>
		{#each CONV_SHAPES as shape, i (shape.output)}
			<div class="network-stage map-stage" class:chosen={layer === i} class:lit={phase === i + 1}>
				<button
					class="stage-title"
					aria-label={`Explore layer ${i + 1}: ${names[i]}`}
					aria-pressed={layer === i}
					onclick={() => selectLayer(i)}
				>
					<strong>{names[i]}</strong><span>Layer {i + 1} · {shape.output} maps</span>
				</button>
				<div class="stage-body">
					<div class="map-bank" class:first-bank={i === 0} class:last-bank={i === 2}>
						{#each Array.from({ length: shape.output }, (_, n) => n) as index (index)}
							<button
								class="network-map"
								class:selected={layer === i && channel === index}
								data-port={`map-${i}-${index}`}
								data-layer={i}
								data-channel={index}
								aria-label={`Network layer ${i + 1}, feature ${index + 1}, ${shape.side ** 2} neurons`}
								aria-pressed={layer === i && channel === index}
								title={`Layer ${i + 1} · feature ${index + 1} · ${shape.side} × ${shape.side} neurons`}
								onclick={() => select(i, index)}
							>
								{#if view === 'kernels'}<KernelAtlas {weights} layer={i} channel={index} compact />
								{:else if view === 'examples'}<ConvHeatmap
										values={strongest(i, index)}
										side={2 ** (i + 2) - 1}
										kind="image"
									/>
								{:else}<ConvHeatmap
										values={convMap(trace, i, index)}
										side={shape.side}
										scale={scales[i]}
									/>{/if}
							</button>
						{/each}
					</div>
				</div>
				<small
					>{view === 'kernels'
						? `${shape.input} × (3 × 3) weights / filter`
						: view === 'examples'
							? `${2 ** (i + 2) - 1} × ${2 ** (i + 2) - 1} input pixels / patch`
							: `${shape.side} × ${shape.side} neurons / map`}</small
				>
			</div>
		{/each}
		<div class="network-stage flatten-stage" class:lit={phase === 4}>
			<div class="stage-title"><strong>Flatten</strong><span>Keep every value</span></div>
			<div class="stage-body">
				<div
					class="flatten-strip"
					data-port="flatten"
					aria-label="All 384 final-layer activations, in order"
				>
					{#each Array.from({ length: 384 }, (_, n) => n) as index (index)}<i
							style:opacity={0.13 + (0.87 * trace.maps[2][index]) / scales[2]}
						></i>{/each}
				</div>
			</div>
			<small>384 values</small>
		</div>
		<div class="network-stage output-stage" class:lit={phase === 5}>
			<div class="stage-title"><strong>Prediction</strong><span>10 output neurons</span></div>
			<div class="stage-body">
				<div class="output-bank" data-port="head">
					{#each CONV_CLASSES as name, label (name)}<div
							class="output-neuron"
							class:winner={trace.prediction === label}
							data-testid="network-output"
							data-score={trace.logits[label]}
						>
							<i data-port={`output-${label}`} style:--response={trace.probabilities[label]}
							></i><span>{name}</span><small>{(trace.probabilities[label] * 100).toFixed(0)}%</small
							>
						</div>{/each}
				</div>
			</div>
			<small>Dense layer → softmax</small>
		</div>
	</div>
	<div class="network-reading" aria-live="polite">
		<p>
			{phase >= 0
				? descriptions[phase]
				: `Selected: layer ${layer + 1}, filter ${channel + 1}. Its incoming and outgoing connections are highlighted. Selecting filters keeps your image fixed.`}
		</p>
		<button
			class:active={neuronOpen}
			onclick={() => (neuronOpen = !neuronOpen)}
			aria-expanded={neuronOpen}
		>
			<PatternIcon name="zoomIn" size={16} />Inside one neuron<PatternIcon
				name="chevronDown"
				size={12}
			/>
		</button>
	</div>
	{#if view === 'kernels'}<div class="selected-kernels">
			<div>
				<strong>Layer {layer + 1} · filter {channel + 1}</strong>
				<p>
					{CONV_SHAPES[layer].input} incoming {CONV_SHAPES[layer].input === 1 ? 'channel' : 'maps'} ×
					9 weights + bias {weights.biases[layer][channel].toFixed(4)}
				</p>
			</div>
			<KernelAtlas {weights} {layer} {channel} /><small
				>Every square is a real learned parameter. One shared color scale per layer preserves
				relative magnitudes.</small
			>
		</div>{/if}
	{#if neuronOpen}
		<div class="neuron-closeup">
			<div class="neuron-location">
				<div class="neuron-map">
					<ConvHeatmap values={selectedMap} side={CONV_SHAPES[layer].side} scale={scales[layer]} />
					<svg
						viewBox={`0 0 ${CONV_SHAPES[layer].side} ${CONV_SHAPES[layer].side}`}
						aria-hidden="true"><rect x={cellX} y={cellY} width="1" height="1" /></svg
					>
				</div>
				<div>
					<strong>One neuron in layer {layer + 1}</strong>
					<p>Feature {channel + 1} · row {cellY + 1}, column {cellX + 1}</p>
					<small>{CONV_SHAPES[layer].input * 9} input connections + one bias</small>
				</div>
			</div>
			<div class="neuron-computation">
				<svg
					viewBox={`0 0 ${diagram.width} ${diagram.height}`}
					role="img"
					aria-label="Nine weighted inputs combine with all other incoming maps and bias, then pass through ReLU"
				>
					{#each Array.from({ length: 9 }, (_, n) => n) as index (index)}
						{@const y = diagram.firstY + index * diagram.step}
						<path
							d={`M${diagram.inputX + 7} ${y} C${diagram.sumX - 95} ${y}, ${diagram.sumX - 85} ${diagram.sumY}, ${diagram.sumX - diagram.r} ${diagram.sumY}`}
							class="neuron-weight"
							style:stroke={incoming.kernel[index] < 0
								? 'var(--chart-blue)'
								: 'var(--chart-lavender)'}
							style:stroke-width={0.6 + (2 * Math.abs(incoming.kernel[index])) / weightScale}
						/>
						<circle
							cx={diagram.inputX}
							cy={y}
							r="7"
							class="input-neuron"
							style:fill={`color-mix(in srgb, var(--chart-lavender) ${100 * Math.max(0, incoming.values[index] / inputScale)}%, var(--plot-soft))`}
						>
							<title
								>Input {incoming.values[index].toFixed(4)} × weight {incoming.kernel[index].toFixed(
									4
								)} = {(incoming.values[index] * incoming.kernel[index]).toFixed(4)}</title
							>
						</circle>
					{/each}
					<text x={diagram.inputX} y="13" text-anchor="middle">3 × 3 inputs</text>
					<text x={vertical ? 87 : 181} y={vertical ? 248 : 220} text-anchor="middle"
						>× learned weights</text
					>
					<path
						d={`M${diagram.sumX} ${diagram.sumY + diagram.r + 23} L${diagram.sumX} ${diagram.sumY + diagram.r}`}
						class="other-input"
					/>
					<circle cx={diagram.sumX} cy={diagram.sumY} r={diagram.r} class="sum-neuron" />
					<text x={diagram.sumX} y={diagram.sumY - 5} text-anchor="middle" class="sum-symbol"
						>Σ</text
					>
					<text x={diagram.sumX} y={diagram.sumY + 14} text-anchor="middle" class="neuron-number"
						>{unit.total.toFixed(3)}</text
					>
					<text x={diagram.sumX} y={diagram.sumY + diagram.r + 41} text-anchor="middle"
						>{unit.sources.length > 1
							? `+ ${unit.sources.length - 1} other maps + bias`
							: '+ bias'}</text
					>
					<text
						x={diagram.sumX}
						y={diagram.sumY + diagram.r + 60}
						text-anchor="middle"
						class="neuron-number">{(unit.total - incoming.contribution).toFixed(3)}</text
					>
					<path
						d={`M${diagram.sumX + diagram.r} ${diagram.sumY} L${diagram.outX - diagram.r} ${diagram.sumY}`}
						class="other-input"
					/>
					<text x={(diagram.sumX + diagram.outX) / 2} y={diagram.sumY - 17} text-anchor="middle"
						>ReLU</text
					>
					<text x={(diagram.sumX + diagram.outX) / 2} y={diagram.sumY + 20} text-anchor="middle"
						>max(0, sum)</text
					>
					<circle cx={diagram.outX} cy={diagram.sumY} r={diagram.r} class="result-neuron" />
					<text
						x={diagram.outX}
						y={diagram.sumY + 4}
						text-anchor="middle"
						class="neuron-number"
						data-testid="network-neuron-response">{unit.response.toFixed(3)}</text
					>
					<text x={diagram.outX} y={diagram.sumY + diagram.r + 23} text-anchor="middle"
						>One output</text
					>
				</svg>

				<div class="neuron-source">
					<span
						>{layer
							? `Showing input map ${sourceIndex + 1} of ${unit.sources.length}`
							: 'Showing the image’s single channel'}</span
					>
					{#if layer}<div>
							<button
								aria-label="Previous neuron input map"
								onclick={() =>
									(source = (sourceIndex - 1 + unit.sources.length) % unit.sources.length)}
								><PatternIcon name="arrowLeft" size={15} /></button
							><button
								aria-label="Next neuron input map"
								onclick={() => (source = (sourceIndex + 1) % unit.sources.length)}
								><PatternIcon name="arrowRight" size={15} /></button
							>
						</div>{/if}
				</div>
			</div>
			<p>
				Blue connections have negative weights; lavender connections have positive weights. The same
				filter is reused at every position in its map.
			</p>
		</div>
	{/if}
	<p class="network-footnote">
		All 48 maps and 10 outputs are shown. Curves group connections between maps; each convolutional
		curve represents nine shared weights. In Activations, brighter cells respond more, scaled within
		each layer. Kernels and strongest-input views leave the prediction unchanged. Flattening feeds
		every value to every output.
	</p>
</div>

<style>
	.network-views {
		display: flex;
		gap: 5px;
		flex-wrap: wrap;
	}
	.network-views button {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 10px 13px;
		border: 0;
		border-radius: 10px;
		background: var(--lab-inset);
		color: var(--muted);
		font-size: 12px;
	}
	.network-views button[aria-pressed='true'] {
		color: var(--lavender);
		background: var(--surface-raised);
	}
	.view-explanation {
		font-size: 12px;
		line-height: 1.7;
		color: var(--muted);
		margin: 12px 0 24px;
		max-width: 780px;
	}
	.selected-kernels {
		background: var(--lab-inset);
		border-radius: 14px;
		padding: 20px;
		margin: 16px 0;
		display: grid;
		gap: 16px;
	}
	.selected-kernels strong {
		font-size: 14px;
		font-weight: 550;
	}
	.selected-kernels p,
	.selected-kernels small {
		color: var(--muted);
		font-size: 12px;
		line-height: 1.6;
		margin: 6px 0 0;
	}

	.conv-network {
		container-type: inline-size;
		margin: 24px 0 16px;
	}
	.network-toolbar {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 16px;
		margin-bottom: 23px;
	}
	.network-toolbar > div {
		display: flex;
		gap: 10px;
		align-items: center;
		color: var(--ink);
		font-size: 13px;
	}
	.network-toolbar > div > :global(svg) {
		color: var(--lavender);
	}
	.network-toolbar small {
		display: block;
		font-size: 10px;
		color: var(--quiet);
		margin-top: 4px;
	}
	.network-toolbar button,
	.network-reading button {
		display: flex;
		align-items: center;
		gap: 7px;
		flex-shrink: 0;
		border: 0;
		border-radius: 8px;
		background: var(--lab-inset);
		padding: 10px 12px;
		color: var(--accent);
		font-size: 11px;
		cursor: pointer;
	}
	.network-scene {
		position: relative;
		display: grid;
		grid-template-columns: 0.7fr 1.1fr 1.2fr 1.2fr 0.48fr 1fr;
		gap: 26px;
		padding: 6px 0 13px;
	}
	.network-wires {
		position: absolute;
		width: 100%;
		height: 100%;
		pointer-events: none;
		overflow: visible;
	}
	.network-wires path {
		fill: none;
		stroke: var(--chart-blue);
		stroke-width: 1.1;
		transition: opacity 300ms;
	}
	.network-wires .base-wire {
		stroke: var(--quiet);
		opacity: 0.075;
		stroke-width: 0.7;
	}
	.network-stage {
		position: relative;
		min-width: 0;
		transition: opacity 450ms;
	}
	.stage-title {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 6px;
		padding: 0;
		height: 46px;
		border: 0;
		background: transparent;
		font-family: inherit;
		color: var(--ink);
		text-align: left;
	}
	button.stage-title {
		cursor: pointer;
	}
	.stage-title strong {
		font-size: 14px;
		font-weight: 500;
	}
	.stage-title span {
		font-size: 9px;
		color: var(--quiet);
		white-space: nowrap;
	}
	.chosen .stage-title strong {
		color: var(--accent);
	}
	.stage-body {
		height: 244px;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.network-stage > small {
		display: block;
		color: var(--quiet);
		font-size: 9px;
		text-align: center;
		white-space: nowrap;
		padding-top: 8px;
	}
	.map-bank {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 7px;
		width: 100%;
		max-width: 158px;
	}
	.first-bank {
		grid-template-columns: repeat(2, 1fr);
		max-width: 91px;
		gap: 8px;
	}
	.network-map {
		aspect-ratio: 1;
		width: 100%;
		min-width: 0;
		padding: 2px;
		border: 0;
		border-radius: 4px;
		background: var(--plot-soft);
		box-shadow: 0 0 0 1px var(--plot-line);
		cursor: pointer;
		transition:
			box-shadow 250ms,
			transform 250ms;
	}
	.network-map:hover {
		box-shadow: 0 0 0 2px var(--accent);
	}
	.network-map.selected {
		box-shadow:
			0 0 0 2px var(--accent),
			0 0 0 5px var(--surface);
	}
	.input-tile {
		width: 100%;
		max-width: 82px;
		aspect-ratio: 1;
		border-radius: 8px;
		overflow: hidden;
	}
	.flatten-strip {
		display: grid;
		grid-template-columns: repeat(4, 3px);
		grid-auto-rows: 1.5px;
		gap: 0.7px;
		padding: 4px;
		background: var(--surface);
		border-radius: 3px;
	}
	.flatten-strip i {
		background: var(--chart-lavender);
	}
	.output-bank {
		width: 100%;
		display: grid;
		gap: 8px;
	}
	.output-neuron {
		display: flex;
		align-items: center;
		gap: 7px;
		color: var(--quiet);
		font-size: 9px;
		white-space: nowrap;
	}
	.output-neuron i {
		width: 12px;
		height: 12px;
		flex-shrink: 0;
		background: color-mix(
			in srgb,
			var(--chart-lavender) calc(var(--response) * 100%),
			var(--plot-soft)
		);
		box-shadow: 0 0 0 1px var(--plot-line);
		border-radius: 50%;
	}
	.output-neuron small {
		margin-left: auto;
		font-family: var(--mono);
		font-size: 8px;
	}
	.output-neuron.winner {
		color: var(--ink);
	}
	.output-neuron.winner i {
		box-shadow: 0 0 0 2px var(--chart-lavender);
	}
	.walking .network-stage:not(.lit) {
		opacity: 0.24;
	}
	.network-reading {
		display: flex;
		gap: 22px;
		align-items: center;
		justify-content: space-between;
		padding: 17px 0 0;
	}
	.network-reading p {
		font-size: 11px;
		line-height: 1.7;
		max-width: 660px;
		margin: 0;
		color: var(--muted);
		min-height: 38px;
	}
	.network-footnote {
		font-size: 9px;
		color: var(--quiet);
		line-height: 1.7;
		max-width: 850px;
		margin: 10px 0 0;
	}
	.neuron-closeup {
		display: grid;
		grid-template-columns: 220px 1fr;
		gap: 12px 25px;
		background: var(--lab-inset);
		border-radius: 14px;
		padding: 22px;
		margin-top: 16px;
	}
	.neuron-location {
		align-self: center;
		display: flex;
		gap: 14px;
		align-items: center;
	}
	.neuron-map {
		position: relative;
		width: 76px;
		height: 76px;
		border-radius: 6px;
		flex-shrink: 0;
	}
	.neuron-map svg {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
	}
	.neuron-map rect {
		fill: none;
		stroke: var(--locator);
		stroke-width: 1.4;
		vector-effect: non-scaling-stroke;
	}
	.neuron-location strong {
		font-size: 12px;
		font-weight: 500;
	}
	.neuron-location p,
	.neuron-location small {
		font-size: 9px;
		line-height: 1.7;
		color: var(--muted);
	}
	.neuron-location p {
		margin: 6px 0;
	}
	.neuron-computation > svg {
		display: block;
		width: 100%;
	}
	.neuron-computation text {
		fill: var(--muted);
		font-family: var(--sans);
		font-size: 11px;
	}
	.neuron-weight {
		fill: none;
		opacity: 0.65;
	}
	.input-neuron {
		stroke: var(--plot-line);
		stroke-width: 1;
	}
	.other-input {
		fill: none;
		stroke: var(--quiet);
		stroke-width: 1.2;
	}
	.sum-neuron,
	.result-neuron {
		fill: var(--surface);
		stroke: var(--chart-lavender);
		stroke-width: 1.2;
	}
	.neuron-computation .sum-symbol {
		font-size: 24px;
		fill: var(--ink);
	}
	.neuron-computation .neuron-number {
		font-family: var(--mono);
		font-size: 12px;
		fill: var(--ink);
	}
	.neuron-source {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		font-size: 10px;
		color: var(--muted);
		padding: 0 4px;
	}
	.neuron-source > div {
		display: flex;
		gap: 8px;
	}
	.neuron-source button {
		background: var(--surface);
		color: var(--accent);
		display: grid;
		place-items: center;
		width: 30px;
		height: 30px;
		border: 0;
		border-radius: 6px;
		cursor: pointer;
	}
	.neuron-closeup > p {
		grid-column: 1/-1;
		font-size: 9px;
		color: var(--quiet);
		line-height: 1.7;
		margin: 0;
	}
	button:focus-visible {
		outline: 2px solid var(--focus);
		outline-offset: 5px;
	}
	@container (max-width: 900px) {
		.network-scene {
			gap: 18px;
			grid-template-columns: 0.6fr 1fr 1.1fr 1.1fr 0.45fr 1fr;
		}
		.map-bank {
			gap: 5px;
		}
		.stage-body {
			height: 205px;
		}
		.output-neuron {
			font-size: 8px;
			gap: 5px;
		}
		.output-neuron small {
			font-size: 7px;
		}
		.stage-title strong {
			font-size: 12px;
		}
		.stage-title span,
		.network-stage > small {
			font-size: 8px;
		}
		.neuron-closeup {
			grid-template-columns: 170px 1fr;
		}
		.neuron-location {
			flex-direction: column;
			align-items: flex-start;
		}
	}
	@container (max-width: 719px) {
		.network-scene {
			max-width: 460px;
			margin-inline: auto;
			display: flex;
			flex-direction: column;
			gap: 22px;
			padding: 3px 0;
		}
		.network-stage {
			display: grid;
			grid-template-columns: 92px 1fr;
			gap: 0 16px;
			align-items: center;
		}
		.stage-title {
			height: auto;
		}
		.stage-title strong {
			font-size: 14px;
		}
		.stage-title span {
			font-size: 9px;
		}
		.stage-body {
			height: auto;
			grid-column: 2;
			grid-row: 1/3;
			justify-content: center;
		}
		.network-stage > small {
			padding-top: 8px;
			text-align: left;
			white-space: normal;
			line-height: 1.5;
			grid-column: 1;
			font-size: 9px;
		}
		.map-bank {
			max-width: 202px;
			gap: 6px;
		}
		.first-bank {
			grid-template-columns: repeat(4, 1fr);
		}
		.last-bank {
			grid-template-columns: repeat(6, 1fr);
		}
		.input-tile {
			max-width: 60px;
		}
		.flatten-strip {
			grid-template-columns: repeat(48, 2.5px);
			grid-auto-rows: 2.5px;
			gap: 1px;
		}
		.output-bank {
			grid-template-columns: repeat(2, 1fr);
			gap: 12px 14px;
		}
		.output-neuron {
			font-size: 8px;
			gap: 5px;
		}
		.output-neuron small {
			display: none;
		}
		.network-reading {
			flex-direction: column;
			align-items: flex-start;
			gap: 10px;
		}
		.network-reading p {
			min-height: 0;
		}
		.network-toolbar > div {
			font-size: 11px;
			gap: 7px;
		}
		.network-toolbar small {
			font-size: 8px;
		}
		.network-toolbar button {
			font-size: 10px;
			padding: 9px;
			gap: 4px;
		}
		.neuron-closeup {
			display: block;
			padding: 15px;
		}
		.neuron-location {
			flex-direction: row;
			align-items: center;
			margin-bottom: 18px;
		}
		.neuron-computation {
			margin: 0 -8px;
		}
		.neuron-computation > svg {
			min-height: 148px;
		}
		.neuron-closeup > p {
			margin-top: 16px;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		*,
		*::before {
			transition: none !important;
		}
	}

	.selected-kernels {
		grid-template-columns: minmax(180px, 0.8fr) minmax(0, 2fr);
		align-items: center;
		gap: 16px 28px;
	}
	.selected-kernels > small {
		grid-column: 1/-1;
	}
	@media (max-width: 650px) {
		.selected-kernels {
			grid-template-columns: 1fr;
		}
	}
</style>
