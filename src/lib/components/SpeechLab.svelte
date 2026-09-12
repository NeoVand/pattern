<script lang="ts">
	import { onDestroy } from 'svelte';
	import type { AiSession } from '$lib/ai/session.svelte';
	import PatternIcon from './PatternIcon.svelte';
	import ChoiceGroup from './ChoiceGroup.svelte';
	import AudioSignal from './AudioSignal.svelte';
	let { ai }: { ai: AiSession } = $props();
	let text = $state(
		'A little curiosity changes everything. Listen closely: a voice is a pattern unfolding in time.'
	);
	let voice = $state('alloy');
	let style = $state('Warm and conversational, with a natural pace.');
	let url = $state('/audio/curiosity.wav');
	let transcript = $state(
		'A little curiosity changes everything. Listen closely: a voice is a pattern unfolding in time.'
	);
	let generated = $state(false);
	let renderedModel = $state('gpt-4o-mini-tts');
	let running = $state(false);
	let error = $state('');
	let controller: AbortController | undefined;
	const examples = [
		{
			label: 'A curious narrator',
			text: 'A little curiosity changes everything. Listen closely: a voice is a pattern unfolding in time.'
		},
		{
			label: 'Meaning through emphasis',
			text: 'I never said she took the last train. I never said she took the last train.'
		},
		{
			label: 'Across languages',
			text: 'Hello, and welcome. Bonjour et bienvenue. Hola, y bienvenidos.'
		}
	];
	async function speak() {
		if (ai.provider !== 'openai' || !ai.ready) {
			ai.settingsOpen = true;
			return;
		}
		running = true;
		error = '';
		controller = new AbortController();
		try {
			const requestedModel = ai.speechModel;
			const result = await ai.speak({ text, voice, style, signal: controller.signal });
			if (controller.signal.aborted) return;
			if (url.startsWith('blob:')) URL.revokeObjectURL(url);
			url = URL.createObjectURL(result.blob);
			transcript = result.transcript;
			renderedModel = requestedModel;
			generated = true;
		} catch (e) {
			if (!controller.signal.aborted) error = e instanceof Error ? e.message : String(e);
		} finally {
			running = false;
		}
	}
	onDestroy(() => {
		controller?.abort();
		if (url.startsWith('blob:')) URL.revokeObjectURL(url);
	});
</script>

