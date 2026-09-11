<script lang="ts">
	import PatternIcon from '$lib/components/PatternIcon.svelte';
	import type { AiSession } from '$lib/ai/session.svelte';
	import SortingLab from './SortingLab.svelte';
	import ImageClassifier from './ImageClassifier.svelte';
	import CaptionLab from './CaptionLab.svelte';
	let { ai }: { ai: AiSession } = $props();
	let stage = $state(0);
	const stages = [
		{ name: 'Put numbers in order', kind: 'An explicit algorithm' },
		{ name: 'Recognize an image', kind: 'A learned classifier' },
		{ name: 'Describe what you see', kind: 'Images become language' }
	];
	function choose(next: number) {
		stage = next;
		requestAnimationFrame(() =>
			document
				.getElementById('problem-sequence')
				?.scrollIntoView({ block: 'start', behavior: 'smooth' })
		);
	}
</script>

<div class="problem-sequence" id="problem-sequence">
	<nav class="problem-tabs" aria-label="Three kinds of problems">
		{#each stages as item, i (item.name)}<button
				class:active={stage === i}
				aria-pressed={stage === i}
				onclick={() => choose(i)}
				><span class="problem-number">0{i + 1}</span><span
					><strong>{item.name}</strong><small>{item.kind}</small></span
				><PatternIcon name="arrowRight" size={17} /></button
			>{/each}
	</nav>
	{#if stage === 0}<SortingLab />
	{:else if stage === 1}
		<div class="classification-story">
			<img
				src="/images/shoe-studies.webp"
				alt="A low-top sneaker and a brown leather ankle boot on stone plinths"
				width="1536"
				height="1024"
			/>
			<div>
				<span class="small-overline">02 / LEARN FROM EXAMPLES</span>
				<h2>Easy to recognize.<br /><em>Hard to write a rule for.</em></h2>
				<p>
					Color changes. Angles change. Some boots have laces, too. A classifier learns which pixel
					patterns help tell them apart.
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
				Train on real Fashion-MNIST images below. The tiny grayscale pictures are the actual data;
				the photograph above illustrates the categories.
			</p>
		</div>
		<ImageClassifier />
	{:else}<CaptionLab {ai} />{/if}
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
		{#if stage < 2}<button class="text-button" onclick={() => choose(stage + 1)}
				>{stage === 0 ? 'Now recognize an image' : 'Now describe an image'}<PatternIcon
					name="arrowRight"
					size={17}
				/></button
			>{/if}
	</div>
</div>
