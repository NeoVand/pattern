<script lang="ts">
	const uid = $props.id();
	import {
		fitRepresentations,
		representationData,
		scoreRepresentation,
		type PlanePredictor,
		type RepresentationKind,
		type RepresentationTask
	} from '$lib/ml/representation-comparison';
	const labels: Record<RepresentationKind, string> = {
		raw: 'Raw logistic regression',
		radius: 'Radius-squared logistic',
		tree: 'Small decision tree',
		network: 'Neural network'
	};
	let task = $state<RepresentationTask>('rings');
	let size = $state(96);
	let seed = $state(123);
	let epochs = $state(600);
	let models = $state.raw<PlanePredictor[]>([]);
	let selected = $state<RepresentationKind>('radius');
	let committed = $state(false);
	let inspectedX = $state(0.4),
		inspectedY = $state(0.5);
	const train = $derived(representationData(task, size, seed));
	const validation = $derived(representationData(task, 64, seed + 1709));
	const heldOut = $derived.by(() => (committed ? representationData(task, 128, seed + 9109) : []));
	const current = $derived(models.find((model) => model.kind === selected));
	const scores = $derived(
		models.map((model) => ({
			model,
			train: scoreRepresentation(model, train),
			validation: scoreRepresentation(model, validation)
		}))
	);
	const finalScore = $derived(current && committed ? scoreRepresentation(current, heldOut) : null);
	const cells = $derived.by(() =>
		current
			? Array.from({ length: 576 }, (_, id) => {
					const x = id % 24,
						y = Math.floor(id / 24);
					return {
						id,
						x,
						y,
						probability: current.predict(-1 + (x + 0.5) / 12, 1 - (y + 0.5) / 12)
					};
				})
			: []
	);
	const px = (value: number) => 25 + (value + 1) * 150;
	const py = (value: number) => 325 - (value + 1) * 150;
	function resetRun() {
		models = [];
		committed = false;
	}
	function newSample() {
		seed += 997;
		resetRun();
	}
	function fit() {
		models = fitRepresentations(train, epochs, seed + 29);
	}
</script>

