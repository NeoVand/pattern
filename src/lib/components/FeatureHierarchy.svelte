<script lang="ts">
	import { onMount } from 'svelte';
	import { base } from '$app/paths';
	import PatternIcon from './PatternIcon.svelte';
	import ConvHeatmap from './ConvHeatmap.svelte';
	import FashionPicker from './FashionPicker.svelte';
	import ConvNetwork from './ConvNetwork.svelte';
	import {
		CONV_CLASSES,
		CONV_SHAPES,
		convReceptiveField,
		traceConv,
		type ConvWeights
	} from '$lib/ml/convnet';
	import {
		FEATURE_STAGES,
		featurePatch,
		flattenFeaturePatch,
		type FeatureAtlas,
		type FeatureExample
	} from '$lib/ml/feature-hierarchy';
	import type { ConvFashionData } from '$lib/ml/convnet-data';
	let {
		data,
		weights,
		checkpointHash
	}: { data: ConvFashionData; weights: ConvWeights; checkpointHash: string } = $props();
	let atlas = $state.raw<FeatureAtlas | null>(null);
	let error = $state('');
	let inputIndex = $state(0);
	const inputPixels = $derived(data.testX.subarray(inputIndex * 784, (inputIndex + 1) * 784));
	const inputTrace = $derived(traceConv(weights, inputPixels));
	const inputCell = $derived.by(() => {
		const side = CONV_SHAPES[layer].side;
		const values = inputTrace.maps[layer].subarray(
			channel * side * side,
			(channel + 1) * side * side
		);
		let best = 0;
		for (let i = 1; i < values.length; i++) if (values[i] > values[best]) best = i;
		return { x: best % side, y: Math.floor(best / side) };
	});
	let layer = $state(0),
		channel = $state<number>(3),
		exampleIndex = $state(0),
		flatten = $state(0);
	const stage = $derived(FEATURE_STAGES[layer]);
	const featureIndex = $derived(stage.features.findIndex((item) => item.channel === channel));
	const interpretation = $derived(
		stage.features[featureIndex] ?? {
			channel,
			name: `Layer ${layer + 1}, feature ${channel + 1}`,
			detail:
				'Compare the strongest patches below. Which boundaries, textures, or arrangements recur? This filter has no assigned concept name; these are its actual highest-response examples.'
		}
	);
	const feature = $derived(atlas?.layers[layer].channels[interpretation.channel]);
	const example = $derived(feature?.examples[exampleIndex]);
	const original = $derived(
		example
			? data.trainX.subarray(example.index * 784, (example.index + 1) * 784)
			: new Float32Array(784)
	);
	const edited = $derived(
		example ? flattenFeaturePatch(original, layer, example.x, example.y, flatten / 100) : original
	);
	const field = $derived(convReceptiveField(layer, example?.x ?? 0, example?.y ?? 0));
	const crop = $derived(
		example ? featurePatch(edited, layer, example.x, example.y) : new Float32Array(stage.size ** 2)
	);
	const trace = $derived(traceConv(weights, edited));
	const response = $derived.by(() => {
		if (!example) return 0;
		const side = CONV_SHAPES[layer].side;
		return trace.maps[layer][interpretation.channel * side * side + example.y * side + example.x];
	});
	const chartMax = $derived(Math.max(example?.score ?? 1, response, 0.01) * 1.12);
	function selectLayer(value: number) {
		layer = value;
		channel = FEATURE_STAGES[value].features[0].channel;
		exampleIndex = 0;
		flatten = 0;
	}
	function selectFeature(value: number) {
		channel = stage.features[value].channel;
		exampleIndex = 0;
		flatten = 0;
	}
	function selectNetwork(atLayer: number, atChannel: number) {
		layer = atLayer;
		channel = atChannel;
		exampleIndex = 0;
		flatten = 0;
	}
	function selectExample(value: number) {
		exampleIndex = value;
		flatten = 0;
	}
	function patchAt(ex: FeatureExample, atLayer: number) {
		return featurePatch(
			data.trainX.subarray(ex.index * 784, (ex.index + 1) * 784),
			atLayer,
			ex.x,
			ex.y
		);
	}
	onMount(() => {
		const controller = new AbortController();
		fetch(`${base}/data/fashion-feature-atlas.json`, { signal: controller.signal })
			.then(async (r) => {
				if (!r.ok) throw new Error('The feature collection could not load.');
				return r.json();
			})
			.then((value: FeatureAtlas) => {
				if (value.checkpointSha256 !== checkpointHash)
					throw new Error('The feature collection belongs to a different checkpoint.');
				atlas = value;
			})
			.catch((e) => {
				if (!controller.signal.aborted) error = e.message;
			});
		return () => controller.abort();
	});
