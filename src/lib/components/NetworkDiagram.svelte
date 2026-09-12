<script lang="ts">
	import { inspectionMarkerPath } from '$lib/ui/inspection-marker';
	import { onDestroy, tick, type Snippet } from 'svelte';
	import { prefersReducedMotion } from 'svelte/motion';
	import { fade } from 'svelte/transition';
	import PatternIcon from './PatternIcon.svelte';
	import type { Network, Sample } from '$lib/ml/models';
	import { inspectNetwork, neuronResponse } from '$lib/ml/network-inspection';
	import { decisionSurface } from '$lib/ml/surface';

	let {
		network,
		revision = 0,
		input,
		oninput,
		onpause,
		samples,
		visible,
		onvisibility,
		toolbar,
		metrics,
		settings,
		problems,
		description,
		classNames = ['Blue class', 'Amber class'],
		threshold = 0.5
	}: {
		network: Network;
		revision?: number;
		input: number[];
		oninput: (input: number[]) => void;
		onpause: () => void;
		samples: Sample[];
		visible: Record<Sample['split'], boolean>;
		onvisibility: (split: Sample['split']) => void;
		toolbar: Snippet;
		metrics: Snippet;
		settings: Snippet;
		problems?: Snippet;
		description?: string;
		classNames?: readonly [string, string];
		threshold?: number;
	} = $props();
	const views = ['prediction', 'network', 'neuron'] as const;
	type View = (typeof views)[number];
	let activeView = $state<View>('prediction');
	let selection = $state({ layer: 1, index: 0 });
	let traceStep = $state(-1);
	let traceRevision = $state(-1);
	let tracing = $state(false);
	let traceNetwork = $state.raw<Network | null>(null);
	let timer: ReturnType<typeof setInterval> | undefined;
	let diagramElement: HTMLDivElement | undefined;
	let drawingWidth = $state(500);
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
	const stage = $derived(traceNetwork === network && traceRevision === revision ? traceStep : -1);
	const isPlaying = $derived(tracing && stage >= 0);
	const traceLabel = $derived(
		isPlaying
			? 'Pause trace'
			: stage >= 0 && stage < lastLayer
				? 'Resume trace'
				: stage === lastLayer
					? 'Replay trace'
					: 'Trace a prediction'
	);
	const selectedPosition = $derived(
		layers.slice(0, selectedLayer).reduce((sum, layer) => sum + layer.length, 0) + selectedIndex
	);
	const flatNodes = $derived(layers.flat());
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
	const x = (layer: number) => 40 + (layer / lastLayer) * (drawingWidth - 80);
	const y = (index: number, count: number) =>
		221 + (index - (count - 1) / 2) * (count > 2 ? 28 : 70);
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
		activeView = 'neuron';
	}
	function connectDiagram(element: HTMLDivElement) {
		diagramElement = element;
		let frame = 0;
		const resize = () => {
			if (!element.clientWidth) return;
			const next = element.clientWidth < 390 ? 400 : 500;
			if (next === drawingWidth) return;
			cancelAnimationFrame(frame);
			frame = requestAnimationFrame(() => (drawingWidth = next));
		};
		resize();
		const observer = new ResizeObserver(resize);
		observer.observe(element);
		return () => {
			observer.disconnect();
			cancelAnimationFrame(frame);
			diagramElement = undefined;
		};
	}
	function followLayer(layer: number) {
		if (!diagramElement || diagramElement.scrollWidth <= diagramElement.clientWidth) return;
		const canvas = diagramElement.querySelector('svg');
		if (!canvas) return;
		const frame = diagramElement.getBoundingClientRect();
		const drawing = canvas.getBoundingClientRect();
		const coordinate =
			drawing.left -
			frame.left +
			diagramElement.scrollLeft +
			(x(layer) / drawingWidth) * drawing.width;
		diagramElement.scrollTo({
			left: Math.max(0, coordinate - frame.width / 2),
			behavior: prefersReducedMotion.current ? 'instant' : 'smooth'
		});
	}
	function chooseStage(next: number) {
		onpause();
		stopTrace();
		traceNetwork = network;
		traceRevision = revision;
		traceStep = next;
		selection = { layer: next, index: 0 };
		activeView = 'network';
		void tick().then(() => followLayer(next));
	}
	function step() {
		chooseStage(stage < 0 || stage === lastLayer ? 0 : stage + 1);
	}
	function resetTrace() {
		stopTrace();
		traceStep = -1;
	}
	function playTrace() {
		if (isPlaying) {
			stopTrace();
			return;
		}
		if (stage < 0 || stage === lastLayer) chooseStage(0);
		else {
			activeView = 'network';
			onpause();
		}
		tracing = true;
		timer = setInterval(() => {
			if (traceNetwork !== network || traceRevision !== revision || traceStep === lastLayer) {
				stopTrace();
				return;
			}
			traceStep += 1;
			selection = { layer: traceStep, index: 0 };
			followLayer(traceStep);
		}, 1400);
	}
	function adjacentNeuron(direction: number) {
		const next = flatNodes[(selectedPosition + direction + flatNodes.length) % flatNodes.length];
		select(next.layer, next.index);
	}
	function revealSelection(identity: string) {
		return (element: HTMLElement) => {
			void identity;
			if (prefersReducedMotion.current) return;
			const animation = element.animate(
				[
					{ opacity: 0.45, transform: 'translateY(4px)' },
					{ opacity: 1, transform: 'translateY(0)' }
				],
				{ duration: 220, easing: 'cubic-bezier(.2,.7,.2,1)' }
			);
			return () => animation.cancel();
		};
	}
	function edgePath(layer: number, index: number, source: number) {
		const fromX = x(layer - 1);
		const toX = x(layer);
		const fromY = y(source, layers[layer - 1].length);
		const toY = y(index, layers[layer].length);
		return `M${fromX},${fromY} C${fromX + (toX - fromX) * 0.48},${fromY} ${toX - (toX - fromX) * 0.48},${toY} ${toX},${toY}`;
	}
	const outputMap = $derived.by(() => {
		void revision;
		return network.classification ? [] : neuronResponse(network, lastLayer, 0);
	});
	const classificationField = $derived.by(() => {
		void revision;
		return network.classification
			? decisionSurface((point) => network.predict(point), threshold)
			: null;
	});
	const visibleSamples = $derived(
		samples.map((sample, index) => ({ ...sample, index })).filter((sample) => visible[sample.split])
	);
	const plotX = (value: number) => 140 + value * 120;
	const plotY = (value: number) => 114 - Math.max(-1.05, Math.min(1.05, value)) * 96;
	function changeView(view: View) {
		activeView = view;
	}
	function navigateViews(event: KeyboardEvent) {
		if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
		event.preventDefault();
		const index = views.indexOf(activeView);
		activeView =
			event.key === 'Home'
				? views[0]
				: event.key === 'End'
					? views.at(-1)!
					: views[(index + (event.key === 'ArrowRight' ? 1 : -1) + views.length) % views.length];
		void tick().then(() => document.getElementById(`${uid}-tab-${activeView}`)?.focus());
	}
	onDestroy(stopTrace);
