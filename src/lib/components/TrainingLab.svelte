<script lang="ts">
	import { inspectionMarkerPath } from '$lib/ui/inspection-marker';
	import { onDestroy, untrack } from 'svelte';
	import { prefersReducedMotion } from 'svelte/motion';
	import PatternIcon from '$lib/components/PatternIcon.svelte';
	import { dataset, Network, type LabKind } from '$lib/ml/models';
	import { neuralDataset, neuralProblems, type NeuralProblem } from '$lib/ml/neural-problems';
	import ChoiceGroup from './ChoiceGroup.svelte';
	import NetworkDiagram from './NetworkDiagram.svelte';
	import { decisionSurface } from '$lib/ml/surface';
	let { kind }: { kind: LabKind } = $props();
	const controlId = $props.id();
	function revealControls() {
		const panel = document.getElementById(controlId);
		panel?.focus({ preventScroll: true });
		panel?.scrollIntoView({
			block: 'start',
			behavior: prefersReducedMotion.current ? 'instant' : 'smooth'
		});
	}
	const config = {
		regression: {
			title: 'Find the line in the noise.',
			subtitle: 'Predict a continuous value from one input.',
			model: 'Linear regression',
			x: 'INPUT FEATURE →',
			y: 'TARGET VALUE →'
		},
		classification: {
			title: 'A boundary, learned from examples.',
			subtitle: 'Two features. Two classes. One decision.',
			model: 'Logistic regression',
			x: 'FEATURE ONE →',
			y: 'FEATURE TWO →'
		},
		forecast: {
			title: 'Where does the pattern go next?',
			subtitle: 'A synthetic signal with a trend and a repeating season.',
			model: 'Trend + seasonality',
			x: 'TIME →',
			y: 'OBSERVED VALUE →'
		},
		'neural-classifier': {
			title: 'A boundary made of many small decisions.',
			subtitle: 'Each neuron learns a response. Together, they can separate a circle from a ring.',
			model: 'Neural classifier',
			x: 'FEATURE ONE →',
			y: 'FEATURE TWO →'
		},
		'neural-regression': {
			title: 'Learning to bend, one step at a time.',
			subtitle: 'The same learning loop. A more expressive model.',
			model: 'Neural regressor',
			x: 'INPUT FEATURE →',
			y: 'TARGET VALUE →'
		}
	};
	const info = $derived(config[kind]);
	const isClass = $derived(kind === 'classification' || kind === 'neural-classifier');
	const isNeural = $derived(kind.startsWith('neural'));
	let seed = $state(42);
	let noise = $state(0.12);
	let depth = $state(2);
	let width = $state(12);
	let seasonal = $state(true);
	let rate = $state(0.015);
	let threshold = $state(0.5);
	let problem = $state<NeuralProblem>('rings');
	const currentProblem = $derived(neuralProblems.find((item) => item.id === problem)!);
	const problemPreviews = neuralProblems.map((item) => ({
		...item,
		points: neuralDataset(item.id).slice(0, 80)
	}));
	// The parent keys each lesson, so a new kind mounts a fresh experiment.
	let data = $state.raw(untrack(() => dataset(kind)));
	function createModel() {
		const input =
			kind === 'forecast'
				? seasonal
					? 3
					: 1
				: kind === 'classification' || kind === 'neural-classifier'
					? 2
					: 1;
		return new Network(
			[input, ...(kind.startsWith('neural') ? Array(depth).fill(width) : []), 1],
			kind === 'classification' || kind === 'neural-classifier',
			seed + 7
		);
	}
	let model = $state.raw(createModel());
	let epoch = $state(0);
	let runTarget = $state(600);
	let running = $state(false);
	let evaluated = $state(false);
	let visibility = $state({ train: true, validation: true, test: true });
	let history = $state.raw<{ epoch: number; train: number; validation: number; test: number }[]>(
		[]
	);
	let probe = $state(0.25);
	let neuralInput = $state([0.25, 0.2]);
	const networkInput = $derived(isClass ? neuralInput : [probe]);
	let showErrors = $state(true);
	let timer: ReturnType<typeof setInterval> | undefined;
	const inputOf = (input: number[]) =>
		kind === 'forecast' && !seasonal ? input.slice(0, 1) : input;
	const plottedData = $derived.by(() => {
		void epoch;
		return data
			.filter((p) => visibility[p.split])
			.map((p) => ({ ...p, prediction: model.predict(inputOf(p.x)) }));
	});
	const prepared = $derived(data.map((p) => ({ ...p, x: inputOf(p.x) })));
	const trainData = $derived(prepared.filter((p) => p.split === 'train'));
	const validationData = $derived(prepared.filter((p) => p.split === 'validation'));
	const testData = $derived(prepared.filter((p) => p.split === 'test'));
	const trainingLoss = $derived.by(() => {
		void epoch;
		return model.loss(trainData);
	});
	const validationLoss = $derived.by(() => {
		void epoch;
		return model.loss(validationData);
	});
	const validationAccuracy = $derived.by(() => {
		void epoch;
		return (
			validationData.filter((p) => Number(model.predict(p.x) >= threshold) === p.y).length /
			validationData.length
		);
	});
	const testScore = $derived.by(() => {
		void epoch;
		return isClass
			? testData.filter((p) => Number(model.predict(p.x) >= threshold) === p.y).length /
					testData.length
			: model.loss(testData);
	});
	const px = (x: number) => 52 + (x + 1) * 285;
	const py = (y: number) => 314 - (y + 1) * 132;
	function predict(x: number) {
		return model.predict(
			kind === 'forecast'
				? inputOf([x, Math.sin(((x + 1) / 2) * 8 * Math.PI), Math.cos(((x + 1) / 2) * 8 * Math.PI)])
				: [x]
		);
	}
	const predictionPath = $derived.by(() => {
		void epoch;
		return Array.from({ length: 121 }, (_, i) => {
			const x = i / 60 - 1;
			return `${i ? 'L' : 'M'}${px(x)},${py(Math.max(-3, Math.min(3, predict(x))))}`;
		}).join(' ');
	});
	const surface = $derived.by(() => {
		void epoch;
		return isClass
			? decisionSurface((input) => model.predict(input), threshold)
			: { cells: [], boundary: '', dx: 0, dy: 0 };
	});
	const probeValue = $derived.by(() => {
		void epoch;
		return !isClass ? predict(probe) : 0;
	});
	const historyMax = $derived(
		Math.max(0.01, ...history.flatMap((p) => [p.train, p.validation, p.test]))
	);
	const curve = (key: 'train' | 'validation' | 'test') =>
		history
			.map(
				(p, i) =>
					`${i ? 'L' : 'M'}${8 + (p.epoch / Math.max(600, epoch)) * 204},${54 - Math.min(1, p[key] / historyMax) * 45}`
			)
			.join(' ');
	function pause() {
		if (timer) clearInterval(timer);
		timer = undefined;
		running = false;
	}
	function reset(newData = false) {
		pause();
		if (newData) {
			seed++;
			data =
				kind === 'neural-classifier'
					? neuralDataset(problem, seed, noise)
					: dataset(kind, seed, noise);
		}
		model = createModel();
		epoch = 0;
		runTarget = 600;
		history = [];
		evaluated = false;
	}
	function chooseProblem(next: NeuralProblem) {
		if (next === problem) return;
		problem = next;
		data = neuralDataset(problem, seed, noise);
		reset();
	}
	function start() {
		if (running) {
			pause();
			return;
		}
		evaluated = false;
		runTarget = epoch + 600;
		if (!history.length)
			history = [
				{
					epoch: 0,
					train: model.loss(trainData),
					validation: model.loss(validationData),
					test: model.loss(testData)
				}
			];
		running = true;
		timer = setInterval(() => {
			for (let i = 0; i < 5; i++) model.train(trainData, rate);
			epoch = model.step;
			// Keep a bounded, whole-run curve even when the learner runs for many minutes.
			history = [
				...(history.length >= 800 ? history.filter((_, i) => i % 2 === 0) : history),
				{
					epoch,
					train: model.loss(trainData),
					validation: model.loss(validationData),
					test: model.loss(testData)
				}
			];
			if (kind !== 'neural-classifier' && epoch >= runTarget) pause();
		}, 40);
	}
	function evaluate() {
		pause();
		evaluated = true;
	}
	onDestroy(pause);
