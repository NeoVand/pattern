<script lang="ts">
	import AutoencoderWorkbench from './AutoencoderWorkbench.svelte';
	import { autoencoderDatasets, type AutoencoderDatasetId } from '$lib/ml/autoencoder-datasets';
	let selected = $state<AutoencoderDatasetId>('mnist');
</script>

<div class="dataset-picker">
	<div class="dataset-options" role="group" aria-label="Autoencoder dataset">
		{#each Object.values(autoencoderDatasets) as source (source.id)}
			<button
				type="button"
				aria-label={source.name}
				aria-pressed={selected === source.id}
				onclick={() => (selected = source.id)}
			>
				<strong>{source.name}</strong>
				<span>{source.subtitle}</span>
			</button>
		{/each}
	</div>
	<p>Choose your images. Switching datasets starts a fresh model.</p>
</div>

{#key selected}
	<AutoencoderWorkbench source={autoencoderDatasets[selected]} />
{/key}

<style>
	.dataset-picker {
		margin-bottom: 20px;
	}
	.dataset-options {
		display: flex;
		gap: 10px;
	}
	.dataset-options button {
		flex: 1;
		min-width: 0;
		display: grid;
		gap: 5px;
		padding: 16px 20px;
		border: 1px solid transparent;
		border-radius: 13px;
		background: var(--lab-card);
		color: var(--muted);
		text-align: left;
		cursor: pointer;
	}
	.dataset-options button[aria-pressed='true'] {
		background: color-mix(in srgb, var(--lavender) 9%, var(--lab-card));
		border-color: color-mix(in srgb, var(--lavender) 45%, transparent);
		color: var(--ink);
	}
	.dataset-options button:hover {
		color: var(--ink);
	}
	.dataset-options button:focus-visible {
		outline: 2px solid var(--focus);
		outline-offset: 3px;
	}
	.dataset-options strong {
		font-weight: 550;
		font-size: 14px;
	}
	.dataset-options span {
		color: var(--muted);
		font-size: 11px;
		line-height: 1.5;
	}
	.dataset-picker p {
		margin: 10px 0 0;
		color: var(--quiet);
		font-size: 11px;
		line-height: 1.6;
	}
	@media (max-width: 600px) {
		.dataset-options {
			gap: 8px;
		}
		.dataset-options button {
			padding: 13px 12px;
		}
		.dataset-options strong {
			font-size: 13px;
		}
	}
</style>