<section class="representation-lab" aria-label="Compare representations on the same data">
	<header>
		<span class="small-overline">THE SAME EXAMPLES, FOUR APPROACHES</span>
		<h3>Change the view of the problem.</h3>
		<p>
			Can a useful feature replace a bigger network? Compare learned boundaries, select using
			validation, then commit to one model before opening its test result.
		</p>
	</header>
	<div class="settings">
		<label
			>Pattern<select bind:value={task} onchange={resetRun} disabled={committed}
				><option value="rings">Inside or outside a circle</option><option value="diagonal"
					>A diagonal boundary</option
				><option value="xor">Opposite quadrants</option></select
			></label
		>
		<label
			>Training examples<select bind:value={size} onchange={resetRun} disabled={committed}
				><option value={32}>32 examples</option><option value={96}>96 examples</option><option
					value={192}>192 examples</option
				></select
			></label
		>
		<label
			>Gradient updates<select bind:value={epochs} onchange={resetRun} disabled={committed}
				><option value={200}>200 updates</option><option value={600}>600 updates</option><option
					value={1600}>1,600 updates</option
				></select
			></label
		>
		<button class="primary-button" onclick={fit} disabled={committed}
			>{models.length ? 'Fit again · same seed' : 'Train all four'}</button
		>
	</div>
	<p class="split-note">
		Seed {seed} · {size} training examples · 64 validation examples · 128 test examples {committed
			? 'opened'
			: 'sealed'}. All four models get the same training rows. Data and initialization are
		reproducible.
	</p>
	{#if models.length}
		<div class="workspace">
			<div class="boundary">
				<h4>{labels[selected]}</h4>
				<svg
					viewBox="0 0 350 350"
					role="img"
					aria-label={`Decision boundary of ${labels[selected]}. Dots show training labels; background blue is class 0, lavender class 1. Cross marks the inspected input.`}
				>
					{#each cells as cell (cell.id)}<rect
							x={25 + cell.x * 12.5}
							y={25 + cell.y * 12.5}
							width="12.6"
							height="12.6"
							fill={cell.probability >= 0.5 ? 'var(--lavender)' : 'var(--blue)'}
							opacity={0.12 + 0.32 * Math.abs(cell.probability - 0.5) * 2}
						/>{/each}
					<line x1="25" x2="325" y1="175" y2="175" stroke="var(--plot-line)" /><line
						x1="175"
						x2="175"
						y1="25"
						y2="325"
						stroke="var(--plot-line)"
					/>
					{#each train as item (item.id)}<circle
							cx={px(item.x)}
							cy={py(item.y)}
							r="3"
							fill={item.label ? 'var(--lavender)' : 'var(--blue)'}
							stroke="var(--plot)"
							stroke-width="1"
						/>{/each}
					<path
						d={`M${px(inspectedX) - 6},${py(inspectedY)}h12 M${px(inspectedX)},${py(inspectedY) - 6}v12`}
						stroke="var(--ink)"
						stroke-width="2"
					/>
					<text x="25" y="343">−1</text><text x="171" y="343">x</text><text x="318" y="343">1</text
					><text x="8" y="178">y</text>
				</svg>
				<p class="legend">
					<span>● Class 0</span><span>● Class 1</span><span>+ Inspect input</span>
				</p>
				<p class="equation">{current?.description}</p>
			</div>
			<div class="results">
				<h4>Choose using validation</h4>
				{#each scores as row (row.model.kind)}<button
						class="model-row"
						aria-pressed={selected === row.model.kind}
						disabled={committed}
						onclick={() => (selected = row.model.kind)}
						><strong>{labels[row.model.kind]}</strong>
						<div>
							<span>Train <b>{(row.train.accuracy * 100).toFixed(1)}%</b></span><span
								>Validation <b>{(row.validation.accuracy * 100).toFixed(1)}%</b></span
							>
						</div>
						<small
							>{row.model.parameters}
							{row.model.kind === 'tree' ? 'thresholds + leaf probabilities' : 'parameters'} · {row
								.model.effort}</small
						></button
					>{/each}
				<p>
					Scores are accuracy at a 0.5 threshold. Logistic models and the network minimize mean
					cross-entropy with L2 penalty 0.001 on weights; biases are unpenalized. The tree greedily
					reduces Gini impurity. Equal update counts do not mean equal computation.
				</p>
				<button
					class="primary-button commit"
					onclick={() => (committed = true)}
					disabled={committed}
					>{committed
						? 'Model choice committed'
						: `Commit ${labels[selected]} & reveal test`}</button
				>
				{#if finalScore}<p class="final-score" role="status" aria-label="Final test result">
						<strong>{(finalScore.accuracy * 100).toFixed(1)}% test accuracy</strong
						>{finalScore.correct} / {finalScore.count} correct, with {labels[selected]}. Your choice
						and training settings are frozen for this sample.
					</p>{/if}
			</div>
		</div>
		<div class="inspector">
			<h4>Inspect the representation</h4>
			<div class="coordinates">
				<label for={`${uid}-control-1`}
					>Input x <output>{inspectedX.toFixed(2)}</output><input
						id={`${uid}-control-1`}
						type="range"
						min="-1"
						max="1"
						step="0.05"
						bind:value={inspectedX}
					/></label
				><label for={`${uid}-control-2`}
					>Input y <output>{inspectedY.toFixed(2)}</output><input
						id={`${uid}-control-2`}
						type="range"
						min="-1"
						max="1"
						step="0.05"
						bind:value={inspectedY}
					/></label
				>
			</div>
			<p>
				Raw inputs: [{inspectedX.toFixed(2)}, {inspectedY.toFixed(2)}]. Supplied radius-squared
				feature: x² + y² = <strong>{(inspectedX ** 2 + inspectedY ** 2).toFixed(3)}</strong>. This
				single feature discards direction, which may help a circle problem and hurt another task.
			</p>
			<div class="predictions">
				{#each models as model (model.kind)}<div>
						<span>{labels[model.kind]}</span><strong
							>{(model.predict(inspectedX, inspectedY) * 100).toFixed(1)}%</strong
						><small>score for class 1</small>
					</div>{/each}
			</div>
		</div>
	{:else}<div class="empty">
			<strong>Predict first.</strong>
			<p>
				Which approach should do well on this pattern? The radius feature encodes a circular
				assumption. The tree cuts the plane into rectangles. The network must learn useful features
				from the examples.
			</p>
		</div>{/if}
	<div class="footer">
		<button class="secondary" onclick={newSample}>Start a fresh sample</button>
		<p>
			Repeat across fresh samples to judge stability. Repeated experiments still teach you about
			this simulator; a real final evaluation needs independent data from the intended setting. This
			small budget comparison does not establish a universally best model.
		</p>
	</div>
</section>

<style>
	.representation-lab {
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
		grid-template-columns: repeat(3, 1fr) auto;
		gap: 12px;
		align-items: end;
		margin-top: 22px;
	}
	label {
		color: var(--muted);
		font-size: 11px;
	}
	select {
		display: block;
		width: 100%;
		min-width: 0;
		margin-top: 8px;
		padding: 12px 9px;
		color: var(--ink);
		background: var(--lab-inset);
		border: 1px solid var(--line);
		border-radius: 9px;
		font-size: 11px;
	}
	button {
		cursor: pointer;
	}
	button:disabled,
	select:disabled {
		cursor: default;
	}
	.primary-button {
		font-size: 12px;
		min-height: 42px;
	}
	.split-note {
		font-size: 10px;
	}
	.workspace {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr);
		gap: 22px;
		margin: 24px 0;
	}
	.boundary,
	.results,
	.inspector,
	.empty {
		padding: 20px;
		border-radius: 16px;
		background: var(--lab-inset);
		min-width: 0;
	}
	svg {
		width: 100%;
		display: block;
	}
	svg text {
		fill: var(--muted);
		font: 10px var(--sans);
	}
	.legend {
		display: flex;
		gap: 15px;
		flex-wrap: wrap;
		font-size: 10px;
	}
	.legend span:first-child {
		color: var(--blue);
	}
	.legend span:nth-child(2) {
		color: var(--lavender);
	}
	.equation {
		font: 11px/1.8 var(--mono);
		overflow-wrap: anywhere;
	}
	.model-row {
		width: 100%;
		border: 1px solid var(--line);
		border-radius: 10px;
		text-align: left;
		padding: 13px;
		background: var(--surface);
		color: var(--muted);
		margin-bottom: 8px;
	}
	.model-row[aria-pressed='true'] {
		border-color: var(--blue);
	}
	.model-row > strong {
		color: var(--ink);
		font-size: 12px;
		font-weight: 550;
	}
	.model-row > div {
		display: flex;
		justify-content: space-between;
		gap: 9px;
		font-size: 10px;
		margin: 10px 0;
	}
	.model-row b {
		color: var(--blue);
		font: 14px var(--mono);
		margin-left: 4px;
	}
	.model-row > div span:last-child b {
		color: var(--lavender);
	}
	.model-row small {
		display: block;
		font-size: 9px;
		line-height: 1.7;
	}
	.results > p {
		font-size: 10px;
	}
	.commit {
		width: 100%;
		white-space: normal;
	}
	.final-score strong {
		display: block;
		font: 22px var(--mono);
		color: var(--orange);
		margin: 12px 0;
	}
	.coordinates {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 22px;
	}
	output {
		float: right;
		font-family: var(--mono);
		color: var(--blue);
	}
	input {
		display: block;
		width: 100%;
		margin-top: 12px;
	}
	.predictions {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 14px;
	}
	.predictions span,
	.predictions small {
		display: block;
		font-size: 10px;
		color: var(--muted);
	}
	.predictions strong {
		display: block;
		font: 21px var(--mono);
		color: var(--blue);
		margin: 12px 0 5px;
	}
	.empty {
		margin: 24px 0;
	}
	.empty strong {
		color: var(--lavender);
		font-size: 13px;
	}
	.footer {
		display: flex;
		align-items: center;
		gap: 24px;
		margin-top: 20px;
	}
	.footer p {
		font-size: 10px;
	}
	.secondary {
		flex-shrink: 0;
		padding: 12px 16px;
		color: var(--blue);
		background: var(--lab-inset);
		border: 1px solid var(--line);
		border-radius: 10px;
		font-size: 12px;
	}
	@container (max-width: 760px) {
		.settings {
			grid-template-columns: 1fr 1fr;
		}
		.workspace {
			grid-template-columns: 1fr;
		}
		.boundary svg {
			max-width: 440px;
			margin: auto;
		}
	}
	@container (max-width: 450px) {
		.settings,
		.coordinates {
			grid-template-columns: 1fr;
		}
		.predictions {
			grid-template-columns: 1fr 1fr;
		}
		.footer {
			flex-direction: column;
			align-items: start;
			gap: 8px;
		}
		.boundary,
		.results,
		.inspector {
			padding: 14px;
		}
	}
</style>
