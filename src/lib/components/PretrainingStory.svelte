<script lang="ts">
	import { asset } from '$app/paths';
	import PatternIcon from '$lib/components/PatternIcon.svelte';
	import type { PatternIconName } from '$lib/data/icons';

	const id = $props.id();
	const photo = asset('/images/caption-garden.webp');
	const puzzles = [
		{
			key: 'compress',
			name: 'Compress',
			shortName: 'Compress',
			icon: 'layers',
			instruction: 'Keep enough information to rebuild the image.',
			target: 'Original image',
			explanation:
				'The image is both the input and the reconstruction target. A small code makes the model choose what to preserve.'
		},
		{
			key: 'patch',
			name: 'Hide a patch',
			shortName: 'Mask',
			icon: 'grid',
			instruction: 'Use the visible picture to predict the missing pixels.',
			target: 'Hidden pixels',
			explanation:
				'The hidden pixels were saved from the original image. They supply the target for the model’s prediction.'
		},
		{
			key: 'next',
			name: 'Predict what follows',
			shortName: 'Next token',
			icon: 'language',
			instruction: 'Use the tokens so far to predict the next one.',
			target: 'Next token',
			explanation:
				'In this passage, the next token is “ ball”. The text itself supplies the target; many other continuations would also make sense.'
		}
	] as const satisfies readonly {
		key: string;
		name: string;
		shortName: string;
		icon: PatternIconName;
		instruction: string;
		target: string;
		explanation: string;
	}[];
	let choice = $state<'compress' | 'patch' | 'next'>('patch');
	let revealed = $state(false);
	const puzzle = $derived(puzzles.find((item) => item.key === choice)!);
	function choose(value: typeof choice) {
		if (choice === value) return;
		choice = value;
		revealed = false;
	}
</script>

