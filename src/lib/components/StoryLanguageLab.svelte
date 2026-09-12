<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import PatternIcon from './PatternIcon.svelte';
	import {
		loadStories,
		storyConfig,
		storyParameterCount,
		type StoryCorpus
	} from '$lib/ml/story-transformer/corpus';
	import type { WorkerEngine } from '$lib/ml/story-transformer/worker-engine';
	import type { TrainStepMetrics, PerTokenInfo } from '$lib/ml/story-transformer/engine';
	let corpus = $state.raw<StoryCorpus>(),
		ready = $state(false),
		loading = $state(false),
		training = $state(false),
		sampling = $state(false),
		error = $state(''),
		status = $state('A small transformer, trained here.');
	let engine: WorkerEngine | undefined,
		disposed = false,
		keepTraining = false;
	let metrics = $state.raw<TrainStepMetrics[]>([]),
		validation = $state.raw<{ step: number; loss: number }[]>([]);
	let prompt = $state('Once upon a time'),
		temperature = $state(0.8),
		selected = $state(0),
		runId = 0;
	let samples = $state.raw<{ id: number; step: number; text: string; prompt: string }[]>([]);
	let inspectedPrompt = $state('');
	let prediction = $state.raw<PerTokenInfo>(),
		attention = $state.raw<{ text: string; value: number }[]>([]);
	const step = $derived(metrics.at(-1)?.step ?? 0),
		loss = $derived(metrics.at(-1)?.loss),
		val = $derived(validation.at(-1)?.loss),
		sample = $derived(samples.find((s) => s.id === selected));
	const uniform = Math.log(storyConfig.vocab);
	const history = $derived(
		metrics.filter(
			(_, i) => i % Math.max(1, Math.ceil(metrics.length / 180)) === 0 || i === metrics.length - 1
		)
	);
	const path = $derived(
		history
			.map(
				(m) =>
					`${(m.step / Math.max(1, step)) * 600},${150 - (Math.min(uniform, m.loss) / uniform) * 130}`
			)
			.join(' ')
	);
	const valPath = $derived(
		validation
			.map(
				(m) =>
					`${(m.step / Math.max(1, step)) * 600},${150 - (Math.min(uniform, m.loss) / uniform) * 130}`
			)
			.join(' ')
	);
	onMount(() => {
		void loadStories()
			.then((c) => {
				if (!disposed) corpus = c;
			})
			.catch((e) => {
				if (!disposed) error = e.message;
			});
	});
	async function initialize() {
		if (!corpus || loading) return;
		loading = true;
		error = '';
		status = 'Preparing WebGPU and the transformer…';
		try {
			const { WorkerEngine: Engine } = await import('$lib/ml/story-transformer/worker-engine');
			if (disposed) return;
			engine = new Engine({
				tokenData: corpus.tokens,
				splitAt: corpus.trainTokens,
				decode: corpus.decode,
				decodeOne: (i) => corpus!.chars[i],
				seed: 42,
				lr: 0.001
			});
			await engine.init(storyConfig);
			if (disposed) return;
			ready = true;
			status = 'Random weights. Every learned pattern will come from these stories.';
			await takeSample();
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
			ready = false;
			status = 'Training needs WebGPU in this browser.';
			await engine?.dispose();
			engine = undefined;
		} finally {
			loading = false;
		}
	}
	async function takeSample() {
		if (!engine || !corpus || sampling) return;
		sampling = true;
		const prefix = prompt.slice(-64) || 'Once';
		try {
			const result = await engine.sample(corpus.encode(prefix), {
				maxTokens: 120,
				temperature,
				topK: 20
			});
			if (disposed) return;
			const next = {
				id: ++runId,
				step: metrics.at(-1)?.step ?? 0,
				text: result.text,
				prompt: prefix
			};
			samples = samples.length >= 8 ? [samples[0], ...samples.slice(-6), next] : [...samples, next];
			selected = next.id;
			const rowValues = await engine.nextDistribution(corpus.encode(prefix));
			prediction = {
				id: 0,
				text: '',
				topk: Array.from(rowValues, (v, id) => [id, Math.exp(v)] as [number, number])
					.sort((a, b) => b[1] - a[1])
					.slice(0, 6)
			};
			inspectedPrompt = prefix;
			const attn = await engine.attention(corpus.encode(prefix));
			const layer = attn.layers.at(-1)!;
			const row = attn.seqLen - 1;
			attention = [...prefix].map((text, i) => ({ text, value: layer[row * attn.blockSize + i] }));
		} catch (e) {
			if (!disposed) error = e instanceof Error ? e.message : String(e);
		} finally {
			sampling = false;
		}
	}
	async function train() {
		if (training || !engine) return;
		keepTraining = true;
		training = true;
		error = '';
		const target = step + 500;
		try {
			while (keepTraining && !disposed && (metrics.at(-1)?.step ?? 0) < target) {
				status = 'Learning from a new batch of story fragments…';
				await engine.train(50, (m) => {
					if (!disposed) metrics = [...metrics, m];
				});
				if (disposed) break;
				status = 'Checking unseen stories and writing a sample…';
				const v = await engine.valLoss();
				if (disposed) break;
				validation = [...validation, { step: metrics.at(-1)?.step ?? 0, loss: v }];
				await takeSample();
			}
			if (!disposed) status = 'Weights and optimizer kept. Continue to learn from more batches.';
		} catch (e) {
			if (!disposed) error = e instanceof Error ? e.message : String(e);
		} finally {
			training = false;
			keepTraining = false;
		}
	}
	function pause() {
		keepTraining = false;
		status = 'Pausing after this update…';
		void engine?.stop().catch((e) => {
			if (!disposed) error = e instanceof Error ? e.message : String(e);
		});
	}
	async function reset() {
		if (training || loading || sampling) return;
		ready = false;
		await engine?.dispose();
		engine = undefined;
		metrics = [];
		validation = [];
		samples = [];
		prediction = undefined;
		attention = [];
		await initialize();
	}
	onDestroy(() => {
		disposed = true;
		keepTraining = false;
		void engine?.dispose();
	});
