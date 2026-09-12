<script lang="ts">
	import { onDestroy, untrack } from 'svelte';
	import { base, asset } from '$app/paths';
	import PatternIcon from './PatternIcon.svelte';
	import MnistDigit from './MnistDigit.svelte';
	import AutoencoderNetwork from './AutoencoderNetwork.svelte';
	import MnistLatentMap from './MnistLatentMap.svelte';
	import {
		MnistAutoencoder,
		VAE_FRAME,
		pixelError,
		interpolateCode,
		type LatentPoint
	} from '$lib/ml/autoencoder';
	import { loadMnist, type MnistData } from '$lib/ml/mnist-data';
	import { DIGIT_COLORS, DIGIT_LIGHT_COLORS } from '$lib/ml/mnist-visuals';
	import type { MnistSnapshot, MnistCommand } from '$lib/ml/mnist-worker';
	const uid = $props.id();
	let dataset = $state.raw<MnistData | null>(null);
	let codes = $state.raw<Float32Array>(new Float32Array());
	let phase = $state<'loading' | 'ready' | 'resetting' | 'error'>('loading');
	let error = $state('');
	let loadNotice = $state('');
	let saved = $state(false),
		running = $state(false),
		stopping = $state(false),
		step = $state(0),
		revision = $state(0),
		ms = $state(0);
	let trainLoss = $state(0),
		testLoss = $state(0);
	let history = $state.raw<{ train: number; test: number; step: number }[]>([]);
	let selected = $state(0),
		mode = $state<'image' | 'probe' | 'morph'>('image'),
		mapMode = $state<'digits' | 'points'>('digits'),
		filter = $state(-1);
	let freeCode = $state<LatentPoint>([0, 0]),
		pair = $state<[number, number]>([18, 61]),
		mix = $state(0.5);
	let checkpoint = $state.raw<Float32Array | undefined>();
	let worker: Worker | undefined,
		generation = 0,
		disposed = false;
	const model = new MnistAutoencoder();
	const codeAt = (i: number): LatentPoint => [codes[i * 2] ?? 0, codes[i * 2 + 1] ?? 0];
	const code = $derived(
		mode === 'image'
			? codeAt(selected)
			: mode === 'morph'
				? interpolateCode(codeAt(pair[0]), codeAt(pair[1]), mix)
				: freeCode
	);
	// A free decoder coordinate has no unique original. Show its nearest real
	// encoding instead, so the reference follows exploration without implying a pair.
	const referenceIndex = $derived.by(() => {
		if (mode === 'image' || !codes.length) return selected;
		let nearest = 0,
			distance = Infinity;
		for (let i = 0; i < codes.length / 2; i++) {
			const d = (codes[i * 2] - code[0]) ** 2 + (codes[i * 2 + 1] - code[1]) ** 2;
			if (d < distance) {
				distance = d;
				nearest = i;
			}
		}
		return nearest;
	});

	const currentPixels = $derived(
		dataset?.testX.subarray(referenceIndex * 784, (referenceIndex + 1) * 784) ??
			new Float32Array(784)
	);
	const rebuilt = $derived.by(() => {
		void revision;
		return model.decode(code);
	});
	const selectedError = $derived(mode === 'image' ? pixelError(currentPixels, rebuilt) : null);
	const frame = VAE_FRAME;
	let device = $state('');
	const neighbors = $derived.by(() => {
		const nearby = Array.from({ length: codes.length / 2 }, (_, index) => ({
			index,
			distance: Math.hypot(codes[index * 2] - code[0], codes[index * 2 + 1] - code[1])
		}));
		return nearby
			.filter((item) => item.index !== referenceIndex)
			.sort((a, b) => a.distance - b.distance)
			.slice(0, 4);
	});
	const maxLoss = $derived(
		Math.max(0.005, ...history.flatMap((point) => [point.train, point.test]))
	);
	const chart = (key: 'train' | 'test') =>
		history
			.map(
				(point, i) =>
					`${i ? 'L' : 'M'}${4 + (i / Math.max(1, history.length - 1)) * 240},${55 - (point[key] / maxLoss) * 47}`
			)
			.join(' ');
	const selectedLabel = $derived(dataset?.testY[referenceIndex] ?? 0);
	const heading = $derived(
		mode === 'image'
			? `Handwritten ${selectedLabel}`
			: mode === 'morph'
				? 'Between two digits'
				: `Near handwritten ${selectedLabel}`
	);
	const status = $derived(
		stopping
			? 'Finishing this update…'
			: running
				? `Learning · ${step} live updates`
				: step > 0
					? `Paused · ${step} live updates`
					: saved
						? 'Saved weights · 0 live updates'
						: 'Random weights · 0 live updates'
	);
	function post(message: MnistCommand) {
		worker?.postMessage(message);
	}
	function receive(
		event: MessageEvent<MnistSnapshot | { type: 'error'; generation: number; error: string }>
	) {
		const message = event.data;
		if (message.generation !== generation || disposed) return;
		if (message.type === 'error') {
			phase = 'error';
			error = message.error;
			running = false;
			return;
		}
		model.load(message.weights);
		codes = message.codes;
		revision++;
		step = message.step;
		running = message.running;
		stopping = false;
		trainLoss = message.trainLoss;
		testLoss = message.testLoss;
		ms = message.millisecondsPerStep;
		device = message.device;
		phase = 'ready';
		if (!history.length || history.at(-1)!.step !== step)
			history = [...history.slice(-299), { train: trainLoss, test: testLoss, step }];
	}
	async function initialize() {
		phase = 'loading';
		error = '';
		try {
			const data = await loadMnist();
			if (disposed) return;
			checkpoint = undefined;
			loadNotice = '';
			try {
				const response = await fetch(`${base}/data/mnist-autoencoder.f32`);
				if (!response.ok) throw new Error('Saved weights unavailable.');
				const candidate = new Float32Array(await response.arrayBuffer());
				model.load(candidate);
				checkpoint = candidate;
			} catch {
				loadNotice =
					'The saved starting point could not be loaded. You can still learn from random weights.';
			}
			if (disposed) return;
			dataset = data;
			saved = false;
			const a = data.testY.findIndex((label) => label === 3),
				b = data.testY.findIndex((label) => label === 8);
			pair = [a, b];
			selected = a;
			worker?.terminate();
			worker = new Worker(new URL('../ml/mnist-worker.ts', import.meta.url), { type: 'module' });
			worker.onmessage = receive;
			worker.onerror = (event) => {
				phase = 'error';
				error = event.message || 'The training worker stopped.';
				running = false;
			};
			const train = data.trainX.slice(),
				test = data.testX.slice();
			generation++;
			worker.postMessage({ type: 'init', generation, train, test } satisfies MnistCommand, [
				train.buffer,
				test.buffer
			]);
		} catch (cause) {
			phase = 'error';
			error = cause instanceof Error ? cause.message : String(cause);
		}
	}
	function pauseForVisibility() {
		if (running && !stopping) {
			stopping = true;
			post({ type: 'pause', generation });
		}
	}
	function visibilityChanged() {
		if (document.hidden) pauseForVisibility();
	}
	function mount(element: HTMLElement) {
		untrack(() => void initialize());
		const observer = new IntersectionObserver(([entry]) => {
			if (!entry.isIntersecting) pauseForVisibility();
		});
		observer.observe(element);
		return () => observer.disconnect();
	}
	function train() {
		if (running) {
			stopping = true;
			post({ type: 'pause', generation });
		} else {
			running = true;
			post({ type: 'start', generation });
		}
	}
	function reset(useSaved = saved) {
		saved = useSaved;
		generation++;
		phase = 'resetting';
		running = false;
		stopping = false;
		history = [];
		step = 0;
		mode = 'image';
		post({ type: 'reset', generation, checkpoint: useSaved ? checkpoint : undefined });
	}
	function select(index: number) {
		selected = index;
		mode = 'image';
	}
	function pick(code: LatentPoint) {
		freeCode = code;
		mode = 'probe';
	}
	function move(axis: number, value: number) {
		freeCode = [...code];
		freeCode[axis] = value;
		mode = 'probe';
	}
	function changeMode(next: 'image' | 'probe' | 'morph') {
		if (next === 'probe') freeCode = [...code];
		if (next === 'image') selected = referenceIndex;
		mode = next;
	}
	function newPair() {
		if (!dataset) return;
		pair = [selected, (pair[1] + 137) % dataset.testY.length];
		mix = 0.5;
		mode = 'morph';
	}
	const imageAt = (index: number) => dataset!.testX.subarray(index * 784, (index + 1) * 784);
	onDestroy(() => {
		disposed = true;
		worker?.terminate();
	});
