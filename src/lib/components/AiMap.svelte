<script lang="ts">
	import PatternIcon from '$lib/components/PatternIcon.svelte';
	let selected = $state(2);
	const levels = [
		{
			name: 'Artificial intelligence',
			label: 'THE BROAD FIELD',
			short: 'Systems that perform tasks associated with intelligence.',
			detail:
				'Planning, search, reasoning, perception, and language all live under the AI umbrella. Some AI systems use explicit rules instead of learning from data.',
			example: 'A rule-based chess engine can be AI without being machine learning.',
			color: '#8dafa4'
		},
		{
			name: 'Machine learning',
			label: 'LEARNING FROM DATA',
			short: 'Algorithms that learn patterns from experience.',
			detail:
				'Instead of specifying every decision rule, we fit a model to data. Linear regression, decision trees, and neural networks are different ways to do this.',
			example: 'A model that predicts house prices from past sales.',
			color: '#b1c792'
		},
		{
			name: 'Deep learning',
			label: 'LAYERS OF REPRESENTATION',
			short: 'Machine learning with multilayer neural networks.',
			detail:
				'Networks learn intermediate representations as part of training. More data, compute, and improved methods made these models practical for complex signals.',
			example: 'A vision network that learns to recognize objects in photos.',
			color: '#dab18b'
		},
		{
			name: 'Large language models',
			label: 'MODELING LANGUAGE AT SCALE',
			short: 'Large neural models trained on language-rich data.',
			detail:
				'Many LLMs use transformer architectures. Pretraining learns broad patterns; additional training can improve instruction following and other behaviors.',
			example: 'A model that can summarize a document or generate a continuation.',
			color: '#e4dfb5'
		}
	];
	const level = $derived(levels[selected]);
	let facet = $state<'generative' | 'foundation' | 'multimodal'>('generative');
	const facets = {
		generative: {
			name: 'Generative',
			text: 'Describes the task: creating content such as text, images, or audio. Generative models are not limited to language, transformers, or even deep learning.'
		},
		foundation: {
			name: 'Foundation',
			text: 'Describes broad pretraining and reuse: a model trained on varied data that can be adapted or prompted for many downstream tasks.'
		},
		multimodal: {
			name: 'Multimodal',
			text: 'Describes the kinds of data: a model that processes or generates more than one modality, such as text and images.'
		}
	};
</script>

<div class="experiment map-experiment">
	<div class="plot-panel">
		<div class="plot-heading">
			<span><i class="live-dot"></i> A MAP OF THE TERRITORY</span><span class="plot-subtle"
				>Select a field to explore</span
			>
		</div>
		<div class="taxonomy-map" aria-label="Nested fields of AI">
			{#each levels as item, i (item.name)}<div
					class="taxonomy-level"
					class:taxonomy-selected={selected === i}
					style:--level={i}
					style:--level-color={item.color}
				>
					<button onclick={() => (selected = i)} aria-pressed={selected === i}
						><span>{item.name}</span><PatternIcon name="arrowUpRight" size={15} /></button
					>{#if i === 0}<small>Includes approaches that don’t learn</small>{/if}
				</div>{/each}
		</div>
		<p class="map-caption">
			A simplified map of common relationships—not a taxonomy of every AI system.
		</p>
	</div>
	<div class="experiment-controls">
		<span class="eyebrow">{level.label}</span><span class="map-section-number">0{selected + 1}</span
		>
		<h3 class="side-title">{level.name}</h3>
		<p class="side-description">{level.short}</p>
		<p class="control-help map-detail">{level.detail}</p>
		<div class="example-note">
			<span class="eyebrow">FOR EXAMPLE</span>
			<p>{level.example}</p>
		</div>
		<button class="text-button" onclick={() => (selected = (selected + 1) % 4)}
			>Explore the next idea <PatternIcon name="arrowRight" size={15} /></button
		>
	</div>
</div>
<div class="ai-facets">
	<div>
		<span class="eyebrow">THREE OTHER WORDS YOU’LL HEAR</span>
		<p>These describe different dimensions.</p>
	</div>
	<div>
		<div class="facet-tabs" role="group" aria-label="AI vocabulary">
			{#each ['generative', 'foundation', 'multimodal'] as key (key)}<button
					class:selected={facet === key}
					aria-pressed={facet === key}
					onclick={() => (facet = key as typeof facet)}
					>{facets[key as keyof typeof facets].name}</button
				>{/each}
		</div>
		<p>{facets[facet].text}</p>
	</div>
</div>