</script>

<section class="neural-observatory" aria-label="Neural network workbench">
	<header class="workbench-heading">
		<div>
			<h3>From input to prediction.</h3>
			<p>
				{description ??
					(network.classification
						? 'Learn to separate the inner circle from the outer ring.'
						: 'Learn a curve, then follow how a number becomes a prediction.')}
			</p>
		</div>
		<div class="architecture-count">
			<strong>{network.sizes.join(' → ')}</strong><small
				>{weightCount + biasCount} parameters · epoch {revision}</small
			>
		</div>
	</header>
	{@render problems?.()}
	<div class="workbench-toolbar">{@render toolbar()}</div>
	<div class="workbench-metrics">{@render metrics()}</div>
	<div
		class="view-tabs"
		role="tablist"
		tabindex="-1"
		aria-label="Neural workbench views"
		onkeydown={navigateViews}
	>
		{#each views as view (view)}<button
				id={`${uid}-tab-${view}`}
				role="tab"
				aria-selected={activeView === view}
				aria-controls={`${uid}-${view}`}
				tabindex={activeView === view ? 0 : -1}
				onclick={() => changeView(view)}
				><PatternIcon
					name={view === 'prediction' ? 'scan' : view === 'network' ? 'neural' : 'eye'}
					size={15}
				/>{view === 'prediction' ? 'Prediction' : view === 'network' ? 'Network' : 'Neuron'}</button
			>{/each}
	</div>
	<div class="workbench-layout" data-view={activeView}>
		<div class="input-dock">
			<div class="prediction-readout">
				<span
					>{network.classification ? `P(${classNames[1].toLowerCase()})` : 'Predicted value'}</span
				><strong data-testid="live-prediction"
					>{network.classification ? probability(output) : fixed(output, 3)}</strong
				><small
					>{network.classification
						? `${probability(1 - output)} ${classNames[0].toLowerCase()}`
						: 'Linear output'}</small
				>
			</div>
			<div class="input-sliders">
				{#each input as value, index (index)}<label for={`${uid}-input-${index}`}
						><span>Input x{index + 1}<strong>{fixed(value, 2)}</strong></span><input
							id={`${uid}-input-${index}`}
							aria-label={`Network input x${index + 1}`}
							type="range"
							min="-1"
							max="1"
							step="0.01"
							{value}
							oninput={(event) => moveInput(index, Number(event.currentTarget.value))}
						/></label
					>{/each}
			</div>
		</div>
		<div
			class="probe-panel"
			id={`${uid}-prediction`}
			role="tabpanel"
			aria-labelledby={`${uid}-tab-prediction`}
		>
			<svg
				class="prediction-map"
				viewBox="0 0 280 236"
				role="img"
				aria-label={`Live prediction for input ${input.map((value) => value.toFixed(2)).join(', ')} is ${fixed(output, 4)}. ${visibleSamples.length} visible examples; shapes distinguish training, validation, and test.`}
			>
				<defs
					><clipPath id={`${uid}-probe-clip`}
						><rect x="20" y="18" width="240" height="192" rx="8" /></clipPath
					></defs
				>
				<rect x="20" y="18" width="240" height="192" rx="8" fill="var(--wb-inset)" />
				<g clip-path={`url(#${uid}-probe-clip)`}>
					{#if classificationField}
						<svg
							x="20"
							y="18"
							width="240"
							height="192"
							viewBox="52 50 570 264"
							preserveAspectRatio="none"
							aria-hidden="true"
						>
							{#each classificationField.cells as point (point.id)}
								<rect
									x={point.x}
									y={point.y}
									width={classificationField.dx + 0.2}
									height={classificationField.dy + 0.2}
									fill={point.p >= threshold ? 'var(--wb-amber)' : 'var(--wb-blue)'}
									fill-opacity={0.05 + Math.abs(point.p - threshold) * 0.22}
								/>
							{/each}
							<path
								data-testid="neural-boundary"
								d={classificationField.boundary}
								fill="none"
								stroke="var(--wb-ink)"
								stroke-opacity=".48"
								stroke-width="1"
								vector-effect="non-scaling-stroke"
							/>
						</svg>
					{/if}
					<path d="M20 114H260 M140 18V210" stroke="var(--wb-line)" stroke-dasharray="2 5" />
					{#each visibleSamples as sample (sample.index)}
						<g
							data-sample-split={sample.split}
							transform={`translate(${plotX(sample.x[0])},${plotY(network.classification ? sample.x[1] : sample.y)}) scale(${samples.length > 200 ? 0.8 : 1})`}
							><title>{sample.split} example · target {fixed(sample.y, 2)}</title>
							{#if sample.split === 'test'}<path
									d="M0 -4L4 0L0 4L-4 0Z"
									fill={network.classification
										? sample.y
											? 'var(--wb-amber)'
											: 'var(--wb-blue)'
										: 'var(--wb-amber)'}
									stroke="var(--wb-card)"
									stroke-width=".8"
								/>{:else if sample.split === 'validation'}<rect
									x="-2.8"
									y="-2.8"
									width="5.6"
									height="5.6"
									rx=".7"
									fill={network.classification
										? sample.y
											? 'var(--wb-amber)'
											: 'var(--wb-blue)'
										: 'var(--wb-lavender)'}
									stroke="var(--wb-card)"
									stroke-width=".7"
								/>{:else}<circle
									r="2.3"
									fill={network.classification
										? sample.y
											? 'var(--wb-amber)'
											: 'var(--wb-blue)'
										: 'var(--wb-sage)'}
									opacity=".85"
								/>{/if}
						</g>
					{/each}
					{#if !network.classification}<path
							d={outputMap
								.map(
									(point, index) => `${index ? 'L' : 'M'}${plotX(point.x)},${plotY(point.value)}`
								)
								.join(' ')}
							fill="none"
							stroke="var(--wb-lavender)"
							stroke-width="2.2"
						/>{/if}
					<g
						data-testid="prediction-probe"
						transform={`translate(${plotX(input[0])},${plotY(network.classification ? input[1] : output)})`}
						><path
							d={inspectionMarkerPath(9, 3)}
							fill="none"
							stroke="var(--locator)"
							stroke-width="1.5"
							stroke-linecap="round"
						/></g
					>
				</g>
				<text x="140" y="229" text-anchor="middle">Input x1 →</text><text
					transform="translate(10 114) rotate(-90)"
					text-anchor="middle"
					>{network.classification ? 'Input x2 →' : 'Target / prediction →'}</text
				>
			</svg>
			<div class="class-key">
				{#if network.classification}<span><i class="blue"></i>{classNames[0]}</span><span
						><i class="amber"></i>{classNames[1]}</span
					>{:else}<span><i class="lavender"></i>Learned curve</span>{/if}<span class="probe-key"
					>⊙ Your input</span
				>
			</div>
			<div class="sample-toggles" aria-label="Visible data splits">
				{#each ['train', 'validation', 'test'] as split (split)}{@const name =
						split as Sample['split']}<button
						aria-pressed={visible[name]}
						onclick={() => onvisibility(name)}
						><span class={`split-symbol ${name}`}
							>{name === 'train' ? '●' : name === 'validation' ? '■' : '◆'}</span
						>{name === 'train' ? 'Train' : name === 'validation' ? 'Val.' : 'Test'}<strong
							>{samples.filter((sample) => sample.split === name).length}</strong
						></button
					>{/each}
			</div>
			<p class="panel-note">Only training points change the weights.</p>
		</div>
		<div
			class="network-panel"
			id={`${uid}-network`}
			role="tabpanel"
			aria-labelledby={`${uid}-tab-network`}
		>
			<div class="network-tools">
				<button class="trace-primary" onclick={playTrace}
					><PatternIcon
						name={isPlaying ? 'pause' : stage === lastLayer ? 'reset' : 'play'}
						size={14}
					/>{traceLabel}</button
				><button aria-label="Advance one layer" onclick={step}
					><PatternIcon name="next" size={16} /></button
				><button aria-label="Reset prediction trace" onclick={resetTrace} disabled={stage < 0}
					><PatternIcon name="reset" size={15} /></button
				>
			</div>
			<div class="trace-progress" aria-label="Forward pass stages">
				{#each layers as layer, index (layer[0].id)}<button
						class:current-stage={stage === index}
						class:completed-stage={stage > index}
						aria-pressed={stage === index}
						onclick={() => chooseStage(index)}
						>{index === 0 ? 'Input' : index === lastLayer ? 'Output' : `Layer ${index}`}</button
					>{/each}
			</div>
			<!-- svelte-ignore a11y_no_noninteractive_tabindex (Keyboard users can pan the complete graph on small screens.) -->
			<div
				class="diagram-scroll"
				role="region"
				aria-label="Complete neural network; scroll horizontally if needed"
				tabindex="0"
				{@attach connectDiagram}
			>
				<svg
					class="complete-network"
					viewBox={`0 0 ${drawingWidth} 400`}
					role="group"
					aria-label={`${inputCount} input nodes, ${network.sizes.slice(1, -1).join(' and ') || 'no'} hidden neurons per layer, 1 output neuron, and ${weightCount} learned connections.`}
				>
					{#each layers as layer, layerIndex (layerIndex)}<g
							class="layer-heading"
							style:transform={`translateX(${x(layerIndex)}px)`}
							><text x="0" y="27" text-anchor="middle" class="layer-title"
								>{layerIndex === 0
									? 'INPUT'
									: layerIndex === lastLayer
										? 'OUTPUT'
										: `HIDDEN ${layerIndex}`}</text
							><text x="0" y="45" text-anchor="middle" class="layer-subtitle"
								>{layerIndex === 0
									? `${layer.length} values`
									: layerIndex === lastLayer
										? network.classification
											? 'sigmoid'
											: 'linear'
										: `${layer.length} neurons`}</text
							></g
						>{/each}
					{#each layers.slice(1) as layer (layer[0].layer)}{#each layer as neuron (neuron.id)}{#each neuron.contributions as edge, source (edge.id)}{@const incoming =
									selected.id === neuron.id}{@const outgoing = selected.id === edge.id}<path
									data-weight={`${edge.id}:${neuron.id}`}
									class="weight-path"
									d={edgePath(neuron.layer, neuron.index, source)}
									style:d={`path('${edgePath(neuron.layer, neuron.index, source)}')`}
									in:fade={{ duration: prefersReducedMotion.current ? 0 : 240 }}
									fill="none"
									stroke={tint(edge.weight)}
									stroke-width={(incoming ? 1.2 : 0.45) +
										(Math.abs(edge.weight) / edgeScale) * (incoming ? 1.8 : 1.1)}
									opacity={stage >= 0 && neuron.layer > stage
										? 0.025
										: incoming
											? 0.8
											: outgoing
												? 0.3
												: 0.13}
									class:signal-arriving={isPlaying && neuron.layer === stage}
									><title
										>{nodeName(neuron.layer - 1, source)} → {nodeName(neuron.layer, neuron.index)}:
										weight {fixed(edge.weight, 5)}, contribution {fixed(edge.product, 5)}</title
									></path
								>{/each}{/each}{/each}
					{#each layers as layer, layerIndex (layerIndex)}{#each layer as neuron (neuron.id)}{@const active =
								selected.id === neuron.id}{@const radius =
								layerIndex === 0 ? 19 : layerIndex === lastLayer ? 22 : 12.5}<g
								data-neuron={neuron.id}
								style:transform={`translate(${x(layerIndex)}px,${y(neuron.index, layer.length)}px)`}
								in:fade={{ duration: prefersReducedMotion.current ? 0 : 240 }}
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
								><circle class="node-halo" cx="0" cy="0" r={radius + 3.5} /><circle
									class="node-base"
									cx="0"
									cy="0"
									r={radius}
								/><circle
									class="node-color"
									cx="0"
									cy="0"
									r={radius}
									fill={tint(neuron.activation)}
									fill-opacity={0.1 + Math.min(1, Math.abs(neuron.activation)) * 0.75}
									stroke={tint(neuron.activation)}
									stroke-opacity=".7"
									stroke-width="1.1"
								/><text
									class="node-value"
									class:bright-node={Math.abs(neuron.activation) > 0.67}
									x="0"
									y="3.3"
									text-anchor="middle"
									>{layerIndex === lastLayer && network.classification
										? probability(neuron.activation)
										: fixed(neuron.activation, 1).replace(/^(-?)0\./, '$1.')}</text
								>{#if layerIndex === 0}<text
										class="input-label"
										x={-radius - 7}
										y="3"
										text-anchor="end">x{neuron.index + 1}</text
									>{/if}</g
							>{/each}{/each}
					<text x={x(lastLayer)} y="262" text-anchor="middle" class="layer-subtitle"
						>{network.classification ? 'P(class 1)' : 'Prediction'}</text
					>
				</svg>
			</div>
			<div class="network-key">
				<span><i class="sage"></i>Positive</span><span><i class="amber"></i>Negative</span><span
					>Thickness = |weight|</span
				>
			</div>
			<div class="forward-story" aria-live={stage >= 0 ? 'polite' : 'off'}>
				<PatternIcon name="arrowRight" size={14} />
				<p>
					{stage < 0
						? 'Select any neuron to inspect its calculation.'
						: stage === 0
							? 'The coordinates enter unchanged. Inference does not update weights.'
							: stage < lastLayer
								? `Layer ${stage} multiplies, adds a bias, then applies tanh.`
								: network.classification
									? 'The output uses sigmoid to produce a probability.'
									: 'The output keeps its sum as a continuous number.'}
				</p>
			</div>
		</div>
		<div
			class="neuron-inspector"
			id={`${uid}-neuron`}
			role="tabpanel"
			aria-labelledby={`${uid}-tab-neuron`}
		>
			<div class="inspector-heading">
				<div>
					<span class="micro-label">Selected neuron</span>
					<h4>{nodeName(selectedLayer, selectedIndex)}</h4>
				</div>
				<div class="neuron-navigation">
					<button aria-label="Inspect previous neuron" onclick={() => adjacentNeuron(-1)}
						><PatternIcon name="arrowLeft" size={14} /></button
					><button aria-label="Inspect next neuron" onclick={() => adjacentNeuron(1)}
						><PatternIcon name="arrowRight" size={14} /></button
					>
				</div>
			</div>
			<div class="neuron-arithmetic" {@attach revealSelection(selected.id)}>
				{#if selected.function === 'input'}<p class="input-description">
						This coordinate is passed to the next layer. It has no incoming weights.
					</p>
					<div class="activation-result">
						<span>Input value</span><strong data-testid="neuron-activation"
							>{fixed(selected.activation, 4)}</strong
						>
					</div>{:else}<div class="calculation-flow">
						<div>
							<span>Weighted inputs</span><strong>{fixed(selected.sum - selected.bias, 3)}</strong>
						</div>
						<span>+</span>
						<div><span>Bias</span><strong>{fixed(selected.bias, 3)}</strong></div>
						<span>=</span>
						<div>
							<span>Sum z</span><strong data-testid="neuron-sum">{fixed(selected.sum, 4)}</strong>
						</div>
					</div>
					<div class="activation-result">
						<span
							>{selected.function === 'tanh'
								? 'tanh · range −1 to 1'
								: selected.function === 'sigmoid'
									? 'sigmoid · range 0 to 1'
									: 'Linear · sum unchanged'}</span
						><strong data-testid="neuron-activation"
							>{selected.function === 'linear' ? 'z' : `${selected.function}(z)`} = {fixed(
								selected.activation,
								4
							)}</strong
						>
					</div>{/if}
			</div>
			<div class="neuron-response">
				<div>
					<h4>This neuron’s response</h4>
					<p>Same weights, different inputs.</p>
				</div>
				<svg
					viewBox="0 0 230 230"
					role="img"
					aria-label={`Activation map of ${nodeName(selectedLayer, selectedIndex)}. Current activation ${fixed(selected.activation, 4)}.`}
					>{#if inputCount === 2}{#each response as point (point.id)}<rect
								x={16 + (point.id % 21) * 9.43}
								y={10 + Math.floor(point.id / 21) * 9.43}
								width="9.6"
								height="9.6"
								fill={tint(point.value)}
								fill-opacity={0.12 + (Math.abs(point.value) / responseScale) * 0.8}
							/>{/each}<g
							transform={`translate(${21 + (input[0] + 1) * 94.3},${15 + (1 - input[1]) * 94.3})`}
							><path
								d={inspectionMarkerPath(6, 2.5)}
								fill="none"
								stroke="var(--locator)"
								stroke-width="1.3"
								stroke-linecap="round"
							/></g
						>{:else}<path
							d={response
								.map(
									(point, index) =>
										`${index ? 'L' : 'M'}${16 + (point.x + 1) * 99},${109 - (point.value / responseScale) * 90}`
								)
								.join(' ')}
							fill="none"
							stroke="var(--wb-lavender)"
							stroke-width="3"
						/><path
							transform={`translate(${16 + (input[0] + 1) * 99},${109 - (selected.activation / responseScale) * 90})`}
							d={inspectionMarkerPath(6, 2.5)}
							fill="none"
							stroke="var(--locator)"
							stroke-width="1.3"
							stroke-linecap="round"
						/>{/if}<text x="16" y="227">−1</text><text x="115" y="227" text-anchor="middle"
						>x1 →</text
					><text x="214" y="227" text-anchor="end">+1</text></svg
				>
			</div>
			<details class="contribution-details">
				<summary
					>{selected.contributions.length
						? `${selected.contributions.length} incoming weights`
						: 'No incoming weights'}<PatternIcon name="chevronDown" size={14} /></summary
				>
				<div class="contribution-scroll">
					{#each selected.contributions as term, index (term.id)}<div
							class="contribution"
							data-contribution={term.id}
						>
							<span>{sourceName(index)}</span><span>{fixed(term.input)} × {fixed(term.weight)}</span
							><strong style:color={tint(term.product)}>{signed(term.product)}</strong>
						</div>{/each}{#if !selected.contributions.length}<p>
							Input nodes receive coordinates directly.
						</p>{/if}
				</div>
			</details>
		</div>
	</div>
	<details class="training-settings">
		<summary
			><PatternIcon name="settings" size={15} />Training settings & learning curves<PatternIcon
				name="chevronDown"
				size={14}
			/></summary
		>
		<div>{@render settings()}</div>
	</details>
</section>

<style>
	.neural-observatory {
		--wb-page: var(--paper);
		--wb-card: var(--lab-card);
		--wb-inset: var(--lab-inset);
		--wb-raised: var(--lab-raised);
		--wb-ink: var(--ink);
		--wb-muted: var(--muted);
		--wb-quiet: var(--quiet);
		--wb-line: var(--line);
		--wb-sage: var(--blue);
		--wb-blue: var(--blue);
		--wb-amber: var(--orange);
		--wb-lavender: var(--lavender);
		--neural-positive: var(--wb-sage);
		--neural-negative: var(--wb-amber);
		color: var(--wb-ink);
		background: var(--wb-card);
		border-radius: 18px;
		padding: 18px;
		container-type: inline-size;
		overflow: hidden;
	}
	.workbench-heading {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 20px;
	}
	h3 {
		font: italic 29px/1.1 var(--serif);
		margin: 0 0 7px;
		color: var(--wb-ink);
	}
	.workbench-heading p {
		margin: 0;
		color: var(--wb-muted);
		font-size: 12px;
		line-height: 1.55;
	}
	.architecture-count {
		flex: none;
		display: grid;
		gap: 5px;
		text-align: right;
	}
	.architecture-count strong {
		font: 16px var(--mono);
	}
	.architecture-count small {
		font-size: 10px;
		color: var(--wb-muted);
	}
	.workbench-toolbar {
		margin-top: 14px;
	}
	.workbench-metrics {
		margin: 10px 0 16px;
	}
	.workbench-layout {
		display: grid;
		grid-template-columns: minmax(200px, 0.95fr) minmax(365px, 1.65fr) minmax(210px, 0.95fr);
		grid-template-rows: auto 1fr;
		gap: 12px 18px;
		align-items: start;
	}
	.input-dock {
		grid-column: 1;
		grid-row: 1;
		padding: 14px;
		border-radius: 12px;
		background: var(--wb-inset);
		display: grid;
		gap: 16px;
	}
	.prediction-readout {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 4px 8px;
		align-items: center;
		margin: 0;
	}
	.prediction-readout > span {
		font-size: 11px;
		color: var(--wb-muted);
	}
	.prediction-readout strong {
		font: 25px var(--mono);
		grid-column: 2;
		grid-row: 1 / span 2;
		color: var(--wb-lavender);
	}
	.prediction-readout small {
		font-size: 10px;
		color: var(--wb-quiet);
	}
	.input-sliders {
		display: grid;
		gap: 12px;
	}
	.input-sliders label {
		display: grid;
		gap: 6px;
	}
	.input-sliders label > span {
		display: flex;
		justify-content: space-between;
		gap: 8px;
		font-size: 11px;
		color: var(--wb-muted);
	}
	.input-sliders strong {
		font: 11px var(--mono);
		color: var(--wb-ink);
	}
	.neural-observatory .input-sliders input {
		height: 20px;
		min-height: 20px;
		width: 100%;
		margin: 0;
		accent-color: var(--accent);
	}
	.probe-panel {
		grid-column: 1;
		grid-row: 2;
		min-width: 0;
	}
	.prediction-map {
		display: block;
		width: 100%;
		max-width: 280px;
		margin-inline: auto;
	}
	.prediction-map text {
		fill: var(--wb-muted);
		font: 9px var(--mono);
	}
	.class-key {
		display: flex;
		flex-wrap: wrap;
		gap: 7px 10px;
		font-size: 10px;
		color: var(--wb-muted);
		margin: 4px 0 12px;
	}
	.class-key span {
		display: flex;
		align-items: center;
		gap: 5px;
	}
	.class-key i,
	.network-key i {
		width: 5px;
		height: 5px;
		border-radius: 50%;
		display: inline-block;
	}
	.blue {
		background: var(--wb-blue);
	}
	.amber {
		background: var(--wb-amber);
	}
	.sage {
		background: var(--wb-sage);
	}
	.lavender {
		background: var(--wb-lavender);
	}
	.probe-key {
		color: var(--wb-ink);
	}
	.sample-toggles {
		display: flex;
		gap: 4px;
		flex-wrap: wrap;
	}
	.sample-toggles button {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 6px 7px;
		min-height: 29px;
		border: 0;
		border-radius: 7px;
		background: var(--wb-inset);
		color: var(--wb-muted);
		font-size: 10px;
		cursor: pointer;
	}
	.sample-toggles button[aria-pressed='false'] {
		opacity: 0.4;
	}
	.sample-toggles strong {
		font: 9px var(--mono);
	}
	.split-symbol.train {
		color: var(--wb-sage);
	}
	.split-symbol.validation {
		color: var(--wb-lavender);
	}
	.split-symbol.test {
		color: var(--wb-amber);
	}
	.panel-note {
		margin: 10px 0 0;
		font-size: 10px;
		line-height: 1.6;
		color: var(--wb-quiet);
	}
	.network-panel {
		grid-column: 2;
		grid-row: 1 / span 2;
		min-width: 0;
	}
	.network-tools {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 5px;
	}
	.network-tools button,
	.neuron-navigation button {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		border: 0;
		min-height: 30px;
		padding: 6px 8px;
		border-radius: 7px;
		background: transparent;
		color: var(--wb-muted);
		cursor: pointer;
		font-size: 10px;
	}
	.network-tools .trace-primary {
		background: var(--wb-raised);
		color: var(--wb-ink);
		min-width: 135px;
	}
	.network-tools button:disabled {
		opacity: 0.35;
	}
	.network-tools button:hover:not(:disabled),
	.neuron-navigation button:hover {
		background: var(--wb-raised);
	}
	.trace-progress {
		display: flex;
		justify-content: center;
		gap: 4px;
		margin: 10px 0 2px;
	}
	.trace-progress button {
		border: 0;
		padding: 5px 8px;
		background: transparent;
		color: var(--wb-quiet);
		border-radius: 6px;
		font-size: 9px;
		cursor: pointer;
	}
	.trace-progress .current-stage {
		background: color-mix(in srgb, var(--wb-lavender) 13%, var(--wb-inset));
		color: var(--wb-lavender);
	}
	.trace-progress .completed-stage {
		color: var(--wb-sage);
	}
	.diagram-scroll {
		overflow: auto;
		scrollbar-width: thin;
		overscroll-behavior-inline: contain;
	}
	.complete-network {
		display: block;
		width: 100%;
		min-width: 0;
		max-width: 440px;
		margin-inline: auto;
	}
	.layer-title {
		font: 9px var(--mono);
		letter-spacing: 0.05em;
		fill: var(--wb-muted);
	}
	.layer-subtitle {
		font: 10px var(--mono);
		fill: var(--wb-quiet);
	}
	.neuron {
		cursor: pointer;
		outline: none;
		transition:
			transform 360ms cubic-bezier(0.2, 0.7, 0.2, 1),
			opacity 160ms ease;
	}
	.node-base {
		fill: var(--wb-inset);
	}
	.node-halo {
		fill: none;
		stroke: var(--wb-lavender);
		stroke-width: 1.2;
		opacity: 0;
		transition: opacity 150ms ease;
	}
	.selected-neuron .node-halo {
		opacity: 1;
	}
	.neuron:focus-visible .node-halo {
		opacity: 1;
		stroke-dasharray: 2 2;
	}
	.neuron:hover .node-color {
		stroke-width: 1.8;
	}
	.node-value {
		fill: #fff;
		font: 10.5px var(--mono);
		pointer-events: none;
	}
	.bright-node {
		fill: #101822;
	}
	:global([data-theme='light']) .node-value {
		fill: #172436;
	}
	.input-label {
		fill: var(--wb-muted);
		font: 9px var(--mono);
	}
	.future-neuron {
		opacity: 0.25;
	}
	.layer-heading {
		transition: transform 360ms cubic-bezier(0.2, 0.7, 0.2, 1);
	}
	.weight-path {
		transition:
			d 360ms cubic-bezier(0.2, 0.7, 0.2, 1),
			opacity 180ms ease,
			stroke-width 150ms ease;
	}
	.node-color {
		transition:
			fill-opacity 80ms linear,
			fill 80ms linear;
	}
	.signal-arriving {
		animation: signal 1.4s linear;
	}
	@keyframes signal {
		from {
			stroke-dasharray: 3 8;
			stroke-dashoffset: 44;
		}
		to {
			stroke-dasharray: 3 8;
			stroke-dashoffset: 0;
		}
	}
	.network-key {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		flex-wrap: wrap;
		font-size: 9px;
		color: var(--wb-muted);
		margin: 1px 0 9px;
	}
	.network-key span {
		display: flex;
		align-items: center;
		gap: 4px;
	}
	.forward-story {
		display: flex;
		align-items: flex-start;
		gap: 8px;
		color: var(--wb-lavender);
		padding: 10px;
		border-radius: 8px;
		background: var(--wb-inset);
		min-height: 45px;
		box-sizing: border-box;
	}
	.forward-story :global(svg) {
		flex: none;
		margin-top: 2px;
	}
	.forward-story p {
		margin: 0;
		color: var(--wb-muted);
		font-size: 10px;
		line-height: 1.5;
	}
	.neuron-inspector {
		grid-column: 3;
		grid-row: 1 / span 2;
		min-width: 0;
	}
	.inspector-heading {
		display: flex;
		justify-content: space-between;
		gap: 8px;
		align-items: flex-start;
		min-height: 48px;
	}
	.micro-label {
		font-size: 9px;
		color: var(--wb-quiet);
	}
	.inspector-heading h4 {
		font-size: 12px;
		font-weight: 500;
		line-height: 1.45;
		margin: 5px 0 0;
	}
	.neuron-navigation {
		display: flex;
		gap: 1px;
		flex: none;
	}
	.neuron-navigation button {
		width: 25px;
		padding: 4px;
		min-height: 25px;
	}
	.calculation-flow {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 5px;
		margin-top: 10px;
	}
	.calculation-flow > div {
		display: grid;
		gap: 7px;
		min-width: 0;
	}
	.calculation-flow > div > span {
		color: var(--wb-muted);
		font-size: 8px;
		white-space: nowrap;
	}
	.calculation-flow strong {
		font: 12px var(--mono);
	}
	.calculation-flow > span {
		font-size: 11px;
		color: var(--wb-quiet);
	}
	.activation-result {
		display: grid;
		gap: 7px;
		border-radius: 9px;
		background: var(--wb-inset);
		padding: 11px;
		margin-top: 12px;
	}
	.activation-result > span {
		font-size: 9px;
		color: var(--wb-muted);
	}
	.activation-result strong {
		font: 12px var(--mono);
		color: var(--wb-lavender);
	}
	.input-description {
		margin: 8px 0;
		color: var(--wb-muted);
		font-size: 11px;
		line-height: 1.6;
	}
	.neuron-response {
		margin-top: 16px;
	}
	.neuron-response h4 {
		margin: 0 0 4px;
		font-size: 11px;
		font-weight: 500;
	}
	.neuron-response p {
		margin: 0;
		font-size: 9px;
		color: var(--wb-quiet);
	}
	.neuron-response svg {
		display: block;
		width: 100%;
		max-width: 185px;
		margin: 8px auto 0;
	}
	.neuron-response text {
		fill: var(--wb-muted);
		font: 9px var(--mono);
	}
	.contribution-details {
		margin-top: 10px;
	}
	.contribution-details summary,
	.training-settings summary {
		display: flex;
		align-items: center;
		gap: 8px;
		cursor: pointer;
		color: var(--wb-muted);
		list-style: none;
		font-size: 10px;
	}
	.contribution-details summary {
		justify-content: space-between;
		padding: 9px 0;
	}
	.contribution-details summary::-webkit-details-marker,
	.training-settings summary::-webkit-details-marker {
		display: none;
	}
	.contribution-details[open] summary :global(svg),
	.training-settings[open] summary > :global(svg:last-child) {
		transform: rotate(180deg);
	}
	.contribution-scroll {
		display: grid;
		gap: 5px;
		max-height: 215px;
		overflow: auto;
		scrollbar-width: thin;
		padding-right: 3px;
	}
	.contribution {
		display: grid;
		grid-template-columns: auto 1fr auto;
		align-items: center;
		gap: 6px;
		font: 9px var(--mono);
		padding: 7px;
		border-radius: 6px;
		background: var(--wb-inset);
	}
	.contribution > span:nth-child(2) {
		font-size: 8px;
		color: var(--wb-muted);
		text-align: center;
	}
	.contribution > strong {
		font-weight: 400;
	}
	.contribution-scroll p {
		font-size: 11px;
		color: var(--wb-muted);
	}
	.training-settings {
		margin-top: 18px;
		padding-top: 12px;
		border-top: 1px solid var(--wb-line);
	}
	.training-settings > summary {
		width: fit-content;
		padding: 4px 0;
	}
	.training-settings > div {
		padding-top: 15px;
	}
	.view-tabs {
		display: none;
	}
	@container (max-width:980px) {
		.workbench-layout {
			display: block;
		}
		.view-tabs {
			display: flex;
			gap: 5px;
			margin: 0 0 12px;
		}
		.view-tabs button {
			display: flex;
			align-items: center;
			justify-content: center;
			gap: 7px;
			flex: 1;
			padding: 9px;
			background: transparent;
			border: 0;
			border-radius: 8px;
			color: var(--wb-muted);
			cursor: pointer;
			font-size: 12px;
		}
		.view-tabs [aria-selected='true'] {
			background: var(--wb-raised);
			color: var(--wb-lavender);
		}
		.input-dock {
			display: grid;
			grid-template-columns: 150px 1fr;
			gap: 22px;
			align-items: center;
			margin-bottom: 14px;
		}
		.prediction-readout {
			display: flex;
			flex-direction: column;
			align-items: flex-start;
			gap: 3px;
		}
		.prediction-readout strong {
			font-size: 29px;
		}
		.neural-observatory .input-sliders input {
			height: 24px;
			min-height: 24px;
		}
		.input-sliders {
			gap: 10px;
		}
		.probe-panel,
		.network-panel,
		.neuron-inspector {
			display: none;
		}
		[data-view='prediction'] .probe-panel,
		[data-view='network'] .network-panel,
		[data-view='neuron'] .neuron-inspector {
			display: block;
		}
		.prediction-map {
			max-width: 340px;
			margin-inline: auto;
		}
		.class-key,
		.sample-toggles {
			justify-content: center;
		}
		.panel-note {
			text-align: center;
		}
		.network-panel {
			max-width: 570px;
			margin-inline: auto;
		}
		.network-tools {
			justify-content: flex-start;
		}
		.trace-progress {
			justify-content: flex-start;
		}
		.complete-network {
			max-width: 440px;
		}
		.neuron-inspector {
			max-width: 500px;
			margin-inline: auto;
		}
		.inspector-heading h4 {
			font-size: 15px;
		}
		.micro-label {
			font-size: 10px;
		}
		.calculation-flow strong {
			font-size: 17px;
		}
		.calculation-flow > div > span {
			font-size: 10px;
		}
		.activation-result strong {
			font-size: 15px;
		}
		.activation-result > span {
			font-size: 11px;
		}
		.neuron-response {
			display: grid;
			grid-template-columns: 1fr 200px;
			align-items: center;
			gap: 20px;
		}
		.neuron-response h4 {
			font-size: 13px;
		}
		.neuron-response p {
			font-size: 11px;
		}
		.neuron-response svg {
			margin: 0;
		}
		.contribution {
			font-size: 11px;
			padding: 9px;
		}
		.contribution > span:nth-child(2) {
			font-size: 10px;
		}
		.contribution-details summary {
			font-size: 12px;
		}
	}
	@container (max-width:510px) {
		.workbench-heading {
			display: block;
		}
		.workbench-heading h3 {
			font-size: 28px;
		}
		.workbench-heading p {
			font-size: 11px;
		}
		.architecture-count {
			display: flex;
			align-items: center;
			justify-content: space-between;
			margin-top: 12px;
			text-align: left;
		}
		.architecture-count strong {
			font-size: 13px;
		}
		.architecture-count small {
			font-size: 9px;
		}
		.workbench-toolbar {
			margin-top: 15px;
		}
		.workbench-metrics {
			margin: 12px 0 14px;
		}
		.input-dock {
			grid-template-columns: 100px 1fr;
			padding: 12px;
			gap: 15px;
		}
		.prediction-readout strong {
			font-size: 26px;
		}
		.prediction-readout span {
			font-size: 10px;
		}
		.prediction-readout small {
			font-size: 9px;
		}
		.prediction-map {
			max-width: 340px;
		}
		.view-tabs button {
			font-size: 11px;
			gap: 5px;
			padding: 8px 5px;
		}
		.neuron-response {
			grid-template-columns: 1fr 150px;
			gap: 12px;
		}
		.neuron-navigation button {
			width: 34px;
			min-height: 34px;
		}
		.neuron-response h4 {
			font-size: 12px;
		}
		.neuron-response p {
			font-size: 10px;
		}
		.complete-network {
			min-width: 0;
		}
		.forward-story p {
			font-size: 11px;
		}
	}
	@media (max-width: 600px) {
		.neural-observatory {
			padding: 16px;
			border-radius: 14px;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.neural-observatory * {
			animation: none !important;
			transition: none !important;
			scroll-behavior: auto !important;
		}
	}
</style>
