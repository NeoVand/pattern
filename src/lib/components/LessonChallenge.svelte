<script lang="ts">
	import { asset } from '$app/paths';
	import { onMount } from 'svelte';
	import PatternIcon from './PatternIcon.svelte';
	import {
		challenges,
		CHALLENGE_STORAGE_PREFIX,
		emptyChallengeNotes,
		parseChallengeNotes,
		type ChallengeNotes
	} from '$lib/data/challenges';
	let { lessonId }: { lessonId: string } = $props();
	let notebooks = $state.raw<Record<string, ChallengeNotes>>({});
	let storage = $state<'loading' | 'available' | 'unavailable'>('loading');
	const challenge = $derived(challenges[lessonId]);
	const notes = $derived(notebooks[lessonId] ?? emptyChallengeNotes());
	const hasNotes = $derived(Boolean(notes.prediction || notes.evidence || notes.transfer));

	onMount(() => {
		const loaded: Record<string, ChallengeNotes> = {};
		try {
			for (const id of Object.keys(challenges))
				loaded[id] = parseChallengeNotes(localStorage.getItem(`${CHALLENGE_STORAGE_PREFIX}${id}`));
			notebooks = loaded;
			storage = 'available';
		} catch {
			// Browsers can deny storage. The notebook still works for this mounted page.
			notebooks = loaded;
			storage = 'unavailable';
		}
	});

	function save(field: keyof ChallengeNotes, value: string) {
		const updated = { ...notes, [field]: value };
		notebooks = { ...notebooks, [lessonId]: updated };
		try {
			localStorage.setItem(`${CHALLENGE_STORAGE_PREFIX}${lessonId}`, JSON.stringify(updated));
			storage = 'available';
		} catch {
			storage = 'unavailable';
		}
	}
</script>

