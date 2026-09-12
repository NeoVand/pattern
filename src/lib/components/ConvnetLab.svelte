<script lang="ts">
	import { onMount } from 'svelte';
	import { base } from '$app/paths';
	import PatternIcon from './PatternIcon.svelte';
	import ConvHeatmap from './ConvHeatmap.svelte';
	import FeatureHierarchy from './FeatureHierarchy.svelte';
	import { loadConvFashion, type ConvFashionData } from '$lib/ml/convnet-data';
	import {
		CONV_CLASSES,
		CONV_SHAPES,
		convFilter,
		convMap,
		convReceptiveField,
		seededConvWeights,
		traceConv,
		unpackConvWeights,
		type ConvCheckpointMeta,
		type ConvWeights
	} from '$lib/ml/convnet';
	import type { ConvCommand, ConvReply, ConvSnapshot } from '$lib/ml/convnet-worker';
	let data = $state.raw<ConvFashionData | null>(null);
	let weights = $state.raw<ConvWeights | null>(null);
	let checkpoint: Float32Array;
	let referenceWeights = $state.raw<ConvWeights | null>(null);
	let metadata = $state.raw<ConvCheckpointMeta | null>(null);
	let snapshot = $state.raw<ConvSnapshot | null>(null);
	let sample = $state(0),
		layer = $state(0),
		channel = $state(0),
		source = $state(0),
		cellX = $state(7),
		cellY = $state(7);
	let muted = $state(false),
		loading = $state(true),
		ready = $state(false),
		running = $state(false),
		pristine = $state(true),
		untrained = $state(false);
	let error = $state(''),
		status = $state('Loading the clothing collection…'),
		device = $state(''),
		searching = $state(false),
		searchNote = $state('');
	let worker: Worker | undefined,
		generation = 0,
		disposed = false;
	const pixels = $derived(
		data?.testX.subarray(sample * 784, (sample + 1) * 784) ?? new Float32Array(784)
	);
	const trueLabel = $derived(data?.testY[sample] ?? 0);
	const trace = $derived(weights ? traceConv(weights, pixels) : null);
	const result = $derived(
		muted && weights ? traceConv(weights, pixels, { layer, channel }) : trace
	);
	const shape = $derived(CONV_SHAPES[layer]);
	const map = $derived(
		result ? convMap(result, layer, channel) : new Float32Array(shape.side ** 2)
	);
	const maxActivation = $derived(trace ? Math.max(0.001, ...trace.maps[layer]) : 1);
	const kernel = $derived(
		weights ? convFilter(weights, layer, channel, source) : new Float32Array(9)
	);
	const maxKernel = $derived(Math.max(0.001, ...kernel.map(Math.abs)));
	const field = $derived(convReceptiveField(layer, cellX, cellY));
	const ranked = $derived(
		result
			? Array.from(result.probabilities, (score, label) => ({ label, score })).sort(
					(a, b) => b.score - a.score
				)
			: []
	);
	const gallery = $derived.by(() => {
		if (!data) return [];
		const indices: number[] = [];
		for (let i = sample + 1; i < data.testY.length + sample + 1 && indices.length < 6; i++) {
			const index = i % data.testY.length;
			if (data.testY[index] === trueLabel) indices.push(index);
		}
		return indices;
	});
	const testMetric = $derived(snapshot?.test ?? (pristine ? metadata?.test : undefined));
	const validationMetric = $derived(
		snapshot?.validation ?? (pristine ? metadata?.validation : undefined)
	);
	function send(command: ConvCommand) {
		worker?.postMessage(command);
	}
	async function load(forceCpu = false) {
		generation++;
		const request = generation;
		loading = true;
		ready = false;
		error = '';
		running = false;
		worker?.terminate();
		try {
			const [loaded, response, info] = await Promise.all([
				loadConvFashion(),
				fetch(`${base}/data/fashion-convnet.f32`),
				fetch(`${base}/data/fashion-convnet.json`)
			]);
			if (!response.ok || !info.ok)
				throw new Error('The trained convolutional model could not load.');
			const packed = new Float32Array(await response.arrayBuffer());
			const meta = (await info.json()) as ConvCheckpointMeta;
			if (disposed || request !== generation) return;
			checkpoint = packed;
			referenceWeights = unpackConvWeights(packed);
			metadata = meta;
			data = loaded;
			weights = unpackConvWeights(packed);
			snapshot = null;
			pristine = true;
			untrained = false;
			loading = false;
			worker = new Worker(new URL('../ml/convnet-worker.ts', import.meta.url), { type: 'module' });
			worker.onmessage = (event: MessageEvent<ConvReply>) => {
				const message = event.data;
				if (disposed || message.generation !== generation) return;
				if (message.type === 'status') {
					status = message.message;
					if (message.device) {
						device = message.device;
						ready = true;
					}
				}
				if (message.type === 'error') {
					error = message.message;
					running = false;
					ready = false;
				}
				if (message.type === 'snapshot') {
					snapshot = message;
					weights = unpackConvWeights(message.weights);
					running = message.running;
					pristine = false;
					status = message.running ? 'Updating every layer…' : 'Training paused';
				}
			};
			worker.onerror = () => {
				error = 'The training engine could not start. The trained model can still be explored.';
				running = false;
				ready = false;
			};
			// Keep test pixels available to the inspector. The worker has its own copy.
			send({
				type: 'init',
				generation,
				trainX: loaded.trainX,
				trainY: loaded.trainY,
				testX: loaded.testX,
				testY: loaded.testY,
				weights: packed,
				forceCpu
			});
		} catch (cause) {
			if (!disposed) {
				error = cause instanceof Error ? cause.message : 'The clothing model could not load.';
				loading = false;
			}
		}
	}
	function selectLayer(next: number) {
		layer = next;
		channel = 0;
		source = 0;
		cellX = Math.floor(CONV_SHAPES[next].side / 2);
		cellY = cellX;
		muted = false;
	}
	function selectSample(index: number) {
		sample = index;
		searchNote = '';
	}
	function stepSample(direction: number) {
		if (data) selectSample((sample + direction + data.testY.length) % data.testY.length);
	}
	function chooseClass(label: number) {
		if (data) {
			const index = data.testY.findIndex((value, i) => value === label && i !== sample);
			if (index >= 0) selectSample(index);
		}
	}
	function chooseCell(event: MouseEvent) {
		const box = event.currentTarget as HTMLElement,
			rect = box.getBoundingClientRect();
		cellX = Math.min(
			shape.side - 1,
			Math.max(0, Math.floor(((event.clientX - rect.left) / rect.width) * shape.side))
		);
		cellY = Math.min(
			shape.side - 1,
			Math.max(0, Math.floor(((event.clientY - rect.top) / rect.height) * shape.side))
		);
	}
	function moveCell(event: KeyboardEvent) {
		if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return;
		event.preventDefault();
		event.stopPropagation();
		cellX = Math.max(
			0,
			Math.min(
				shape.side - 1,
				cellX + Number(event.key === 'ArrowRight') - Number(event.key === 'ArrowLeft')
			)
		);
		cellY = Math.max(
			0,
			Math.min(
				shape.side - 1,
				cellY + Number(event.key === 'ArrowDown') - Number(event.key === 'ArrowUp')
			)
		);
	}
	async function findMistake() {
		if (!data || !weights || searching) return;
		muted = false;
		searching = true;
		searchNote = '';
		const currentWeights = weights,
			currentData = data;
		for (let offset = 1; offset <= currentData.testY.length; offset++) {
			const index = (sample + offset) % currentData.testY.length;
			if (
				traceConv(currentWeights, currentData.testX.subarray(index * 784, (index + 1) * 784))
					.prediction !== currentData.testY[index]
			) {
				sample = index;
				searching = false;
				return;
			}
			if (offset % 30 === 0) await new Promise((resolve) => setTimeout(resolve, 0));
			if (disposed) {
				return;
			}
		}
		searching = false;
		searchNote = 'No mistakes found in these 2,000 held-out images.';
	}
	function train() {
		if (!ready || running) return;
		running = true;
		error = '';
		status = 'Updating every layer…';
		send({ type: 'train', generation, steps: 100 });
	}
	function pause() {
		running = false;
		status = 'Finishing this update…';
		send({ type: 'pause', generation });
	}
	function reset(random = false) {
		if (!checkpoint || !ready) return;
		generation++;
		running = false;
		muted = false;
		untrained = random;
		pristine = !random;
		snapshot = null;
		ready = false;
		status = 'Preparing weights…';
		const packed = random ? seededConvWeights() : checkpoint;
		weights = unpackConvWeights(packed);
		send({ type: 'reset', generation, weights: packed, reportMetrics: random });
	}
	onMount(() => {
		void load();
		return () => {
			disposed = true;
			generation++;
			worker?.terminate();
		};
	});
	const percent = (value: number) => `${(value * 100).toFixed(1)}%`;
