<script lang="ts">
	import PatternIcon from '$lib/components/PatternIcon.svelte';
	import type { PatternIconName } from '$lib/data/icons';

	const id = $props.id();
	let selected = $state(2);
	const levels = [
		{
			name: 'Artificial intelligence',
			label: 'Artificial intelligence',
			idea: 'The broad pursuit of intelligent behavior.',
			detail:
				'Planning, reasoning, perception, and language. An AI system can follow explicit rules without learning from data.',
			example: 'A chess engine that searches possible moves.',
			color: 'blue',
			cx: 258,
			cy: 246,
			radius: 220,
			labelY: 76
		},
		{
			name: 'Machine learning',
			label: 'Machine learning',
			idea: 'Learning patterns from examples.',
			detail:
				'Part of AI. We fit a model to data instead of writing every decision rule. Linear regression, trees, and neural networks all belong here.',
			example: 'Predicting house prices from past sales.',
			color: 'sage',
			cx: 278,
			cy: 280,
			radius: 168,
			labelY: 159
		},
		{
			name: 'Deep learning',
			label: 'Deep learning',
			idea: 'Learning through layers of representation.',
			detail:
				'Part of machine learning. Multilayer neural networks learn useful features along with the task, making complex signals easier to work with.',
			example: 'A vision network recognizing objects in photos.',
			color: 'lavender',
			cx: 287,
			cy: 315,
			radius: 113,
			labelY: 246
		},
		{
			name: 'Large language models',
			label: 'LLMs',
			idea: 'Learning the patterns of language at scale.',
			detail:
				'Part of deep learning. Many LLMs use transformers, with broad pretraining followed by further training for useful behaviors.',
			example: 'Summarizing a document or continuing a conversation.',
			color: 'amber',
			cx: 287,
			cy: 344,
			radius: 63,
			labelY: 347
		}
	] as const;
	const level = $derived(levels[selected]);
	let facet = $state<'generative' | 'foundation' | 'multimodal'>('generative');
	const facets = [
		{
			key: 'generative',
			name: 'Generative',
			question: 'What it creates',
			icon: 'sparkles',
			text: 'Creates content: text, images, audio, and more. Generative models extend beyond language—and beyond deep learning.'
		},
		{
			key: 'foundation',
			name: 'Foundation',
			question: 'How it is reused',
			icon: 'layers',
			text: 'Broad pretraining makes one model useful across many tasks. It can be prompted or adapted for a particular purpose.'
		},
		{
			key: 'multimodal',
			name: 'Multimodal',
			question: 'What data it uses',
			icon: 'vision',
			text: 'Works with more than one kind of data, such as text and images. A model can be multimodal, generative, and a foundation model at once.'
		}
	] as const satisfies readonly {
		key: string;
		name: string;
		question: string;
		icon: PatternIconName;
		text: string;
	}[];
	const dimension = $derived(facets.find((item) => item.key === facet)!);

	function chooseWithKey(event: KeyboardEvent, index: number) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			selected = index;
		}
	}
</script>

