<script lang="ts">
	const uid = $props.id();
	import {
		denoisingLoss,
		denoisingPairs,
		fitToyDenoiser,
		learnedScore,
		sampleDenoiser,
		smoothedToyDensity,
		type ToyDenoiser
	} from '$lib/ml/sampling-lab';
	let sigma = $state(0.55);
	let model = $state.raw<ToyDenoiser | null>(null);
	let pairIndex = $state(18);
	let sampleSeed = $state(701);
	let stepSize = $state(0.03);
	let step = $state(0);
	const train = $derived(denoisingPairs(187, 64, sigma));
	const validation = $derived(denoisingPairs(1201, 64, sigma));
	const pair = $derived(train[pairIndex]);
	const paths = $derived(model ? sampleDenoiser(model, sampleSeed, 96, 180, stepSize) : []);
	const current = $derived(paths.map((path) => path[step]));
	const trainLoss = $derived(model ? denoisingLoss(train, model.predict) : null);
	const validationLoss = $derived(model ? denoisingLoss(validation, model.predict) : null);
	const baselineLoss = $derived(denoisingLoss(validation, (x) => x));
	const denoisingCurve = $derived.by(() => {
		const fitted = model;
		if (!fitted) return '';
		return Array.from({ length: 121 }, (_, index) => {
			const x = -3.6 + index * 0.06;
			return `${index ? 'L' : 'M'}${px(x)},${dy(fitted.predict(x))}`;
		}).join(' ');
	});
	const referenceCurve = $derived(
		Array.from({ length: 161 }, (_, index) => {
			const x = -4 + index * 0.05;
			return `${index ? 'L' : 'M'}${px(x)},${240 - smoothedToyDensity(x, sigma) * 175}`;
		}).join(' ')
	);
	const histogram = $derived(
		Array.from({ length: 32 }, (_, index) => ({
			index,
			count: current.filter((value) => value >= -4 + index / 4 && value < -4 + (index + 1) / 4)
				.length
		}))
	);
	const outside = $derived(current.filter((value) => value < -4 || value >= 4).length);
	const selectedPath = $derived(paths[0] ?? []);
	const position = $derived(selectedPath[step] ?? 0);
	const drift = $derived(model ? 0.5 * stepSize * learnedScore(model, position) : 0);
	const px = (x: number) => 30 + (x + 4) * 67.5;
	const dy = (y: number) => 130 - Math.max(-2.3, Math.min(2.3, y)) * 40;
	function fit() {
		model = fitToyDenoiser(train, sigma);
		step = 0;
	}
	function changeNoise() {
		model = null;
		step = 0;
	}
	function newNoise() {
		sampleSeed += 997;
		step = 0;
	}
</script>

