<script lang="ts">
	import PatternIcon from '$lib/components/PatternIcon.svelte';
	import { onDestroy } from 'svelte';
	import type { AiSession } from '$lib/ai/session.svelte';
	import ModelConnection from './ModelConnection.svelte';
	import ChoiceGroup from './ChoiceGroup.svelte';
	import StoryLanguageLab from './StoryLanguageLab.svelte';
	import TransformerView from './TransformerView.svelte';
	let { ai }: { ai: AiSession } = $props();
	let tab = $state<'generation' | 'transformer' | 'training'>('generation');
	let storiesOpened = $state(false);
	let prompt = $state('Explain why the Moon stays in orbit, in three clear sentences.');
	let temperature = $state(0.7);
	let output = $state('');
	let error = $state('');
	let status = $state('Ready when you are');
	let running = $state(false);
	let tokens = $state<{ id: number; text: string }[]>([]);
	let inputCount = $state<number>();
	let outputCount = $state<number>();
	let backend = $state('');
	let localRun = $state(false);
	let controller: AbortController | undefined;
	const suggestions = [
		'Explain why the Moon stays in orbit, in three clear sentences.',
		'Complete this scene in 80 words: The lighthouse keeper found a letter dated tomorrow.',
		'Explain overfitting using a student preparing for an exam.'
	];
	async function generate() {
		if (!ai.ready) {
			ai.settingsOpen = true;
			return;
		}
		running = true;
		error = '';
		output = '';
		tokens = [];
		inputCount = undefined;
		outputCount = undefined;
		backend = ai.label;
		localRun = ai.provider === 'local';
		status = 'Reading context…';
		document.getElementById('language-output')?.scrollIntoView({
			block: 'start',
			behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
		});
		controller = new AbortController();
		try {
			const result = await ai.generate({
				messages: [
					{
						role: 'system',
						content:
							'Be clear, concise, and accurate. Follow the user’s request. Avoid unnecessary preambles.'
					},
					{ role: 'user', content: prompt }
				],
				temperature,
				maxTokens: 300,
				signal: controller.signal,
				onText: (text) => {
					output += text;
					status = 'Generating…';
				},
				onToken: (id, text) => {
					tokens = [...tokens, { id, text }];
				}
			});
			output = result.text;
			inputCount = result.inputTokens;
			outputCount = result.outputTokens;
			status = 'Generation complete';
		} catch (e) {
			if (e instanceof Error && e.name === 'AbortError') status = 'Stopped';
			else {
				error = e instanceof Error ? e.message : String(e);
				status = 'Could not generate';
			}
		} finally {
			running = false;
		}
	}
	onDestroy(() => controller?.abort());
</script>

<ModelConnection {ai} />
<div class="lesson-tabs" role="group" aria-label="Language model experiments">
	<button
		class:selected={tab === 'generation'}
		aria-pressed={tab === 'generation'}
		onclick={() => (tab = 'generation')}
		><PatternIcon name="sparkles" size={16} /> Run a real language model</button
	>
	<button
		class:selected={tab === 'transformer'}
		aria-pressed={tab === 'transformer'}
		onclick={() => (tab = 'transformer')}
		><PatternIcon name="layers" size={16} /> Inside a transformer</button
	>
	<button
		class:selected={tab === 'training'}
		aria-pressed={tab === 'training'}
		onclick={() => {
			storiesOpened = true;
			tab = 'training';
		}}><PatternIcon name="training" size={16} />Train on TinyStories</button
	>