</script>

<svelte:document onvisibilitychange={visibilityChanged} />
<section class="ssl-lab" aria-label="MNIST autoencoder workbench" {@attach mount}>
	<header class="ssl-header">
		<div>
			<span class="ssl-kicker">HANDWRITING, REIMAGINED</span>
			<h3>A world inside two numbers.</h3>
			<p>
				Start with random weights. Watch 2,000 unseen digits find their places as the model learns.
			</p>
		</div>
		<div class="ssl-actions">
			<button class="ssl-train" disabled={phase !== 'ready' || stopping} onclick={train}
				><PatternIcon name={running ? 'pause' : 'play'} size={16} />{stopping
					? 'Pausing…'
					: running
						? 'Pause learning'
						: saved || step
							? 'Keep learning'
							: 'Start learning'}</button
			><button
				class="ssl-reset"
				aria-label="Reset the autoencoder"
				disabled={phase !== 'ready'}
				onclick={() => reset()}><PatternIcon name="reset" size={17} /></button
			>
		</div>
	</header>
	<div class="ssl-toolbar">
		<div class="ssl-starting-point" aria-label="Starting weights">
			<button
				aria-pressed={!saved}
				disabled={phase === 'loading' || phase === 'resetting'}
				onclick={() => reset(false)}>Random weights</button
			>
			<button
				aria-pressed={saved}
				disabled={!checkpoint || phase === 'loading' || phase === 'resetting'}
				onclick={() => reset(true)}>Saved example</button
			>
		</div>
		<span class="ssl-status" role="status" data-batch-ms={ms} data-backend={device}
			><i class:running></i>{phase === 'loading'
				? 'Preparing the digits and training backend…'
				: phase === 'resetting'
					? 'Loading the chosen weights…'
					: status}{#if device}<b class="ssl-device"
					>{device === 'webgpu' ? 'GPU' : device === 'wasm' ? 'WASM' : 'CPU'}</b
				>{/if}</span
		>
	</div>
	{#if loadNotice}<p class="ssl-load-notice" role="status">{loadNotice}</p>{/if}
	{#if phase === 'error'}<div class="ssl-error" role="alert">
			<p>{error}</p>
			<button onclick={() => initialize()}>Load the digits again</button>
		</div>{:else if dataset && codes.length}
		<div class="ssl-scores" class:has-history={history.length > 1}>
			<div>
				<span>Training error</span><strong data-testid="mnist-training-loss"
					>{trainLoss.toFixed(4)}</strong
				><small>256 training examples</small>
			</div>
			<div>
				<span>Unseen error</span><strong data-testid="mnist-test-loss">{testLoss.toFixed(4)}</strong
				><small>2,000 official test examples</small>
			</div>
			{#if history.length > 1}
				<div class="ssl-learning-curve">
					<svg
						viewBox="0 0 250 62"
						role="img"
						aria-label="Measured training and unseen reconstruction error; lower is better."
					>
						<path d={chart('train')} stroke="var(--ssl-blue)" />
						<path d={chart('test')} stroke="var(--ssl-amber)" />
					</svg>
				</div>
			{/if}
			<span class="ssl-score-note">MSE · lower is better</span>
		</div>
		<AutoencoderNetwork {model} {revision} pixels={currentPixels} {code} {mode} />
		<div class="ssl-workspace">
			<div class="ssl-map-panel">
				<div class="ssl-map-heading">
					<div>
						<h4>The learned map</h4>
						<span>Hover to inspect a digit. Drag to explore between them.</span>
					</div>
					<div class="ssl-map-style" aria-label="Map appearance">
						<button aria-pressed={mapMode === 'digits'} onclick={() => (mapMode = 'digits')}
							>Digits</button
						><button aria-pressed={mapMode === 'points'} onclick={() => (mapMode = 'points')}
							>Points</button
						>
					</div>
				</div>
				<MnistLatentMap
					pixels={dataset.testX}
					labels={dataset.testY}
					{codes}
					selected={mode === 'image' ? selected : -1}
					probe={code}
					pair={mode === 'morph' ? pair : null}
					mode={mapMode}
					probeMode={mode === 'probe'}
					{filter}
					onselect={select}
					onprobe={pick}
				/>
				<div class="ssl-digit-key" aria-label="Color by digit">
					<button class:active={filter === -1} onclick={() => (filter = -1)}>All</button
					>{#each DIGIT_COLORS as color, digit (digit)}<button
							style:--digit-color={color}
							style:--digit-light={DIGIT_LIGHT_COLORS[digit]}
							aria-label={`Highlight digit ${digit}`}
							aria-pressed={filter === digit}
							onclick={() => (filter = filter === digit ? -1 : digit)}>{digit}</button
						>{/each}<span>Color reveals labels. Learning never uses them.</span>
				</div>
				<div class="ssl-morph">
					<button
						class="ssl-endpoint"
						aria-label="Select first morph digit"
						onclick={() => {
							mode = 'morph';
							mix = 0;
						}}
						><MnistDigit
							pixels={imageAt(pair[0])}
							label="First morph digit"
							color={DIGIT_COLORS[dataset.testY[pair[0]]]}
						/></button
					><label for={`${uid}-morph`}
						><span>Morph between two encodings<output>{Math.round(mix * 100)}%</output></span><input
							id={`${uid}-morph`}
							aria-label="Interpolate between the two digit codes"
							type="range"
							min="0"
							max="1"
							step="0.01"
							value={mix}
							oninput={(event) => {
								mix = Number(event.currentTarget.value);
								mode = 'morph';
							}}
						/></label
					><button
						class="ssl-endpoint"
						aria-label="Select second morph digit"
						onclick={() => {
							mode = 'morph';
							mix = 1;
						}}
						><MnistDigit
							pixels={imageAt(pair[1])}
							label="Second morph digit"
							color={DIGIT_COLORS[dataset.testY[pair[1]]]}
						/></button
					><button class="ssl-new-pair" aria-label="Choose another morph pair" onclick={newPair}
						><PatternIcon name="shuffle" size={16} /></button
					>
				</div>
			</div>
			<aside class="ssl-inspector" aria-label="Inspect the digit and decoder">
				<div class="ssl-inspector-heading">
					<span>{heading}</span>
					<div>
						<button
							aria-label="Previous MNIST digit"
							onclick={() => select((referenceIndex + 1999) % 2000)}
							><PatternIcon name="arrowLeft" size={15} /></button
						><button
							aria-label="Next MNIST digit"
							onclick={() => select((referenceIndex + 1) % 2000)}
							><PatternIcon name="arrowRight" size={15} /></button
						>
					</div>
				</div>
				<div class="ssl-roundtrip">
					<div>
						<MnistDigit
							pixels={currentPixels}
							label={`${mode === 'image' ? 'Original' : 'Nearest real'} handwritten ${selectedLabel}, test image ${referenceIndex + 1}`}
							color={DIGIT_COLORS[selectedLabel]}
						/><span>{mode === 'image' ? 'Original' : 'Nearest real digit'}</span>
					</div>
					<PatternIcon name="arrowRight" size={17} />
					<div>
						<MnistDigit
							pixels={rebuilt}
							label="Actual decoder reconstruction"
							color="#c8b7f0"
						/><span>{mode === 'image' ? 'Reconstruction' : 'Decoded point'}</span>
					</div>
				</div>
				<p class="ssl-compression">
					784 pixels <span>→</span> <strong>2 numbers</strong> <span>→</span> 784 pixels
				</p>
				<div class="ssl-explore-mode" aria-label="Decoder controls">
					<button aria-pressed={mode === 'image'} onclick={() => changeMode('image')}
						>Inspect</button
					><button aria-pressed={mode === 'probe'} onclick={() => changeMode('probe')}
						>Explore</button
					><button aria-pressed={mode === 'morph'} onclick={() => changeMode('morph')}>Morph</button
					>
				</div>
				<div class="ssl-coordinates">
					{#each [0, 1] as axis (axis)}<label for={`${uid}-coordinate-${axis}`}
							><span
								>Latent {axis + 1}<output data-testid={`mnist-code-${axis}`}
									>{code[axis].toFixed(3)}</output
								></span
							><input
								id={`${uid}-coordinate-${axis}`}
								aria-label={`Latent coordinate ${axis + 1}`}
								type="range"
								min={Math.floor(((axis === 0 ? frame.cx : frame.cy) - frame.span) * 100) / 100}
								max={Math.ceil(((axis === 0 ? frame.cx : frame.cy) + frame.span) * 100) / 100}
								step="0.01"
								value={code[axis]}
								oninput={(event) => move(axis, Number(event.currentTarget.value))}
							/></label
						>{/each}
				</div>
				<p class="ssl-inspector-note">
					{mode === 'image'
						? `Official test image #${selected + 1} · reconstruction error ${selectedError?.toFixed(4)}.`
						: mode === 'probe'
							? 'Drag to decode any coordinate. The reference follows the nearest real digit; it is not the source of this free point.'
							: 'The slider follows a straight line between two real encodings. The decoder redraws every intermediate point.'}
				</p>
				<div class="ssl-neighbors">
					<span>Nearby handwriting</span>
					<div>
						{#each neighbors as neighbor (neighbor.index)}{@const index = neighbor.index}<button
								aria-label={`Inspect test image ${index + 1}, digit ${dataset.testY[index]}`}
								onclick={() => select(index)}
								><MnistDigit
									pixels={imageAt(index)}
									label={`Held-out ${dataset.testY[index]}`}
									color={DIGIT_COLORS[dataset.testY[index]]}
								/></button
							>{/each}
					</div>
				</div>
			</aside>
		</div>
		<details class="ssl-method">
			<summary>What is actually learning?<PatternIcon name="chevronDown" size={15} /></summary>
			<p>
				Following Jaxverse, this variational autoencoder learns 784 → 128 → 32 → <strong>2</strong> →
				32 → 128 → 784 with GELU hidden layers. The encoder predicts two means and two uncertainties.
				Training samples that Gaussian; the map shows each digit’s exact two means.
			</p>
			<p>
				Adam minimizes reconstruction MSE plus a small KL penalty toward a unit Gaussian. That
				penalty encourages a continuous, centered map. Its axes stay fixed while weights learn; only
				actual coordinates move. All 2,000 official test digits are drawn, and none update weights.
				Labels only assign color. The two-number bottleneck loses detail, so reconstructions can
				blur. Display pixels are clipped to 0–1; errors use the raw linear output.
			</p>
			<p>
				The learned starting point was trained for 10,000 updates on the 8,000 training images.
				Choose random weights to begin from zero. Each live run performs up to 200 further updates
				in a dedicated browser worker, using JaxJS’s compiled WebGPU kernels when available and
				WebAssembly otherwise. The decoder runs locally so dragging never waits for training. <a
					href={asset('/data/MNIST-PROVENANCE.md')}
					target="_blank"
					rel="noreferrer">Dataset and model provenance</a
				>.
			</p>
		</details>
	{:else}<div class="ssl-loading">
			<span>784 pixels</span><PatternIcon name="arrowRight" size={24} /><strong>2</strong
			><PatternIcon name="arrowRight" size={24} /><span>784 pixels</span>
			<p>Preparing the handwritten digits and their learned coordinates.</p>
		</div>{/if}
</section>

<style>
	.ssl-device {
		font: 8px var(--mono);
		letter-spacing: 0.05em;
		padding: 3px 5px;
		background: var(--ssl-raised);
		color: var(--ssl-lavender);
		border-radius: 4px;
	}
	.ssl-load-notice {
		font-size: 11px;
		line-height: 1.6;
		color: var(--ssl-amber);
		margin: 0 0 14px;
	}
	.ssl-lab {
		--ssl-ink: var(--ink);
		--ssl-muted: var(--muted);
		--ssl-quiet: var(--quiet);
		--ssl-card: var(--lab-card);
		--ssl-inset: var(--lab-inset);
		--ssl-raised: var(--lab-raised);
		--ssl-blue: var(--blue);
		--ssl-lavender: var(--lavender);
		--ssl-amber: var(--orange);
		--ssl-sage: var(--blue);
		background: var(--ssl-card);
		color: var(--ssl-ink);
		padding: 25px;
		border-radius: 22px;
		container-type: inline-size;
	}
	.ssl-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 24px;
	}
	.ssl-kicker {
		font-size: 9px;
		letter-spacing: 0.15em;
		color: var(--ssl-lavender);
	}
	.ssl-header h3 {
		font: italic 34px/1.1 var(--serif);
		margin: 9px 0 7px;
	}
	.ssl-header p {
		font-size: 12px;
		line-height: 1.6;
		color: var(--ssl-muted);
		margin: 0;
	}
	.ssl-actions {
		display: flex;
		gap: 5px;
		align-items: center;
		flex: none;
	}
	.ssl-train {
		display: flex;
		align-items: center;
		gap: 9px;
		min-height: 39px;
		padding: 0 16px;
		border: 0;
		border-radius: 10px;
		background: var(--control-fill);
		color: var(--control-ink);
		font-size: 12px;
		font-weight: 600;
		white-space: nowrap;
	}
	.ssl-train:disabled {
		opacity: 0.55;
		cursor: default;
	}
	:global([data-theme='light']) .ssl-train {
		color: white;
	}
	.ssl-reset,
	.ssl-new-pair {
		display: grid;
		place-items: center;
		border: 0;
		background: transparent;
		color: var(--ssl-muted);
		width: 35px;
		height: 35px;
		border-radius: 8px;
	}
	.ssl-lab button {
		cursor: pointer;
	}
	.ssl-lab button:focus-visible,
	.ssl-lab input:focus-visible,
	.ssl-lab summary:focus-visible {
		outline: 2px solid var(--focus);
		outline-offset: 3px;
	}
	.ssl-lab button:hover:not(:disabled) {
		filter: brightness(1.1);
	}
	.ssl-toolbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 18px;
		margin: 22px 0 16px;
	}
	.ssl-starting-point,
	.ssl-map-style,
	.ssl-explore-mode {
		display: flex;
		gap: 4px;
		padding: 3px;
		background: var(--ssl-inset);
		border-radius: 9px;
	}
	.ssl-starting-point button,
	.ssl-map-style button,
	.ssl-explore-mode button {
		border: 0;
		border-radius: 7px;
		color: var(--ssl-muted);
		background: transparent;
		font-size: 10px;
		white-space: nowrap;
		padding: 8px 11px;
	}
	.ssl-starting-point button[aria-pressed='true'],
	.ssl-map-style button[aria-pressed='true'],
	.ssl-explore-mode button[aria-pressed='true'] {
		color: var(--ssl-ink);
		background: var(--ssl-raised);
	}
	.ssl-status {
		color: var(--ssl-quiet);
		font-size: 10px;
		display: flex;
		gap: 7px;
		align-items: center;
	}
	.ssl-status i {
		width: 5px;
		height: 5px;
		background: var(--ssl-quiet);
		border-radius: 50%;
	}
	.ssl-status i.running {
		background: var(--ssl-sage);
		box-shadow: 0 0 10px color-mix(in srgb, var(--chart-blue) 30.2%, transparent);
	}
	.ssl-scores {
		display: grid;
		grid-template-columns: auto auto 1fr;
		gap: 30px;
		align-items: center;
		padding: 13px 16px;
		background: var(--ssl-inset);
		border-radius: 12px;
		margin-bottom: 18px;
	}
	.ssl-scores.has-history {
		grid-template-columns: auto auto minmax(140px, 1fr) auto;
	}
	.ssl-scores > div:not(.ssl-learning-curve) {
		display: grid;
		grid-template-columns: auto auto;
		gap: 4px 12px;
		align-items: baseline;
	}
	.ssl-scores span {
		font-size: 10px;
		color: var(--ssl-muted);
		grid-column: 1/-1;
	}
	.ssl-scores strong {
		font: 21px var(--mono);
		color: var(--ssl-blue);
	}
	.ssl-scores > div:nth-child(2) strong {
		color: var(--ssl-amber);
	}
	.ssl-scores small {
		color: var(--ssl-quiet);
		font-size: 9px;
		white-space: nowrap;
	}
	.ssl-learning-curve svg {
		width: 100%;
		height: 58px;
		display: block;
	}
	.ssl-learning-curve path {
		fill: none;
		stroke-width: 1.6;
	}
	.ssl-scores .ssl-score-note {
		grid-column: auto;
		font-size: 10px;
		line-height: 1.8;
		justify-self: end;
	}
	.ssl-workspace {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 290px;
		gap: 27px;
		align-items: start;
	}
	.ssl-map-panel {
		min-width: 0;
	}
	.ssl-map-heading {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 16px;
		margin-bottom: 13px;
	}
	.ssl-map-heading h4 {
		font-weight: 500;
		font-size: 17px;
		margin: 0 0 4px;
	}
	.ssl-map-heading > div > span {
		color: var(--ssl-quiet);
		font-size: 10px;
	}
	.ssl-map-style {
		flex: none;
	}
	.ssl-map-style button {
		font-size: 10px;
		padding: 7px 9px;
	}
	.ssl-digit-key {
		display: flex;
		gap: 4px;
		align-items: center;
		flex-wrap: wrap;
		margin: 13px 0 15px;
	}
	.ssl-digit-key button {
		border: 0;
		background: transparent;
		color: var(--digit-color, var(--ssl-muted));
		border-radius: 6px;
		min-width: 25px;
		padding: 4px;
		font: 12px var(--mono);
	}
	:global([data-theme='light']) .ssl-digit-key button {
		color: var(--digit-light, var(--ssl-muted));
	}
	.ssl-digit-key button[aria-pressed='true'],
	.ssl-digit-key button.active {
		background: var(--ssl-raised);
	}
	.ssl-digit-key span {
		font-size: 9px;
		color: var(--ssl-quiet);
		margin-left: auto;
	}
	.ssl-morph {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 12px;
		background: var(--ssl-inset);
		border-radius: 12px;
	}
	.ssl-endpoint {
		width: 43px;
		flex: none;
		border: 0;
		padding: 0;
		border-radius: 7px;
		background: transparent;
	}
	.ssl-morph label {
		min-width: 0;
		flex: 1;
	}
	.ssl-morph label > span,
	.ssl-coordinates label > span {
		display: flex;
		justify-content: space-between;
		gap: 10px;
		color: var(--ssl-muted);
		font-size: 10px;
	}
	.ssl-morph output,
	.ssl-coordinates output {
		font: 11px var(--mono);
		color: var(--ssl-lavender);
	}
	.ssl-lab input[type='range'] {
		display: block;
		width: 100%;
		margin: 5px 0 0;
		height: 22px;
		min-height: 22px;
		accent-color: var(--accent);
	}
	.ssl-lab input[type='range']::-webkit-slider-thumb {
		background: var(--control-fill);
	}
	.ssl-lab input[type='range']::-moz-range-thumb {
		background: var(--control-fill);
	}
	.ssl-inspector {
		padding: 17px;
		background: var(--ssl-inset);
		border-radius: 15px;
		min-width: 0;
	}
	.ssl-inspector-heading {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		margin-bottom: 16px;
		font-size: 13px;
	}
	.ssl-inspector-heading > div {
		display: flex;
		gap: 2px;
	}
	.ssl-inspector-heading button {
		width: 27px;
		height: 27px;
		border: 0;
		display: grid;
		place-items: center;
		border-radius: 7px;
		background: transparent;
		color: var(--ssl-muted);
	}
	.ssl-roundtrip {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 20px minmax(0, 1fr);
		gap: 10px;
		align-items: center;
		color: var(--ssl-muted);
	}
	.ssl-roundtrip > div {
		min-width: 0;
		display: grid;
		gap: 9px;
		text-align: center;
	}
	.ssl-roundtrip > div > span {
		font-size: 10px;
		color: var(--ssl-muted);
	}
	.ssl-roundtrip :global(canvas) {
		max-width: 104px;
		margin: auto;
	}
	.ssl-compression {
		text-align: center;
		font-size: 9px;
		color: var(--ssl-quiet);
		margin: 15px 0;
	}
	.ssl-compression strong {
		font-weight: 500;
		color: var(--ssl-lavender);
	}
	.ssl-compression span {
		padding: 0 4px;
	}
	.ssl-explore-mode button {
		flex: 1;
		padding: 7px 5px;
	}
	.ssl-coordinates {
		display: grid;
		gap: 13px;
		margin-top: 18px;
	}
	.ssl-inspector-note {
		font-size: 10px;
		line-height: 1.7;
		color: var(--ssl-quiet);
		min-height: 49px;
		margin: 14px 0 17px;
	}
	.ssl-neighbors > span {
		font-size: 10px;
		color: var(--ssl-muted);
	}
	.ssl-neighbors > div {
		display: flex;
		gap: 7px;
		margin-top: 9px;
	}
	.ssl-neighbors button {
		padding: 0;
		border: 0;
		background: transparent;
		border-radius: 6px;
		min-width: 0;
		flex: 1;
	}
	.ssl-method {
		margin-top: 24px;
		padding-top: 16px;
		border-top: 1px solid color-mix(in srgb, var(--ssl-muted) 10%, transparent);
	}
	.ssl-method summary {
		display: flex;
		align-items: center;
		gap: 9px;
		list-style: none;
		color: var(--ssl-muted);
		font-size: 11px;
		cursor: pointer;
	}
	.ssl-method summary::-webkit-details-marker {
		display: none;
	}
	.ssl-method p {
		color: var(--ssl-muted);
		font-size: 11px;
		line-height: 1.8;
		max-width: 95em;
	}
	.ssl-method a {
		color: var(--ssl-lavender);
	}
	.ssl-loading {
		min-height: 420px;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 24px;
		position: relative;
		color: var(--ssl-quiet);
		font-size: 14px;
	}
	.ssl-loading strong {
		font: italic 100px var(--serif);
		color: var(--ssl-lavender);
	}
	.ssl-loading p {
		position: absolute;
		top: 70%;
		font-size: 12px;
		text-align: center;
	}
	.ssl-error {
		padding: 50px 0;
		text-align: center;
	}
	.ssl-error p {
		color: var(--ssl-muted);
		font-size: 13px;
	}
	.ssl-error button {
		border: 0;
		background: var(--control-fill);
		padding: 10px 15px;
		border-radius: 9px;
		color: var(--ssl-inset);
	}
	@container (max-width:1000px) {
		.ssl-workspace {
			grid-template-columns: minmax(0, 1fr) 250px;
			gap: 20px;
		}
		.ssl-scores {
			gap: 20px;
		}
		.ssl-scores > div:not(.ssl-learning-curve) {
			grid-template-columns: 1fr;
		}
		.ssl-score-note {
			display: none;
		}
		.ssl-digit-key span {
			flex-basis: 100%;
			margin: 5px 0 0;
		}
		.ssl-roundtrip {
			gap: 6px;
		}
		.ssl-inspector {
			padding: 14px;
		}
	}
	@container (max-width:740px) {
		.ssl-header {
			align-items: flex-start;
			flex-direction: column;
			gap: 12px;
		}
		.ssl-kicker {
			display: none;
		}
		.ssl-train {
			min-height: 34px;
			padding: 0 12px;
			font-size: 11px;
		}
		.ssl-toolbar {
			flex-wrap: wrap;
			gap: 9px;
			margin: 12px 0;
		}
		.ssl-scores {
			grid-template-columns: 1fr 1fr;
			margin-bottom: 20px;
			padding: 12px;
			gap: 15px;
		}
		.ssl-scores.has-history {
			grid-template-columns: 1fr 1fr 1.2fr;
		}
		.ssl-scores strong {
			font-size: 18px;
		}
		.ssl-scores small {
			font-size: 8px;
		}
		.ssl-workspace {
			grid-template-columns: 1fr;
			gap: 20px;
		}
		.ssl-inspector {
			grid-row: 1;
			display: grid;
			grid-template-columns: 160px 1fr;
			gap: 0 20px;
		}
		.ssl-inspector-heading {
			grid-column: 1/-1;
			margin-bottom: 12px;
		}
		.ssl-roundtrip {
			grid-column: 1;
			grid-row: 2 / span 2;
			align-self: start;
		}
		.ssl-roundtrip > div > span {
			font-size: 9px;
		}
		.ssl-compression {
			display: none;
		}
		.ssl-explore-mode {
			grid-column: 2;
			grid-row: 2;
			align-self: start;
		}
		.ssl-coordinates {
			grid-column: 2;
			grid-row: 3;
			margin-top: 10px;
			gap: 9px;
		}
		.ssl-inspector-note {
			grid-column: 1/-1;
			min-height: 0;
			margin: 12px 0 0;
		}
		.ssl-neighbors {
			display: none;
		}
		.ssl-map-heading > div > span {
			max-width: 28em;
			display: block;
			line-height: 1.5;
		}
		.ssl-digit-key span {
			flex-basis: auto;
			margin: 0 0 0 auto;
		}
		.ssl-header h3 {
			font-size: 32px;
		}
	}
	@container (max-width:420px) {
		.ssl-inspector {
			grid-template-columns: 132px 1fr;
			gap: 0 13px;
			padding: 13px;
		}
		.ssl-inspector-heading {
			font-size: 12px;
		}
		.ssl-roundtrip {
			grid-template-columns: minmax(0, 1fr) 12px minmax(0, 1fr);
			gap: 5px;
		}
		.ssl-roundtrip :global(svg) {
			width: 12px;
		}
		.ssl-roundtrip > div > span {
			font-size: 8px;
		}
		.ssl-explore-mode {
			gap: 1px;
			padding: 2px;
		}
		.ssl-explore-mode button {
			font-size: 9px;
			padding: 6px 3px;
		}
		.ssl-coordinates label > span {
			font-size: 9px;
		}
		.ssl-coordinates output {
			font-size: 10px;
		}
		.ssl-coordinates {
			gap: 5px;
		}
		.ssl-scores,
		.ssl-scores.has-history {
			grid-template-columns: 1fr 1fr;
			gap: 8px 20px;
		}
		.ssl-learning-curve {
			grid-column: 1/-1;
		}
		.ssl-learning-curve svg {
			height: 37px;
		}
		.ssl-header h3 {
			font-size: 29px;
		}
		.ssl-header p {
			font-size: 11px;
		}
		.ssl-map-heading {
			gap: 10px;
		}
		.ssl-map-heading h4 {
			font-size: 16px;
		}
		.ssl-map-heading > div > span {
			font-size: 9px;
		}
		.ssl-map-style button {
			padding: 7px;
		}
		.ssl-digit-key {
			gap: 2px;
		}
		.ssl-digit-key span {
			flex-basis: 100%;
			margin: 4px 0 0;
		}
		.ssl-morph {
			gap: 8px;
			padding: 9px;
		}
		.ssl-morph label > span {
			font-size: 9px;
		}
		.ssl-endpoint {
			width: 35px;
		}
		.ssl-new-pair {
			width: 24px;
		}
		.ssl-loading {
			gap: 12px;
		}
		.ssl-loading strong {
			font-size: 80px;
		}
		.ssl-loading > span {
			font-size: 10px;
		}
	}
	@media (max-width: 600px) {
		.ssl-lab {
			padding: 18px;
			border-radius: 17px;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.ssl-lab button {
			transition: none;
		}
	}
</style>