<section class="speech-lab" aria-label="Text to speech experiment">
	<div class="speech-heading">
		<span class="small-overline">WORDS BECOME SOUND</span>
		<h2>The same words.<br /><em>A thousand ways to say them.</em></h2>
		<p>
			A speech model learns pronunciation, rhythm, and expression from audio. Change the delivery,
			then listen to what changes in the signal.
		</p>
	</div>
	<div class="speech-workspace">
		<div class="speech-controls">
			<div class="speech-presets" role="group" aria-label="Speech examples">
				{#each examples as example (example.label)}<button
						aria-pressed={text === example.text}
						onclick={() => (text = example.text)}>{example.label}</button
					>{/each}
			</div>
			<label for="speech-text">What should it say?</label><textarea
				id="speech-text"
				bind:value={text}
				rows="4"
				maxlength="600"></textarea><ChoiceGroup
				label="Voice"
				value={voice}
				options={[
					{ value: 'alloy', label: 'Alloy' },
					{ value: 'nova', label: 'Nova' },
					{ value: 'onyx', label: 'Onyx' }
				]}
				onchange={(v) => (voice = v)}
			/><ChoiceGroup
				label="Delivery"
				value={style}
				options={[
					{ value: 'Warm and conversational, with a natural pace.', label: 'Conversational' },
					{ value: 'Soft, calm, and unhurried.', label: 'Reflective' },
					{
						value:
							'Animated, bright, and excited. Emphasize a different word in each repeated sentence.',
						label: 'Expressive'
					}
				]}
				onchange={(v) => (style = v)}
			/>
			<div class="speech-actions">
				<button class="primary-button" disabled={running || ai.busy || !text.trim()} onclick={speak}
					><PatternIcon name="audio" size={18} />{running
						? 'Creating speech…'
						: ai.provider === 'openai' && ai.ready
							? 'Generate speech'
							: 'Connect OpenAI'}</button
				>{#if running}<button class="text-button" onclick={() => controller?.abort()}>Cancel</button
					>{/if}
			</div>
			{#if error}<p role="alert" class="error-notice">{error}</p>{/if}
		</div>
		<div class="speech-listen">
			<div class="listen-heading">
				<PatternIcon name="microphone" size={24} />
				<div>
					<strong>Listen to the model</strong><small
						>{generated ? renderedModel : 'Recorded example · GPT-4o mini TTS'}</small
					>
				</div>
			</div>
			{#key url}<AudioSignal src={url} />{/key}
			<p class="transcript">“{transcript}”</p>
			<div class="speech-footer">
				<span>AI-generated voice</span>
				<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- This is a generated blob or static audio download, never app navigation. -->
				<a href={url} download="pattern-voice.wav"
					><PatternIcon name="download" size={15} />Save audio</a
				>
			</div>
			<p class="speech-note">
				Text is the input. Audio samples are the output. A learned model supplies the pronunciation
				and timing that a sorting rule never needed.
			</p>
		</div>
	</div>
</section>

<style>
	.speech-heading h2 em {
		font-family: var(--serif);
		font-style: italic;
		color: var(--lavender);
		font-weight: 400;
	}
	.speech-lab {
		padding: clamp(20px, 3.5vw, 44px);
		background: var(--surface);
		border-radius: 24px;
	}
	.speech-heading {
		max-width: 760px;
		margin-bottom: 26px;
	}
	.speech-heading h2 {
		font-size: clamp(28px, 3vw, 42px);
		line-height: 1.15;
		margin: 12px 0;
	}
	.speech-heading p {
		font-size: 14px;
		color: var(--muted);
		line-height: 1.7;
		max-width: 650px;
	}
	.speech-workspace {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 32px;
	}
	.speech-controls,
	.speech-listen {
		min-width: 0;
	}
	.speech-presets {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin-bottom: 20px;
	}
	.speech-presets button {
		font-size: 11px;
		padding: 8px 10px;
		border: 0;
		border-radius: 8px;
		background: var(--lab-inset);
		color: var(--muted);
	}
	.speech-presets button[aria-pressed='true'] {
		color: var(--blue);
		background: var(--accent-bg);
	}
	.speech-controls label {
		font-size: 12px;
		color: var(--muted);
		display: block;
		margin-bottom: 8px;
	}
	.speech-controls textarea {
		width: 100%;
		padding: 14px;
		border-radius: 12px;
		border: 1px solid var(--line);
		background: var(--input);
		color: var(--ink);
		font: inherit;
		font-size: 14px;
		line-height: 1.7;
		resize: vertical;
	}
	.speech-controls :global(.choice-group) {
		margin: 18px 0;
	}
	.speech-controls :global(.choice-group legend) {
		font-size: 12px;
		margin-bottom: 8px;
	}
	.speech-controls :global(.choice-group button) {
		font-size: 12px;
		padding: 10px 7px;
	}
	.speech-actions {
		display: flex;
		gap: 14px;
		align-items: center;
		margin-top: 20px;
	}
	.speech-actions .primary-button {
		min-height: 44px;
		font-size: 13px;
		padding: 12px 18px;
	}
	.speech-listen {
		padding: 24px;
		background: var(--lab-inset);
		border-radius: 18px;
		align-self: start;
	}
	.listen-heading {
		display: flex;
		align-items: center;
		gap: 12px;
		margin-bottom: 26px;
		color: var(--lavender);
	}
	.listen-heading strong {
		font-size: 15px;
		color: var(--ink);
		font-weight: 550;
	}
	.listen-heading small {
		display: block;
		font-size: 11px;
		color: var(--muted);
		margin-top: 4px;
	}
	.transcript {
		font-family: var(--serif);
		font-size: 26px;
		line-height: 1.5;
		color: var(--ink);
	}
	.speech-footer {
		display: flex;
		justify-content: space-between;
		gap: 12px;
		color: var(--muted);
		font-size: 11px;
	}
	.speech-footer a {
		display: flex;
		align-items: center;
		gap: 6px;
		color: var(--blue);
	}
	.speech-note {
		font-size: 12px;
		line-height: 1.7;
		color: var(--muted);
		margin: 24px 0 0;
	}
	@media (max-width: 900px) {
		.speech-workspace {
			grid-template-columns: 1fr;
			gap: 24px;
		}
	}
</style>