</div>
{#if tab === 'generation'}
	<div class="experiment language-experiment live-language">
		<div class="experiment-controls">
			<label class="field-label" for="live-prompt">Your prompt</label><textarea
				id="live-prompt"
				bind:value={prompt}
				rows="4"
				disabled={running}></textarea>
			<div class="prompt-presets" role="group" aria-label="Example prompts">
				{#each ['Explain', 'Imagine', 'Teach'] as name, i (name)}<button
						disabled={running}
						onclick={() => (prompt = suggestions[i])}
						>{name}<PatternIcon name="arrowUpRight" size={12} /></button
					>{/each}
			</div>
			<ChoiceGroup
				label="Temperature"
				value={temperature}
				options={[
					{ value: 0, label: 'Focused' },
					{ value: 0.7, label: 'Balanced' },
					{ value: 1.1, label: 'Varied' }
				]}
				onchange={(v) => (temperature = v)}
				disabled={running}
			/>
			<p class="control-help">
				Higher temperature allows less likely tokens more often. It changes variety, not factual
				accuracy. Some OpenAI models use their own decoding settings.
			</p>
			{#if running}<button class="primary-button" onclick={() => controller?.abort()}
					><PatternIcon name="stop" size={15} /> Stop generation</button
				>{:else}<button
					class="primary-button"
					disabled={!prompt.trim() || ai.busy}
					onclick={generate}
					><PatternIcon name="play" size={15} />{ai.ready
						? 'Generate answer'
						: 'Choose a model'}</button
				>{/if}
			<div class="control-divider"></div>
			<p class="control-help">
				Generate the same prompt twice. Then change one detail. The weights stay fixed; the context
				and sampling shape the answer.
			</p>
		</div>
		<div class="plot-panel" id="language-output">
			<div class="plot-heading">
				<span><i class="live-dot"></i> THE LANGUAGE STUDIO</span>{#if running}<button
						class="stream-stop"
						onclick={() => controller?.abort()}
						aria-label="Stop generating answer"><PatternIcon name="stop" size={12} /> Stop</button
					>{:else}<span class="plot-subtle">{backend || 'Your prompt. A real model.'}</span>{/if}
			</div>
			<div class="plot-intro">
				<h3>Watch an answer take shape.</h3>
				<p>Every new token becomes context for the next prediction.</p>
			</div>
			<div class="response-sheet" aria-busy={running}>
				{#if error}<div class="error-notice" role="alert">{error}</div>{/if}
				{#if output}<div class="model-output">{output}</div>{:else if !error}<div
						class="output-empty"
					>
						<PatternIcon name="sparkles" size={30} />
						<h4>{running ? 'Reading your context…' : 'A continuation starts here.'}</h4>
						<p>
							{running
								? 'The model is preparing its first prediction.'
								: 'Choose a model, write a prompt, and watch the answer take shape.'}
						</p>
					</div>{/if}
				{#if running}<span class="stream-cursor" aria-label="Generating"></span>{/if}
			</div>
			<div class="training-status">
				<span role="status">{status}</span><span
					>{inputCount !== undefined
						? `${inputCount} input · ${outputCount ?? '—'} output tokens`
						: running && tokens.length
							? `${tokens.length} tokens received`
							: ''}</span
				>
			</div>
			{#if localRun && tokens.length}<details class="token-inspector">
					<summary>Inspect the actual tokens <span>{tokens.length} received</span></summary>
					<p>
						Token IDs and decoded pieces from this model’s tokenizer. Spaces and partial words are
						normal.
					</p>
					<div>
						{#each tokens as token, i (i)}<span title={`Token ID: ${token.id}`}
								><small>{token.id}</small>{token.text.replaceAll(' ', '·').replaceAll('\n', '↵') ||
									'∅'}</span
							>{/each}
					</div>
				</details>{:else if output && !localRun}<p class="stream-note">
					OpenAI streams text in chunks; a chunk is not necessarily one token. Token counts above
					come from the API’s usage report. This API does not expose the full next-token
					distribution.
				</p>{/if}
		</div>
	</div>
{:else if tab === 'transformer'}<TransformerView />{/if}
<div hidden={tab !== 'training'}>
	{#if storiesOpened}<StoryLanguageLab />{/if}
</div>
<div class="lab-explanation">
	<span class="eyebrow">TRAINING ≠ GENERATING</span>
	<p>
		Pretraining updates a model’s weights by learning to predict tokens across a large collection of
		text. Instruction and preference training shape how it responds. Here, you are running
		inference: the learned weights stay fixed while the context grows. Fluent predictions can still
		be wrong.
	</p>
</div>

<style>
	.live-language {
		grid-template-areas: 'output controls';
		grid-template-columns: minmax(0, 1fr) minmax(300px, 35%);
	}
	.live-language .experiment-controls {
		grid-area: controls;
		min-width: 0;
	}
	.live-language .field-label {
		margin-top: 0;
	}
	.live-language .plot-panel {
		grid-area: output;
		min-width: 0;
	}
	.plot-heading {
		min-height: 30px;
	}
	.response-sheet {
		padding-inline: 6px;
	}
	.response-sheet:has(.output-empty) {
		display: grid;
		align-content: center;
	}
	.output-empty {
		min-height: 260px;
	}
	.model-output {
		animation: answer-arrive 180ms ease-out;
	}
	@keyframes answer-arrive {
		from {
			opacity: 0;
			transform: translateY(4px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
	@media (max-width: 760px) {
		.live-language {
			grid-template-areas: 'controls' 'output';
			grid-template-columns: minmax(0, 1fr);
		}
		.live-language .experiment-controls {
			padding: 24px;
		}
		.response-sheet {
			min-height: 225px;
			padding-block: 20px;
		}
		.output-empty {
			min-height: 190px;
			padding: 18px 8px;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.model-output {
			animation: none;
		}
	}
</style>
