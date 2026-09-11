<script lang="ts">
	import PatternIcon from '$lib/components/PatternIcon.svelte';
	let selected = $state(0);
	let reused = $state(false);
	const sets = [
		{
			name: 'Training',
			verb: 'Learn',
			purpose: 'Change the weights.',
			detail:
				'Like practice questions with answers. The model sees its mistakes and changes its weights to do better.'
		},
		{
			name: 'Validation',
			verb: 'Choose',
			purpose: 'Compare your choices.',
			detail:
				'Like a rehearsal exam. Compare model sizes, settings, or stopping points here. These examples do not directly update the weights.'
		},
		{
			name: 'Test',
			verb: 'Evaluate',
			purpose: 'Check the final model.',
			detail:
				'Like a final exam with new questions. Use this once your choices are fixed, to estimate how well the model handles unseen examples.'
		}
	];
</script>

<section class="data-split-story" aria-labelledby="split-title">
	<div class="split-story-heading">
		<div>
			<span class="small-overline">WHY SEPARATE THE DATA?</span>
			<h2>Practice is not<br /><em>a fair exam.</em></h2>
		</div>
		<p>
			A model can memorize its examples. Scoring it on the same examples would reward remembering,
			not learning a pattern that works elsewhere.
		</p>
	</div>
	<div class="split-artwork">
		<img
			src="/images/data-split.webp"
			alt="A large green tray of training examples, a smaller purple validation tray, and a protected amber test tray"
			width="1536"
			height="1024"
			loading="lazy"
		/><span class="split-before">Split before training begins</span>
	</div>
	<div class="split-stages">
		{#each sets as set, i (set.name)}<button
				aria-pressed={selected === i}
				class:active={selected === i}
				class="split-stage split-stage-{i}"
				onclick={() => (selected = i)}
				><span>{i === 2 ? '03' : `0${i + 1}`} / {set.name}</span><strong
					>{set.verb}{#if i === 2}<PatternIcon name="lock" size={17} />{:else}<PatternIcon
							name="arrowRight"
							size={17}
						/>{/if}</strong
				><small>{set.purpose}</small></button
			>{/each}
	</div>
	<p class="split-detail" role="status">{sets[selected].detail}</p>
	<div class="split-leak">
		<label
			><input type="checkbox" bind:checked={reused} /> What if I use test scores to choose the model?</label
		>
		<p class:leaking={reused}>
			{reused
				? 'Then the test set is doing validation. Its score is no longer an independent check. You need fresh, untouched test examples.'
				: 'Separate sets let us distinguish a good fit from a model that generalizes.'}
		</p>
	</div>
	<p class="split-demo-note">
		Our teaching demos show all three sets so you can inspect the errors. In a real project, keep
		the final test evaluation separate from model selection.
	</p>
</section>