<section class="pretraining-story" aria-label="From experience to self-supervised pretraining">
	<div class="experience-bridge">
		<h3>Experience arrives <br />before labels.</h3>
		<p>
			Babies encounter sights, sounds, and movement before every experience has a name.
			Self-supervision shares the idea of learning from experience. An autoencoder is a mathematical
			illustration, not an explanation of how a baby’s brain learns.
		</p>
	</div>

	<div class="puzzle-studio">
		<div class="puzzle-choices" role="group" aria-label="Choose a self-supervision puzzle">
			{#each puzzles as item (item.key)}
				<button
					class={['puzzle-choice', { 'puzzle-active': choice === item.key }]}
					aria-pressed={choice === item.key}
					aria-label={item.name}
					aria-controls={`${id}-puzzle`}
					onclick={() => choose(item.key)}
					><PatternIcon name={item.icon} size={20} /><span class="puzzle-name">{item.name}</span
					><span class="puzzle-short" aria-hidden="true">{item.shortName}</span></button
				>
			{/each}
		</div>

		<div class="puzzle-example" id={`${id}-puzzle`}>
			<div class="puzzle-instruction">
				<h4>{puzzle.instruction}</h4>
				<span>The data already contains the answer.</span>
			</div>
			<div class="puzzle-scene">
				<div class="puzzle-source">
					<span class="puzzle-label">{choice === 'next' ? 'Earlier tokens' : 'Input image'}</span>
					{#if choice === 'next'}
						<div class="passage" aria-label="Earlier text: The dog chased the">
							<span>The dog<br />chased the</span><i aria-hidden="true"></i>
						</div>
					{:else}
						<svg
							class="puzzle-photo"
							viewBox="0 0 480 320"
							role="img"
							aria-label={choice === 'patch'
								? 'A garden scene with a square region hidden'
								: 'A dog with a ball in a garden'}
						>
							<image href={photo} x="0" y="0" width="480" height="320" />
							{#if choice === 'patch'}<rect
									x="144"
									y="48"
									width="96"
									height="96"
									class="missing-patch"
								/><path d="M 181 96 H 203 M 192 85 V 107" class="patch-mark" />{/if}
						</svg>
					{/if}
				</div>

				<div class="puzzle-connection" aria-hidden="true">
					{#if choice === 'compress'}
						<svg viewBox="0 0 104 100"
							><path
								class="code-flow"
								d="M 2 16 C 46 16 33 41 51 41 C 71 41 59 16 102 16 L 102 84 C 59 84 71 59 51 59 C 33 59 46 84 2 84 Z"
							/><path
								class="code-guide"
								d="M 2 16 C 46 16 33 41 51 41 C 71 41 59 16 102 16 M 2 84 C 46 84 33 59 51 59 C 71 59 46 84 102 84"
							/><circle cx="51" cy="45" r="3" /><circle cx="51" cy="56" r="3" /></svg
						><small>Small code</small>
					{:else}<PatternIcon name="arrowRight" size={26} />{/if}
				</div>

				<div class="puzzle-target">
					<span class="puzzle-label">{puzzle.target}</span>
					<button
						class={[
							'target-reveal',
							{ 'target-open': revealed, 'target-patch': choice === 'patch' }
						]}
						aria-label={`${revealed ? 'Hide' : 'Reveal'} ${puzzle.target.toLowerCase()} target`}
						aria-expanded={revealed}
						aria-controls={`${id}-target-explanation`}
						onclick={() => (revealed = !revealed)}
					>
						{#if revealed}
							{#if choice === 'next'}<span class="next-token">ball</span>
							{:else if choice === 'patch'}<svg
									viewBox="144 48 96 96"
									role="img"
									aria-label="The exact hidden region from the original image"
									><image href={photo} x="0" y="0" width="480" height="320" /></svg
								>
							{:else}<img src={photo} alt="The complete original garden scene" />{/if}
						{:else}<PatternIcon name="eye" size={25} /><span>Reveal target</span>{/if}
					</button>
				</div>
			</div>
			<p class="puzzle-answer" id={`${id}-target-explanation`} aria-live="polite">
				{revealed
					? puzzle.explanation
					: 'Where could a training target come from without anyone assigning a category?'}
			</p>
			<p class="puzzle-caption">
				A conceptual illustration. Reveal displays the saved training target.
			</p>
		</div>
	</div>

	<div class="pretraining-transfer">
		<div class="transfer-explanation">
			<h4>Keep what the model learned.</h4>
			<p>
				Solving these puzzles can teach useful features and patterns. This first stage is <strong
					>pretraining</strong
				>. Keep the learned weights, then adapt them for a later task.
			</p>
		</div>
		<div
			class="transfer-path"
			aria-label="Examples lead to pretrained weights, which can be adapted for new tasks"
		>
			<div class="transfer-step">
				<span class="transfer-orb data-orb"><PatternIcon name="database" size={24} /></span><span
					>Examples</span
				><small>Images or text</small>
			</div>
			<div class="transfer-arrow" aria-hidden="true">
				<small>Pretrain</small><PatternIcon name="arrowRight" size={17} />
			</div>
			<div class="transfer-step">
				<span class="transfer-orb weight-orb"><PatternIcon name="layers" size={24} /></span><span
					>Learned weights</span
				><small>Reusable patterns</small>
			</div>
			<div class="transfer-arrow" aria-hidden="true">
				<small>Adapt</small><PatternIcon name="arrowRight" size={17} />
			</div>
			<div class="transfer-step">
				<span class="transfer-orb task-orb"><PatternIcon name="generalization" size={24} /></span
				><span>New tasks</span><small>Recognize, retrieve…</small>
			</div>
		</div>
	</div>
</section>

<style>
	.puzzle-short {
		display: none;
	}
	@media (max-width: 680px) {
		.puzzle-name {
			display: none;
		}
		.puzzle-short {
			display: inline;
		}
		.puzzle-choices .puzzle-choice {
			flex-direction: row;
			gap: 5px;
			min-height: 44px;
			padding: 9px 6px;
		}
		.puzzle-choice :global(svg) {
			width: 15px;
			height: 15px;
		}
	}
	.pretraining-story {
		--story-ink: var(--ink);
		--story-muted: var(--muted);
		--story-blue: var(--blue);
		--story-lavender: var(--lavender);
		--story-card: var(--lab-card);
		--story-inset: var(--lab-inset);
		--story-sage: var(--blue);
		margin-top: 40px;
		color: var(--story-ink);
		container-type: inline-size;
	}
	.experience-bridge {
		display: grid;
		grid-template-columns: minmax(220px, 0.8fr) minmax(0, 1.4fr);
		gap: 44px;
		align-items: center;
		margin: 0 16px 30px;
	}
	.experience-bridge h3 {
		font-family: var(--serif);
		font-style: italic;
		font-size: clamp(31px, 3vw, 40px);
		line-height: 1.15;
		font-weight: 400;
		margin: 0;
	}
	.experience-bridge p {
		font-size: 14px;
		color: var(--story-muted);
		line-height: 1.8;
		margin: 0;
		max-width: 720px;
	}
	.puzzle-studio {
		background: var(--story-card);
		border-radius: 24px;
		padding: clamp(22px, 2.6vw, 30px);
	}
	.puzzle-choices {
		display: flex;
		gap: 10px;
	}
	.puzzle-choice {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 10px;
		border: 0;
		border-radius: 12px;
		min-height: 46px;
		padding: 12px 17px;
		background: transparent;
		color: var(--story-muted);
		font-size: 13px;
	}
	.puzzle-choice:hover {
		background: var(--story-inset);
		color: var(--story-ink);
	}
	.puzzle-choice.puzzle-active {
		background: color-mix(in srgb, var(--story-lavender) 14%, var(--story-inset));
		color: var(--story-lavender);
	}
	.pretraining-story button:focus-visible {
		outline: 2px solid var(--focus);
		outline-offset: 4px;
	}
	.puzzle-example {
		margin-top: 26px;
	}
	.puzzle-instruction {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 24px;
	}
	.puzzle-instruction h4 {
		margin: 0;
		font-size: 18px;
		line-height: 1.45;
		font-weight: 450;
	}
	.puzzle-instruction > span {
		font-size: 11px;
		line-height: 1.5;
		color: var(--story-muted);
	}
	.puzzle-scene {
		display: grid;
		grid-template-columns: minmax(0, 1.35fr) minmax(60px, 0.4fr) minmax(0, 0.8fr);
		max-width: 700px;
		margin: 26px auto 0;
		align-items: center;
		gap: 18px;
	}
	.puzzle-label {
		display: block;
		color: var(--story-muted);
		font-size: 11px;
		margin-bottom: 11px;
	}
	.puzzle-photo {
		display: block;
		width: 100%;
		aspect-ratio: 1.5;
		border-radius: 15px;
		overflow: hidden;
	}
	.missing-patch {
		fill: #bab0df;
		stroke: #e4dbff;
		stroke-width: 1.5;
	}
	.patch-mark {
		stroke: #4c416e;
		stroke-width: 2;
		stroke-linecap: round;
		fill: none;
	}
	.puzzle-connection {
		display: grid;
		justify-items: center;
		color: var(--story-lavender);
		padding-top: 24px;
	}
	.puzzle-connection > svg {
		width: 100%;
		max-width: 100px;
		height: auto;
	}
	.puzzle-connection small {
		font-size: 10px;
		margin-top: 7px;
		white-space: nowrap;
		color: var(--story-muted);
	}
	.code-flow {
		fill: var(--story-lavender);
		opacity: 0.08;
	}
	.code-guide {
		fill: none;
		stroke: var(--story-lavender);
		opacity: 0.38;
		stroke-width: 1.2;
	}
	.puzzle-connection circle {
		fill: var(--story-lavender);
	}
	.puzzle-target {
		min-width: 0;
	}
	.target-reveal {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 13px;
		padding: 0;
		width: 100%;
		aspect-ratio: 1.2;
		max-height: 210px;
		border: 0;
		border-radius: 15px;
		overflow: hidden;
		color: var(--story-lavender);
		background:
			radial-gradient(
				circle at 30% 30%,
				color-mix(in srgb, var(--story-lavender) 8%, transparent),
				transparent 75%
			),
			var(--story-inset);
	}
	.target-reveal > span {
		font-size: 12px;
	}
	.target-reveal:hover {
		background-color: color-mix(in srgb, var(--story-lavender) 8%, var(--story-inset));
	}
	.target-reveal.target-open {
		background: var(--story-inset);
	}
	.target-reveal img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: contain;
	}
	.target-reveal > svg {
		display: block;
		width: 100%;
		height: 100%;
	}
	.target-reveal.target-patch {
		aspect-ratio: 1;
		max-width: 190px;
	}
	.target-reveal .next-token {
		font-family: var(--serif);
		font-style: italic;
		font-size: clamp(35px, 4vw, 54px);
		color: var(--story-blue);
	}
	.passage {
		background:
			radial-gradient(
				ellipse at 80% 10%,
				color-mix(in srgb, var(--story-blue) 9%, transparent),
				transparent 75%
			),
			var(--story-inset);
		aspect-ratio: 1.5;
		padding: 25px;
		display: flex;
		align-items: center;
		gap: 15px;
		border-radius: 15px;
	}
	.passage > span {
		font-family: var(--serif);
		font-style: italic;
		font-size: clamp(26px, 3.3vw, 44px);
		line-height: 1.18;
	}
	.passage i {
		align-self: center;
		width: 24px;
		height: 2px;
		background: var(--story-blue);
		opacity: 0.6;
	}
	.puzzle-answer {
		margin: 24px auto 0;
		max-width: 700px;
		min-height: 44px;
		font-size: 13px;
		line-height: 1.7;
		color: var(--story-ink);
	}
	.puzzle-caption {
		margin: 8px auto 0;
		max-width: 700px;
		color: var(--story-muted);
		font-size: 10px;
		line-height: 1.7;
	}
	.pretraining-transfer {
		display: grid;
		grid-template-columns: minmax(0, 0.85fr) minmax(0, 1.2fr);
		align-items: center;
		gap: 52px;
		padding: 30px 16px 0;
	}
	.transfer-explanation h4 {
		font-family: var(--serif);
		font-style: italic;
		font-size: 29px;
		font-weight: 400;
		line-height: 1.2;
		margin: 0;
	}
	.transfer-explanation p {
		font-size: 13px;
		line-height: 1.8;
		color: var(--story-muted);
		margin: 12px 0 0;
	}
	.transfer-explanation strong {
		color: var(--story-ink);
		font-weight: 500;
	}
	.transfer-path {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 37px minmax(0, 1fr) 37px minmax(0, 1fr);
		align-items: center;
		gap: 10px;
	}
	.transfer-step {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		gap: 9px;
		min-width: 0;
	}
	.transfer-orb {
		display: grid;
		place-items: center;
		width: 57px;
		height: 57px;
		border-radius: 50%;
	}
	.data-orb {
		color: var(--story-blue);
		background: color-mix(in srgb, var(--story-blue) 11%, var(--story-inset));
	}
	.weight-orb {
		color: var(--story-lavender);
		background: color-mix(in srgb, var(--story-lavender) 13%, var(--story-inset));
	}
	.task-orb {
		color: var(--story-sage);
		background: color-mix(in srgb, var(--story-sage) 12%, var(--story-inset));
	}
	.transfer-step > span:not(.transfer-orb) {
		font-size: 12px;
		line-height: 1.4;
	}
	.transfer-step > small {
		font-size: 10px;
		color: var(--story-muted);
		line-height: 1.5;
	}
	.transfer-arrow {
		display: grid;
		justify-items: center;
		gap: 5px;
		margin-top: -34px;
		color: var(--story-muted);
	}
	.transfer-arrow > small {
		font-size: 9px;
	}
	@container (max-width: 800px) {
		.experience-bridge {
			grid-template-columns: 1fr 1.5fr;
			gap: 25px;
		}
		.experience-bridge h3 {
			font-size: 33px;
		}
		.experience-bridge p {
			font-size: 13px;
		}
		.puzzle-instruction {
			display: block;
		}
		.puzzle-instruction > span {
			display: block;
			margin-top: 7px;
		}
		.pretraining-transfer {
			grid-template-columns: 1fr;
			gap: 28px;
		}
		.transfer-path {
			max-width: 580px;
		}
	}
	@container (max-width: 550px) {
		.experience-bridge {
			display: block;
			margin-inline: 4px;
		}
		.experience-bridge h3 {
			font-size: 32px;
		}
		.experience-bridge h3 br {
			display: none;
		}
		.experience-bridge p {
			margin-top: 14px;
			line-height: 1.75;
		}
		.puzzle-studio {
			padding: 20px 16px;
			border-radius: 20px;
		}
		.puzzle-choices {
			display: grid;
			grid-template-columns: 1fr 1fr 1.2fr;
			gap: 5px;
		}
		.puzzle-choice {
			flex-direction: column;
			gap: 8px;
			padding: 12px 5px;
			font-size: 11px;
			line-height: 1.4;
			min-height: 75px;
		}
		.puzzle-instruction h4 {
			font-size: 16px;
		}
		.puzzle-scene {
			grid-template-columns: minmax(0, 1.35fr) 32px minmax(0, 0.85fr);
			gap: 9px;
			margin-top: 22px;
		}
		.puzzle-label {
			font-size: 9px;
		}
		.puzzle-photo,
		.target-reveal,
		.passage {
			border-radius: 10px;
		}
		.target-reveal {
			min-height: 94px;
		}
		.target-reveal > span {
			font-size: 10px;
			line-height: 1.4;
		}
		.target-reveal :global(svg[data-slot='hugeicons']) {
			width: 20px;
		}
		.puzzle-connection small {
			display: block;
			font-size: 8px;
			text-align: center;
			white-space: normal;
		}
		.puzzle-connection > svg {
			min-width: 28px;
		}
		.puzzle-connection {
			padding-top: 18px;
		}
		.passage {
			padding: 15px 10px;
			min-height: 94px;
		}
		.passage > span {
			font-size: 24px;
		}
		.passage i {
			display: none;
		}
		.target-reveal .next-token {
			font-size: 34px;
		}
		.puzzle-answer {
			font-size: 12px;
			min-height: 63px;
			margin-top: 20px;
		}
		.puzzle-caption {
			font-size: 9px;
		}
		.pretraining-transfer {
			padding: 26px 4px 0;
			gap: 23px;
		}
		.transfer-explanation h4 {
			font-size: 29px;
		}
		.transfer-path {
			gap: 5px;
			grid-template-columns: minmax(0, 1fr) 27px minmax(0, 1fr) 27px minmax(0, 1fr);
		}
		.transfer-step > span:not(.transfer-orb) {
			font-size: 10px;
		}
		.transfer-step > small {
			font-size: 8px;
		}
		.transfer-arrow > small {
			font-size: 8px;
		}
		.transfer-orb {
			width: 48px;
			height: 48px;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.pretraining-story button {
			transition: none;
		}
	}
</style>
