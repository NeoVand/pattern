<script lang="ts">
	import { onDestroy, untrack } from 'svelte';
	import PatternIcon from '$lib/components/PatternIcon.svelte';
	import { dataset, Network, type LabKind } from '$lib/ml/models';
	import ChoiceGroup from './ChoiceGroup.svelte';
	import NetworkDiagram from './NetworkDiagram.svelte';
	import { decisionSurface } from '$lib/ml/surface';
	let { kind }: { kind: LabKind } = $props();
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
					`${i ? 'L' : 'M'}${8 + (p.epoch / 600) * 204},${54 - Math.min(1, p[key] / historyMax) * 45}`
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
			data = dataset(kind, seed, noise);
		}
		model = createModel();
		epoch = 0;
		history = [];
		evaluated = false;
	}
	function start() {
		if (running) {
			pause();
			return;
		}
		if (evaluated || epoch >= 600) reset();
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
			history = [
				...history,
				{
					epoch,
					train: model.loss(trainData),
					validation: model.loss(validationData),
					test: model.loss(testData)
				}
			];
			if (epoch >= 600) pause();
		}, 40);
	}
	function evaluate() {
		pause();
		evaluated = true;
	}
	onDestroy(pause);
</script>

{#if isNeural}
	<div class="neural-architecture">
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
		<div class="neural-live-actions">
			<button class="primary-button" onclick={start}
				><PatternIcon name={running ? 'pause' : 'play'} size={17} />{running
					? 'Pause learning'
					: epoch >= 600 || evaluated
						? 'Learn again'
						: epoch > 0
							? 'Continue learning'
							: 'Start learning'}</button
			>
			<span
				>{epoch === 0
					? 'Untrained weights · ready to explore'
					: `Epoch ${epoch} · ${running ? 'weights updating' : 'weights held fixed'}`}</span
			>
		</div>
	</div>
	{#key model}<NetworkDiagram
			network={model}
			revision={epoch}
			input={networkInput}
			onpause={pause}
			oninput={(input) => {
				neuralInput = input;
				probe = input[0];
			}}
		/>{/key}
{/if}
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
			<span><i class="live-dot"></i> {isNeural ? 'THE NEURAL LAB' : 'THE LEARNING LAB'}</span><span
				class="plot-subtle">{info.model} · real training</span
			>
		</div>
		<div class="plot-intro">
			<h3>{info.title}</h3>
			<p>{info.subtitle}</p>
		</div>
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
							fill={cell.p >= threshold ? '#d9a477' : '#7eaaab'}
							fill-opacity={Math.min(0.23, 0.04 + Math.abs(cell.p - threshold) * 0.32)}
						/>{/each}{/if}
				{#if kind === 'forecast'}<rect
						x={px(0.4)}
						y="50"
						width={px(1) - px(0.4)}
						height="264"
						fill="#a1b7a4"
						opacity=".045"
					/><line
						x1={px(0.4)}
						x2={px(0.4)}
						y1="45"
						y2="318"
						stroke="#a3b3a3"
						stroke-dasharray="4 5"
						stroke-opacity=".7"
					/>{/if}
				{#if isClass}<path
						d={surface.boundary}
						fill="none"
						stroke="#e8eccb"
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
								? '#f3b777'
								: p.split === 'validation'
									? '#a694f2'
									: '#77c8b1'}
							stroke-opacity=".3"
						/>{/if}
					<g transform={`translate(${px(p.x[0])} ${py(isClass ? p.x[1] : p.y)})`}
						><title
							>{p.split} example: actual {p.y.toFixed(2)}, prediction {p.prediction.toFixed(
								2
							)}</title
						>{#if p.split === 'test'}<path
								d="M0 -6 L6 0 L0 6 L-6 0Z"
								fill={isClass ? (p.y ? '#e9aa80' : '#92bfb5') : '#f3b777'}
								stroke="#17251f"
								stroke-width="1.3"
							/>{:else if p.split === 'validation'}<rect
								x="-4"
								y="-4"
								width="8"
								height="8"
								rx="1"
								fill={isClass ? (p.y ? '#e9aa80' : '#92bfb5') : '#a694f2'}
								stroke="#17251f"
								stroke-width="1.3"
							/>{:else}<circle
								r="3.8"
								fill={isClass ? (p.y ? '#e9aa80' : '#92bfb5') : '#77c8b1'}
								opacity=".85"
							/>{/if}</g
					>
				{/each}
				{#if kind === 'neural-classifier'}<g
						class="network-probe"
						transform={`translate(${px(neuralInput[0])} ${py(neuralInput[1])})`}
						><title
							>Network probe: x1 {neuralInput[0].toFixed(2)}, x2 {neuralInput[1].toFixed(2)}</title
						><circle r="10" fill="none" stroke="#17251f" stroke-width="5" /><circle
							r="10"
							fill="none"
							stroke="#eef6ce"
							stroke-width="2"
						/><path d="M-16 0h7 M9 0h7 M0 -16v7 M0 9v7" stroke="#eef6ce" stroke-width="2" /></g
					>{/if}
				{#if !isClass}<path
						d={predictionPath}
						fill="none"
						stroke="#d7e7c0"
						stroke-width="2.5"
					/>{#if kind !== 'forecast'}<circle
							cx={px(probe)}
							cy={py(probeValue)}
							r="7"
							fill="#e3edbe"
							stroke="#31483b"
							stroke-width="3"
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
				><i style:background={isClass ? '#e9aa80' : '#77c8b1'}></i>{isClass
					? kind === 'neural-classifier'
						? 'Outer ring'
						: 'Class A'
					: 'Training examples'}</span
			>{#if isClass}<span
					><i style="background:#92bfb5"></i>{kind === 'neural-classifier'
						? 'Inner circle'
						: 'Class B'}</span
				>{:else}<span><i style="background:#d7e7c0"></i>Learned prediction</span>{/if}<span
				class="legend-note">● Training · ■ Validation · ◆ Test</span
			>
		</div>
		<div class="training-status">
			<span
				>{running
					? 'Adjusting the weights…'
					: epoch === 0
						? 'Ready when you are.'
						: evaluated
							? 'Model frozen. Compare its predictions with all three sets.'
							: epoch >= 600
								? 'Training complete. Compare the three error curves.'
								: 'Paused. Take a closer look.'}</span
			><span>EPOCH <strong>{String(epoch).padStart(3, '0')}</strong> / 600</span>
		</div>
	</div>
	<div class="experiment-controls">
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
					{epoch >= 600 || evaluated
						? 'Train again'
						: epoch > 0
							? 'Resume training'
							: 'Train the model'}{/if}</button
			><button class="icon-button" aria-label="Reset model" onclick={() => reset()}
				><PatternIcon name="reset" size={15} /></button
			>
		</div>
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
		<svg
			class="loss-chart"
			viewBox="0 0 220 63"
			role="img"
			aria-label="Loss on training, validation, and test examples. Lower means fewer errors."
			><line x1="8" y1="55" x2="214" y2="55" stroke="var(--line)" />{#if history.length > 1}<path
					d={curve('train')}
					fill="none"
					stroke="var(--training)"
					stroke-width="1.6"
				/><path
					d={curve('validation')}
					fill="none"
					stroke="var(--validation)"
					stroke-width="1.6"
				/><path d={curve('test')} fill="none" stroke="var(--test)" stroke-width="1.6" />{:else}<text
					x="110"
					y="35"
					text-anchor="middle"
					fill="#a1ab96"
					font-size="8">Your learning curves will appear here</text
				>{/if}</svg
		>
		<div class="loss-legend">
			<span><i></i>Training loss</span><span><i></i>Validation</span><span class="test"
				><i></i>Test</span
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
			<p class="prediction-readout">Model predicts <strong>{probeValue.toFixed(2)}</strong></p>{/if}
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

<style>
	.neural-architecture {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) minmax(180px, 0.9fr);
		align-items: end;
		gap: 24px;
		margin: 0 0 26px;
	}
	.neural-architecture :global(.choice-group) {
		margin: 0;
		min-width: 0;
	}
	.neural-live-actions {
		display: grid;
		gap: 10px;
	}
	.neural-live-actions .primary-button {
		min-height: 49px;
		margin: 0;
	}
	.neural-live-actions > span {
		color: var(--muted);
		font-size: 10px;
		text-align: center;
	}
	@media (max-width: 760px) {
		.neural-architecture {
			grid-template-columns: 1fr 1fr;
			gap: 18px;
		}
		.neural-live-actions {
			grid-column: 1 / -1;
		}
	}
	@media (max-width: 420px) {
		.neural-architecture {
			grid-template-columns: 1fr;
		}
	}
</style>
