<script lang="ts">
	import type { PatternIconName } from '$lib/data/icons';
	import PatternIcon from '$lib/components/PatternIcon.svelte';
	let attentionToken = $state(4);
	let block = $state(2);
	const tokenX = (index: number) => ((index + 0.5) * 600) / 7;
	const attentionWords = ['The', 'animal', 'stopped', 'because', 'it', 'was', 'tired'];
	// Hand-chosen features support a causal-attention illustration, not pretrained attention.
	const embeddings = [
		[0.1, 0.2, 0.1],
		[1, 0.15, 0.4],
		[0.1, 0.5, 0.4],
		[0.3, 0.8, 0.1],
		[0.9, 0.1, 0.4],
		[0.1, 0.4, 0.2],
		[0.8, 0.3, 0.5]
	];
	const attention = $derived.by(() => {
		const query = embeddings[attentionToken];
		const scores = embeddings.map((key, i) =>
			i > attentionToken ? 0 : Math.exp(key.reduce((sum, v, j) => sum + query[j] * v, 0) * 3)
		);
		const sum = scores.reduce((a, b) => a + b, 0);
		return scores.map((s) => s / sum);
	});
	const stages: { title: string; subtitle: string; description: string; icon: PatternIconName }[] =
		[
			{
				title: 'Tokens',
				icon: 'language',
				subtitle: 'Text → small pieces',
				description:
					'A tokenizer turns text into token IDs. Tokens may be whole words, word fragments, punctuation, or other pieces. This display uses word-sized pieces to keep the process readable.'
			},
			{
				title: 'Embeddings',
				icon: 'grid',
				subtitle: 'Pieces → vectors',
				description:
					'An embedding maps each token ID to a learned vector of numbers. Position information also enters the model, because word order matters.'
			},
			{
				title: 'Attention',
				icon: 'eye',
				subtitle: 'Gather relevant context',
				description:
					'Each position produces queries, keys, and values. Query–key similarities become attention weights; the weighted values mix information from other positions. Causal masking hides future tokens during next-token modeling.'
			},
			{
				title: 'Neural layers',
				icon: 'neural',
				subtitle: 'Transform what was gathered',
				description:
					'Feed-forward networks transform each position’s representation. Residual connections and normalization help information and gradients flow. Repeated attention and feed-forward blocks build richer contextual representations.'
			},
			{
				title: 'Next-token probabilities',
				icon: 'forecasting',
				subtitle: 'Scores → a distribution',
				description:
					'The final representation is projected into vocabulary scores called logits. Softmax converts those scores to probabilities. A decoding strategy selects a token, appends it to the context, and repeats.'
			}
		];
</script>