</script>

<section class="conv-lab" aria-label="Convolutional clothing classifier">
	{#if data && referenceWeights && metadata}<FeatureHierarchy
			{data}
			weights={referenceWeights}
			checkpointHash={metadata.sha256}
		/>{/if}
	<header class="conv-heading">
		<div>
			<span class="conv-kicker">Fashion-MNIST · ten kinds of clothing</span>
			<h3>Now follow one image through the network.</h3>
			<p>Choose an image, follow its features, then remove one to see what changes.</p>
		</div>
		<span class="conv-model-state"
			><span class:conv-live={running}></span>{untrained
				? 'Started from random weights'
				: pristine
					? 'Trained model'
					: 'Your trained model'}<small>8,578 parameters</small></span
		>
	</header>
	{#if loading}
		<div class="conv-loading" role="status">
			<PatternIcon name="layers" size={36} />
			<p>{status}</p>
		</div>
	{:else if trace && result && data}
		<div class="conv-workspace">
			<div class="conv-class-picker" aria-label="Choose a clothing category">
				{#each CONV_CLASSES as name, label (name)}<button
						class:active={trueLabel === label}
						aria-pressed={trueLabel === label}
						onclick={() => chooseClass(label)}>{name}</button
					>{/each}
			</div>
			<div class="conv-flow">
				<div class="conv-input-column">
					<div class="conv-small-heading">
						<span>Held-out image</span><span>#{sample + 1}</span>
					</div>
					<div class="conv-original">
						<ConvHeatmap
							values={pixels}
							side={28}
							kind="image"
							label={`Fashion-MNIST ${CONV_CLASSES[trueLabel]}, test image ${sample + 1}`}
						/>
						<svg viewBox="0 0 28 28" aria-hidden="true"
							><rect
								x={Math.max(0, field.left)}
								y={Math.max(0, field.top)}
								width={Math.min(28, field.right) - Math.max(0, field.left)}
								height={Math.min(28, field.bottom) - Math.max(0, field.top)}
							/></svg
						>
					</div>
					<div class="conv-image-caption">
						<span>True label<strong>{CONV_CLASSES[trueLabel]}</strong></span>
						<div class="conv-steppers">
							<button aria-label="Previous test image" onclick={() => stepSample(-1)}
								><PatternIcon name="arrowLeft" size={17} /></button
							><button aria-label="Next test image" onclick={() => stepSample(1)}
								><PatternIcon name="arrowRight" size={17} /></button
							>
						</div>
					</div>
					<div class="conv-gallery">
						{#each gallery as index (index)}<button
								aria-label={`Inspect ${CONV_CLASSES[trueLabel]} test image ${index + 1}`}
								onclick={() => selectSample(index)}
								><ConvHeatmap
									values={data.testX.subarray(index * 784, (index + 1) * 784)}
									side={28}
									kind="image"
								/></button
							>{/each}
					</div>
					<button class="conv-mistake" onclick={findMistake} disabled={searching}
						>{searching ? 'Looking through test images…' : 'Find a mistake'}<PatternIcon
							name="arrowRight"
							size={15}
						/></button
					>
				</div>
				<div class="conv-features">
					<div class="conv-layer-tabs" aria-label="Convolutional layers">
						{#each CONV_SHAPES as dimensions, index (index)}<button
								class:active={layer === index}
								aria-pressed={layer === index}
								onclick={() => selectLayer(index)}
								><span>Layer {index + 1}</span><small
									>{dimensions.output} maps · {dimensions.side} × {dimensions.side}</small
								></button
							>{/each}
					</div>
					<div class="conv-map-grid" class:conv-many={shape.output > 8}>
						{#each Array(shape.output).keys() as index (index)}
							<button
								class:active={channel === index}
								class:conv-muted={muted && channel === index}
								aria-label={`Inspect layer ${layer + 1} feature ${index + 1}`}
								aria-pressed={channel === index}
								onclick={() => {
									channel = index;
									muted = false;
								}}
								><ConvHeatmap
									values={convMap(result, layer, index)}
									side={shape.side}
									scale={maxActivation}
								/><span>{String(index + 1).padStart(2, '0')}</span></button
							>
						{/each}
					</div>
					<div class="conv-map-caption">
						<span class="conv-scale"></span><span
							>Low → high response · same scale within this layer</span
						>
					</div>
				</div>
				<div class="conv-prediction">
					<div class="conv-small-heading">
						<span>Model prediction</span><span>{muted ? 'Feature muted' : 'All features'}</span>
					</div>
					<strong class="conv-predicted">{CONV_CLASSES[result.prediction]}</strong>
					<span class="conv-verdict" class:conv-wrong={result.prediction !== trueLabel}
						>{result.prediction === trueLabel ? 'Matches the label' : 'A real model mistake'}</span
					>
					<div class="conv-probabilities" aria-label="Class probability scores">
						{#each ranked as item (item.label)}<div class:conv-true={item.label === trueLabel}>
								<div>
									<span>{CONV_CLASSES[item.label]}{item.label === trueLabel ? ' · true' : ''}</span
									><span>{percent(item.score)}</span>
								</div>
								<span class="conv-bar"><i style:width={`${item.score * 100}%`}></i></span>
							</div>{/each}
					</div>
					<p class="conv-probability-note">
						Softmax scores express the model’s preference. They are not a guarantee.
					</p>
				</div>
			</div>
			<div class="conv-inspector">
				<div class="conv-selected-map">
					<button
						class="conv-map-detail"
						aria-label={`Feature ${channel + 1}, row ${cellY + 1}, column ${cellX + 1}. Click a cell or use arrow keys to inspect its receptive field.`}
						onclick={chooseCell}
						onkeydown={moveCell}
					>
						<ConvHeatmap values={map} side={shape.side} scale={maxActivation} />
						<svg viewBox={`0 0 ${shape.side} ${shape.side}`} aria-hidden="true"
							><rect x={cellX} y={cellY} width="1" height="1" /></svg
						>
					</button>
					<div>
						<span class="conv-kicker">Feature {String(channel + 1).padStart(2, '0')}</span>
						<h4>{field.size} × {field.size} pixels of context</h4>
						<p>
							Pick a cell. Its outline on the clothing image shows which pixels can influence it.
						</p>
						<span class="conv-cell-value"
							>Response {map[cellY * shape.side + cellX].toFixed(3)}</span
						>
					</div>
				</div>
				<div class="conv-kernel-inspector">
					<div class="conv-kernel" aria-label="Learned 3 by 3 kernel weights">
						{#each kernel as weight, index (index)}<span
								style:background={`color-mix(in srgb, ${weight < 0 ? 'var(--chart-blue)' : 'var(--chart-lavender)'} ${(Math.abs(weight) / maxKernel) * 50 + 6}%, var(--plot-soft))`}
								title={weight.toFixed(5)}>{weight.toFixed(2)}</span
							>{/each}
					</div>
					<div>
						<span class="conv-kicker">Learned filter</span>
						<h4>A 3 × 3 window</h4>
						<p>
							{layer === 0
								? 'One filter slides across the pixels. ReLU keeps positive responses.'
								: `Each output combines ${shape.input} incoming maps. This is one filter slice.`}
						</p>
						{#if layer > 0}<div class="conv-source">
								<button
									aria-label="Previous input channel"
									onclick={() => (source = (source - 1 + shape.input) % shape.input)}
									><PatternIcon name="arrowLeft" size={14} /></button
								><span>Input {source + 1} / {shape.input}</span><button
									aria-label="Next input channel"
									onclick={() => (source = (source + 1) % shape.input)}
									><PatternIcon name="arrowRight" size={14} /></button
								>
							</div>{:else}<span class="conv-cell-value">Blue − · lavender +</span>{/if}
					</div>
				</div>
				<div class="conv-ablation">
					<label><input type="checkbox" bind:checked={muted} /><span>Mute this feature</span></label
					>
					<p>
						{muted
							? `The ${CONV_CLASSES[trace.prediction]} score moves from ${percent(trace.probabilities[trace.prediction])} to ${percent(result.probabilities[trace.prediction])}.`
							: 'Zero this whole map and run the remaining layers again.'}
					</p>
					<small
						>{muted
							? 'A temporary intervention; weights stay intact.'
							: 'Useful evidence is spread across many features.'}</small
					>
				</div>
			</div>
		</div>
		<div class="conv-training">
			<div class="conv-training-copy">
				<span class="conv-kicker">Train every layer</span>
				<h4>
					{running
						? 'The representation is changing.'
						: untrained
							? 'Build from random weights.'
							: 'The filters were learned, too.'}
				</h4>
				<p>Each step updates all three convolutional layers and the ten-class prediction head.</p>
			</div>
			<div class="conv-training-controls">
				<div class="conv-buttons">
					{#if running}<button class="conv-primary" onclick={pause}
							><PatternIcon name="pause" size={16} />Pause training</button
						>{:else}<button class="conv-primary" onclick={train} disabled={!ready}
							><PatternIcon name="play" size={16} />{snapshot?.step
								? 'Train 100 more steps'
								: 'Train 100 steps'}</button
						>{/if}<button
						class="conv-icon-button"
						aria-label="Restore trained model"
						title="Restore trained model"
						onclick={() => reset()}
						disabled={!ready}><PatternIcon name="reset" size={18} /></button
					>
				</div>
				<button class="conv-text-button" onclick={() => reset(true)} disabled={!ready || running}
					>Start with random weights</button
				><span class="conv-engine" role="status"
					>{device ? `${device} · ` : ''}{running
						? `${snapshot?.step ?? 0} steps · training…`
						: snapshot
							? `${snapshot.step} steps · ${snapshot.milliseconds.toFixed(0)} ms / step`
							: status}</span
				>
			</div>
			<div class="conv-metrics">
				<div>
					<span>Validation accuracy</span><strong
						>{validationMetric ? percent(validationMetric.accuracy) : '—'}</strong
					><small>{validationMetric?.count.toLocaleString() ?? 'No'} validation images</small>
				</div>
				<div>
					<span>Test accuracy</span><strong
						>{testMetric ? percent(testMetric.accuracy) : '—'}</strong
					><small>{testMetric?.count.toLocaleString() ?? 'No'} held-out images</small>
				</div>
			</div>
		</div>
		<details class="conv-provenance">
			<summary
				>Where the data and trained weights come from<PatternIcon
					name="chevronDown"
					size={15}
				/></summary
			>
			<p>
				The checkpoint learned from 10,000 official Fashion-MNIST training images. A separate 2,000
				training images selected the checkpoint by validation loss. Its {percent(
					metadata?.test.accuracy ?? 0
				)} test accuracy was then measured on 2,000 official test images, which never update weights.
			</p>
			<p>
				Browser training samples only those same 10,000 training images. Every snapshot evaluates
				the same 2,000 validation and 2,000 test images. Returning to the trained model restores its
				original weights and metrics. Browsing test mistakes is for learning; repeated decisions
				based on them make this an exploratory test set.
			</p>
			<p>
				Three learned 3 × 3 convolutions, stride 2, zero padding and ReLU: 1 → 8 → 16 → 24 channels,
				then a 384 → 10 classifier. The maps are exact activations, not illustrations. Individual
				filters need not correspond to human-named parts. <a
					href="https://github.com/zalandoresearch/fashion-mnist"
					target="_blank"
					rel="noreferrer">Fashion-MNIST by Zalando Research</a
				>.
			</p>
		</details>
	{/if}
	{#if searchNote}<p class="conv-search-note" role="status">{searchNote}</p>{/if}
	{#if error}<div class="conv-error" role="alert">
			<p>{error}</p>
			<button onclick={() => load(true)}>Reload with CPU training</button>
		</div>{/if}
</section>

<style>
	.conv-lab {
		margin-top: 1.8rem;
		color: var(--ink);
		min-width: 0;
	}
	.conv-heading {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 2rem;
		margin-bottom: 1.5rem;
	}
	.conv-kicker {
		font-size: 0.65rem;
		font-weight: 600;
		letter-spacing: 0.09em;
		text-transform: uppercase;
		color: var(--muted);
	}
	.conv-heading h3 {
		font:
			400 clamp(1.8rem, 2.5vw, 2.5rem)/1.1 'Instrument Serif',
			serif;
		margin: 0.4rem 0 0.55rem;
		letter-spacing: -0.025em;
	}
	.conv-heading p,
	.conv-training-copy p {
		font-size: 0.8rem;
		line-height: 1.65;
		color: var(--muted);
		margin: 0;
		max-width: 38rem;
	}
	.conv-model-state {
		display: grid;
		grid-template-columns: 7px auto;
		align-items: center;
		column-gap: 0.55rem;
		row-gap: 0.2rem;
		font-size: 0.72rem;
		white-space: nowrap;
	}
	.conv-model-state > span {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--accent);
	}
	.conv-model-state small {
		grid-column: 2;
		color: var(--muted);
		font-size: 0.65rem;
	}
	.conv-live {
		animation: conv-pulse 1s infinite alternate;
	}
	.conv-workspace {
		color-scheme: inherit;
		background: var(--plot);
		border-radius: 1.2rem;
		color: var(--plot-ink);
		padding: 1.4rem;
		overflow: hidden;
	}
	.conv-class-picker {
		display: flex;
		flex-wrap: wrap;
		gap: 0.3rem;
		margin-bottom: 1.45rem;
	}
	.conv-class-picker button {
		font-size: 0.66rem;
		padding: 0.44rem 0.65rem;
		border-radius: 2rem;
		background: transparent;
		color: var(--plot-muted);
		border: 0;
		transition:
			background 0.2s,
			color 0.2s;
	}
	.conv-class-picker button.active {
		background: var(--plot-raised);
		color: var(--plot-ink);
	}
	.conv-class-picker button:hover {
		color: var(--plot-ink);
		background: var(--plot-soft);
	}
	.conv-flow {
		display: grid;
		grid-template-columns: minmax(140px, 0.77fr) minmax(240px, 1.65fr) minmax(150px, 0.83fr);
		gap: 1.8rem;
		align-items: start;
	}
	.conv-small-heading {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.3rem;
		color: var(--plot-muted);
		font-size: 0.65rem;
		margin-bottom: 0.65rem;
	}
	.conv-small-heading span + span {
		color: var(--plot-quiet);
		font-size: 0.65rem;
	}
	.conv-original {
		position: relative;
		border-radius: 0.75rem;
		aspect-ratio: 1;
		width: 100%;
		overflow: hidden;
	}
	.conv-original svg,
	.conv-map-detail svg {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		pointer-events: none;
	}
	.conv-original rect {
		fill: none;
		stroke: var(--locator);
		stroke-width: 0.22;
		transition:
			x 0.18s,
			y 0.18s,
			width 0.18s,
			height 0.18s;
	}
	.conv-image-caption {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-top: 0.7rem;
		gap: 0.6rem;
	}
	.conv-image-caption > span {
		font-size: 0.65rem;
		color: var(--plot-muted);
	}
	.conv-image-caption strong {
		display: block;
		font-size: 0.91rem;
		font-weight: 500;
		color: var(--plot-ink);
		margin-top: 0.1rem;
	}
	.conv-steppers {
		display: flex;
		gap: 0.15rem;
	}
	.conv-steppers button,
	.conv-source button {
		border: 0;
		display: grid;
		place-items: center;
		background: transparent;
		color: var(--plot-muted);
		border-radius: 0.5rem;
		width: 27px;
		height: 29px;
	}
	.conv-steppers button:hover,
	.conv-source button:hover {
		background: var(--plot-raised);
		color: var(--plot-ink);
	}
	.conv-gallery {
		display: grid;
		grid-template-columns: repeat(6, 1fr);
		gap: 0.28rem;
		margin-top: 1rem;
	}
	.conv-gallery button {
		padding: 0;
		border: 0;
		border-radius: 0.25rem;
		overflow: hidden;
		opacity: 0.7;
		transition:
			opacity 0.2s,
			transform 0.2s;
	}
	.conv-gallery button:hover {
		opacity: 1;
		transform: translateY(-2px);
	}
	.conv-mistake {
		display: flex;
		gap: 0.7rem;
		align-items: center;
		justify-content: space-between;
		width: 100%;
		background: transparent;
		border: 0;
		color: var(--chart-lavender);
		font-size: 0.66rem;
		padding: 0.7rem 0 0.1rem;
	}
	.conv-layer-tabs {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 0.3rem;
		margin: -0.3rem 0 1rem;
		background: var(--plot-soft);
		padding: 0.3rem;
		border-radius: 0.8rem;
	}
	.conv-layer-tabs button {
		padding: 0.55rem 0.3rem;
		border-radius: 0.55rem;
		border: 0;
		background: transparent;
		color: var(--plot-muted);
		transition:
			background 0.2s,
			color 0.2s;
	}
	.conv-layer-tabs button span {
		font-size: 0.73rem;
		display: block;
	}
	.conv-layer-tabs small {
		display: block;
		font-size: 0.65rem;
		margin-top: 0.2rem;
		color: var(--plot-quiet);
		white-space: nowrap;
	}
	.conv-layer-tabs button.active {
		background: var(--plot-raised);
		color: var(--chart-lavender);
	}
	.conv-layer-tabs button.active small {
		color: var(--plot-muted);
	}
	.conv-map-grid {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 0.6rem;
		min-height: 223px;
		align-content: start;
	}
	.conv-map-grid.conv-many {
		grid-template-columns: repeat(6, 1fr);
		gap: 0.45rem;
	}
	.conv-map-grid button {
		position: relative;
		padding: 3px;
		background: var(--plot-soft);
		border: 1px solid transparent;
		border-radius: 0.5rem;
		transition:
			border 0.15s,
			background 0.15s;
		aspect-ratio: 1;
		overflow: hidden;
	}
	.conv-map-grid button:hover {
		background: var(--plot-raised);
	}
	.conv-map-grid button.active {
		border-color: var(--chart-lavender);
		background: color-mix(in srgb, var(--chart-lavender) 13%, transparent);
	}
	.conv-map-grid button.conv-muted {
		border-style: dashed;
	}
	.conv-map-grid button > span {
		position: absolute;
		bottom: 4px;
		left: 5px;
		font-size: 0.55rem;
		background: color-mix(in srgb, var(--plot) 85%, transparent);
		color: var(--plot-muted);
		padding: 1px 3px;
		border-radius: 3px;
		line-height: 1.1;
	}
	.conv-map-caption {
		display: flex;
		gap: 0.5rem;
		align-items: center;
		margin-top: 0.8rem;
		font-size: 0.65rem;
		color: var(--plot-quiet);
	}
	.conv-scale {
		height: 5px;
		width: 35px;
		border-radius: 3px;
		background: linear-gradient(90deg, var(--plot-soft), var(--chart-lavender));
		flex-shrink: 0;
	}
	.conv-predicted {
		display: block;
		font:
			400 1.7rem/1.1 'Instrument Serif',
			serif;
		letter-spacing: -0.015em;
	}
	.conv-verdict {
		display: block;
		font-size: 0.65rem;
		color: var(--chart-blue);
		margin: 0.35rem 0 1rem;
	}
	.conv-verdict.conv-wrong {
		color: var(--chart-amber);
	}
	.conv-probabilities {
		display: grid;
		gap: 0.53rem;
	}
	.conv-probabilities > div > div {
		display: flex;
		justify-content: space-between;
		font-size: 0.65rem;
		color: var(--plot-muted);
		gap: 0.3rem;
		margin-bottom: 0.22rem;
	}
	.conv-probabilities > div > div span:last-child {
		font-variant-numeric: tabular-nums;
	}
	.conv-bar {
		display: block;
		height: 3px;
		background: var(--plot-soft);
		border-radius: 3px;
		overflow: hidden;
	}
	.conv-bar i {
		display: block;
		height: 100%;
		background: var(--chart-lavender);
		border-radius: 3px;
		transition: width 0.3s ease;
	}
	.conv-true .conv-bar i {
		background: var(--chart-blue);
	}
	.conv-probabilities .conv-true > div {
		color: var(--chart-blue);
	}
	.conv-probability-note {
		font-size: 0.65rem;
		line-height: 1.6;
		color: var(--plot-quiet);
		margin: 0.85rem 0 0;
	}
	.conv-inspector {
		display: grid;
		grid-template-columns: 1.4fr 1.3fr 1fr;
		gap: 1.5rem;
		margin-top: 1.7rem;
		padding: 1.2rem;
		border-radius: 0.9rem;
		background: var(--plot-soft);
		align-items: center;
	}
	.conv-selected-map,
	.conv-kernel-inspector {
		display: flex;
		gap: 1rem;
		align-items: center;
		min-width: 0;
	}
	.conv-map-detail {
		padding: 0;
		border: 0;
		background: transparent;
		position: relative;
		width: 90px;
		min-width: 70px;
		flex-shrink: 0;
		aspect-ratio: 1;
		border-radius: 0.5rem;
		overflow: hidden;
	}
	.conv-map-detail rect {
		fill: none;
		stroke: var(--locator);
		stroke-width: 0.1;
	}
	.conv-inspector .conv-kicker {
		color: var(--plot-quiet);
		font-size: 0.65rem;
	}
	.conv-inspector h4 {
		font-size: 0.78rem;
		font-weight: 500;
		margin: 0.3rem 0 0.4rem;
		line-height: 1.3;
	}
	.conv-inspector p {
		font-size: 0.65rem;
		line-height: 1.6;
		color: var(--plot-muted);
		margin: 0;
	}
	.conv-cell-value {
		display: block;
		font-size: 0.65rem;
		color: var(--plot-quiet);
		margin-top: 0.45rem;
		font-variant-numeric: tabular-nums;
	}
	.conv-kernel {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 2px;
		flex-shrink: 0;
		width: 87px;
	}
	.conv-kernel span {
		display: grid;
		place-items: center;
		aspect-ratio: 1;
		font-size: 0.65rem;
		font-variant-numeric: tabular-nums;
		border-radius: 2px;
		color: var(--plot-ink);
	}
	.conv-source {
		display: flex;
		align-items: center;
		gap: 0.2rem;
		margin-top: 0.3rem;
		font-size: 0.65rem;
		color: var(--plot-quiet);
	}
	.conv-source button {
		width: 20px;
		height: 20px;
	}
	.conv-ablation label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.72rem;
		cursor: pointer;
	}
	.conv-ablation input {
		accent-color: var(--accent);
		width: 14px;
		height: 14px;
		margin: 0;
	}
	.conv-ablation p {
		margin: 0.6rem 0 0.4rem;
	}
	.conv-ablation small {
		font-size: 0.65rem;
		line-height: 1.5;
		color: var(--plot-quiet);
		display: block;
	}
	.conv-training {
		display: grid;
		grid-template-columns: 1.35fr 1fr 1.1fr;
		gap: 1.6rem;
		align-items: center;
		padding: 1.5rem 0.15rem;
	}
	.conv-training-copy h4 {
		font-size: 0.91rem;
		font-weight: 500;
		margin: 0.35rem 0 0.35rem;
	}
	.conv-training-copy p {
		font-size: 0.72rem;
		max-width: 27rem;
	}
	.conv-training-controls {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.5rem;
	}
	.conv-buttons {
		display: flex;
		gap: 0.45rem;
		align-items: center;
	}
	.conv-primary {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		padding: 0.75rem 1rem;
		min-height: 42px;
		background: var(--control-fill);
		color: var(--control-ink);
		border: 0;
		border-radius: 0.7rem;
		font-size: 0.72rem;
		white-space: nowrap;
	}
	.conv-icon-button {
		display: grid;
		place-items: center;
		background: var(--surface);
		color: var(--muted);
		border: 0;
		border-radius: 0.6rem;
		height: 39px;
		width: 37px;
	}
	.conv-text-button {
		font-size: 0.65rem;
		background: transparent;
		border: 0;
		padding: 0;
		color: var(--muted);
	}
	.conv-engine {
		font-size: 0.65rem;
		color: var(--muted);
		line-height: 1.5;
		min-height: 1.5em;
	}
	.conv-metrics {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
	}
	.conv-metrics > div {
		display: flex;
		flex-direction: column;
		gap: 0.27rem;
	}
	.conv-metrics span {
		font-size: 0.65rem;
		color: var(--muted);
	}
	.conv-metrics strong {
		font:
			400 1.8rem/1.1 'Instrument Serif',
			serif;
		font-variant-numeric: tabular-nums;
	}
	.conv-metrics small {
		font-size: 0.65rem;
		color: var(--muted);
	}
	.conv-provenance {
		font-size: 0.7rem;
		color: var(--muted);
		max-width: 60rem;
	}
	.conv-provenance summary {
		display: inline-flex;
		gap: 0.7rem;
		align-items: center;
		cursor: pointer;
		padding: 0.3rem 0;
		list-style: none;
	}
	.conv-provenance summary::-webkit-details-marker {
		display: none;
	}
	.conv-provenance p {
		font-size: 0.7rem;
		line-height: 1.75;
		margin: 0.8rem 0;
	}
	.conv-provenance a {
		color: inherit;
		text-decoration: underline;
		text-underline-offset: 3px;
	}
	.conv-loading {
		min-height: 350px;
		border-radius: 1rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 1rem;
		background: var(--plot);
		color: var(--plot-muted);
		font-size: 0.8rem;
	}
	.conv-error {
		padding: 1rem 1.2rem;
		background: var(--surface);
		border-radius: 0.8rem;
		font-size: 0.75rem;
		color: var(--muted);
	}
	.conv-error button {
		font-size: 0.7rem;
		padding: 0.6rem 0.8rem;
		border: 0;
		background: var(--control-fill);
		color: var(--control-ink);
		border-radius: 0.5rem;
	}
	.conv-search-note {
		font-size: 0.7rem;
		color: var(--muted);
	}
	button {
		cursor: pointer;
	}
	button:disabled {
		cursor: default;
		opacity: 0.45;
	}
	button:focus-visible,
	.conv-map-detail:focus-visible,
	summary:focus-visible {
		outline: 2px solid var(--focus);
		outline-offset: 3px;
	}
	@keyframes conv-pulse {
		to {
			opacity: 0.3;
		}
	}
	@media (min-width: 1300px) {
		.conv-map-grid {
			min-height: 262px;
		}
	}
	@media (max-width: 1050px) {
		.conv-flow {
			gap: 1.15rem;
			grid-template-columns: minmax(125px, 0.8fr) minmax(210px, 1.55fr) minmax(130px, 0.85fr);
		}
		.conv-workspace {
			color-scheme: inherit;
			padding: 1.1rem;
		}
		.conv-inspector {
			grid-template-columns: 1.2fr 1.1fr;
			gap: 1rem;
		}
		.conv-ablation {
			grid-column: 1/-1;
			display: grid;
			grid-template-columns: auto 1fr;
			gap: 0.35rem 1rem;
			align-items: center;
		}
		.conv-ablation p {
			margin: 0;
		}
		.conv-ablation small {
			grid-column: 2;
		}
		.conv-training {
			grid-template-columns: 1fr 1fr;
		}
		.conv-training-controls {
			justify-self: end;
		}
		.conv-metrics {
			grid-column: 1/-1;
			display: flex;
			gap: 2rem;
		}
		.conv-metrics > div {
			display: grid;
			grid-template-columns: auto auto;
			align-items: center;
			gap: 0.15rem 0.8rem;
		}
		.conv-metrics strong {
			grid-column: 2;
			grid-row: 1/3;
		}
		.conv-map-grid {
			min-height: 200px;
		}
	}
	@media (max-width: 700px) {
		.conv-heading {
			align-items: flex-start;
			gap: 1rem;
		}
		.conv-model-state {
			display: none;
		}
		.conv-heading h3 {
			font-size: 1.95rem;
		}
		.conv-workspace {
			color-scheme: inherit;
			padding: 1rem;
		}
		.conv-class-picker {
			gap: 0.15rem;
			margin-bottom: 1.2rem;
		}
		.conv-class-picker button {
			font-size: 0.65rem;
			padding: 0.45rem 0.58rem;
		}
		.conv-flow {
			grid-template-columns: 1fr 1fr;
			gap: 1.4rem 1rem;
		}
		.conv-features {
			grid-column: 1/-1;
			grid-row: 2;
		}
		.conv-input-column {
			grid-column: 1;
		}
		.conv-prediction {
			grid-column: 2;
			grid-row: 1;
		}
		.conv-original {
			max-width: 210px;
		}
		.conv-probabilities {
			gap: 0.45rem;
		}
		.conv-probabilities > div > div {
			font-size: 0.65rem;
		}
		.conv-small-heading {
			font-size: 0.65rem;
		}
		.conv-small-heading span + span {
			font-size: 0.65rem;
		}
		.conv-predicted {
			font-size: 1.5rem;
		}
		.conv-probability-note {
			font-size: 0.65rem;
		}
		.conv-image-caption strong {
			font-size: 0.82rem;
		}
		.conv-steppers button {
			width: 24px;
		}
		.conv-gallery {
			grid-template-columns: repeat(3, 1fr);
			gap: 0.35rem;
			max-width: 135px;
		}
		.conv-gallery button {
			max-height: 38px;
		}
		.conv-mistake {
			font-size: 0.65rem;
			gap: 0.2rem;
		}
		.conv-map-grid {
			min-height: unset;
			grid-template-columns: repeat(4, 1fr);
		}
		.conv-map-grid.conv-many {
			grid-template-columns: repeat(6, 1fr);
		}
		.conv-layer-tabs {
			margin: 0 0 0.8rem;
		}
		.conv-layer-tabs button {
			padding: 0.65rem 0.3rem;
		}
		.conv-map-caption {
			font-size: 0.65rem;
		}
		.conv-inspector {
			grid-template-columns: 1fr;
			padding: 1rem;
			gap: 1.25rem;
			margin-top: 1.25rem;
		}
		.conv-selected-map,
		.conv-kernel-inspector {
			gap: 1.1rem;
		}
		.conv-map-detail {
			width: 87px;
		}
		.conv-inspector h4 {
			font-size: 0.83rem;
		}
		.conv-inspector p {
			font-size: 0.66rem;
		}
		.conv-inspector .conv-kicker {
			font-size: 0.65rem;
		}
		.conv-ablation {
			display: block;
		}
		.conv-ablation label {
			font-size: 0.75rem;
		}
		.conv-ablation p {
			margin: 0.55rem 0 0.4rem;
		}
		.conv-ablation small {
			font-size: 0.65rem;
		}
		.conv-training {
			grid-template-columns: 1fr;
			gap: 1.2rem;
		}
		.conv-training-controls {
			justify-self: start;
		}
		.conv-metrics {
			grid-column: auto;
			justify-content: space-between;
			gap: 1rem;
		}
		.conv-metrics > div {
			display: flex;
			gap: 0.25rem;
			align-items: flex-start;
		}
		.conv-metrics strong {
			font-size: 2rem;
		}
		.conv-provenance summary {
			font-size: 0.66rem;
			line-height: 1.5;
		}
		.conv-training-copy h4 {
			font-size: 1rem;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		*,
		*::before,
		*::after {
			transition: none !important;
			animation: none !important;
		}
	}
</style>