</script>

<svelte:document
	onvisibilitychange={() => {
		if (document.hidden) pause();
	}}
/>

{#if isNeural}
	<NetworkDiagram
		network={model}
		revision={epoch}
		input={networkInput}
		onpause={pause}
		oninput={(input) => {
			neuralInput = input;
			probe = input[0];
		}}
		samples={prepared}
		visible={visibility}
		onvisibility={(split) => (visibility[split] = !visibility[split])}
		{threshold}
		description={kind === 'neural-classifier' ? currentProblem.question : undefined}
		classNames={problem === 'rings'
			? ['Inner circle', 'Outer ring']
			: ['Blue class', 'Amber class']}
	>
		{#snippet problems()}
			{#if kind === 'neural-classifier'}
				<div class="problem-gallery">
					<div class="problem-heading">
						<span>Choose a pattern</span>
						<button onclick={() => reset(true)}
							><PatternIcon name="shuffle" size={13} />Resample points</button
						>
					</div>
					<div class="problem-choices" role="group" aria-label="Classification problem">
						{#each problemPreviews as item (item.id)}
							<button
								class="problem-choice"
								aria-label={item.label}
								aria-pressed={problem === item.id}
								onclick={() => chooseProblem(item.id)}
							>
								<svg viewBox="0 0 100 60" aria-hidden="true">
									{#each item.points as point (point)}
										<circle
											cx={50 + point.x[0] * 30}
											cy={30 - point.x[1] * 30}
											r="1.45"
											class:class-one={point.y === 1}
										/>
									{/each}
								</svg>
								<span>{item.label}</span><small>{item.level}</small>
							</button>
						{/each}
					</div>
					<p class="problem-hint">{currentProblem.hint}</p>
				</div>
			{/if}
		{/snippet}
		{#snippet toolbar()}
			<div class="neural-toolbar">
				<ChoiceGroup
					label="Hidden layers"
					value={depth}
					options={[
						{ value: 0, label: 'None' },
						{ value: 1, label: '1 layer' },
						{ value: 2, label: '2 layers' }
					]}
					onchange={(value) => {
						depth = value;
						reset();
					}}
				/>
				<ChoiceGroup
					label="Neurons per layer"
					value={width}
					options={[
						{ value: 4, label: '4' },
						{ value: 8, label: '8' },
						{ value: 12, label: '12' }
					]}
					disabled={depth === 0}
					onchange={(value) => {
						width = value;
						reset();
					}}
				/>
				<div class="neural-train-actions">
					<button class="neural-start" onclick={start}>
						<PatternIcon name={running ? 'pause' : 'play'} size={16} />
						{running
							? 'Pause learning'
							: epoch >= runTarget || evaluated
								? 'Continue learning'
								: epoch > 0
									? 'Continue learning'
									: 'Start learning'}
					</button>
					<button class="neural-reset" aria-label="Reset model" onclick={() => reset()}
						><PatternIcon name="reset" size={16} /></button
					>
				</div>
			</div>
		{/snippet}
		{#snippet metrics()}
			<div class="neural-scores">
				<div>
					<span>Training loss</span><strong>{trainingLoss.toFixed(4)}</strong><small
						>{trainData.length} examples</small
					>
				</div>
				<div class="validation-score">
					<span>Validation {isClass ? 'accuracy' : 'loss'}</span><strong
						>{isClass
							? `${Math.round(validationAccuracy * 100)}%`
							: validationLoss.toFixed(4)}</strong
					><small>{validationData.length} held out</small>
				</div>
				<div class="test-score">
					<span>Test {isClass ? 'accuracy' : 'loss'}</span><strong data-testid="neural-test-score"
						>{isClass ? `${Math.round(testScore * 100)}%` : testScore.toFixed(4)}</strong
					><small>{testData.length} held out</small>
				</div>
				<div class="neural-training-state">
					<span
						><i class:running></i>{running
							? 'Learning'
							: evaluated
								? 'Frozen'
								: epoch === 0
									? 'Untrained'
									: kind !== 'neural-classifier' && epoch >= runTarget
										? 'Learned'
										: 'Paused'}</span
					>
					{#if kind === 'neural-classifier'}
						<strong data-testid="neural-epoch">{epoch.toLocaleString()}</strong><small
							>epochs · pause anytime</small
						>
					{:else}
						<progress value={epoch} max={runTarget} aria-label="Training progress"></progress><small
							>{epoch} epochs · target {runTarget}</small
						>
					{/if}
				</div>
			</div>
		{/snippet}
		{#snippet settings()}
			<div class="neural-settings">
				<div class="neural-options">
					<ChoiceGroup
						label="Learning rate"
						value={rate}
						options={[
							{ value: 0.003, label: 'Gentle' },
							{ value: 0.015, label: 'Balanced' },
							{ value: 0.05, label: 'Bold' }
						]}
						disabled={running || evaluated}
						onchange={(value) => (rate = value)}
					/>
					{#if isClass}<label class="neural-threshold" for={`${controlId}-threshold`}
							>Decision threshold <span>{threshold.toFixed(2)}</span><input
								id={`${controlId}-threshold`}
								type="range"
								min="0.1"
								max="0.9"
								step="0.05"
								bind:value={threshold}
								disabled={evaluated}
							/></label
						>{/if}
					{#if kind !== 'neural-classifier'}<div class="neural-secondary-actions">
							<button disabled={epoch === 0 || evaluated} onclick={evaluate}
								><PatternIcon name={evaluated ? 'checkCircle' : 'eye'} size={14} />{evaluated
									? 'Model frozen'
									: 'Freeze model'}</button
							><button onclick={() => reset(true)}
								><PatternIcon name="shuffle" size={14} />New dataset</button
							>
						</div>{/if}
				</div>
				<div class="neural-history">
					<div class="neural-history-heading">
						<span>Learning curves</span><small>Lower loss is better</small>
					</div>
					<svg
						viewBox="0 0 220 63"
						role="img"
						aria-label={`Real training, validation, and test loss over ${epoch} epochs.`}
					>
						<line x1="8" y1="55" x2="214" y2="55" stroke="var(--wb-quiet)" stroke-opacity=".2" />
						{#if history.length > 1}
							<path d={curve('train')} fill="none" stroke="var(--wb-sage)" stroke-width="1.6" />
							<path
								d={curve('validation')}
								fill="none"
								stroke="var(--wb-lavender)"
								stroke-width="1.6"
							/>
							<path d={curve('test')} fill="none" stroke="var(--wb-amber)" stroke-width="1.6" />
						{:else}<text x="110" y="32" text-anchor="middle" fill="var(--wb-muted)" font-size="8"
								>Start learning to compare the three curves</text
							>{/if}
					</svg>
					<div class="neural-curve-legend">
						<span>Training</span><span>Validation</span><span>Test</span>
					</div>
					<p>
						Only training examples change the weights. Use validation to compare models; reserve a
						final test for examples you have not tuned against.
					</p>
				</div>
			</div>
		{/snippet}
	</NetworkDiagram>
{:else}
	<div class="split-toolbar">
		<span>Visible data</span>{#each ['train', 'validation', 'test'] as split (split)}<button
				class={`split-chip ${split}`}
				aria-pressed={visibility[split as keyof typeof visibility]}
				onclick={() =>
					(visibility[split as keyof typeof visibility] =
						!visibility[split as keyof typeof visibility])}
				><i></i>{split === 'train' ? 'Training' : split === 'validation' ? 'Validation' : 'Test'}
				<strong>{data.filter((p) => p.split === split).length}</strong></button
			>{/each}<span class="split-reminder">Only training points update the model.</span>
	</div>
	<div class="experiment training-experiment">
		<div class="plot-panel">
			<div class="plot-heading">
				<span><i class="live-dot"></i> {isNeural ? 'THE NEURAL LAB' : 'THE LEARNING LAB'}</span
				><span class="plot-subtle">{info.model} · real training</span>
			</div>
			<div class="plot-intro">
				<h3>{info.title}</h3>
				<p>{info.subtitle}</p>
			</div>
			{#if !isNeural}<div class="mobile-training-action">
					<button class="primary-button" onclick={start}
						><PatternIcon name={running ? 'pause' : 'play'} size={16} />{running
							? 'Pause learning'
							: epoch > 0 && epoch < runTarget && !evaluated
								? 'Continue learning'
								: epoch >= runTarget || evaluated
									? 'Continue learning'
									: 'Start learning'}</button
					><button class="text-button" onclick={revealControls}
						>Model settings<PatternIcon name="arrowDown" size={15} /></button
					>
				</div>{/if}
			<svg
				class="main-plot training-plot"
				viewBox="0 0 670 365"
				role="img"
				aria-label={`${info.model} predictions at epoch ${epoch}. Training loss ${trainingLoss.toFixed(4)}; validation loss ${validationLoss.toFixed(4)}.`}
			>
				<defs
					><clipPath id="training-clip"><rect x="52" y="50" width="570" height="264" /></clipPath
					></defs
				>
				{#each [0, 1, 2, 3, 4, 5, 6] as n (n)}<line
						x1={52 + n * 95}
						y1="50"
						x2={52 + n * 95}
						y2="314"
						class="grid-line"
					/>{/each}{#each [0, 1, 2, 3, 4] as n (n)}<line
						x1="52"
						y1={50 + n * 66}
						x2="622"
						y2={50 + n * 66}
						class="grid-line"
					/>{/each}
				<g clip-path="url(#training-clip)">
					{#if isClass}{#each surface.cells as cell (cell.id)}<rect
								x={cell.x}
								y={cell.y}
								width={surface.dx + 0.4}
								height={surface.dy + 0.4}
								fill={cell.p >= threshold ? 'var(--chart-amber)' : 'var(--chart-blue)'}
								fill-opacity={Math.min(0.23, 0.04 + Math.abs(cell.p - threshold) * 0.32)}
							/>{/each}{/if}
					{#if kind === 'forecast'}<rect
							x={px(0.4)}
							y="50"
							width={px(1) - px(0.4)}
							height="264"
							fill="var(--plot-muted)"
							opacity=".045"
						/><line
							x1={px(0.4)}
							x2={px(0.4)}
							y1="45"
							y2="318"
							stroke="var(--plot-muted)"
							stroke-dasharray="4 5"
							stroke-opacity=".7"
						/>{/if}
					{#if isClass}<path
							d={surface.boundary}
							fill="none"
							stroke="var(--plot-ink)"
							stroke-opacity=".8"
							stroke-width="1.6"
						/>{/if}
					{#each plottedData as p, i (i)}
						{#if !isClass && showErrors}<line
								x1={px(p.x[0])}
								x2={px(p.x[0])}
								y1={py(p.y)}
								y2={py(p.prediction)}
								stroke={p.split === 'test'
									? 'var(--test)'
									: p.split === 'validation'
										? 'var(--validation)'
										: 'var(--chart-blue)'}
								stroke-opacity=".3"
							/>{/if}
						<g transform={`translate(${px(p.x[0])} ${py(isClass ? p.x[1] : p.y)})`}
							><title
								>{p.split} example: actual {p.y.toFixed(2)}, prediction {p.prediction.toFixed(
									2
								)}</title
							>{#if p.split === 'test'}<path
									d="M0 -6 L6 0 L0 6 L-6 0Z"
									fill={isClass
										? p.y
											? 'var(--chart-amber)'
											: 'var(--chart-blue)'
										: 'var(--test)'}
									stroke="var(--plot)"
									stroke-width="1.3"
								/>{:else if p.split === 'validation'}<rect
									x="-4"
									y="-4"
									width="8"
									height="8"
									rx="1"
									fill={isClass
										? p.y
											? 'var(--chart-amber)'
											: 'var(--chart-blue)'
										: 'var(--validation)'}
									stroke="var(--plot)"
									stroke-width="1.3"
								/>{:else}<circle
									r="3.8"
									fill={isClass
										? p.y
											? 'var(--chart-amber)'
											: 'var(--chart-blue)'
										: 'var(--chart-blue)'}
									opacity=".85"
								/>{/if}</g
						>
					{/each}
					{#if kind === 'neural-classifier'}<g
							class="network-probe"
							transform={`translate(${px(neuralInput[0])} ${py(neuralInput[1])})`}
							><title
								>Network probe: x1 {neuralInput[0].toFixed(2)}, x2 {neuralInput[1].toFixed(
									2
								)}</title
							><path
								d={inspectionMarkerPath(12, 4)}
								fill="none"
								stroke="var(--plot-ink)"
								stroke-width="1.5"
								stroke-linecap="round"
							/></g
						>{/if}
					{#if !isClass}<path
							d={predictionPath}
							fill="none"
							stroke="var(--chart-blue)"
							stroke-width="2.5"
						/>{#if kind !== 'forecast'}<path
								transform={`translate(${px(probe)},${py(probeValue)})`}
								d={inspectionMarkerPath(8, 3)}
								fill="none"
								stroke="var(--plot-ink)"
								stroke-width="1.5"
								stroke-linecap="round"
							/>{/if}{/if}
				</g>
				{#if kind === 'forecast'}<text x="68" y="36" class="axis-label">PAST · TRAINING</text><text
						x={px(0.4) + 8}
						y="36"
						class="axis-label">FUTURE</text
					>{/if}
				<text x="337" y="350" text-anchor="middle" class="axis-label">{info.x}</text><text
					transform="translate(20 183) rotate(-90)"
					text-anchor="middle"
					class="axis-label">{info.y}</text
				>
			</svg>
			<div class="plot-legend">
				<span
					><i style:background={isClass ? 'var(--chart-amber)' : 'var(--chart-blue)'}></i>{isClass
						? kind === 'neural-classifier'
							? 'Outer ring'
							: 'Class A'
						: 'Training examples'}</span
				>{#if isClass}<span
						><i style="background:var(--chart-blue)"></i>{kind === 'neural-classifier'
							? 'Inner circle'
							: 'Class B'}</span
					>{:else}<span><i style="background:var(--chart-blue)"></i>Learned prediction</span
					>{/if}<span class="legend-note">● Training · ■ Validation · ◆ Test</span>
			</div>
			<div class="training-status">
				<span
					>{running
						? 'Adjusting the weights…'
						: epoch === 0
							? 'Ready when you are.'
							: evaluated
								? 'Model frozen. Compare its predictions with all three sets.'
								: epoch >= runTarget
									? 'Paused. Compare the curves, or continue training.'
									: 'Paused. Take a closer look.'}</span
				><span>EPOCH <strong>{String(epoch).padStart(3, '0')}</strong></span>
			</div>
			<div class="learning-readout">
				<div class="learning-scores">
					<div class="loss-stats">
						<div><span>TRAINING LOSS</span><strong>{trainingLoss.toFixed(4)}</strong></div>
						<div>
							<span>{isClass ? 'VALIDATION ACC.' : 'VALIDATION LOSS'}</span><strong
								>{isClass
									? `${Math.round(validationAccuracy * 100)}%`
									: validationLoss.toFixed(4)}</strong
							>
						</div>
					</div>
					<div class="test-metric">
						<span>TEST {isClass ? 'ACCURACY' : 'LOSS'}</span><strong
							>{isClass ? `${Math.round(testScore * 100)}%` : testScore.toFixed(4)}</strong
						><small>Measured on {testData.length} examples never used for updates.</small>
					</div>
				</div>
				<div class="learning-history">
					<span class="history-heading">Learning curves <small>Lower loss is better</small></span>
					<svg
						class="loss-chart"
						viewBox="0 0 220 63"
						role="img"
						aria-label="Loss on training, validation, and test examples. Lower means fewer errors."
						><line
							x1="8"
							y1="55"
							x2="214"
							y2="55"
							stroke="var(--line)"
						/>{#if history.length > 1}<path
								d={curve('train')}
								fill="none"
								stroke="var(--training)"
								stroke-width="1.6"
							/><path
								d={curve('validation')}
								fill="none"
								stroke="var(--validation)"
								stroke-width="1.6"
							/><path
								d={curve('test')}
								fill="none"
								stroke="var(--test)"
								stroke-width="1.6"
							/>{:else}<text
								x="110"
								y="35"
								text-anchor="middle"
								fill="var(--plot-muted)"
								font-size="8">Your learning curves will appear here</text
							>{/if}</svg
					>
					<div class="loss-legend">
						<span><i></i>Training loss</span><span><i></i>Validation</span><span class="test"
							><i></i>Test</span
						>
					</div>
				</div>
			</div>
		</div>
		<div class="experiment-controls" id={controlId} tabindex="-1">
			<span class="eyebrow">YOUR EXPERIMENT</span>
			{#if kind === 'forecast'}<ChoiceGroup
					label="Patterns the model can use"
					value={seasonal}
					options={[
						{ value: false, label: 'Trend' },
						{ value: true, label: 'Trend + season' }
					]}
					onchange={(value) => {
						seasonal = value;
						reset();
					}}
				/>
				<p class="control-help">
					The last part of the timeline is held out from training. You can still see it—and compare
					the forecast against it.
				</p>{:else if !isNeural}<ChoiceGroup
					label="Noise in the data"
					value={noise}
					options={[
						{ value: 0.04, label: 'Low' },
						{ value: 0.12, label: 'Medium' },
						{ value: 0.4, label: 'High' }
					]}
					onchange={(value) => {
						noise = value;
						reset(true);
					}}
				/>{/if}<ChoiceGroup
				label="Learning rate"
				value={rate}
				options={[
					{ value: 0.003, label: 'Gentle' },
					{ value: 0.015, label: 'Balanced' },
					{ value: 0.05, label: 'Bold' }
				]}
				disabled={running || evaluated}
				onchange={(value) => (rate = value)}
			/>

			<div class="train-actions">
				<button class="primary-button" onclick={start}
					>{#if running}<PatternIcon name="pause" size={14} /> Pause{:else}<PatternIcon
							name="play"
							size={14}
							fill="currentColor"
						/>
						{epoch >= runTarget || evaluated
							? 'Continue training'
							: epoch > 0
								? 'Resume training'
								: 'Train the model'}{/if}</button
				><button class="icon-button" aria-label="Reset model" onclick={() => reset()}
					><PatternIcon name="reset" size={15} /></button
				>
			</div>
			{#if isClass}<label class="slider-label threshold-control" for="decision-threshold"
					>Decision threshold <span>{threshold.toFixed(2)}</span></label
				><input
					id="decision-threshold"
					type="range"
					min="0.1"
					max="0.9"
					step="0.05"
					bind:value={threshold}
					disabled={evaluated}
				/>{:else if kind !== 'forecast'}<label
					class="slider-label threshold-control"
					for="prediction-input">Try an input <span>{probe.toFixed(2)}</span></label
				><input
					id="prediction-input"
					type="range"
					min="-0.9"
					max="0.9"
					step="0.01"
					bind:value={probe}
				/>
				<p class="prediction-readout">
					Model predicts <strong>{probeValue.toFixed(2)}</strong>
				</p>{/if}
			{#if evaluated}<div class="test-result" role="status">
					<PatternIcon name="checkCircle" size={16} /><span
						>Test {isClass ? 'accuracy' : 'loss'}
						<strong>{isClass ? `${Math.round(testScore * 100)}%` : testScore.toFixed(4)}</strong
						><small>{testData.length} held-out examples · model frozen</small></span
					>
				</div>{:else}<button class="secondary-button" disabled={epoch === 0} onclick={evaluate}
					><PatternIcon name="eye" size={13} />
					Freeze this model
					<PatternIcon name="arrowRight" size={13} /></button
				>{/if}
			<div class="lab-small-actions">
				<button class="text-button" onclick={() => reset(true)}
					><PatternIcon name="shuffle" size={12} /> New dataset</button
				>{#if !isClass}<label><input type="checkbox" bind:checked={showErrors} /> Show errors</label
					>{/if}
			</div>
		</div>
	</div>
	<div class="lab-explanation">
		<span class="eyebrow">LOOK A LITTLE CLOSER</span>
		<p>
			{kind === 'neural-classifier'
				? 'With no hidden layers, this model is logistic regression: its boundary is a straight line. Hidden layers with nonlinear activations can combine to enclose the inner circle. A deeper model is more expressive, but it still needs good data and careful evaluation.'
				: kind === 'neural-regression'
					? 'This network predicts a number, rather than a category. Its final neuron uses a linear output; its hidden neurons use nonlinear functions. Watch how adding capacity lets the model fit the wave. More depth isn’t automatically better for every problem.'
					: kind === 'forecast'
						? 'Green circles are the 84 training observations. Purple squares are the next 18 validation observations. Amber diamonds are the final 18 test observations. All are visible, but only green points update the weights. Real forecasts become less reliable when the conditions that created the pattern change.'
						: kind === 'classification'
							? 'The colored regions show the model’s decisions. A threshold of 0.50 means “choose A when its predicted probability is at least 50%.” A lower threshold predicts A more often. Which mistake matters more depends on the application.'
							: 'The vertical lines show prediction errors. Squaring and averaging them gives the mean squared error (MSE). Training adjusts the slope and intercept to reduce that number. Even a good fit cannot explain away random noise.'}
		</p>
	</div>
{/if}

<style>
	.problem-gallery {
		margin-top: 18px;
	}
	.problem-heading {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		margin-bottom: 9px;
	}
	.problem-heading > span {
		color: var(--wb-muted);
		font-size: 11px;
	}
	.problem-heading button {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 5px 0 5px 8px;
		background: transparent;
		border: 0;
		color: var(--wb-muted);
		font-size: 11px;
		cursor: pointer;
	}
	.problem-heading button:hover {
		color: var(--wb-ink);
	}
	.problem-choices {
		display: grid;
		grid-template-columns: repeat(6, minmax(0, 1fr));
		gap: 8px;
	}
	.problem-choice {
		display: grid;
		justify-items: center;
		gap: 3px;
		min-width: 0;
		padding: 7px 5px 10px;
		background: var(--wb-inset);
		color: var(--wb-muted);
		border: 1px solid transparent;
		border-radius: 11px;
		cursor: pointer;
		transition:
			background 180ms,
			border-color 180ms;
	}
	.problem-choice:hover {
		background: var(--wb-raised);
	}
	.problem-choice[aria-pressed='true'] {
		background: var(--selection-fill);
		border-color: color-mix(in srgb, var(--blue) 50%, transparent);
		color: var(--selection-ink);
	}
	.problem-choice svg {
		display: block;
		width: 100%;
		height: 48px;
	}
	.problem-choice circle {
		fill: var(--chart-blue);
		opacity: 0.85;
	}
	.problem-choice circle.class-one {
		fill: var(--chart-amber);
	}
	.problem-choice > span {
		font-size: 12px;
		font-weight: 600;
		white-space: nowrap;
	}
	.problem-choice small {
		font-size: 10px;
		color: var(--wb-quiet);
	}
	.problem-hint {
		margin: 10px 0 16px;
		color: var(--wb-muted);
		font-size: 11px;
		line-height: 1.6;
		min-height: 1.6em;
	}
	.problem-gallery button:focus-visible {
		outline: 2px solid var(--focus);
		outline-offset: 3px;
	}
	.neural-toolbar {
		display: flex;
		align-items: end;
		gap: 20px;
		flex-wrap: wrap;
	}
	.neural-toolbar :global(.choice-group) {
		width: 190px;
		min-width: 0;
		margin: 0;
	}
	.neural-toolbar :global(.choice-group > legend),
	.neural-options :global(.choice-group > legend) {
		color: var(--wb-muted);
		font-size: 11px;
		margin-bottom: 7px;
	}
	.neural-toolbar :global(.choice-group > div),
	.neural-options :global(.choice-group > div) {
		background: var(--wb-inset);
		padding: 3px;
		border-radius: 9px;
	}
	.neural-toolbar :global(.choice-group > div button),
	.neural-options :global(.choice-group > div button) {
		min-height: 32px;
		white-space: nowrap;
		padding: 7px 8px;
		font-size: 11px;
		color: var(--wb-muted);
	}
	.neural-toolbar :global(.choice-group > div button[aria-pressed='true']),
	.neural-options :global(.choice-group > div button[aria-pressed='true']) {
		background: var(--wb-raised);
		color: var(--wb-ink);
	}
	.neural-train-actions {
		display: flex;
		align-items: center;
		gap: 5px;
		margin-left: auto;
	}
	.neural-start,
	.neural-reset,
	.neural-secondary-actions button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		border: 0;
		border-radius: 9px;
		min-height: 38px;
		font-size: 12px;
		font-weight: 600;
		cursor: pointer;
		transition:
			background 0.18s,
			transform 0.18s;
	}
	.neural-start {
		padding: 0 17px;
		background: var(--action-gradient);
		color: var(--control-ink);
		white-space: nowrap;
	}
	.neural-start:hover {
		filter: brightness(1.08);
	}
	.neural-start:active,
	.neural-reset:active {
		transform: scale(0.97);
	}
	.neural-reset {
		width: 36px;
		background: transparent;
		color: var(--wb-muted);
	}
	.neural-reset:hover {
		color: var(--wb-ink);
		background: var(--wb-raised);
	}
	.neural-scores {
		display: grid;
		grid-template-columns: repeat(3, 1fr) minmax(108px, 0.65fr);
		align-items: center;
		gap: 20px;
		padding: 12px 16px;
		border-radius: 12px;
		background: var(--wb-inset);
	}
	.neural-scores > div {
		display: grid;
		grid-template-columns: auto 1fr;
		align-items: baseline;
		column-gap: 12px;
		row-gap: 3px;
		min-width: 0;
	}
	.neural-scores span {
		color: var(--wb-muted);
		font-size: 10px;
		grid-column: 1/-1;
	}
	.neural-scores strong {
		color: var(--wb-sage);
		font: 500 21px/1.25 var(--font-mono, 'IBM Plex Mono', monospace);
		font-variant-numeric: tabular-nums;
	}
	.neural-scores small {
		color: var(--wb-quiet);
		font-size: 9px;
		white-space: nowrap;
	}
	.neural-scores .validation-score strong {
		color: var(--wb-lavender);
	}
	.neural-scores .test-score strong {
		color: var(--wb-amber);
	}
	.neural-scores .neural-training-state {
		grid-template-columns: 1fr;
		gap: 5px;
	}
	.neural-training-state > span {
		display: flex;
		align-items: center;
		gap: 6px;
	}
	.neural-training-state i {
		width: 5px;
		height: 5px;
		border-radius: 50%;
		background: var(--wb-quiet);
	}
	.neural-training-state i.running {
		background: var(--wb-sage);
		box-shadow: 0 0 8px color-mix(in srgb, var(--wb-sage) 35%, transparent);
	}
	.neural-training-state progress {
		appearance: none;
		width: 100%;
		height: 3px;
		border: 0;
		background: var(--wb-raised);
		border-radius: 2px;
		overflow: hidden;
	}
	.neural-training-state progress::-webkit-progress-bar {
		background: var(--wb-raised);
	}
	.neural-training-state progress::-webkit-progress-value {
		background: var(--wb-sage);
		transition: width 0.12s linear;
	}
	.neural-training-state progress::-moz-progress-bar {
		background: var(--wb-sage);
	}
	.neural-settings {
		display: grid;
		grid-template-columns: minmax(220px, 1fr) minmax(220px, 1.2fr);
		gap: 30px;
		padding-top: 16px;
	}
	.neural-options :global(.choice-group) {
		margin: 0;
	}
	.neural-threshold {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		gap: 9px;
		color: var(--wb-muted);
		font-size: 11px;
		margin-top: 16px;
	}
	.neural-threshold input {
		width: 100%;
		margin: 0;
		accent-color: var(--accent);
	}
	.neural-secondary-actions {
		display: flex;
		gap: 12px;
		margin-top: 10px;
	}
	.neural-secondary-actions button {
		background: transparent;
		color: var(--wb-muted);
		padding: 0;
		min-height: 34px;
		font-size: 10px;
	}
	.neural-secondary-actions button:hover {
		color: var(--wb-ink);
	}
	.neural-secondary-actions button:disabled {
		opacity: 0.45;
		cursor: default;
	}
	.neural-history-heading {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		color: var(--wb-muted);
		font-size: 11px;
	}
	.neural-history-heading small {
		font-size: 9px;
		color: var(--wb-quiet);
	}
	.neural-history svg {
		display: block;
		width: 100%;
		max-height: 110px;
	}
	.neural-curve-legend {
		display: flex;
		gap: 14px;
		font-size: 9px;
		color: var(--wb-sage);
	}
	.neural-curve-legend span:nth-child(2) {
		color: var(--wb-lavender);
	}
	.neural-curve-legend span:nth-child(3) {
		color: var(--wb-amber);
	}
	.neural-curve-legend span::before {
		content: '';
		display: inline-block;
		vertical-align: middle;
		width: 9px;
		height: 2px;
		margin-right: 5px;
		background: currentColor;
	}
	.neural-history p {
		max-width: 45em;
		color: var(--wb-quiet);
		font-size: 10px;
		line-height: 1.65;
		margin: 9px 0 0;
	}
	.neural-toolbar button:focus-visible,
	.neural-settings button:focus-visible {
		outline: 2px solid var(--focus);
		outline-offset: 3px;
	}
	@container (max-width:720px) {
		.problem-choices {
			grid-template-columns: repeat(3, minmax(0, 1fr));
			gap: 6px;
		}
		.problem-choice {
			padding: 5px 4px 7px;
		}
		.problem-choice svg {
			height: 38px;
		}
		.problem-choice > span {
			font-size: 11px;
		}
		.problem-choice small {
			font-size: 9px;
		}
		.neural-toolbar {
			gap: 14px;
		}
		.neural-toolbar :global(.choice-group) {
			width: 170px;
		}
		.neural-train-actions {
			margin-left: 0;
		}
		.neural-scores {
			gap: 12px;
			padding: 13px 14px;
		}
		.neural-scores > div {
			grid-template-columns: 1fr;
			gap: 3px;
		}
	}
	@container (max-width:510px) {
		.neural-toolbar {
			display: grid;
			grid-template-columns: 1fr 1fr;
			gap: 12px;
		}
		.neural-toolbar :global(.choice-group) {
			width: 100%;
		}
		.neural-toolbar :global(.choice-group > div button) {
			padding: 6px;
			font-size: 10px;
		}
		.neural-train-actions {
			grid-column: 1/-1;
		}
		.neural-start {
			min-height: 35px;
			padding: 0 14px;
			font-size: 11px;
		}
		.neural-scores {
			grid-template-columns: repeat(3, 1fr);
			gap: 14px 8px;
			padding: 12px;
		}
		.neural-scores strong {
			font-size: 18px;
		}
		.neural-scores span {
			font-size: 9px;
		}
		.neural-scores small {
			font-size: 8px;
		}
		.neural-scores .neural-training-state {
			grid-column: 1/-1;
			grid-template-columns: auto 1fr auto;
			align-items: center;
			gap: 10px;
		}
		.neural-training-state > span {
			grid-column: auto;
		}
		.neural-settings {
			grid-template-columns: 1fr;
			gap: 20px;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.problem-choice {
			transition: none;
		}
		.neural-start,
		.neural-reset,
		.neural-secondary-actions button {
			transition: none;
		}
		.neural-training-state progress::-webkit-progress-value {
			transition: none;
		}
	}
</style>
