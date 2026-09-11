<script lang="ts">
	import PatternIcon from '$lib/components/PatternIcon.svelte';
	let attentionToken = $state(4);
	let block = $state(2);
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
	const stages = [
		{
			title: 'Tokens',
			subtitle: 'Text → small pieces',
			description:
				'A tokenizer turns text into token IDs. Tokens may be whole words, word fragments, punctuation, or other pieces. This display uses word-sized pieces to keep the process readable.'
		},
		{
			title: 'Embeddings',
			subtitle: 'Pieces → vectors',
			description:
				'An embedding maps each token ID to a learned vector of numbers. Position information also enters the model, because word order matters.'
		},
		{
			title: 'Attention',
			subtitle: 'Gather relevant context',
			description:
				'Each position produces queries, keys, and values. Query–key similarities become attention weights; the weighted values mix information from other positions. Causal masking hides future tokens during next-token modeling.'
		},
		{
			title: 'Neural layers',
			subtitle: 'Transform what was gathered',
			description:
				'Feed-forward networks transform each position’s representation. Residual connections and normalization help information and gradients flow. Repeated attention and feed-forward blocks build richer contextual representations.'
		},
		{
			title: 'Next-token probabilities',
			subtitle: 'Scores → a distribution',
			description:
				'The final representation is projected into vocabulary scores called logits. Softmax converts those scores to probabilities. A decoding strategy selects a token, appends it to the context, and repeats.'
		}
	];
</script>

<div class="transformer-experiment">
	<div class="transformer-pipeline" aria-label="Transformer stages">
		{#each stages as stage, i (stage.title)}<button
				class:selected={block === i}
				aria-pressed={block === i}
				onclick={() => (block = i)}
				><span>0{i + 1}</span><strong>{stage.title}</strong><small>{stage.subtitle}</small></button
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
								d={`M ${36 + attentionToken * 88} 8 Q ${(36 + attentionToken * 88 + 36 + i * 88) / 2} ${65 + Math.abs(i - attentionToken) * 17} ${36 + i * 88} 160`}
								stroke="#c5d8a2"
								stroke-width={1 + weight * 9}
								stroke-opacity={0.15 + weight * 0.75}
								fill="none"
							/><circle
								cx={36 + i * 88}
								cy="160"
								r={4 + weight * 12}
								fill="#b8cf9b"
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
		<div class="experiment-controls">
			<span class="eyebrow">STEP 0{block + 1} / 05</span><span class="map-section-number"
				>0{block + 1}</span
			>
			<h3 class="side-title">{stages[block].title}</h3>
			<p class="side-description">{stages[block].subtitle}</p>
			<p class="control-help map-detail">{stages[block].description}</p>
			<button class="text-button" onclick={() => (block = (block + 1) % stages.length)}
				>Follow the information <PatternIcon name="arrowRight" size={14} /></button
			>
		</div>
	</div>
</div>
