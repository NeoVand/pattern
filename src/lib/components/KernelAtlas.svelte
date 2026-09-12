<script lang="ts">
	import { CONV_SHAPES, convFilter, type ConvWeights } from '$lib/ml/convnet';
	import ConvHeatmap from './ConvHeatmap.svelte';
	let {
		weights,
		layer,
		channel,
		compact = false
	}: { weights: ConvWeights; layer: number; channel: number; compact?: boolean } = $props();
	const shape = $derived(CONV_SHAPES[layer]);
	const scale = $derived(Math.max(0.0001, ...weights.kernels[layer].map(Math.abs)));
</script>

<div
	class="kernel-atlas"
	class:compact
	style:--columns={compact ? Math.ceil(Math.sqrt(shape.input)) : Math.min(8, shape.input)}
>
	{#each Array.from({ length: shape.input }, (_, i) => i) as input (input)}<div
			class="kernel-slice"
		>
			<ConvHeatmap
				values={convFilter(weights, layer, channel, input)}
				side={3}
				kind="weight"
				{scale}
			/>{#if !compact}<small>{layer ? 'Map ' + (input + 1) : 'Image'}</small>{/if}
		</div>{/each}
</div>

<style>
	.kernel-atlas {
		display: grid;
		grid-template-columns: repeat(var(--columns), minmax(0, 1fr));
		gap: 10px;
		max-width: 640px;
	}
	.kernel-slice {
		min-width: 0;
	}
	.kernel-slice :global(canvas) {
		width: 100%;
		height: auto;
		max-width: 70px;
		aspect-ratio: 1;
		border-radius: 3px;
	}
	.kernel-slice small {
		display: block;
		font-size: 10px;
		color: var(--muted);
		margin-top: 6px;
	}
	.compact {
		gap: 1px;
		width: 100%;
		height: 100%;
		max-width: none;
		align-content: center;
	}
	.compact .kernel-slice :global(canvas) {
		border-radius: 0;
		max-width: none;
	}
	@media (max-width: 650px) {
		.kernel-atlas:not(.compact) {
			grid-template-columns: repeat(min(var(--columns), 4), minmax(0, 1fr));
		}
	}
</style>