<section class="sampling-lab" aria-label="Learn to denoise and sample a distribution">
	<header>
		<span class="small-overline">FROM A TRAINING TARGET TO A NEW SAMPLE</span>
		<h3>Learn the way out of noise.</h3>
		<p>
			Our “images” have one number. Learn to reconstruct a clean value from a corrupted value, then
			use the learned denoiser to guide fresh random samples.
		</p>
	</header>
	<div class="training-controls">
		<label for={`${uid}-control-1`}
			>Corruption strength σ <output>{sigma.toFixed(2)}</output><input
				id={`${uid}-control-1`}
				type="range"
				min="0.25"
				max="1"
				step="0.05"
				bind:value={sigma}
				oninput={changeNoise}
			/></label
		><button class="primary-button" onclick={fit}
			>{model ? 'Refit the same training pairs' : 'Fit the denoiser'}</button
		>
	</div>
	<div class="workspace">
		<div class="training-panel">
			<h4>1 · Learn a reconstruction target</h4>
			<p>
				64 clean values from two clusters, each corrupted eight times. Training sees 512 pairs. The
				target is always the original clean value.
			</p>
			<svg
				viewBox="0 0 600 270"
				role="img"
				aria-label="Noisy input on the horizontal axis and clean training target on the vertical axis. The learned denoising curve appears after training."
			>
				<line x1="30" x2="570" y1={dy(0)} y2={dy(0)} stroke="var(--plot-line)" /><line
					x1={px(0)}
					x2={px(0)}
					y1="25"
					y2="230"
					stroke="var(--plot-line)"
				/>
				{#each train.filter((_, index) => index % 3 === 0) as item (item.id)}<circle
						cx={px(item.noisy)}
						cy={dy(item.clean)}
						r="2"
						fill="var(--blue)"
						opacity="0.5"
					/>{/each}
				{#if model}<path
						d={denoisingCurve}
						stroke="var(--lavender)"
						stroke-width="3"
						fill="none"
					/>{/if}
				<circle
					cx={px(pair.noisy)}
					cy={dy(pair.clean)}
					r="7"
					fill="none"
					stroke="var(--orange)"
					stroke-width="2"
				/>
				<text x="30" y="258">−4</text><text x="235" y="258">corrupted input z</text><text
					x="557"
					y="258">4</text
				><text x="33" y="18">clean target x</text>
			</svg>
			<label for={`${uid}-control-2`}
				>Inspect training pair <output>{pairIndex + 1} / 512</output><input
					id={`${uid}-control-2`}
					type="range"
					min="0"
					max="511"
					step="1"
					bind:value={pairIndex}
				/></label
			>
			<div class="pair">
				<div><span>Clean target x</span><strong>{pair.clean.toFixed(3)}</strong></div>
				<div><span>Gaussian noise ε</span><strong>{pair.noise.toFixed(3)}</strong></div>
				<div><span>z = x + σ × ε</span><strong>{pair.noisy.toFixed(3)}</strong></div>
				<div>
					<span>Learned D(z)</span><strong
						>{model ? model.predict(pair.noisy).toFixed(3) : '—'}</strong
					>
				</div>
			</div>
			{#if model}<p>
					For this pair, squared error is (D(z) − x)² = <strong
						>{((model.predict(pair.noisy) - pair.clean) ** 2).toFixed(4)}</strong
					>. The curve estimates an average clean target for each noisy input; ambiguous inputs need
					not map to either cluster exactly.
				</p>{/if}
		</div>
		<div class="fit-panel">
			<h4>What actually learns?</h4>
			<p>
				Twenty-five fixed Gaussian basis functions view the noisy number at different positions.
				Ridge regression learns their 25 output weights and one bias by minimizing mean squared
				reconstruction error plus 0.001 × the sum of all 26 squared coefficients.
			</p>
			<p>
				The fit solves this small least-squares problem directly in your browser. Changing the
				corruption strength creates new pairs and clears the learned weights.
			</p>
			<div class="metrics">
				<div><span>Training MSE</span><strong>{trainLoss?.toFixed(4) ?? '—'}</strong></div>
				<div><span>Validation MSE</span><strong>{validationLoss?.toFixed(4) ?? '—'}</strong></div>
				<div>
					<span>Copy-input baseline · validation MSE</span><strong>{baselineLoss.toFixed(4)}</strong
					>
				</div>
			</div>
			<p>
				Validation uses 64 independently drawn clean values and 512 new corruption pairs. Lower
				reconstruction error checks denoising, not the quality of generated samples.
			</p>
		</div>
	</div>
	<div class="sampling-panel">
		<h4>2 · Turn reconstruction into a direction</h4>
		<p>
			With Gaussian corruption, an ideal denoiser gives the slope of log density: <code
				>score(z) = (D(z) − z) / σ²</code
			>. This learned approximation points toward higher density in the <em>noise-smoothed</em> distribution.
		</p>
		<div class="sampling-settings">
			<label for={`${uid}-control-3`}
				>Sampling step size η <output>{stepSize.toFixed(3)}</output><input
					id={`${uid}-control-3`}
					type="range"
					min="0.005"
					max="0.08"
					step="0.005"
					bind:value={stepSize}
					oninput={() => (step = 0)}
				/></label
			><button class="secondary" onclick={newNoise} disabled={!model}>New starting noise</button>
		</div>
		<svg
			class="samples"
			viewBox="0 0 600 280"
			role="img"
			aria-label={`Histogram of 96 generated values at sampling step ${step}, with the known noise-smoothed source density as a reference. ${outside} values lie outside the displayed interval.`}
		>
			<line x1="30" x2="570" y1="240" y2="240" stroke="var(--plot-line)" />
			{#each histogram as bin (bin.index)}<rect
					x={30 + bin.index * 16.875}
					y={240 - (bin.count / 96 / 0.25) * 175}
					width="15"
					height={(bin.count / 96 / 0.25) * 175}
					fill="var(--blue)"
					opacity="0.65"
				/>{/each}
			<path
				d={referenceCurve}
				fill="none"
				stroke="var(--lavender)"
				stroke-width="2.5"
				stroke-dasharray="5 4"
			/>
			{#if model}<circle cx={px(position)} cy="247" r="5" fill="var(--orange)" />{/if}
			<text x="30" y="270">−4</text><text x="258" y="270">sample value</text><text x="557" y="270"
				>4</text
			>
		</svg>
		<p class="legend">
			<span>▰ Generated density estimate</span><span>┄ Known smoothed source density</span><span
				>● Sample 1</span
			>
		</p>
		<label for={`${uid}-control-4`}
			>Sampling step <output>{step} / 180</output><input
				id={`${uid}-control-4`}
				type="range"
				min="0"
				max="180"
				step="1"
				bind:value={step}
				disabled={!model}
			/></label
		>
		<div class="actions">
			<button
				class="primary-button"
				onclick={() => (step = Math.min(180, step + 1))}
				disabled={!model || step === 180}>Take one sampling step</button
			><button class="secondary" onclick={() => (step = 180)} disabled={!model || step === 180}
				>Run 180 steps</button
			><button class="text-button" onclick={() => (step = 0)} disabled={!model}>Rewind</button>
		</div>
		{#if model}<div class="equation" role="status" aria-label="Sampling result">
				<strong>Inspect sample 1 · step {step}</strong><code
					>next z = z + ½η × score(z) + √η × fresh Gaussian noise</code
				>
				<p>
					Current z = {position.toFixed(3)}. Learned drift = {drift.toFixed(4)}. Random-step
					standard deviation = {Math.sqrt(stepSize).toFixed(3)}.{#if step < 180}
						The seeded next position is {selectedPath[step + 1].toFixed(3)}.{/if}
					{outside} of 96 current samples fall outside [−4, 4].
				</p>
			</div>{:else}<p class="prompt">Fit the denoiser to begin sampling.</p>{/if}
		<details>
			<summary>What this experiment establishes</summary>
			<p>
				This is unadjusted Langevin sampling at one fixed noise level. Starting points come from a
				broad Gaussian. Drift comes entirely from the fitted denoiser; random motion helps samples
				explore. The dashed reference density is computed from the known synthetic source and is
				never used by fitting or sampling.
			</p>
			<p>
				Even an ideal score with finite steps and finite step size only approximates that smoothed
				density. Model error, tails with few training examples, and limited mixing add error. The
				clean two-cluster distribution is narrower. A full diffusion model learns many noise levels
				and a reverse-time schedule; this lab isolates the learned denoising-to-score connection.
			</p>
			<p>
				Try a larger corruption strength and a larger step size separately. Predict whether the
				reference clusters merge and whether generated samples follow the reference more closely.
				Reconstruction loss alone cannot settle that second question.
			</p>
		</details>
	</div>
</section>

<style>
	.sampling-lab {
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
	.training-controls,
	.sampling-settings {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: 30px;
		align-items: center;
		margin: 24px 0;
	}
	label {
		display: block;
		color: var(--muted);
		font-size: 11px;
	}
	output {
		float: right;
		color: var(--blue);
		font: 11px var(--mono);
	}
	input {
		display: block;
		width: 100%;
		margin-top: 12px;
	}
	button {
		cursor: pointer;
	}
	button:disabled {
		cursor: default;
	}
	.primary-button {
		font-size: 12px;
	}
	.secondary {
		padding: 12px 16px;
		border: 1px solid var(--line);
		border-radius: 10px;
		background: var(--surface);
		color: var(--blue);
		font-size: 12px;
	}
	.workspace {
		display: grid;
		grid-template-columns: minmax(0, 1.7fr) minmax(0, 1fr);
		gap: 20px;
		margin: 24px 0;
	}
	.training-panel,
	.fit-panel,
	.sampling-panel {
		background: var(--lab-inset);
		padding: 22px;
		border-radius: 16px;
		min-width: 0;
	}
	svg {
		width: 100%;
		display: block;
		overflow: hidden;
	}
	svg text {
		font: 10px var(--sans);
		fill: var(--muted);
	}
	.pair {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 12px;
		margin-top: 22px;
	}
	.pair span,
	.metrics span {
		display: block;
		font-size: 10px;
		color: var(--muted);
	}
	.pair strong,
	.metrics strong {
		display: block;
		color: var(--blue);
		font: 20px var(--mono);
		margin: 9px 0;
	}
	.metrics {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 15px;
		margin: 25px 0;
	}
	.metrics > div:last-child {
		grid-column: 1 / -1;
	}
	.metrics > div:nth-child(2) strong {
		color: var(--lavender);
	}
	code {
		font: 11px/1.8 var(--mono);
		color: var(--ink);
		overflow-wrap: anywhere;
	}
	.samples {
		max-height: 340px;
	}
	.legend {
		display: flex;
		flex-wrap: wrap;
		gap: 18px;
		font-size: 10px;
	}
	.legend span:first-child {
		color: var(--blue);
	}
	.legend span:nth-child(2) {
		color: var(--lavender);
	}
	.legend span:last-child {
		color: var(--orange);
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
		margin: 20px 0;
	}
	.equation {
		border-left: 2px solid var(--lavender);
		padding-left: 18px;
		margin: 24px 0;
	}
	.equation strong {
		display: block;
		color: var(--lavender);
		font-size: 12px;
		margin-bottom: 10px;
	}
	summary {
		color: var(--blue);
		font-size: 12px;
		cursor: pointer;
	}
	.prompt {
		color: var(--blue);
	}
	@container (max-width: 730px) {
		.workspace {
			grid-template-columns: 1fr;
		}
	}
	@container (max-width: 460px) {
		.training-controls,
		.sampling-settings {
			grid-template-columns: 1fr;
			gap: 18px;
		}
		.pair {
			grid-template-columns: 1fr 1fr;
		}
		.training-panel,
		.fit-panel,
		.sampling-panel {
			padding: 14px;
		}
	}
</style>
