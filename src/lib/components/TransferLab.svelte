<script lang="ts">
	import { onDestroy } from 'svelte';
	import type { MnistAutoencoder } from '$lib/ml/autoencoder';
	import type { AutoencoderData } from '$lib/ml/autoencoder-datasets';
	import { runTransferComparison, type TransferResult } from '$lib/ml/transfer-learning';
	import MnistDigit from './MnistDigit.svelte';
	let {
		model,
		dataset,
		revision,
		training,
		ready = true,
		encoderStep = 0,
		classLabels = []
	}: {
		model: MnistAutoencoder;
		dataset: AutoencoderData;
		revision: number;
		training: boolean;
		ready?: boolean;
		encoderStep?: number;
		classLabels?: readonly string[];
	} = $props();
	const uid = $props.id();
	let budget = $state(5);
	let seed = $state(91);
	let busy = $state(false);
	let progress = $state(0);
	let total = $state(0);
	let result = $state.raw<TransferResult | null>(null);
	let recordedLabels = $state.raw<readonly string[]>([]);
	let message = $state(
		'Predict first: will reconstruction training make these two-number codes more useful for classification?'
	);
	let selected = $state(0);
	let inspection = $state<'current' | 'random'>('current');
	let controller: AbortController | undefined;
	let disposed = false;
	const stale = $derived(result && (result.revision !== revision || result.dataset !== dataset));
	const changedSettings = $derived(
		result && (result.seed !== seed || result.requestedBudget !== budget)
	);
	const example = $derived(result?.testImages[selected]);
	const evaluated = $derived(result?.[inspection]);
	const prediction = $derived(evaluated?.predictions[selected]);
	const neighbors = $derived(
		prediction?.neighbors.map((neighbor) => ({
			...neighbor,
			image: result?.trainImages.find((item) => item.index === neighbor.index)
		})) ?? []
	);
	const labelName = (label: number) => recordedLabels[label] ?? `Class ${label}`;
	async function compare() {
		if (!ready || busy) return;
		controller?.abort();
		const attempt = new AbortController();
		controller = attempt;
		busy = true;
		progress = 0;
		const capturedLabels = [...classLabels];
		message = 'Freezing both encoders and choosing the same labeled images for each.';
		try {
			const measured = await runTransferComparison({
				model,
				dataset,
				revision,
				encoderStep,
				seed,
				labelBudget: budget,
				signal: attempt.signal,
				onProgress: (done, count) => {
					if (!disposed) {
						progress = done;
						total = count;
					}
				}
			});
			if (disposed || attempt.signal.aborted) return;
			result = measured;
			recordedLabels = capturedLabels;
			selected = 0;
			const difference = (measured.current.accuracy - measured.random.accuracy) * 100;
			message = `Comparison complete. The current encoder scored ${Math.abs(difference).toFixed(1)} percentage points ${difference > 0 ? 'higher than' : difference < 0 ? 'lower than' : 'different from'} the random encoder on the same ${measured.testImages.length} test images.`;
		} catch (error) {
			if (!disposed)
				message = attempt.signal.aborted
					? 'Comparison cancelled. The previous result remains available.'
					: error instanceof Error
						? error.message
						: 'The comparison could not finish.';
		} finally {
			if (!disposed && controller === attempt) busy = false;
		}
	}
	onDestroy(() => {
		disposed = true;
		controller?.abort();
	});
</script>

