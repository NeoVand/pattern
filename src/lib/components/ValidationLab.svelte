<script lang="ts">
	import PatternIcon from '$lib/components/PatternIcon.svelte';
	import {
		makeCurveData,
		fitPolynomial,
		polynomialPredict,
		polynomialLoss
	} from '$lib/ml/polynomial';
	import ChoiceGroup from './ChoiceGroup.svelte';
	let seed = $state(6);
	let selected = $state(1);
	let regularization = $state(1e-7);
	let count = $state(18);
	let showTruth = $state(false);
	const options = [
		{ name: 'Straight line', detail: '2 adjustable weights', degree: 1 },
		{ name: 'Gentle curve', detail: '4 adjustable weights', degree: 3 },
		{ name: 'Very flexible', detail: '13 adjustable weights', degree: 12 }
	];
	const data = $derived(makeCurveData(seed, count));
	const train = $derived(data.filter((p) => p.split === 'train'));
	const models = $derived(options.map((o) => fitPolynomial(train, o.degree, regularization)));
	const coefficients = $derived(models[selected]);
	const scores = $derived(
		models.map((m) => ({
			train: polynomialLoss(m, train),
			validation: polynomialLoss(
				m,
				data.filter((p) => p.split === 'validation')
			),
			test: polynomialLoss(
				m,
				data.filter((p) => p.split === 'test')
			)
		}))
	);
	const best = $derived(
		scores.reduce((winner, s, i) => (s.validation < scores[winner].validation ? i : winner), 0)
	);
	const px = (x: number) => 38 + (x + 1) * 175;
	const py = (y: number) => 233 - (y + 1) * 96;
	function curve(fn: (x: number) => number) {
		return Array.from({ length: 241 }, (_, i) => {
			const x = i / 120 - 1;
			return `${i ? 'L' : 'M'}${px(x)},${py(Math.max(-4, Math.min(4, fn(x))))}`;
		}).join(' ');
	}
	const line = $derived(curve((x) => polynomialPredict(coefficients, x)));
	const truth = curve((x) => 0.65 * Math.sin(3 * x));
	const panels = [
		{ name: 'Training', detail: 'The examples that change the weights', set: 'train' },
		{ name: 'Held-out examples', detail: 'The very same model. Unseen examples.', set: 'heldout' }
	];
</script>

<div class="split-purpose">
	<div>
		<i class="split-dot train"></i><strong>Training</strong>
		<p>Fit the weights.<span>{count} examples</span></p>
	</div>
	<div>
		<i class="split-dot validation"></i><strong>Validation</strong>
		<p>Choose the model.<span>21 examples</span></p>
	</div>
	<div>
		<i class="split-dot test"></i><strong>Test</strong>
		<p>Evaluate the final choice.<span>21 examples</span></p>
	</div>
