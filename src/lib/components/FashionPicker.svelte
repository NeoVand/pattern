<script lang="ts">
	import { CONV_CLASSES } from '$lib/ml/convnet';
	import ConvHeatmap from './ConvHeatmap.svelte';
	import PatternIcon from './PatternIcon.svelte';
	let {
		pixels,
		labels,
		value,
		onchange
	}: {
		pixels: Float32Array;
		labels: Int32Array;
		value: number;
		onchange: (index: number) => void;
	} = $props();
	let category = $state(9),
		page = $state(0),
		expanded = $state(false);
	let indices = $derived(Array.from(labels, (_, i) => i).filter((i) => labels[i] === category));
	function chooseClass(next: number) {
		category = next;
		page = 0;
		const index = labels.findIndex((v) => v === next);
		if (index >= 0) onchange(index);
	}
</script>

<div class="fashion-picker">
	<div class="picker-heading">
		<div class="current-image">
			<ConvHeatmap
				values={pixels.subarray(value * 784, (value + 1) * 784)}
				side={28}
				kind="image"
			/>
		</div>
		<div>
			<strong>{CONV_CLASSES[labels[value]]}</strong><span
				>Official test image #{value + 1} · weights stay fixed</span
			>
		</div>
		<button class="text-button" aria-expanded={expanded} onclick={() => (expanded = !expanded)}
			><PatternIcon name="classification" size={16} />{expanded
				? 'Close image library'
				: 'Choose an image'}<PatternIcon name="chevronDown" size={13} /></button
		>
	</div>
	{#if expanded}<div class="class-choices" role="group" aria-label="Fashion-MNIST category">
			{#each CONV_CLASSES as name, i (name)}<button
					aria-pressed={category === i}
					onclick={() => chooseClass(i)}>{name}</button
				>{/each}
		</div>
		<div class="fashion-images">
			{#each indices.slice(page * 12, (page + 1) * 12) as index (index)}<button
					aria-pressed={value === index}
					aria-label={`Use ${CONV_CLASSES[labels[index]]} test image ${index + 1}`}
					onclick={() => onchange(index)}
					><ConvHeatmap
						values={pixels.subarray(index * 784, (index + 1) * 784)}
						side={28}
						kind="image"
					/></button
				>{/each}
		</div>
		<div class="picker-pages">
			<button
				class="icon-button"
				aria-label="Previous clothing images"
				disabled={page === 0}
				onclick={() => page--}><PatternIcon name="arrowLeft" size={15} /></button
			><span
				>{page * 12 + 1}–{Math.min((page + 1) * 12, indices.length)} of {indices.length}
				{CONV_CLASSES[category].toLowerCase()} images</span
			><button
				class="icon-button"
				aria-label="Next clothing images"
				disabled={(page + 1) * 12 >= indices.length}
				onclick={() => page++}><PatternIcon name="arrowRight" size={15} /></button
			>
		</div>{/if}
</div>

<style>
	.fashion-picker {
		background: var(--lab-inset);
		border-radius: 16px;
		padding: 16px 20px;
		margin: 22px 0;
	}
	.picker-heading {
		display: flex;
		gap: 14px;
		align-items: center;
	}
	.current-image {
		width: 48px;
		height: 48px;
		border-radius: 8px;
		overflow: hidden;
		flex-shrink: 0;
	}
	.picker-heading strong {
		font-size: 14px;
		font-weight: 550;
	}
	.picker-heading span {
		display: block;
		font-size: 11px;
		color: var(--muted);
		margin-top: 5px;
	}
	.picker-heading .text-button {
		margin-left: auto;
		font-size: 12px;
		padding: 8px;
	}
	.class-choices {
		display: flex;
		flex-wrap: wrap;
		gap: 5px;
		margin: 20px 0 16px;
	}
	.class-choices button {
		padding: 8px 11px;
		border: 0;
		border-radius: 8px;
		background: var(--surface);
		color: var(--muted);
		font-size: 11px;
	}
	.class-choices button[aria-pressed='true'] {
		color: var(--blue);
		box-shadow: inset 0 0 0 1px var(--blue);
	}
	.fashion-images {
		display: grid;
		grid-template-columns: repeat(12, minmax(0, 1fr));
		gap: 8px;
	}
	.fashion-images button {
		padding: 3px;
		border: 0;
		border-radius: 10px;
		background: transparent;
		overflow: hidden;
	}
	.fashion-images button[aria-pressed='true'] {
		box-shadow: 0 0 0 2px var(--lavender);
	}
	.picker-pages {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 18px;
		font-size: 11px;
		color: var(--muted);
		margin-top: 12px;
	}
	@media (max-width: 680px) {
		.fashion-images {
			grid-template-columns: repeat(6, minmax(0, 1fr));
		}
		.picker-heading {
			flex-wrap: wrap;
		}
		.picker-heading .text-button {
			margin-left: 0;
			padding-left: 0;
		}
	}
</style>
