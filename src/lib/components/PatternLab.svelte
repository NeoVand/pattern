<script lang="ts">
	import { fade } from 'svelte/transition';
	import { prefersReducedMotion } from 'svelte/motion';
	import PatternIcon from '$lib/components/PatternIcon.svelte';
	import type { AiSession } from '$lib/ai/session.svelte';
	import SortingLab from './SortingLab.svelte';
	import ImageClassifier from './ImageClassifier.svelte';
	import SpeechLab from './SpeechLab.svelte';
	import type { PatternIconName } from '$lib/data/icons';
	import CaptionLab from './CaptionLab.svelte';
	let { ai }: { ai: AiSession } = $props();
	let stage = $state(0);
	const stages: { name: string; kind: string; short: string; icon: PatternIconName }[] = [
		{ name: 'Put numbers in order', kind: 'An explicit algorithm', short: 'Sort', icon: 'sort' },
		{
			name: 'Recognize an image',
			kind: 'A learned classifier',
			short: 'Classify',
			icon: 'classification'
		},
		{
			name: 'Describe what you see',
			kind: 'Images become language',
			short: 'Caption',
			icon: 'vision'
		},
		{ name: 'Give words a voice', kind: 'Language becomes sound', short: 'Speak', icon: 'audio' }
	];
	function choose(next: number) {
		stage = next;
		requestAnimationFrame(() =>
			document.getElementById('problem-sequence')?.scrollIntoView({
				block: 'start',
				behavior: prefersReducedMotion.current ? 'instant' : 'smooth'
			})
		);
	}
</script>

<div class="problem-sequence" id="problem-sequence">
	<nav class="problem-tabs" aria-label="Four kinds of problems">
		{#each stages as item, i (item.name)}<button
				class:active={stage === i}
				aria-pressed={stage === i}
				aria-label={`${item.name}: ${item.kind}`}
				onclick={() => choose(i)}
				><span class="problem-number"><PatternIcon name={item.icon} size={21} /></span><span
					class="problem-full"><strong>{item.name}</strong><small>{item.kind}</small></span
				><span class="problem-short" aria-hidden="true">{item.short}</span><PatternIcon
					name="arrowRight"
					size={17}
				/></button
			>{/each}
	</nav>
	{#key stage}<div
			class="problem-content"
			in:fade={{ duration: prefersReducedMotion.current ? 0 : 220 }}
		>
			{#if stage === 0}<SortingLab />
			{:else if stage === 1}
				<div class="classification-story">
					<img
						src="/images/edition-3/shoe-studies.webp"
						alt="A blue and ivory sneaker and a slate ankle boot, with rear-view photographs showing their different collar heights"
						width="1932"
						height="814"
					/>
					<div>
						<span class="small-overline">02 / LEARN FROM EXAMPLES</span>
						<h2>Easy to recognize.<br /><em>Hard to write a rule for.</em></h2>
						<p>
							Color changes. Angles change. Some boots have laces, too. A classifier learns which
							pixel patterns help tell them apart.
						</p>
						<div class="input-output">
							<span>Image</span><PatternIcon name="arrowRight" size={17} /><span>Learned model</span
							><PatternIcon name="arrowRight" size={17} /><strong>A label</strong>
						</div>
					</div>
				</div>
				<div class="section-intro">
					<h3>Teach it sneakers and boots.</h3>
					<p>
						Train on real Fashion-MNIST images below. The tiny grayscale pictures are the actual
						data; the photograph above illustrates the categories.
					</p>
				</div>
				<ImageClassifier />
			{:else if stage === 2}<CaptionLab {ai} />{:else}<SpeechLab {ai} />{/if}
		</div>{/key}
	<div class="problem-navigation">
		<button class="text-button" disabled={stage === 0} onclick={() => choose(stage - 1)}
			><PatternIcon name="arrowLeft" size={16} /> Back</button
		>
		<p>
			{stage === 0
				? 'But what if the rule is hard to describe?'
				: stage === 1
					? 'A label names a thing. A caption describes a scene.'
					: 'The algorithm for learning is written. The useful patterns come from data.'}
		</p>
		{#if stage < 3}<button class="text-button" onclick={() => choose(stage + 1)}
				>{stage === 0
					? 'Recognize an image'
					: stage === 1
						? 'Describe an image'
						: 'Give it a voice'}<PatternIcon name="arrowRight" size={17} /></button
			>{/if}
	</div>
</div>

<style>
	.problem-tabs {
		grid-template-columns: repeat(4, minmax(0, 1fr));
	}
	.problem-tabs button {
		padding: 16px 12px;
		gap: 10px;
	}
	.problem-tabs strong {
		font-size: 12px;
	}
	.problem-tabs small {
		font-size: 10px;
	}
	.problem-tabs button > :global(svg) {
		display: none;
	}
	@media (max-width: 1100px) and (min-width: 681px) {
		.problem-tabs {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}
	.problem-short {
		display: none;
	}
	.classification-story > img {
		height: auto;
		object-fit: contain;
		align-self: center;
	}
	@media (max-width: 680px) {
		.problem-full,
		.problem-number {
			display: none;
		}
		.problem-short {
			display: inline;
			font-size: 12px;
			font-weight: 550;
		}
		.problem-tabs button {
			min-height: 44px;
			padding: 10px 12px;
			display: flex;
			align-items: center;
			justify-content: center;
		}
	}
</style>
