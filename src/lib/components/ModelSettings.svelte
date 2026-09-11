<script lang="ts">
	import PatternIcon from '$lib/components/PatternIcon.svelte';
	import type { AiSession } from '$lib/ai/session.svelte';
	import ChoiceGroup from './ChoiceGroup.svelte';
	let { ai }: { ai: AiSession } = $props();
	function openDialog(node: HTMLDialogElement) {
		node.showModal();
		return () => node.close();
	}
</script>

{#if ai.settingsOpen}<dialog
		class="model-dialog"
		{@attach openDialog}
		onclose={() => (ai.settingsOpen = false)}
		aria-labelledby="model-settings-title"
	>
		<div class="dialog-top">
			<span class="eyebrow">A REAL MODEL, YOUR CHOICE</span><button
				class="icon-button"
				aria-label="Close model settings"
				onclick={() => (ai.settingsOpen = false)}><PatternIcon name="close" size={18} /></button
			>
		</div>
		<h2 id="model-settings-title">Connect the intelligence.</h2>
		<p class="dialog-intro">
			Choose where the model runs. Captioning also has its own local vision model.
		</p>
		<div class="provider-choices">
			<button
				aria-pressed={ai.provider === 'local'}
				class:selected={ai.provider === 'local'}
				disabled={ai.busy || ai.loading || ai.visionLoading}
				onclick={() => (ai.provider = 'local')}
				><PatternIcon name="cpu" size={22} /><strong>On this device</strong><span
					>Private · WebGPU · no key</span
				></button
			><button
				aria-pressed={ai.provider === 'openai'}
				class:selected={ai.provider === 'openai'}
				disabled={ai.busy || ai.loading || ai.visionLoading}
				onclick={() => (ai.provider = 'openai')}
				><PatternIcon name="key" size={22} /><strong>OpenAI</strong><span
					>Your API key · your account</span
				></button
			>
		</div>
		{#if ai.provider === 'local'}<ChoiceGroup
				label="Choose a local model"
				value={ai.localModel}
				disabled={ai.loading || ai.busy}
				options={[
					{ value: 'onnx-community/Qwen3-0.6B-ONNX', label: 'Qwen3 0.6B · small' },
					{ value: 'onnx-community/Qwen3-1.7B-ONNX', label: 'Qwen3 1.7B · stronger' }
				]}
				onchange={(value) => (ai.localModel = value)}
			/>
			<p class="control-help">
				A one-time model download from Hugging Face: roughly 0.5 GB for the small model, or 1.2 GB
				for the stronger one. Weights are cached by your browser. Prompts stay on this device.
			</p>
			{#if ai.loading}<div class="download-progress" role="status">
					<span
						>{ai.progress.status === 'progress'
							? 'Downloading model weights…'
							: ai.progress.status === 'done'
								? 'Preparing the model…'
								: (ai.progress.status ?? 'Loading…')}</span
					>{#if typeof ai.progress.progress === 'number'}<progress
							max="100"
							value={ai.progress.progress}
						></progress><small
							>{Math.round(ai.progress.progress)}% of {ai.progress.file?.split('/').at(-1) ??
								'current file'}</small
						>{/if}
				</div>
				<button class="secondary-button" onclick={() => ai.unload()}>Cancel download</button
				>{:else}<button
					class="primary-button connect-button"
					disabled={ai.busy}
					onclick={() => (ai.ready ? (ai.settingsOpen = false) : ai.loadLocal())}
					>{#if ai.ready}<PatternIcon name="check" size={16} /> Use this model{:else}<PatternIcon
							name="download"
							size={16}
						/> Download & load model{/if}</button
				>{/if}
		{:else}
			{#if ai.devKeyAvailable}<div class="key-source" role="group" aria-label="OpenAI connection">
					<button
						aria-pressed={ai.useDevKey}
						disabled={ai.busy}
						onclick={() => (ai.useDevKey = true)}
						><PatternIcon name="cpu" size={20} />This computer</button
					>
					<button
						aria-pressed={!ai.useDevKey}
						disabled={ai.busy}
						onclick={() => (ai.useDevKey = false)}
						><PatternIcon name="key" size={20} />My API key</button
					>
				</div>{/if}
			{#if !ai.useDevKey}<label class="input-label" for="api-key">OpenAI API key</label><input
					id="api-key"
					type="password"
					autocomplete="off"
					spellcheck="false"
					placeholder="sk-…"
					bind:value={ai.apiKey}
					disabled={ai.busy}
				/>{:else}<p class="control-help">
					Connected through this computer. The key stays on the local server.
				</p>{/if}
			<label class="input-label" for="openai-model">Model ID</label><input
				id="openai-model"
				type="text"
				bind:value={ai.openaiModel}
				disabled={ai.busy}
			/>
			<p class="control-help">
				{ai.useDevKey
					? 'Your local connection sends requests to OpenAI.'
					: 'Your key stays in page memory and is sent only to OpenAI.'}
				Prompts, selected images, and tool results are sent when you run a lab. API usage is billed to
				your account.
			</p>
			<div class="dialog-actions">
				{#if !ai.useDevKey}<button
						class="secondary-button"
						disabled={ai.busy || !ai.apiKey}
						onclick={() => (ai.apiKey = '')}>Forget key</button
					>{/if}<button
					class="primary-button"
					disabled={!ai.ready || ai.busy}
					onclick={() => (ai.settingsOpen = false)}>Use this model</button
				>
			</div>{/if}
		{#if ai.error}<div class="error-notice" role="alert">
				<PatternIcon name="alert" size={17} /><span>{ai.error}</span>
			</div>{/if}
	</dialog>{/if}

<style>
	.key-source {
		display: flex;
		gap: 10px;
		margin: 23px 0;
	}
	.key-source button {
		display: flex;
		gap: 10px;
		align-items: center;
		flex: 1;
		padding: 15px;
		border: 0;
		border-radius: 12px;
		background: var(--surface);
		color: var(--muted);
		font-size: 13px;
	}
	.key-source button[aria-pressed='true'] {
		background: var(--accent-bg);
		color: var(--green);
	}
</style>
