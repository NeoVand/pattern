<script lang="ts">
	import PatternIcon from '$lib/components/PatternIcon.svelte';
	import { onMount, onDestroy } from 'svelte';
	import { Network } from '$lib/ml/models';
	import { loadFashion, type FashionSample } from '$lib/ml/fashion';
	let data = $state<FashionSample[]>([]);
	let loading = $state(true);
	let error = $state('');
	let selectedId = $state('');
	let running = $state(false);
	let epoch = $state(0);
	let mistakesOnly = $state(false);
	let threshold = $state(0.5);
	let pages = $state([0, 0, 0]);
	let network = $state.raw(new Network([196, 1], true, 8));
	let timer: ReturnType<typeof setInterval> | undefined;
	let mounted = true;
	const splits = ['train', 'validation', 'test'] as const;
	const predictions = $derived.by(() => {
		void epoch;
		return data.map((sample) => ({ ...sample, probability: network.predict(sample.x) }));
	});
	const selected = $derived(predictions.find((p) => p.id === selectedId));
	const statistics = $derived(
		splits.map((split) => {
			const set = predictions.filter((p) => p.split === split);
			const correct = set.filter((p) => Number(p.probability >= threshold) === p.y).length;
			return {
				correct,
				count: set.length,
				accuracy: set.length ? correct / set.length : 0,
				loss: set.length
					? -set.reduce(
							(s, p) =>
								s +
								p.y * Math.log(Math.max(1e-9, p.probability)) +
								(1 - p.y) * Math.log(Math.max(1e-9, 1 - p.probability)),
							0
						) / set.length
					: 0
			};
		})
	);
	const weights = $derived.by(() => {
		void epoch;
		return network.weights[0][0].slice();
	});
	const maxWeight = $derived(Math.max(...weights.map(Math.abs), 0.01));
	function pause() {
		running = false;
		if (timer) clearInterval(timer);
	}
	function train() {
		if (running) {
			pause();
			return;
		}
		running = true;
		timer = setInterval(() => {
			const set = data.filter((p) => p.split === 'train');
			for (let i = 0; i < 2; i++) network.train(set, 0.015);
			epoch += 2;
			if (epoch >= 200) pause();
		}, 45);
	}
	function reset() {
		pause();
		network = new Network([196, 1], true, 8);
		epoch = 0;
	}
	async function load() {
		loading = true;
		error = '';
		try {
			const samples = await loadFashion();
			if (mounted) {
				data = samples;
				selectedId = samples.find((p) => p.split === 'test')!.id;
			}
		} catch (e) {
			if (mounted) error = e instanceof Error ? e.message : String(e);
		} finally {
			if (mounted) loading = false;
		}
	}
	onMount(() => {
		void load();
	});
	onDestroy(() => {
		mounted = false;
		pause();
	});
</script>