</div>
<div class="experiment generalization-lab">
	<div class="plot-panel">
		<div class="plot-heading">
			<span><i class="live-dot"></i> THE GENERALIZATION LAB</span><span class="plot-subtle"
				>All three sets are visible</span
			>
		</div>
		<div class="plot-intro">
			<h3>
				{selected === 0
					? 'Too simple to follow the pattern.'
					: selected === 2 && regularization < 0.001
						? 'A closer fit can be a worse prediction.'
						: 'Learn the pattern behind the noise.'}
			</h3>
			<p>Vertical lines are prediction errors. Compare their lengths on both sides.</p>
		</div>
		<div class="paired-plots">
			{#each panels as panel, pi (panel.set)}<div>
					<div class="paired-heading">
						<h4>{panel.name}</h4>
						<p>{panel.detail}</p>
					</div>
					<svg
						viewBox="0 0 420 282"
						role="img"
						aria-label={`${panel.name}: ${options[selected].name} with actual samples and prediction errors.`}
						><defs
							><clipPath id={`generalization-${pi}`}
								><rect x="38" y="28" width="350" height="216" /></clipPath
							></defs
						>{#each [0, 1, 2, 3, 4] as n (n)}<line
								x1="38"
								x2="388"
								y1={40 + n * 48}
								y2={40 + n * 48}
								class="grid-line"
							/><line
								x1={38 + n * 87.5}
								x2={38 + n * 87.5}
								y1="28"
								y2="244"
								class="grid-line"
							/>{/each}<g clip-path={`url(#generalization-${pi})`}
							>{#if showTruth}<path
									d={truth}
									fill="none"
									stroke="var(--quiet)"
									stroke-width="2"
									stroke-dasharray="5 5"
								/>{/if}{#each data.filter( (p) => (panel.set === 'train' ? p.split === 'train' : p.split !== 'train') ) as p, i (i)}{@const color =
									p.split === 'train'
										? 'var(--training)'
										: p.split === 'validation'
											? 'var(--validation)'
											: 'var(--test)'}<line
									x1={px(p.x)}
									x2={px(p.x)}
									y1={py(p.y)}
									y2={py(polynomialPredict(coefficients, p.x))}
									stroke={color}
									stroke-opacity=".5"
									stroke-width="1.5"
								/>{#if p.split === 'train'}<circle cx={px(p.x)} cy={py(p.y)} r="4.5" fill={color}
										><title
											>Training · actual {p.y.toFixed(2)} · prediction {polynomialPredict(
												coefficients,
												p.x
											).toFixed(2)}</title
										></circle
									>{:else if p.split === 'validation'}<rect
										x={px(p.x) - 4}
										y={py(p.y) - 4}
										width="8"
										height="8"
										rx="1"
										fill={color}
										><title
											>Validation · actual {p.y.toFixed(2)} · prediction {polynomialPredict(
												coefficients,
												p.x
											).toFixed(2)}</title
										></rect
									>{:else}<path d={`M${px(p.x)},${py(p.y) - 5}l5,5 -5,5 -5,-5Z`} fill={color}
										><title
											>Test · actual {p.y.toFixed(2)} · prediction {polynomialPredict(
												coefficients,
												p.x
											).toFixed(2)}</title
										></path
									>{/if}{/each}<path
								d={line}
								fill="none"
								stroke="var(--accent)"
								stroke-width="2.6"
							/></g
						><text x="213" y="269" text-anchor="middle" class="axis-label">INPUT FEATURE →</text
						><text transform="translate(15 136) rotate(-90)" text-anchor="middle" class="axis-label"
							>TARGET →</text
						></svg
					>
				</div>{/each}
		</div>
		<div class="comparison-metrics">
			{#each ['train', 'validation', 'test'] as split (split)}<div
					style={`--split-color:var(--${split === 'train' ? 'training' : split})`}
				>
					<span
						>{split === 'train' ? 'Training' : split === 'validation' ? 'Validation' : 'Test'} error</span
					><strong>{scores[selected][split as 'train' | 'validation' | 'test'].toFixed(4)}</strong
					><small>mean squared error ↓</small>
				</div>{/each}
		</div>
		<div class="plot-legend">
			<span><i style="background:var(--accent)"></i> Fitted model</span><span
				><i style="background:var(--training)"></i> Train ●</span
			><span><i style="background:var(--validation)"></i> Validation ■</span><span
				><i style="background:var(--test)"></i> Test ◆</span
			>
		</div>
	</div>
	<div class="experiment-controls">
		<span class="eyebrow">HOW MUCH FLEXIBILITY?</span>
		<div class="choice-stack model-options">
			{#each options as option, i (option.degree)}<button
					class:chosen={selected === i}
					aria-pressed={selected === i}
					onclick={() => (selected = i)}
					><span class="choice-number">0{i + 1}</span><span
						><strong>{option.name}</strong><small>{option.detail}</small></span
					><span class="radio-dot"></span></button
				>{/each}
		</div>
		<ChoiceGroup
			label="Training examples"
			value={count}
			options={[
				{ value: 18, label: '18' },
				{ value: 42, label: '42' },
				{ value: 100, label: '100' }
			]}
			onchange={(v) => (count = v)}
		/>
		<ChoiceGroup
			label="Regularization"
			value={regularization}
			options={[
				{ value: 1e-7, label: 'Off' },
				{ value: 0.001, label: 'Gentle' },
				{ value: 0.03, label: 'Strong' }
			]}
			onchange={(v) => (regularization = v)}
		/>
		<p class="control-help">
			Regularization penalizes large weights. It can tame a flexible model’s wiggles, even when its
			training error increases.
		</p>
		<label class="check-control"
			><input type="checkbox" bind:checked={showTruth} /> Show the underlying pattern</label
		>
		<div class="example-note">
			<span class="eyebrow">COMPARE YOUR CHOICES</span>
			<p>“{options[best].name}” has the lowest validation error at these settings.</p>
		</div>
		<button class="text-button" onclick={() => seed++}
			><PatternIcon name="shuffle" size={14} /> Draw fresh data</button
		>
	</div>
</div>
<div class="concept-cards">
	<article>
		<span>01 / UNDERFITTING</span>
		<h4>Too little flexibility</h4>
		<p>
			A straight line misses a curved relationship. Both training and held-out errors stay high.
		</p>
	</article>
	<article>
		<span>02 / OVERFITTING</span>
		<h4>Learning the accidents</h4>
		<p>
			A flexible curve can chase noise in a small training set. Low training error then hides poor
			predictions on new examples.
		</p>
	</article>
	<article>
		<span>03 / GENERALIZATION</span>
		<h4>The pattern travels</h4>
		<p>
			More representative data, suitable complexity, and regularization help. Use validation results
			to choose among them.
		</p>
	</article>
</div>
<div class="lab-explanation">
	<span class="eyebrow">VISIBLE TO YOU. UNSEEN BY THE OPTIMIZER.</span>
	<p>
		These synthetic examples contain a curved signal and random noise. Showing test data helps you
		understand the failure. It does not train the model: only the green points enter the fit. In a
		real project, choose settings with validation data and use the test set only for the final
		evaluation. If you keep choosing models based on this visible test score, it stops being an
		unbiased final check.
	</p>
</div>