<section class="transfer-lab" aria-label="Transfer learned representations to classification">
	<header>
		<span class="small-overline">DO THE FEATURES TRANSFER?</span>
		<h3>Spend a few labels.</h3>
		<p>
			Freeze the encoder above. Use its two-number codes for a new job: classify images from a small
			labeled set. Compare against the same architecture with random seed-7 weights.
		</p>
	</header>
	<div class="settings">
		<label for={`${uid}-budget`}
			>Labels per class <output>{budget}</output><input
				id={`${uid}-budget`}
				type="range"
				min="1"
				max="20"
				step="1"
				bind:value={budget}
				disabled={busy}
			/></label
		>
		<div class="actions">
			<button class="primary-button" onclick={compare} disabled={busy || !ready}
				>Freeze current encoder & compare</button
			><button class="secondary" onclick={() => (seed += 997)} disabled={busy}
				>Choose new sample · seed {seed}</button
			>{#if busy}<button class="text-button" onclick={() => controller?.abort()}
					>Cancel comparison</button
				>{/if}
		</div>
	</div>
	{#if !ready}<p class="notice">Waiting for the active encoder snapshot before comparing.</p>{/if}
	{#if training}<p class="notice">
			Encoder training is running. This comparison copies the current weights once, so later updates
			cannot change its result.
		</p>{/if}
	{#if busy}<div class="progress">
			<progress value={progress} max={Math.max(total, 1)} aria-label="Images encoded by both models"
			></progress><span>{progress} / {total || '…'} shared images encoded by both models</span>
		</div>{/if}
	<p class="status" role="status" aria-label="Transfer result">{message}</p>
	{#if result}
		<div class="snapshot">
			<strong
				>Recorded encoder · revision {result.revision} · live update {result.encoderStep}</strong
			><span
				>{result.trainPerClass} labels × {result.classes.length} classes = {result.trainImages
					.length} classifier-training images · {result.testPerClass} official test images per class</span
			>{#if stale}<p>
					The encoder or dataset above has changed. These scores still describe the recorded
					snapshot. Run a new comparison to evaluate the current weights.
				</p>{/if}{#if changedSettings}<p>
					Your label budget or sample seed has changed. Run a new comparison to apply those
					settings.
				</p>{/if}
		</div>
		<div class="scores">
			<div>
				<span>Current encoder + 3-nearest neighbors</span><strong
					>{(result.current.accuracy * 100).toFixed(1)}%</strong
				><small>{result.current.correct} / {result.testImages.length} correct</small>
			</div>
			<div>
				<span>Random encoder + 3-nearest neighbors</span><strong
					>{(result.random.accuracy * 100).toFixed(1)}%</strong
				><small>{result.random.correct} / {result.testImages.length} correct</small>
			</div>
		</div>
		<p>
			Both classifiers use identical labeled training images, test images, label budgets, and
			neighbor rules. Each encoder’s two coordinates are scaled using its own training-code standard
			deviations. Test labels score predictions; they do not fit the encoder, scaling, or
			classifier.
		</p>
		<div class="workspace">
			<div class="class-results">
				<h4>Which classes benefit?</h4>
				<table>
					<thead
						><tr
							><th scope="col">Class</th><th scope="col">Current</th><th scope="col">Random</th></tr
						></thead
					><tbody
						>{#each result.current.perClass as row, index (row.label)}<tr
								><th scope="row">{labelName(row.label)}</th><td>{row.correct} / {row.total}</td><td
									>{result.random.perClass[index].correct} / {row.total}</td
								></tr
							>{/each}</tbody
					>
				</table>
				<p>
					Counts are correct predictions, out of the same class-balanced sample. Small test samples
					vary; an improvement here does not guarantee transfer to another task.
				</p>
			</div>
			<div class="inspection">
				<h4>Inspect an unseen image</h4>
				<label for={`${uid}-image`}
					>Official test image <output>{selected + 1} / {result.testImages.length}</output><input
						id={`${uid}-image`}
						type="range"
						min="0"
						max={result.testImages.length - 1}
						step="1"
						bind:value={selected}
					/></label
				>
				<div class="encoder-choice" role="group" aria-label="Encoder to inspect">
					<button aria-pressed={inspection === 'current'} onclick={() => (inspection = 'current')}
						>Current snapshot</button
					><button aria-pressed={inspection === 'random'} onclick={() => (inspection = 'random')}
						>Random encoder</button
					>
				</div>
				{#if example && evaluated && prediction}<div class="query">
						<div class="thumbnail">
							<MnistDigit
								pixels={example.pixels}
								label={`Test image with label ${labelName(example.label)}`}
							/>
						</div>
						<div>
							<span>True label: <strong>{labelName(example.label)}</strong></span><span
								>Predicted: <strong>{labelName(prediction.label)}</strong></span
							><code
								>Code [{evaluated.testCodes[selected].code
									.map((value) => value.toFixed(3))
									.join(', ')}]</code
							>
						</div>
					</div>
					<p>Three nearest labeled training codes, after training-only scaling:</p>
					<div class="neighbors">
						{#each neighbors as neighbor (neighbor.index)}<div>
								{#if neighbor.image}<MnistDigit
										pixels={neighbor.image.pixels}
										label={`Training neighbor with label ${labelName(neighbor.label)}`}
									/>{/if}<strong>{labelName(neighbor.label)}</strong><small
									>distance {neighbor.distance.toFixed(3)}</small
								>
							</div>{/each}
					</div>{/if}
			</div>
		</div>
	{/if}
	<details>
		<summary>What transfers, and what can fail?</summary>
		<p>
			Reconstruction training used pixels without class labels. This downstream classifier uses
			labels to attach a class to nearby codes. A useful representation can reduce the labels
			needed, but a two-dimensional bottleneck can discard distinctions needed for classification. A
			random encoder can retain useful information too. Equal or worse scores for the current
			encoder are valid outcomes.
		</p>
		<p>
			The encoders stay frozen during evaluation. Three neighbors vote; ties use the smaller summed
			distance, then the smaller class number. Official training and test images remain separate.
			Class balancing uses labels only to choose the sample; it does not describe the natural
			frequency of classes. Repeatedly comparing snapshots or budgets against these test images
			turns this subset into development feedback. Reserve fresh independent data for a final
			real-world claim.
		</p>
		<p>
			Try one label per class, then twenty, using the same sample seed. Predict which classes will
			benefit before inspecting the counts. Then repeat with a fresh seed and explain whether the
			evidence is stable.
		</p>
	</details>
</section>

<style>
	.transfer-lab {
		background: var(--surface);
		border-radius: 24px;
		padding: clamp(20px, 3vw, 38px);
		container-type: inline-size;
		margin-top: 24px;
	}
	h3 {
		font: italic 400 clamp(30px, 3.2vw, 44px) var(--serif);
		margin: 10px 0;
	}
	h4 {
		font-size: 14px;
		font-weight: 550;
		margin: 0 0 16px;
	}
	p {
		font-size: 12px;
		line-height: 1.8;
		color: var(--muted);
	}
	.settings {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1.3fr);
		gap: 26px;
		align-items: center;
		margin: 24px 0;
	}
	label {
		font-size: 11px;
		display: block;
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
		margin-top: 12px;
	}
	.actions {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
	}
	.actions button {
		flex: 1;
	}
	button {
		cursor: pointer;
	}
	.primary-button {
		font-size: 11px;
		white-space: normal;
	}
	.secondary {
		background: var(--lab-inset);
		border: 1px solid var(--line);
		border-radius: 10px;
		color: var(--blue);
		font-size: 11px;
		padding: 12px;
	}
	.status {
		color: var(--blue);
	}
	.notice {
		color: var(--lavender);
	}
	.progress {
		display: flex;
		align-items: center;
		gap: 12px;
	}
	.progress span {
		color: var(--muted);
		font-size: 10px;
	}
	progress {
		accent-color: var(--blue);
		height: 6px;
	}
	.snapshot {
		padding: 18px;
		border-radius: 12px;
		background: var(--lab-inset);
		margin: 20px 0;
	}
	.snapshot strong,
	.snapshot span {
		display: block;
		font-size: 11px;
		line-height: 1.8;
	}
	.snapshot span {
		color: var(--muted);
	}
	.snapshot p {
		color: var(--orange);
		margin-bottom: 0;
	}
	.scores {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 24px;
		margin: 24px 0;
	}
	.scores span,
	.scores small {
		font-size: 11px;
		color: var(--muted);
	}
	.scores strong {
		display: block;
		color: var(--blue);
		font: 34px var(--mono);
		margin: 12px 0;
	}
	.scores > div:last-child strong {
		color: var(--lavender);
	}
	.workspace {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr);
		gap: 20px;
		margin: 24px 0;
	}
	.class-results,
	.inspection {
		padding: 22px;
		background: var(--lab-inset);
		border-radius: 16px;
		min-width: 0;
	}
	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 11px;
	}
	th,
	td {
		border-bottom: 1px solid var(--line);
		padding: 10px 4px;
	}
	th {
		text-align: left;
		font-weight: 500;
	}
	td {
		font-family: var(--mono);
		color: var(--blue);
		text-align: center;
	}
	td:last-child {
		color: var(--lavender);
	}
	.encoder-choice {
		display: flex;
		gap: 8px;
		margin: 20px 0;
	}
	.encoder-choice button {
		flex: 1;
		color: var(--muted);
		background: var(--surface);
		border: 1px solid var(--line);
		border-radius: 9px;
		padding: 11px;
		font-size: 11px;
	}
	.encoder-choice button[aria-pressed='true'] {
		color: var(--blue);
		border-color: var(--blue);
	}
	.query {
		display: flex;
		gap: 18px;
		align-items: center;
	}
	.thumbnail {
		width: 80px;
		flex-shrink: 0;
	}
	.query span {
		display: block;
		font-size: 11px;
		color: var(--muted);
		line-height: 1.9;
	}
	.query strong {
		color: var(--ink);
		font-weight: 500;
	}
	code {
		font: 10px/1.8 var(--mono);
		overflow-wrap: anywhere;
	}
	.neighbors {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 13px;
	}
	.neighbors :global(.digit-image) {
		max-width: 90px;
	}
	.neighbors strong {
		display: block;
		font-size: 10px;
		color: var(--blue);
		margin: 10px 0 5px;
		font-weight: 500;
	}
	.neighbors small {
		font: 9px var(--mono);
		color: var(--muted);
	}
	summary {
		cursor: pointer;
		color: var(--blue);
		font-size: 12px;
	}
	@container (max-width: 720px) {
		.settings,
		.workspace {
			grid-template-columns: 1fr;
		}
	}
	@container (max-width: 420px) {
		.scores {
			gap: 15px;
		}
		.scores strong {
			font-size: 27px;
		}
		.class-results,
		.inspection {
			padding: 14px;
		}
		.query {
			align-items: start;
			gap: 12px;
		}
		.thumbnail {
			width: 60px;
		}
		.progress {
			align-items: start;
			flex-direction: column;
		}
		.neighbors {
			gap: 8px;
		}
	}
</style>