<section class="ai-atlas" aria-label="How the fields of AI fit together">
	<div class="atlas-main">
		<figure class="atlas-figure">
			<svg
				class="atlas-orbits"
				viewBox="0 0 520 490"
				role="group"
				aria-label="AI contains machine learning, which contains deep learning, which contains large language models"
			>
				<defs>
					{#each levels as item, index (item.name)}
						<radialGradient id={`${id}-disc-${index}`} cx="30%" cy="18%" r="94%">
							<stop class={`atlas-tint tone-${item.color}`} offset="0%" stop-opacity="0.27" />
							<stop class={`atlas-tint tone-${item.color}`} offset="58%" stop-opacity="0.07" />
							<stop class={`atlas-tint tone-${item.color}`} offset="100%" stop-opacity="0.17" />
						</radialGradient>
					{/each}
					<radialGradient id={`${id}-sheen`} cx="26%" cy="8%" r="80%">
						<stop offset="0%" stop-color="white" stop-opacity="0.06" />
						<stop offset="75%" stop-color="white" stop-opacity="0" />
					</radialGradient>
				</defs>
				{#each levels as item, index (item.name)}
					<g
						class={['atlas-orbit', `tone-${item.color}`, { 'orbit-selected': selected === index }]}
						role="button"
						tabindex="0"
						aria-label={`Explore ${item.name}`}
						aria-pressed={selected === index}
						aria-controls={`${id}-field-detail`}
						onclick={() => (selected = index)}
						onkeydown={(event) => chooseWithKey(event, index)}
					>
						<circle
							class="orbit-body"
							cx={item.cx}
							cy={item.cy}
							r={item.radius}
							fill={`url(#${id}-disc-${index})`}
						/>
						<circle
							class="orbit-sheen"
							cx={item.cx}
							cy={item.cy}
							r={item.radius}
							fill={`url(#${id}-sheen)`}
						/>
						<circle class="orbit-rim" cx={item.cx} cy={item.cy} r={item.radius} />
						<text
							class="orbit-label"
							x={item.cx}
							y={item.labelY}
							text-anchor="middle"
							dominant-baseline="middle">{item.label}</text
						>
					</g>
				{/each}
			</svg>
			<figcaption>Containment shows relationships, not relative size.</figcaption>
		</figure>

		<div class="atlas-reading">
			<div class="atlas-fields" role="group" aria-label="Explore a field">
				{#each levels as item, index (item.name)}
					<button
						class={['atlas-field', `tone-${item.color}`, { 'field-selected': selected === index }]}
						aria-pressed={selected === index}
						aria-controls={`${id}-field-detail`}
						onclick={() => (selected = index)}
					>
						<span class="field-dot" aria-hidden="true"></span>
						<span>{item.name}</span>
						<span class="field-check"
							><PatternIcon name={selected === index ? 'check' : 'arrowRight'} size={17} /></span
						>
					</button>
				{/each}
			</div>
			<div
				class={`atlas-explanation tone-${level.color}`}
				id={`${id}-field-detail`}
				aria-live="polite"
				aria-atomic="true"
			>
				{#key selected}
					<div class="atlas-detail-content">
						<h3>{level.idea}</h3>
						<p>{level.detail}</p>
						<div class="atlas-example">
							<PatternIcon name="idea" size={18} /><span>{level.example}</span>
						</div>
					</div>
				{/key}
			</div>
		</div>
	</div>

	<div class="atlas-dimensions">
		<p class="dimension-intro">These words describe different dimensions.</p>
		<div class="dimension-choices" role="group" aria-label="Other ways to describe a model">
			{#each facets as item, index (item.key)}
				<button
					class={[
						'dimension-choice',
						`tone-${['lavender', 'blue', 'amber'][index]}`,
						{ 'dimension-selected': facet === item.key }
					]}
					aria-pressed={facet === item.key}
					aria-controls={`${id}-dimension-detail`}
					onclick={() => (facet = item.key)}
				>
					<span class="dimension-symbol"><PatternIcon name={item.icon} size={23} /></span>
					<span class="dimension-label"
						><strong>{item.name}</strong><small>{item.question}</small></span
					>
				</button>
			{/each}
		</div>
		<div
			class="dimension-description"
			id={`${id}-dimension-detail`}
			aria-live="polite"
			aria-atomic="true"
		>
			{#key facet}<p>{dimension.text}</p>{/key}
		</div>
	</div>
</section>

<style>
	.ai-atlas {
		--atlas-muted: var(--muted);
		--atlas-text: var(--ink);
		--atlas-blue: var(--blue);
		--atlas-sage: var(--periwinkle);
		--atlas-lavender: var(--lavender);
		--atlas-amber: var(--orange);
		--atlas-surface: var(--lab-card);
		--atlas-soft: var(--lab-inset);
		color: var(--atlas-text);
		background:
			radial-gradient(ellipse at 18% 26%, #6975990b, transparent 55%), var(--atlas-surface);
		border-radius: 28px;
		padding: clamp(22px, 3.2vw, 40px);
		container-type: inline-size;
	}
	.tone-blue {
		--field-color: var(--atlas-blue);
	}
	.tone-sage {
		--field-color: var(--atlas-sage);
	}
	.tone-lavender {
		--field-color: var(--atlas-lavender);
	}
	.tone-amber {
		--field-color: var(--atlas-amber);
	}
	.atlas-main {
		display: grid;
		grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr);
		align-items: center;
		gap: clamp(24px, 4vw, 64px);
	}
	.atlas-figure {
		margin: 0;
		min-width: 0;
	}
	.atlas-orbits {
		display: block;
		width: 100%;
		max-width: 480px;
		margin-inline: auto;
		overflow: visible;
	}
	.atlas-tint {
		stop-color: var(--field-color);
	}
	.atlas-orbit {
		cursor: pointer;
		outline: none;
	}
	.orbit-body {
		transition: filter 280ms ease;
	}
	.orbit-rim {
		fill: none;
		stroke: var(--field-color);
		stroke-width: 1;
		stroke-opacity: 0.45;
		transition:
			stroke-width 220ms ease,
			stroke-opacity 220ms ease;
	}
	.orbit-sheen {
		pointer-events: none;
	}
	.orbit-selected .orbit-rim {
		stroke-width: 2;
		stroke-opacity: 0.95;
	}
	.atlas-orbit:hover .orbit-body {
		filter: brightness(1.13);
	}
	.atlas-orbit:focus-visible .orbit-rim {
		stroke-width: 3;
		stroke-dasharray: 5 5;
		stroke-opacity: 1;
	}
	.orbit-label {
		fill: var(--atlas-text);
		font-size: 19px;
		font-weight: 500;
		letter-spacing: -0.3px;
		pointer-events: none;
	}
	.orbit-selected .orbit-label {
		font-weight: 650;
	}
	.atlas-figure figcaption {
		margin-top: 2px;
		color: var(--atlas-muted);
		font-size: 12px;
		text-align: center;
		line-height: 1.5;
	}
	.atlas-reading {
		min-width: 0;
	}
	.atlas-fields {
		display: grid;
		gap: 5px;
	}
	.atlas-field {
		display: flex;
		align-items: center;
		gap: 13px;
		min-height: 46px;
		width: 100%;
		padding: 11px 14px;
		border: 0;
		border-radius: 12px;
		background: transparent;
		font-size: 16px;
		line-height: 1.4;
		text-align: left;
		color: var(--atlas-muted);
	}
	.atlas-field:hover {
		color: var(--atlas-text);
		background: var(--atlas-soft);
	}
	.atlas-field.field-selected {
		color: var(--atlas-text);
		background: color-mix(in srgb, var(--field-color) 12%, transparent);
	}
	.field-dot {
		width: 12px;
		height: 12px;
		flex: 0 0 auto;
		border-radius: 50%;
		background: color-mix(in srgb, var(--field-color) 28%, var(--atlas-surface));
		box-shadow: inset 0 0 0 1.5px var(--field-color);
		transition:
			background 200ms ease,
			box-shadow 200ms ease;
	}
	.field-selected .field-dot {
		background: var(--field-color);
		box-shadow: 0 0 14px color-mix(in srgb, var(--field-color) 18%, transparent);
	}
	.field-check {
		display: flex;
		color: var(--field-color);
		margin-left: auto;
		opacity: 0;
	}
	.atlas-field:hover .field-check,
	.field-selected .field-check {
		opacity: 1;
	}
	.atlas-field:focus-visible,
	.dimension-choice:focus-visible {
		outline: 2px solid var(--field-color);
		outline-offset: 3px;
	}
	.atlas-explanation {
		min-height: 217px;
		padding: 28px 14px 0;
	}
	.atlas-detail-content h3 {
		margin: 0;
		font-family: var(--serif);
		font-style: italic;
		font-weight: 400;
		font-size: clamp(27px, 2.2vw, 34px);
		line-height: 1.18;
		text-wrap: balance;
	}
	.atlas-detail-content > p {
		margin: 14px 0 0;
		color: var(--atlas-muted);
		font-size: 14px;
		line-height: 1.7;
	}
	.atlas-example {
		display: flex;
		gap: 10px;
		align-items: flex-start;
		margin-top: 17px;
		color: var(--field-color);
		font-size: 13px;
		line-height: 1.6;
	}
	.atlas-example :global(svg) {
		flex: 0 0 auto;
		margin-top: 1px;
	}
	.atlas-dimensions {
		margin-top: clamp(26px, 3vw, 32px);
	}
	.dimension-intro {
		margin: 0 0 16px;
		font-size: 13px;
		color: var(--atlas-muted);
	}
	.dimension-choices {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 12px;
	}
	.dimension-choice {
		display: flex;
		align-items: center;
		gap: 13px;
		min-height: 78px;
		padding: 16px 20px;
		border: 0;
		border-radius: 16px;
		background: color-mix(in srgb, var(--atlas-soft) 65%, transparent);
		text-align: left;
	}
	.dimension-choice:hover {
		background: var(--atlas-soft);
	}
	.dimension-choice.dimension-selected {
		background: color-mix(in srgb, var(--field-color) 12%, var(--atlas-soft));
	}
	.dimension-symbol {
		display: flex;
		color: var(--field-color);
	}
	.dimension-label {
		display: grid;
		gap: 5px;
	}
	.dimension-label strong {
		color: var(--atlas-text);
		font-size: 15px;
		font-weight: 500;
	}
	.dimension-label small {
		color: var(--atlas-muted);
		font-size: 12px;
	}
	.dimension-description {
		min-height: 48px;
		padding-top: 16px;
		max-width: 840px;
	}
	.dimension-description p {
		margin: 0;
		color: var(--atlas-muted);
		font-size: 14px;
		line-height: 1.7;
	}
	.atlas-detail-content,
	.dimension-description p {
		animation: atlas-arrive 220ms ease-out;
	}
	@keyframes atlas-arrive {
		from {
			opacity: 0;
			transform: translateY(4px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
	@container (max-width: 700px) {
		.atlas-main {
			grid-template-columns: 1fr;
			gap: 28px;
		}
		.atlas-figure {
			max-width: 450px;
			width: 100%;
			margin-inline: auto;
		}
		.atlas-reading {
			display: grid;
			grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr);
			gap: 22px;
			align-items: start;
		}
		.atlas-explanation {
			padding: 7px 0 0;
			min-height: 240px;
		}
		.atlas-field {
			font-size: 14px;
			padding-inline: 10px;
		}
		.dimension-choice {
			padding: 14px;
			gap: 10px;
		}
	}
	@container (max-width: 490px) {
		.atlas-main {
			gap: 24px;
		}
		.atlas-reading {
			display: block;
		}
		.atlas-fields {
			grid-template-columns: repeat(2, minmax(0, 1fr));
			gap: 7px;
		}
		.atlas-field {
			align-items: center;
			gap: 9px;
			padding: 11px 10px;
			min-height: 61px;
			font-size: 13px;
		}
		.field-dot {
			width: 10px;
			height: 10px;
		}
		.field-check {
			display: none;
		}
		.atlas-explanation {
			padding: 24px 3px 0;
			min-height: 237px;
		}
		.atlas-detail-content h3 {
			font-size: 29px;
		}
		.atlas-detail-content > p {
			font-size: 14px;
		}
		.atlas-figure figcaption {
			font-size: 10px;
		}
		.dimension-intro {
			font-size: 12px;
		}
		.dimension-choices {
			gap: 7px;
		}
		.dimension-choice {
			flex-direction: column;
			align-items: flex-start;
			gap: 11px;
			padding: 13px 10px;
			min-height: 105px;
			border-radius: 12px;
		}
		.dimension-label strong {
			font-size: 12px;
		}
		.dimension-label small {
			font-size: 10px;
			line-height: 1.4;
		}
		.dimension-description {
			min-height: 110px;
		}
	}
	@media (max-width: 480px) {
		.ai-atlas {
			padding: 20px 16px 23px;
			border-radius: 22px;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.atlas-detail-content,
		.dimension-description p {
			animation: none;
		}
		.orbit-body,
		.orbit-rim,
		.field-dot {
			transition: none;
		}
	}
</style>