{#if challenge}
	{#key lessonId}
		<details class="lesson-challenge">
			<summary>
				<img
					src={asset('/images/edition-5/learning-notebook-800.webp')}
					alt=""
					width="1942"
					height="809"
					loading="lazy"
				/>
				<span class="notebook-heading"
					><span class="eyebrow">YOUR LEARNING NOTEBOOK <span>· OPTIONAL</span></span><strong
						>Predict. Investigate. Explain.</strong
					><span class="summary-note">Open before the lab. Return with evidence.</span></span
				>
				<PatternIcon name="chevronDown" size={17} />
			</summary>
			<div class="notebook-body">
				<p class="notebook-intro">
					Make a prediction before you experiment. Afterward, compare it with what happened and
					apply the idea to a different situation.
				</p>
				<div class="notebook-grid">
					<section class="notebook-step" aria-label="Prediction activity">
						<div class="step-heading">
							<span>01</span>
							<h3>Before the experiment</h3>
						</div>
						<p>{challenge.prediction}</p>
						<label
							>Your prediction<textarea
								aria-label="Prediction before experimenting"
								rows="3"
								value={notes.prediction}
								oninput={(event) => save('prediction', event.currentTarget.value)}
								placeholder="I expect… because…"></textarea></label
						>
					</section>
					<section class="notebook-step" aria-label="Experiment and evidence activity">
						<div class="step-heading">
							<span>02</span>
							<h3>Try it in the lab below</h3>
						</div>
						<p>{challenge.experiment}</p>
						<p class="evidence-prompt">{challenge.evidence}</p>
						<label
							>Your observations and explanation<textarea
								aria-label="Observations and explanation"
								rows="3"
								value={notes.evidence}
								oninput={(event) => save('evidence', event.currentTarget.value)}
								placeholder="I changed… The result was… This supports…"></textarea></label
						>
					</section>
				</div>
				<section class="transfer-step" aria-label="Transfer activity">
					<div class="step-heading">
						<span>03</span>
						<h3>A different situation</h3>
					</div>
					<p>{challenge.transfer}</p>
					<label
						>Apply the idea<textarea
							aria-label="Apply the idea to a new situation"
							rows="2"
							value={notes.transfer}
							oninput={(event) => save('transfer', event.currentTarget.value)}
							placeholder="I would… I would check…"></textarea></label
					>
				</section>
				<details class="worked-explanation">
					<summary
						><PatternIcon name="idea" size={16} /><span
							>Compare your reasoning with an explanation</span
						><PatternIcon name="chevronDown" size={14} /></summary
					>
					<p>{challenge.explanation}</p>
					<p class="explanation-note">
						Use this to check your reasoning against the experiment. Your written notes are not
						automatically graded.
					</p>
				</details>
				<div class="notebook-footer">
					<PatternIcon
						name={storage === 'unavailable' ? 'alert' : 'book'}
						size={14}
					/>{#if storage === 'unavailable'}<p role="status">
							Notes remain in this open page. Browser saving is unavailable.
						</p>{:else}<p>
							{hasNotes
								? 'Notes saved in this browser, separately for each chapter.'
								: 'Your notes will save in this browser, separately for each chapter.'} Nothing you type
							here is sent to a model.
						</p>{/if}
				</div>
			</div>
		</details>
	{/key}
{/if}

<style>
	.lesson-challenge {
		border: 1px solid var(--line);
		border-radius: 18px;
		background: var(--surface);
		color: var(--ink);
		margin: 0 0 24px;
		container-type: inline-size;
	}
	.lesson-challenge > summary {
		display: flex;
		align-items: center;
		gap: 20px;
		padding: 19px 24px;
		cursor: pointer;
		list-style: none;
	}
	summary::-webkit-details-marker {
		display: none;
	}
	summary:focus-visible {
		outline: 2px solid var(--focus);
		outline-offset: 5px;
		border-radius: 12px;
	}
	.lesson-challenge > summary img {
		width: 116px;
		height: auto;
		flex-shrink: 0;
		object-fit: contain;
	}
	.notebook-heading {
		display: block;
		min-width: 0;
		flex: 1;
	}
	.eyebrow {
		display: block;
		color: var(--blue);
		font: 9px var(--mono);
		letter-spacing: 0.8px;
		line-height: 1.7;
	}
	.eyebrow > span {
		color: var(--quiet);
	}
	.notebook-heading strong {
		display: block;
		font-size: 15px;
		font-weight: 550;
		margin: 5px 0;
	}
	.summary-note {
		display: block;
		font-size: 11px;
		color: var(--muted);
		line-height: 1.6;
	}
	.notebook-body {
		border-top: 1px solid var(--line);
		padding: 22px 26px 18px;
	}
	p {
		color: var(--muted);
		font-size: 12px;
		line-height: 1.85;
	}
	.notebook-intro {
		font-size: 11px;
		margin: 0 0 24px;
		max-width: 820px;
	}
	.notebook-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 30px;
	}
	.notebook-step,
	.transfer-step {
		min-width: 0;
	}
	.step-heading {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.step-heading > span {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 25px;
		height: 25px;
		border: 1px solid var(--line);
		border-radius: 50%;
		color: var(--blue);
		font: 9px var(--mono);
		flex-shrink: 0;
	}
	h3 {
		font-size: 13px;
		font-weight: 550;
		margin: 0;
	}
	.evidence-prompt {
		border-left: 2px solid var(--lavender);
		padding-left: 13px;
		font-size: 11px;
	}
	label {
		display: block;
		color: var(--muted);
		font-size: 11px;
		margin-top: 17px;
	}
	textarea {
		display: block;
		width: 100%;
		border: 1px solid var(--line);
		border-radius: 9px;
		background: var(--input);
		color: var(--ink);
		font: 12px/1.8 var(--sans);
		padding: 11px 12px;
		resize: vertical;
		margin-top: 8px;
	}
	textarea::placeholder {
		color: var(--quiet);
		opacity: 1;
	}
	.transfer-step {
		margin-top: 24px;
		padding-top: 23px;
		border-top: 1px solid var(--line);
	}
	.worked-explanation {
		margin-top: 24px;
		background: var(--lab-inset);
		border-radius: 12px;
	}
	.worked-explanation summary {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 15px 17px;
		cursor: pointer;
		list-style: none;
		color: var(--muted);
		font-size: 11px;
		line-height: 1.7;
	}
	.worked-explanation summary > span {
		flex: 1;
	}
	.worked-explanation p {
		padding: 0 18px;
		margin: 0 0 13px;
	}
	.worked-explanation .explanation-note {
		font-size: 10px;
		color: var(--quiet);
		padding-bottom: 17px;
		margin-bottom: 0;
	}
	.notebook-footer {
		display: flex;
		align-items: start;
		gap: 9px;
		margin-top: 17px;
		color: var(--quiet);
	}
	.notebook-footer p {
		flex: 1;
		font-size: 10px;
		color: var(--quiet);
		line-height: 1.7;
		margin: 0;
	}
	@container (max-width: 650px) {
		.notebook-grid {
			grid-template-columns: 1fr;
			gap: 24px;
		}
		.notebook-step + .notebook-step {
			border-top: 1px solid var(--line);
			padding-top: 23px;
		}
	}
	@container (max-width: 440px) {
		.lesson-challenge > summary {
			padding: 16px;
			gap: 12px;
		}
		.lesson-challenge > summary img {
			width: 72px;
		}
		.notebook-heading strong {
			font-size: 13px;
		}
		.summary-note {
			font-size: 10px;
		}
		.eyebrow {
			font-size: 8px;
			letter-spacing: 0.4px;
		}
		.eyebrow > span {
			display: block;
		}
		.notebook-body {
			padding: 20px 17px 17px;
		}
	}
</style>
