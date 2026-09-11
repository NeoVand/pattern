<script lang="ts">
	import PatternIcon from '$lib/components/PatternIcon.svelte';
	import { notes, sources } from '$lib/data/notes';
	let { chapter }: { chapter: number } = $props();
	let answer = $state<{ chapter: number; choice: number } | null>(null);
	let selectedAnswer = $derived(answer?.chapter === chapter ? answer.choice : null);
	let note = $derived(notes[chapter]);
</script>

<div class="lesson-notes">
	<details>
		<summary
			><span>Reflection & vocabulary</span><PatternIcon name="chevronDown" size={15} /></summary
		>
		<div class="notes-content">
			<div class="reflection">
				<span class="eyebrow">CHECK YOUR INTUITION</span>
				<h3>{note.question}</h3>
				<div class="answer-options">
					{#each note.answers as option, i (option)}<button
							class:answer-selected={selectedAnswer === i}
							aria-pressed={selectedAnswer === i}
							class:answer-correct={selectedAnswer === i && i === note.correct}
							onclick={() => (answer = { chapter, choice: i })}
							>{#if selectedAnswer === i && i === note.correct}<PatternIcon
									name="check"
									size={14}
								/>{:else}<span>{i === 0 ? 'A' : 'B'}</span>{/if}{option}</button
						>{/each}
				</div>
				{#if selectedAnswer !== null}<p class="answer-feedback" role="status">
						<PatternIcon name="idea" size={15} /><span
							><strong
								>{selectedAnswer === note.correct
									? 'Exactly. '
									: 'Think about it this way. '}</strong
							>{note.explanation}</span
						>
					</p>{/if}
			</div>
			<dl>
				{#each note.terms as term (term[0])}<div>
						<dt>{term[0]}</dt>
						<dd>{term[1]}</dd>
					</div>{/each}
			</dl>
		</div>
	</details>
	<details class="source-notes">
		<summary><span>Further reading</span><PatternIcon name="chevronDown" size={13} /></summary>
		<div class="source-links">
			{#each sources.filter((source) => source.chapters.includes(chapter)) as source (source.url)}
				<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- These curated sources are external HTTPS URLs. -->
				<a href={source.url} target="_blank" rel="noreferrer"
					>{source.title}<PatternIcon name="arrowUpRight" size={12} /></a
				>{/each}
		</div>
	</details>
</div>