</script>

<section class="story-lab">
	<header>
		<div>
			<span class="story-kicker">A LANGUAGE MODEL YOU CAN TRAIN</span>
			<h2>From scattered letters<br /><em>to the beginnings of a story.</em></h2>
			<p>Real TinyStories. A real causal transformer. Every update runs in your browser.</p>
		</div>
		<span class="model-spec"
			><PatternIcon name="cpu" size={18} />{storyParameterCount.toLocaleString()} parameters<small
				>2 blocks · 4 heads · 64-character context</small
			></span
		>
	</header>
	<div class="story-architecture" aria-label="Transformer architecture">
		<div>
			<PatternIcon name="book" size={21} /><b>64 characters</b><small>96-token vocabulary</small>
		</div>
		<PatternIcon name="arrowRight" size={16} />
		<div>
			<PatternIcon name="embeddings" size={21} /><b>Embeddings</b><small
				>32 numbers per position</small
			>
		</div>
		<PatternIcon name="arrowRight" size={16} />
		<div>
			<PatternIcon name="neural" size={21} /><b>2 transformer blocks</b><small
				>Causal attention + ReLU MLP</small
			>
		</div>
		<PatternIcon name="arrowRight" size={16} />
		<div>
			<PatternIcon name="language" size={21} /><b>Next character</b><small>96 probabilities</small>
		</div>
	</div>
	<div class="story-workspace">
		<div class="story-training">
			<div class="story-data">
				<span>THE READING MATERIAL</span><strong
					>{corpus ? corpus.trainStories.toLocaleString() : '…'} training stories</strong
				><small
					>{corpus?.validationStories ?? '…'} separate validation stories · actual TinyStories release</small
				>
				<details>
					<summary>Read a training example</summary>
					<p>{corpus?.examples[0]}</p>
				</details>
			</div>
			<div class="learning-actions">
				{#if !ready}<button
						class="primary-button"
						onclick={initialize}
						disabled={!corpus || loading}
						>{loading ? 'Preparing model…' : 'Initialize the model'}</button
					>{:else}<button
						class="primary-button"
						disabled={sampling && !training}
						onclick={() => (training ? pause() : train())}
						><PatternIcon name={training ? 'pause' : 'play'} size={16} />{training
							? 'Pause training'
							: step
								? 'Continue training'
								: 'Train 500 steps'}</button
					><button
						class="icon-button"
						aria-label="Reset transformer to random weights"
						disabled={training || sampling || loading}
						onclick={reset}><PatternIcon name="reset" size={17} /></button
					>{/if}
			</div>
			<p class="training-status" role="status">{status}</p>
			<div class="story-metrics">
				<div><small>Updates</small><strong>{step.toLocaleString()}</strong></div>
				<div><small>Batch loss</small><strong>{loss?.toFixed(3) ?? '—'}</strong></div>
				<div><small>Unseen loss</small><strong>{val?.toFixed(3) ?? '—'}</strong></div>
			</div>
			<div class="story-loss">
				<svg
					viewBox="0 0 600 170"
					preserveAspectRatio="none"
					role="img"
					aria-label="Training and held-out next-character loss. Lower is better."
					><line
						x1="0"
						x2="600"
						y1="20"
						y2="20"
						stroke="var(--plot-line)"
						stroke-dasharray="4 5"
						vector-effect="non-scaling-stroke"
					/><polyline
						points={path}
						fill="none"
						stroke="var(--blue)"
						stroke-width="2"
						vector-effect="non-scaling-stroke"
					/><polyline
						points={valPath}
						fill="none"
						stroke="var(--lavender)"
						stroke-width="2"
						vector-effect="non-scaling-stroke"
					/></svg
				><span class="uniform">Uniform guessing: {uniform.toFixed(3)}</span>
			</div>
			<div class="loss-legend">
				<span><i></i>Training batch</span><span><i></i>Unseen stories</span>
			</div>
			<p class="training-explanation">
				Each batch contains 8 fragments. At every position, the next character is the target.
				Backpropagation and Adam update the weights; validation never does.
			</p>
			{#if error}<p class="error-notice" role="alert">{error}</p>{/if}
		</div>
		<div class="story-writing">
			<div class="writing-top">
				<span>THE MODEL’S OWN WRITING</span><button
					class="text-button"
					onclick={takeSample}
					disabled={!ready || training || sampling}
					>{sampling ? 'Writing…' : 'Sample now'}<PatternIcon name="shuffle" size={15} /></button
				>
			</div>
			<label for="story-prompt">Start a story</label><input
				id="story-prompt"
				bind:value={prompt}
				maxlength="64"
				disabled={training || sampling}
				spellcheck="false"
			/>
			<label class="temperature-control" for="story-temperature"
				><span>Sampling temperature</span><b>{temperature.toFixed(1)}</b><input
					id="story-temperature"
					type="range"
					min="0.2"
					max="1.4"
					step="0.1"
					bind:value={temperature}
					disabled={training || sampling}
				/></label
			>
			<div class="story-page">
				{#if sample}<span class="sample-age"
						>WEIGHTS AFTER {sample.step.toLocaleString()} UPDATES</span
					>
					<p><b>{sample.prompt}</b>{sample.text}</p>{:else}<span class="sample-age"
						>LETTERS BEFORE LANGUAGE</span
					>
					<p class="sample-placeholder">
						Start with random weights. Save a sample. Train, and watch what changes.
					</p>{/if}
			</div>
			{#if samples.length}<div class="sample-timeline" aria-label="Saved writing samples">
					{#each samples as s (s.id)}<button
							aria-pressed={selected === s.id}
							onclick={() => (selected = s.id)}
							>{s.step === 0 ? 'Before training' : `Step ${s.step}`}</button
						>{/each}
				</div>{/if}
			<p class="writing-caption">
				A new sample is saved every 50 updates. Early output is mostly noise; short runs learn
				letter patterns before fluent stories. Continue training from the same weights.
			</p>
		</div>
	</div>
	{#if prediction}<div class="prediction-inspection">
			<div>
				<span class="story-kicker">A MEASURED PREDICTION</span>
				<h3>What comes after “{inspectedPrompt.slice(-20)}”?</h3>
				<p>
					These probabilities and attention values come from this transformer’s current weights at
					the most recent sample.
				</p>
				<div class="next-characters">
					{#each prediction.topk?.slice(0, 6) ?? [] as [id, prob] (id)}<div>
							<strong
								>{corpus?.chars[id] === ' '
									? '␣'
									: corpus?.chars[id] === '\n'
										? '↵'
										: corpus?.chars[id]}</strong
							><span>{(prob * 100).toFixed(1)}%</span><i style:width={`${Math.max(2, prob * 100)}%`}
							></i>
						</div>{/each}
				</div>
			</div>
			<div class="attention-reading">
				<h3>Where one attention head looks</h3>
				<p>
					Last block, first head, last position. Stronger fill means more attention to that earlier
					character.
				</p>
				<div class="attention-characters">
					{#each attention as char, i (i)}<span
							style:--strength={Math.max(0.07, char.value)}
							title={`${char.text === ' ' ? 'Space' : char.text}: ${(char.value * 100).toFixed(1)}% attention`}
							>{char.text === ' ' ? '·' : char.text}</span
						>{/each}
				</div>
				<small
					>One head is only part of the computation; attention alone does not explain the whole
					prediction.</small
				>
			</div>
		</div>{/if}
	<p class="story-source">
		Dataset: <a
			href="https://huggingface.co/datasets/roneneldan/TinyStories"
			target="_blank"
			rel="noreferrer">TinyStories, Eldan & Li</a
		> · CDLA-Sharing-1.0. The original training and validation splits remain separate. Transformer runtime
		adapted from Jaxverse. No OpenAI calls are made by this lab.
	</p>
</section>

<style>
	.story-lab {
		container-type: inline-size;
		background: var(--surface);
		padding: 28px;
		border-radius: 24px;
	}
	.story-lab header {
		display: flex;
		justify-content: space-between;
		gap: 24px;
		align-items: center;
	}
	.story-kicker {
		font-size: 10px;
		letter-spacing: 0.1em;
		color: var(--lavender);
	}
	h2 {
		font-size: 28px;
		font-weight: 400;
		line-height: 1.2;
		margin: 14px 0;
	}
	h2 em {
		font-family: var(--serif);
		font-size: 34px;
		color: var(--lavender);
	}
	header p {
		font-size: 12px;
		color: var(--muted);
		line-height: 1.7;
	}
	.model-spec {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
		font: 12px var(--mono);
		max-width: 245px;
		color: var(--blue);
	}
	.model-spec small {
		font: 10px/1.7 var(--sans);
		color: var(--muted);
	}
	.story-architecture {
		display: grid;
		grid-template-columns: 1fr 16px 1fr 16px 1.4fr 16px 1fr;
		align-items: center;
		gap: 12px;
		background: var(--lab-inset);
		padding: 20px;
		border-radius: 16px;
		margin: 25px 0;
		color: var(--lavender);
	}
	.story-architecture > div {
		display: grid;
		gap: 8px;
		justify-items: center;
		text-align: center;
	}
	.story-architecture b {
		font-size: 12px;
		color: var(--ink);
		font-weight: 500;
	}
	.story-architecture small {
		font-size: 10px;
		line-height: 1.6;
		color: var(--muted);
	}
	.story-workspace {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr);
		gap: 32px;
	}
	.story-data > span,
	.writing-top,
	.sample-age {
		font: 10px var(--mono);
		color: var(--muted);
		letter-spacing: 0.05em;
	}
	.story-data > strong {
		display: block;
		margin: 12px 0 5px;
		font-size: 20px;
		font-weight: 500;
	}
	.story-data > small {
		font-size: 11px;
		color: var(--muted);
		line-height: 1.7;
	}
	.story-data details {
		font-size: 11px;
		color: var(--muted);
		line-height: 1.8;
		margin: 14px 0;
	}
	.story-data details p {
		max-height: 220px;
		overflow: auto;
		padding: 12px;
		background: var(--lab-inset);
		border-radius: 10px;
	}
	.learning-actions {
		display: flex;
		align-items: center;
		gap: 12px;
		margin-top: 20px;
	}
	.training-status {
		font-size: 11px;
		line-height: 1.65;
		color: var(--muted);
		min-height: 36px;
	}
	.story-metrics {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 12px;
		margin-top: 20px;
	}
	.story-metrics small {
		display: block;
		color: var(--muted);
		font-size: 10px;
		margin-bottom: 7px;
	}
	.story-metrics strong {
		font: 23px var(--mono);
		color: var(--blue);
	}
	.story-metrics > div:last-child strong {
		color: var(--lavender);
	}
	.story-loss {
		position: relative;
		margin-top: 22px;
		background: var(--lab-inset);
		border-radius: 12px;
		padding: 20px 12px 0;
	}
	.story-loss svg {
		width: 100%;
		height: 155px;
		display: block;
	}
	.uniform {
		position: absolute;
		top: 10px;
		right: 12px;
		font-size: 9px;
		color: var(--muted);
	}
	.loss-legend {
		display: flex;
		gap: 16px;
		font-size: 10px;
		color: var(--muted);
		margin: 10px 0;
	}
	.loss-legend span {
		display: flex;
		align-items: center;
		gap: 6px;
	}
	.loss-legend i {
		width: 12px;
		height: 2px;
		background: var(--blue);
	}
	.loss-legend span:last-child i {
		background: var(--lavender);
	}
	.training-explanation,
	.writing-caption,
	.story-source {
		font-size: 11px;
		color: var(--muted);
		line-height: 1.8;
	}
	.writing-top {
		display: flex;
		justify-content: space-between;
		gap: 14px;
		align-items: center;
	}
	.writing-top button {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 11px;
		letter-spacing: 0;
	}
	label {
		display: block;
		font-size: 11px;
		color: var(--muted);
		margin: 18px 0 8px;
	}
	input:not([type]) {
		width: 100%;
		background: var(--lab-inset);
		color: var(--ink);
		border: 0;
		padding: 13px;
		border-radius: 10px;
		font-size: 13px;
	}
	.temperature-control {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 10px;
		align-items: center;
	}
	.temperature-control b {
		font: 11px var(--mono);
		color: var(--blue);
	}
	.temperature-control input {
		grid-column: 1/-1;
		width: 100%;
	}
	.story-page {
		margin-top: 20px;
		padding: 22px;
		border-radius: 16px;
		background: var(--lab-inset);
		min-height: 220px;
	}
	.story-page p {
		font: 19px/1.65 var(--serif);
		white-space: pre-wrap;
		overflow-wrap: anywhere;
		margin: 16px 0 0;
		color: var(--ink);
	}
	.story-page b {
		color: var(--blue);
		font-weight: 400;
	}
	.story-page .sample-placeholder {
		color: var(--quiet);
		font-style: italic;
	}
	.sample-timeline {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin: 12px 0;
	}
	.sample-timeline button {
		font-size: 10px;
		border: 0;
		padding: 7px 9px;
		border-radius: 7px;
		background: var(--lab-inset);
		color: var(--muted);
	}
	.sample-timeline button[aria-pressed='true'] {
		background: var(--selection-fill);
		color: var(--selection-ink);
		box-shadow: inset 0 0 0 1px var(--blue);
	}
	.prediction-inspection {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 30px;
		padding-top: 28px;
		margin-top: 15px;
	}
	.prediction-inspection h3 {
		font-size: 17px;
		font-weight: 500;
		margin: 10px 0;
	}
	.prediction-inspection p {
		font-size: 11px;
		line-height: 1.75;
		color: var(--muted);
	}
	.next-characters {
		display: grid;
		grid-template-columns: repeat(6, 1fr);
		gap: 7px;
		margin-top: 18px;
	}
	.next-characters > div {
		position: relative;
		overflow: hidden;
		display: grid;
		gap: 5px;
		justify-items: center;
		border-radius: 9px;
		padding: 10px 5px;
		background: var(--lab-inset);
	}
	.next-characters strong {
		font: 22px var(--mono);
		color: var(--blue);
	}
	.next-characters span {
		font: 9px var(--mono);
		color: var(--muted);
	}
	.next-characters i {
		height: 2px;
		background: var(--blue);
		position: absolute;
		bottom: 0;
		left: 0;
	}
	.attention-characters {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
		margin: 20px 0;
	}
	.attention-characters span {
		position: relative;
		isolation: isolate;
		border-radius: 5px;
		min-width: 22px;
		padding: 6px;
		text-align: center;
		font: 12px var(--mono);
		color: var(--ink);
		background: var(--lab-inset);
	}
	.attention-characters span:before {
		content: '';
		position: absolute;
		inset: 0;
		background: var(--lavender);
		opacity: var(--strength);
		z-index: -1;
		border-radius: inherit;
	}
	.attention-reading small {
		font-size: 10px;
		color: var(--muted);
		line-height: 1.7;
		display: block;
	}
	.story-source {
		margin: 28px 0 0;
		font-size: 10px;
	}
	.story-source a {
		color: var(--blue);
	}
	button:disabled {
		opacity: 0.5;
		cursor: default;
	}
	@container (max-width:760px) {
		.story-workspace,
		.prediction-inspection {
			grid-template-columns: 1fr;
		}
		.story-lab header {
			display: block;
		}
		.model-spec {
			max-width: none;
			margin-top: 20px;
		}
		.story-architecture {
			grid-template-columns: 1fr 16px 1fr;
			padding: 15px;
			gap: 12px;
		}
		.story-architecture > :nth-child(4) {
			display: none;
		}
		.story-architecture b {
			font-size: 11px;
		}
		.story-architecture small {
			font-size: 9px;
		}
		.story-page {
			min-height: 180px;
		}
		.story-workspace {
			gap: 24px;
		}
		.story-metrics strong {
			font-size: 21px;
		}
	}
	@media (max-width: 600px) {
		.story-lab {
			padding: 18px;
		}
		h2 {
			font-size: 24px;
		}
		h2 em {
			font-size: 28px;
		}
	}
</style>
