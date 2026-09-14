<script lang="ts">
	import { asset } from '$app/paths';
	import { fade } from 'svelte/transition';
	import { prefersReducedMotion } from 'svelte/motion';
	import PatternIcon from '$lib/components/PatternIcon.svelte';

	let selected = $state(0);
	let reused = $state(false);
	const sets = [
		{
			name: 'Training',
			purpose: 'Learn the weights',
			tone: 'sage',
			detail:
				'Practice with answers. The model sees its mistakes and changes its weights to make better predictions.'
		},
		{
			name: 'Validation',
			purpose: 'Choose the settings',
			tone: 'lavender',
			detail:
				'A rehearsal exam. Compare model sizes, settings, or stopping points. These examples do not directly update the weights.'
		},
		{
			name: 'Test',
			purpose: 'Evaluate the final model',
			tone: 'amber',
			detail:
				'A final exam with new questions. Once your choices are fixed, estimate how well the model handles unseen examples.'
		}
	];
</script>

<section class="data-partition" aria-labelledby="partition-title">
	<header class="partition-heading">
		<h2 id="partition-title">Three sets. <em>Three jobs.</em></h2>
		<p>
			A model can memorize its examples. Fresh examples reveal whether it learned a pattern that
			works elsewhere.
		</p>
	</header>

	<div class="partition-composition">
		<figure class="partition-figure">
			<img
				src={`${asset('/images/edition-2/data-split.webp')}?v=3`}
				alt="Blue training tray, lavender validation tray, and apricot test tray with a glass lid, each holding its own examples."
				width="1672"
				height="735"
				loading="lazy"
			/>
			<figcaption>Separate the data before training begins.</figcaption>
		</figure>

		<div class="partition-guide">
			<div class="partition-choices" role="group" aria-label="The purpose of each data set">
				{#each sets as set, i (set.name)}
					<button
						type="button"
						class="partition-choice partition-{set.tone}"
						aria-pressed={selected === i}
						aria-controls="partition-explanation"
						onclick={() => (selected = i)}
					>
						<span class="partition-number">0{i + 1}</span>
						<span class="partition-purpose"
							><strong>{set.name}</strong><span>{set.purpose}</span></span
						>
						<span class="partition-symbol"
							><PatternIcon name={i === 2 ? 'lock' : 'arrowRight'} size={17} /></span
						>
					</button>
				{/each}
			</div>

			<div id="partition-explanation" class="partition-explanation" role="status">
				{#each sets as set, i (set.name)}
					<p class:partition-current={selected === i} aria-hidden={selected !== i}>
						{set.detail}
					</p>
				{/each}
			</div>

			<div class="partition-question" class:partition-reused={reused}>
				<label>
					<input type="checkbox" bind:checked={reused} aria-describedby="partition-leak-answer" />
					<span>What if test scores help me choose?</span>
				</label>
				<div id="partition-leak-answer" class="partition-answer" role="status">
					{#key reused}
						<p in:fade={{ duration: prefersReducedMotion.current ? 0 : 180 }}>
							{#if reused}
								<strong>That makes it validation.</strong> The score is no longer an independent check.
								You need fresh, untouched test examples.
							{:else}
								Keep the test set out of model selection. It gives you an independent check of how
								well your final model generalizes.
							{/if}
						</p>
					{/key}
				</div>
			</div>
		</div>
	</div>
	<p class="partition-demo-note">
		In these demos, all three sets are visible so you can inspect the errors. In a real project,
		keep the final test separate from model selection.
	</p>
</section>

<style>
	.data-partition {
		margin-top: 44px;
		scroll-margin-top: 96px;
	}
	.partition-heading,
	.partition-composition {
		display: grid;
		grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
		gap: clamp(24px, 2.5vw, 36px);
	}
	.partition-heading {
		align-items: end;
		margin-bottom: 24px;
	}
	.partition-heading h2 {
		margin: 0;
		font-size: clamp(30px, 3.1vw, 44px);
		font-weight: 440;
		line-height: 1.1;
		letter-spacing: -0.045em;
		text-wrap: balance;
	}
	.partition-heading em {
		font-family: var(--serif);
		font-weight: 400;
		color: var(--green);
	}
	.partition-heading p {
		margin: 0;
		color: var(--muted);
		font-size: 13px;
		line-height: 1.7;
		max-width: 47ch;
	}
	.partition-composition {
		align-items: center;
	}
	.partition-figure {
		min-width: 0;
		margin: 0;
	}
	.partition-figure img {
		display: block;
		width: 100%;
		height: auto;
		object-fit: contain;
		border-radius: 20px;
		background: transparent;
	}
	.partition-figure figcaption {
		margin-top: 12px;
		color: var(--quiet);
		font-size: 12px;
		line-height: 1.5;
	}
	.partition-guide {
		min-width: 0;
	}
	.partition-choices {
		display: grid;
		gap: 5px;
	}
	.partition-choice {
		display: grid;
		grid-template-columns: 34px minmax(0, 1fr) 18px;
		align-items: center;
		gap: 12px;
		width: 100%;
		min-height: 64px;
		padding: 10px 12px;
		border: 0;
		border-radius: 12px;
		background: transparent;
		text-align: left;
		transition: background 180ms ease;
	}
	.partition-sage {
		--partition-accent: var(--chart-blue);
	}
	.partition-lavender {
		--partition-accent: #b098c1;
	}
	.partition-amber {
		--partition-accent: #c99343;
	}
	.partition-choice:hover {
		background: color-mix(in srgb, var(--partition-accent) 7%, transparent);
	}
	.partition-choice[aria-pressed='true'] {
		background: color-mix(in srgb, var(--partition-accent) 13%, transparent);
	}
	.partition-choice:focus-visible {
		outline: 2px solid var(--partition-accent);
		outline-offset: 3px;
	}
	.partition-number {
		display: grid;
		place-items: center;
		width: 34px;
		height: 34px;
		border-radius: 50%;
		font: 11px var(--mono);
		color: var(--ink);
		background: color-mix(in srgb, var(--partition-accent) 23%, transparent);
	}
	.partition-purpose {
		display: grid;
		gap: 2px;
	}
	.partition-purpose strong {
		font-size: 14px;
		font-weight: 550;
		line-height: 1.45;
	}
	.partition-purpose > span {
		font-size: 12px;
		color: var(--muted);
		line-height: 1.5;
	}
	.partition-symbol {
		display: flex;
		color: var(--partition-accent);
		opacity: 0.45;
		transition: opacity 180ms ease;
	}
	.partition-choice[aria-pressed='true'] .partition-symbol {
		opacity: 1;
	}
	.partition-explanation {
		display: grid;
		margin: 16px 12px 20px;
	}
	.partition-explanation p {
		grid-area: 1 / 1;
		margin: 0;
		font-size: 13px;
		line-height: 1.75;
		color: var(--muted);
		visibility: hidden;
		opacity: 0;
		transition: opacity 180ms ease;
	}
	.partition-explanation p.partition-current {
		visibility: visible;
		opacity: 1;
	}
	.partition-question {
		padding: 15px 16px;
		border-radius: 14px;
		background: var(--surface);
		transition: background 180ms ease;
	}
	.partition-question.partition-reused {
		background: color-mix(in srgb, #c99343 10%, var(--surface));
	}
	.partition-question label {
		display: flex;
		align-items: flex-start;
		gap: 10px;
		font-size: 12px;
		font-weight: 550;
		line-height: 1.6;
		cursor: pointer;
	}
	.partition-question input {
		width: 15px;
		height: 15px;
		margin: 2px 0 0;
		flex-shrink: 0;
		accent-color: #b78743;
	}
	.partition-question input:focus-visible {
		outline: 2px solid #b78743;
		outline-offset: 3px;
	}
	.partition-answer {
		margin: 9px 0 0 25px;
		min-height: 5.1em;
		font-size: 12px;
		line-height: 1.7;
		color: var(--muted);
	}
	.partition-answer p {
		margin: 0;
	}
	.partition-answer strong {
		font-weight: 550;
		color: var(--ink);
	}
	.partition-demo-note {
		margin: 22px 0 0;
		max-width: 95ch;
		color: var(--quiet);
		font-size: 11px;
		line-height: 1.7;
	}
	@media (max-width: 900px) {
		.partition-heading,
		.partition-composition {
			grid-template-columns: 1fr;
			gap: 20px;
		}
		.partition-heading {
			gap: 12px;
			margin-bottom: 20px;
		}
		.partition-heading p {
			max-width: 65ch;
		}
		.partition-composition {
			align-items: start;
		}
		.partition-guide {
			display: grid;
			grid-template-columns: 1fr 1fr;
			gap: 16px 24px;
		}
		.partition-choices {
			grid-row: span 2;
		}
		.partition-explanation {
			margin: 0;
			align-self: center;
		}
	}
	@media (max-width: 560px) {
		.data-partition {
			margin-top: 32px;
		}
		.partition-heading h2 {
			font-size: 32px;
		}
		.partition-figure img {
			border-radius: 16px;
		}
		.partition-figure figcaption {
			margin-top: 10px;
			font-size: 11px;
		}
		.partition-guide {
			display: block;
		}
		.partition-explanation {
			margin: 14px 12px 18px;
		}
		.partition-demo-note {
			margin-top: 18px;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.partition-choice,
		.partition-symbol,
		.partition-explanation p,
		.partition-question {
			transition: none;
		}
	}
</style>