<div class="transformer-experiment">
	<div class="transformer-pipeline" role="group" aria-label="Transformer stages">
		{#each stages as stage, i (stage.title)}<button
				class:selected={block === i}
				aria-pressed={block === i}
				aria-controls="transformer-stage-detail"
				onclick={() => (block = i)}
				><span><PatternIcon name={stage.icon} size={23} /></span><strong>{stage.title}</strong
				><small>{stage.subtitle}</small></button
			>{#if i < stages.length - 1}<PatternIcon name="arrowRight" size={16} />{/if}{/each}
	</div>
	<div class="experiment">
		<div class="plot-panel">
			<div class="plot-heading">
				<span><i class="live-dot"></i> A CLOSER LOOK AT ATTENTION</span><span class="plot-subtle"
					>One illustrative causal attention head</span
				>
			</div>
			<div class="plot-intro">
				<h3>Every token has a context.</h3>
				<p>Select a token. See which earlier positions it can attend to.</p>
			</div>
			<div class="attention-visual">
				<div class="attention-tokens">
					{#each attentionWords as word, i (i)}<button
							class:selected={attentionToken === i}
							class:masked={i > attentionToken}
							onclick={() => {
								attentionToken = i;
								block = 2;
							}}
							aria-pressed={attentionToken === i}>{word}</button
						>{/each}
				</div>
				<svg
					viewBox="0 0 600 180"
					role="img"
					aria-label="Attention connections from selected token to earlier tokens. Future positions are masked."
					>{#each attention as weight, i (i)}{#if weight > 0}<path
								d={`M ${tokenX(attentionToken)} 8 Q ${(tokenX(attentionToken) + tokenX(i)) / 2} ${65 + Math.abs(i - attentionToken) * 17} ${tokenX(i)} 160`}
								stroke="var(--chart-blue)"
								stroke-linecap="round"
								stroke-width={1 + weight * 9}
								stroke-opacity={0.15 + weight * 0.75}
								fill="none"
							/><circle
								cx={tokenX(i)}
								cy="160"
								r={4 + weight * 12}
								fill="var(--chart-blue)"
								fill-opacity={0.3 + weight * 0.7}
							/>{/if}{/each}</svg
				>
				<div class="attention-weights">
					{#each attention as weight, i (i)}<span
							>{weight ? `${Math.round(weight * 100)}%` : 'masked'}</span
						>{/each}
				</div>
			</div>
			<p class="attention-disclaimer">
				Hand-chosen vectors illustrate the calculation. These are not measured weights from a
				trained transformer. Real models learn many attention heads with different patterns.
			</p>
		</div>
		<div class="experiment-controls" id="transformer-stage-detail" aria-live="polite">
			{#key block}
				<span class="eyebrow">STEP 0{block + 1} / 05</span><span class="stage-icon"
					><PatternIcon name={stages[block].icon} size={32} /></span
				>
				<h3 class="side-title">{stages[block].title}</h3>
				<p class="side-description">{stages[block].subtitle}</p>
				<p class="control-help map-detail">{stages[block].description}</p>
			{/key}
			<button class="text-button" onclick={() => (block = (block + 1) % stages.length)}
				>Follow the information <PatternIcon name="arrowRight" size={14} /></button
			>
		</div>
	</div>
</div>

<style>
	.stage-icon {
		display: block;
		color: var(--lavender);
		margin: 20px 0 15px;
	}
	.transformer-pipeline button > span {
		font-size: inherit;
	}
	.attention-tokens,
	.attention-weights {
		gap: 0;
	}
	.attention-tokens button {
		margin-inline: 2px;
		border-radius: 8px;
		min-height: 44px;
	}
	.attention-visual svg path {
		transition:
			stroke-width 0.24s ease,
			stroke-opacity 0.24s ease;
	}
	.attention-visual svg circle {
		transition:
			r 0.24s ease,
			fill-opacity 0.24s ease;
	}
	.experiment-controls > :not(.text-button) {
		animation: detail-arrive 0.22s ease-out;
	}
	.transformer-pipeline > button {
		display: flex;
		flex-direction: column;
		justify-content: flex-start;
		min-width: 0;
	}
	.transformer-pipeline strong {
		min-height: 2.8em;
	}
	.transformer-pipeline small {
		margin-top: 8px;
	}
	@keyframes detail-arrive {
		from {
			opacity: 0;
			transform: translateY(4px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
	@media (max-width: 680px) {
		.transformer-pipeline {
			display: grid;
			grid-template-columns: repeat(2, minmax(0, 1fr));
			gap: 7px;
			padding: 9px;
			overflow: visible;
		}
		.transformer-pipeline > button {
			min-width: 0;
			width: auto;
			min-height: 90px;
			padding: 13px;
		}
		.transformer-pipeline > button:last-child {
			grid-column: 1/-1;
			min-height: 82px;
		}
		.transformer-pipeline strong {
			min-height: 0;
			font-size: 12px;
		}
		.transformer-pipeline small {
			font-size: 10px;
		}
		.transformer-pipeline > :global(svg) {
			display: none;
		}
		.experiment {
			display: flex;
			flex-direction: column;
		}
		.experiment-controls {
			order: -1;
			min-height: 325px;
			padding: 24px;
		}
		.experiment-controls .stage-icon {
			display: none;
		}
		.experiment-controls .eyebrow {
			margin-bottom: 18px;
		}
		.experiment-controls .side-description {
			margin-bottom: 13px;
		}
		.experiment-controls .text-button {
			margin-top: 18px;
			min-height: 44px;
		}
		.attention-visual {
			margin: 28px 0 18px;
		}
		.attention-disclaimer {
			margin-inline: 0;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.experiment-controls > :not(.text-button) {
			animation: none;
		}
		.attention-visual svg path,
		.attention-visual svg circle {
			transition: none;
		}
	}
</style>