</script>

<section class="feature-hierarchy" aria-label="Interpret the learned feature hierarchy">
	<header class="hierarchy-heading">
		<div>
			<span class="hierarchy-kicker">Trained reference · learned features</span>
			<h3>Edges become contours.<br /><em>Contours become parts.</em></h3>
		</div>
		<p>
			Follow an image through the actual trained network. Select a feature to connect its neurons,
			its learned pattern, and the image patches that excite it.
		</p>
	</header>
	{#if error}<p class="hierarchy-status" role="alert">{error}</p>
	{:else if !atlas}<p class="hierarchy-status" role="status">Gathering the learned features…</p>
	{:else}
		<FashionPicker
			pixels={data.testX}
			labels={data.testY}
			value={inputIndex}
			onchange={(index) => (inputIndex = index)}
		/>
		<ConvNetwork
			{weights}
			trace={inputTrace}
			pixels={inputPixels}
			{atlas}
			trainingPixels={data.trainX}
			{layer}
			{channel}
			cellX={inputCell.x}
			cellY={inputCell.y}
			onselect={selectNetwork}
			onlayer={selectLayer}
		/>
		<div class="hierarchy-meaning">
			<PatternIcon name="layers" size={18} />
			<p>{stage.meaning}</p>
			<span>A growing field of view.</span>
		</div>
		<div class="feature-tabs" aria-label="Choose an interpreted feature">
			{#each stage.features as item, i (item.channel)}<button
					class:active={featureIndex === i}
					aria-pressed={featureIndex === i}
					onclick={() => selectFeature(i)}>{item.name}</button
				>{/each}
		</div>
		{#if example && feature}
			<div
				class="feature-evidence"
				data-testid="feature-evidence"
				data-layer={layer}
				data-channel={interpretation.channel}
			>
				<div class="feature-reading">
					<span class="hierarchy-kicker"
						>{featureIndex >= 0 ? 'An interpretation' : 'An unnamed feature'} · filter {interpretation.channel +
							1}</span
					>
					<h4>{interpretation.name}</h4>
					<p>{interpretation.detail}</p>
					<small
						>Names describe the examples we observe. A filter can respond to more than one kind of
						pattern.</small
					>
				</div>
				<div class="feature-matches">
					<div class="evidence-heading">
						<strong>What it responds to</strong><span>Six strongest matches</span>
					</div>
					<div class="match-grid">
						{#each feature.examples as ex, i (ex.index)}<button
								class:active={exampleIndex === i}
								aria-pressed={exampleIndex === i}
								aria-label={`Inspect match ${i + 1}: ${CONV_CLASSES[ex.label]}`}
								onclick={() => selectExample(i)}
								><span
									><ConvHeatmap values={patchAt(ex, layer)} side={stage.size} kind="image" /></span
								><small>{CONV_CLASSES[ex.label]}</small></button
							>{/each}
					</div>
					<p>
						Actual input patches, ranked across 2,000 training images. Selecting a match changes the
						evidence probe below; your chosen test image above stays fixed.
					</p>
				</div>
				<div class="feature-probe">
					<div class="evidence-heading">
						<strong>Remove the pattern</strong><span>{CONV_CLASSES[example.label]}</span>
					</div>
					<div class="probe-images">
						<div class="probe-source">
							<ConvHeatmap
								values={edited}
								side={28}
								kind="image"
								label="Source clothing image with the selected patch"
							/><svg viewBox="0 0 28 28" aria-hidden="true"
								><rect x={field.left} y={field.top} width={field.size} height={field.size} /></svg
							>
						</div>
						<PatternIcon name="arrowRight" size={16} />
						<div class="probe-crop">
							<ConvHeatmap
								values={crop}
								side={stage.size}
								kind="image"
								label="The exact pixels visible to this unit"
							/>
						</div>
					</div>
					<label class="flatten-control"
						><span>Smooth away the pattern <output>{flatten}%</output></span><input
							type="range"
							min="0"
							max="100"
							step="1"
							bind:value={flatten}
							aria-label="Smooth away the selected feature"
						/></label
					>
					<div class="feature-response" aria-live="polite">
						<div>
							<span>Filter response</span><strong data-testid="feature-response"
								>{response.toFixed(2)}</strong
							>
						</div>
						<div class="response-bar">
							<i style:width={`${(response / chartMax) * 100}%`}></i><b
								style:left={`${(example.score / chartMax) * 100}%`}
								title={`Original response: ${example.score.toFixed(2)}`}
							></b>
						</div>
						<small>Original {example.score.toFixed(2)} <span>Weights stay fixed</span></small>
					</div>
				</div>
			</div>
		{/if}
		<footer class="hierarchy-footer">
			<p>
				Each layer combines earlier features. The classifier then weighs their arrangement to choose
				a clothing category.
			</p>
			<details>
				<summary>How to read this view <PatternIcon name="chevronDown" size={14} /></summary>
				<div>
					<p>
						These patches come from the first 2,000 bundled training images and the saved reference
						checkpoint. Each match is the strongest interior response for a different image, without
						padded borders. The windows grow from 3 × 3 to 7 × 7 to 15 × 15 pixels. The slider
						blends a patch toward its mean brightness, then reruns the model at the same location.
					</p>
					<p>
						Nine filters have guided interpretations; all 48 can be explored. This does not mean a
						network assigns one concept to each neuron. The live activation inspector below can be
						trained separately; this reference collection stays fixed.
					</p>
					<a href="https://distill.pub/2018/building-blocks/" target="_blank" rel="noreferrer"
						>The Building Blocks of Interpretability <PatternIcon
							name="arrowUpRight"
							size={13}
						/></a
					>
				</div>
			</details>
		</footer>
	{/if}
</section>

<style>
	.feature-hierarchy {
		background: var(--surface);
		border-radius: 22px;
		padding: clamp(20px, 3vw, 32px);
		margin-bottom: 42px;
	}
	.hierarchy-heading {
		display: grid;
		grid-template-columns: 1.2fr 1fr;
		align-items: end;
		gap: 32px;
		margin-bottom: 26px;
	}
	.hierarchy-kicker {
		display: block;
		color: var(--lavender);
		font-size: 9px;
		letter-spacing: 0.14em;
		text-transform: uppercase;
	}
	.hierarchy-heading h3 {
		font-size: clamp(28px, 3vw, 38px);
		line-height: 1.1;
		font-weight: 400;
		letter-spacing: -0.045em;
		margin: 12px 0 0;
	}
	.hierarchy-heading h3 em {
		font-family: var(--serif);
		color: var(--lavender);
		font-weight: 400;
	}
	.hierarchy-heading p {
		max-width: 40em;
		color: var(--muted);
		font-size: 12px;
		line-height: 1.8;
		margin: 0;
	}
	.hierarchy-meaning {
		display: flex;
		align-items: center;
		gap: 10px;
		margin: 19px 0 23px;
		color: var(--muted);
	}
	.hierarchy-meaning :global(svg) {
		flex: 0 0 auto;
		color: var(--lavender);
	}
	.hierarchy-meaning p {
		margin: 0;
		font-size: 11px;
		line-height: 1.6;
	}
	.hierarchy-meaning > span {
		margin-left: auto;
		flex: 0 0 150px;
		font-size: 10px;
		text-align: right;
		color: var(--quiet);
	}
	.feature-tabs {
		display: flex;
		flex-wrap: wrap;
		gap: 5px;
		margin-bottom: 22px;
	}
	.feature-tabs button {
		background: transparent;
		color: var(--muted);
		padding: 9px 12px;
		border: 0;
		border-radius: 8px;
		font-size: 11px;
		cursor: pointer;
		transition:
			background 0.2s,
			color 0.2s;
	}
	.feature-tabs button:hover,
	.feature-tabs button.active {
		background: var(--surface-raised);
		color: var(--ink);
	}
	.feature-evidence {
		display: grid;
		grid-template-columns: minmax(0, 0.95fr) minmax(0, 1.1fr) minmax(0, 1.05fr);
		gap: 28px;
		align-items: start;
	}
	.feature-reading h4 {
		font-size: 25px;
		font-family: var(--serif);
		font-weight: 400;
		line-height: 1.15;
		margin: 12px 0;
	}
	.feature-reading p {
		color: var(--muted);
		font-size: 12px;
		line-height: 1.8;
		margin: 0 0 14px;
	}
	.feature-reading small {
		display: block;
		font-size: 10px;
		line-height: 1.7;
		color: var(--quiet);
	}
	.evidence-heading {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		flex-wrap: wrap;
		gap: 6px;
		margin-bottom: 13px;
	}
	.evidence-heading strong {
		font-size: 12px;
		font-weight: 500;
	}
	.evidence-heading > span {
		color: var(--quiet);
		font-size: 9px;
	}
	.match-grid {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 8px;
	}
	.match-grid button {
		border: 0;
		border-radius: 9px;
		padding: 4px;
		background: var(--lab-inset);
		color: var(--muted);
		cursor: pointer;
		transition: box-shadow 0.2s;
	}
	.match-grid button.active {
		box-shadow: 0 0 0 1.5px var(--blue);
	}
	.match-grid button > span {
		display: block;
		aspect-ratio: 1;
		border-radius: 5px;
		overflow: hidden;
	}
	.match-grid small {
		display: block;
		font-size: 8px;
		margin: 5px 0 2px;
		white-space: nowrap;
	}
	.feature-matches > p {
		font-size: 10px;
		color: var(--quiet);
		line-height: 1.6;
		margin: 12px 0 0;
	}
	.feature-probe {
		background: var(--lab-inset);
		border-radius: 12px;
		padding: 16px;
	}
	.probe-images {
		display: grid;
		grid-template-columns: 1.3fr 16px 1fr;
		gap: 10px;
		align-items: center;
	}
	.probe-source,
	.probe-crop {
		position: relative;
		border-radius: 7px;
		overflow: hidden;
		aspect-ratio: 1;
	}
	.probe-source svg {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		pointer-events: none;
	}
	.probe-source rect {
		fill: none;
		stroke: #cdbbf4;
		stroke-width: 0.32;
	}
	.probe-images > :global(svg) {
		color: var(--muted);
	}
	.flatten-control {
		display: block;
		margin-top: 17px;
	}
	.flatten-control > span {
		display: flex;
		justify-content: space-between;
		gap: 8px;
		font-size: 10px;
		color: var(--muted);
	}
	.flatten-control output {
		font-family: var(--mono);
		color: var(--blue);
	}
	.flatten-control input {
		width: 100%;
		margin: 5px 0 8px;
		min-height: 22px;
	}
	.feature-response > div:first-child {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		color: var(--muted);
		font-size: 10px;
	}
	.feature-response strong {
		color: var(--lavender);
		font: 20px var(--mono);
	}
	.response-bar {
		height: 5px;
		position: relative;
		margin: 9px 0 8px;
		background: var(--surface-raised);
		border-radius: 3px;
	}
	.response-bar i {
		height: 100%;
		display: block;
		background: var(--lavender);
		border-radius: inherit;
		transition: width 90ms linear;
	}
	.response-bar b {
		position: absolute;
		top: -3px;
		width: 1px;
		height: 11px;
		background: var(--muted);
	}
	.feature-response small {
		display: flex;
		justify-content: space-between;
		gap: 8px;
		font-size: 8px;
		color: var(--quiet);
	}
	.hierarchy-footer {
		display: flex;
		align-items: start;
		justify-content: space-between;
		gap: 30px;
		margin-top: 24px;
		padding-top: 17px;
		border-top: 1px solid var(--line);
	}
	.hierarchy-footer > p {
		margin: 0;
		color: var(--muted);
		font-size: 10px;
		line-height: 1.7;
		max-width: 48em;
	}
	.hierarchy-footer details {
		max-width: 420px;
		font-size: 10px;
		color: var(--muted);
	}
	.hierarchy-footer summary {
		display: flex;
		gap: 16px;
		align-items: center;
		cursor: pointer;
		list-style: none;
		white-space: nowrap;
	}
	.hierarchy-footer summary::-webkit-details-marker {
		display: none;
	}
	.hierarchy-footer details p {
		line-height: 1.75;
	}
	.hierarchy-footer a {
		display: inline-flex;
		gap: 6px;
		align-items: center;
		color: var(--blue);
	}
	.hierarchy-status {
		color: var(--muted);
		padding: 30px 0;
		font-size: 12px;
	}
	button:focus-visible,
	summary:focus-visible,
	input:focus-visible {
		outline: 2px solid var(--focus);
		outline-offset: 4px;
	}
	@media (max-width: 1100px) {
		.feature-evidence {
			grid-template-columns: 1fr 1fr;
			gap: 22px;
		}
		.feature-reading {
			grid-column: 1/-1;
		}
		.feature-reading p {
			max-width: 65em;
		}
		.hierarchy-meaning > span {
			display: none;
		}
	}
	@media (max-width: 620px) {
		.hierarchy-heading {
			grid-template-columns: 1fr;
			gap: 14px;
		}
		.feature-tabs button {
			padding: 8px 9px;
			font-size: 10px;
		}
		.feature-evidence {
			grid-template-columns: 1fr;
		}
		.feature-reading {
			grid-column: auto;
		}
		.match-grid {
			grid-template-columns: repeat(6, minmax(0, 1fr));
			gap: 5px;
		}
		.match-grid button {
			padding: 3px;
		}
		.match-grid small {
			display: none;
		}
		.probe-images {
			grid-template-columns: minmax(0, 1fr) 20px minmax(0, 0.8fr);
			max-width: 240px;
			margin: 0 auto;
		}
		.hierarchy-footer {
			flex-direction: column;
			gap: 12px;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		*,
		*::before,
		*::after {
			transition: none !important;
		}
	}
</style>