<div class="experiment image-classifier">
	<div class="plot-panel">
		<div class="plot-heading">
			<span><i class="live-dot"></i> THE IMAGE CLASSIFIER</span><span class="plot-subtle"
				>Fashion-MNIST · real clothing images</span
			>
		</div>
		<div class="plot-intro">
			<h3>Sneaker or ankle boot?</h3>
			<p>From pixels to a prediction. Train a model, then inspect the images it gets wrong.</p>
		</div>
		{#if loading}<div class="output-empty" role="status">
				<PatternIcon name="scan" size={30} />
				<h4>Loading the image collection…</h4>
				<p>Preparing real training, validation, and test examples.</p>
			</div>{:else if error}<div class="error-notice" role="alert">
				{error}<button class="secondary-button" onclick={load}>Retry</button>
			</div>{:else}
			<div class="image-filter">
				<span>Every split, always visible.</span><label class="check-control"
					><input
						type="checkbox"
						bind:checked={mistakesOnly}
						onchange={() => (pages = [0, 0, 0])}
					/> Mistakes only</label
				>
			</div>
			<div class="dataset-columns">
				{#each splits as split, si (split)}{@const group = predictions.filter(
						(p) => p.split === split
					)}{@const filtered = group.filter(
						(p) => !mistakesOnly || Number(p.probability >= threshold) !== p.y
					)}{@const page = pages[si] * 16 < filtered.length ? pages[si] : 0}
					<section style={`--split-color:var(--${split === 'train' ? 'training' : split})`}>
						<header>
							<span
								>{split === 'train'
									? 'Training'
									: split === 'validation'
										? 'Validation'
										: 'Test'}</span
							><strong>{(statistics[si].accuracy * 100).toFixed(0)}<small>%</small></strong>
						</header>
						<p>{statistics[si].correct} / {statistics[si].count} correct</p>
						<div class="image-grid">
							{#each filtered.slice(page * 16, page * 16 + 16) as sample (sample.id)}{@const correct =
									Number(sample.probability >= threshold) === sample.y}<button
									class:selected={selectedId === sample.id}
									class:incorrect={!correct}
									aria-label={`${split} ${sample.label}, predicted ${sample.probability >= threshold ? 'ankle boot' : 'sneaker'}, ${correct ? 'correct' : 'incorrect'}`}
									aria-pressed={selectedId === sample.id}
									onclick={() => (selectedId = sample.id)}
									><img src={sample.image} alt={sample.label} width="28" height="28" /><span
										class="image-result"
										>{#if correct}<PatternIcon name="check" size={10} />{:else}<PatternIcon
												name="close"
												size={10}
											/>{/if}</span
									></button
								>{/each}
						</div>
						{#if !filtered.length}<div class="no-mistakes">
								No mistakes in this split.
							</div>{/if}<button
							class="gallery-page"
							disabled={filtered.length <= 16}
							onclick={() => (pages[si] = (page + 1) % Math.ceil(filtered.length / 16))}
							>{filtered.length
								? `${page * 16 + 1}–${Math.min(page * 16 + 16, filtered.length)} of ${filtered.length}`
								: '0 images'}<PatternIcon name="arrowRight" size={14} /></button
						>
						<div class="split-role">
							{split === 'train'
								? 'These images update the weights.'
								: split === 'validation'
									? 'Use these to compare choices.'
									: 'Official held-out test images.'}
						</div>
					</section>{/each}
			</div>
			<div class="image-training-footer">
				<span>Epoch <strong>{epoch}</strong> / 200</span><span
					>{epoch === 0
						? 'Random initial weights'
						: running
							? 'Learning from 320 training images…'
							: 'Weights learned from training images only'}</span
				>
			</div>
		{/if}
	</div>
	<div class="experiment-controls">
		<span class="eyebrow">INSPECT AN IMAGE</span>
		{#if selected}<div class="image-inspector">
				<img src={selected.image} alt={`Selected ${selected.label}`} width="112" height="112" />
				<div>
					<span class={`split-badge ${selected.split}`}
						>{selected.split === 'train' ? 'Training' : selected.split}</span
					><small>ACTUAL LABEL</small>
					<h4>{selected.label}</h4>
				</div>
			</div>
			<div class="prediction-readout">
				<span>Model predicts</span><strong
					>{selected.probability >= threshold ? 'Ankle boot' : 'Sneaker'}</strong
				>
				<div class="class-probability">
					<span style:width={`${(1 - selected.probability) * 100}%`}></span>
				</div>
				<div class="probability-labels">
					<span>Sneaker {((1 - selected.probability) * 100).toFixed(0)}%</span><span
						>Boot {(selected.probability * 100).toFixed(0)}%</span
					>
				</div>
				<p>Model scores express confidence, not a guarantee of correctness.</p>
			</div>{/if}
		<label class="slider-label" for="image-threshold"
			>Boot decision threshold <span>{threshold.toFixed(2)}</span></label
		><input
			id="image-threshold"
			type="range"
			min="0.1"
			max="0.9"
			step="0.05"
			bind:value={threshold}
		/>
		<p class="control-help threshold-help">
			Above this score, predict “boot.” Move the threshold to change decisions without retraining.
		</p>
		<button class="primary-button" disabled={loading || !!error || epoch >= 200} onclick={train}
			>{#if running}<PatternIcon name="pause" size={15} /> Pause training{:else}<PatternIcon
					name="play"
					size={15}
				/>{epoch === 0
					? 'Train the classifier'
					: epoch >= 200
						? 'Training complete'
						: 'Continue training'}{/if}</button
		><button class="text-button" disabled={loading} onclick={reset}
			><PatternIcon name="reset" size={13} /> Reset the weights</button
		>
		<div class="control-divider"></div>
		<span class="eyebrow">WHAT HAS IT LEARNED?</span>
		<div class="weight-explanation">
			<svg
				viewBox="0 0 140 140"
				role="img"
				aria-label="Actual learned pixel weights. Mint favors boots and peach favors sneakers."
				>{#each weights as weight, i (i)}<rect
						x={(i % 14) * 10}
						y={Math.floor(i / 14) * 10}
						width="9.5"
						height="9.5"
						rx=".8"
						fill={weight >= 0 ? '#8fcdb4' : '#e3aa89'}
						opacity={0.12 + (Math.abs(weight) / maxWeight) * 0.88}
					/>{/each}</svg
			>
			<p>
				Each pixel has a learned weight.<br /><span class="weight-boot">Mint → boot</span><br
				/><span class="weight-sneaker">Peach → sneaker</span>
			</p>
		</div>
		<p class="control-help">
			The model adds 196 weighted pixel values and a bias, then converts the score into a
			probability. That is logistic regression.
		</p>
	</div>
</div>
<div class="lab-explanation">
	<span class="eyebrow">REAL IMAGES. VISIBLE MISTAKES.</span>
	<p>
		These are sneaker and ankle-boot examples from <a
			href="https://github.com/zalandoresearch/fashion-mnist"
			target="_blank"
			rel="noreferrer">Zalando’s Fashion-MNIST</a
		>. Each 28 × 28 image is averaged into 14 × 14 input pixels. Training and validation use
		separate subsets of the official training data; the test images come from the official test
		data. The model sees no test labels during training. This small, balanced subset is a teaching
		experiment, not a benchmark score.
	</p>
</div>
