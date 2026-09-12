<script lang="ts">
	import PatternIcon from '$lib/components/PatternIcon.svelte';
	import type { AiSession } from '$lib/ai/session.svelte';
	import SelectMenu from './SelectMenu.svelte';
	import ChoiceGroup from './ChoiceGroup.svelte';
	let { ai }: { ai: AiSession } = $props();
	function openDialog(node: HTMLDialogElement) {
		node.showModal();
		if (ai.provider === 'openai' && !ai.models.length && !ai.modelsLoading) void ai.refreshModels();
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
				onclick={() => {
					ai.provider = 'openai';
					void ai.refreshModels();
				}}
				><PatternIcon name="key" size={22} /><strong>OpenAI</strong><span
					>Your API key · your account</span
				></button
			>
		</div>
		<div class="model-configuration">
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
				{/if}
			{:else}
				{#if ai.devKeyAvailable}<div class="key-source" role="group" aria-label="OpenAI connection">
						<button
							aria-pressed={ai.useDevKey}
							disabled={ai.busy}
							onclick={() => {
								ai.useDevKey = true;
								void ai.refreshModels();
							}}><PatternIcon name="cpu" size={20} />This computer</button
						>
						<button
							aria-pressed={!ai.useDevKey}
							disabled={ai.busy}
							onclick={() => {
								ai.useDevKey = false;
								void ai.refreshModels();
							}}><PatternIcon name="key" size={20} />My API key</button
						>
					</div>{/if}
				{#if !ai.useDevKey}<label class="input-label" for="api-key">OpenAI API key</label><input
						id="api-key"
						type="password"
						autocomplete="off"
						spellcheck="false"
						placeholder="sk-…"
						bind:value={ai.apiKey}
						onchange={() => ai.refreshModels()}
						disabled={ai.busy}
					/>{:else}<p class="control-help">
						Connected through this computer. The key stays on the local server.
					</p>{/if}
				<div class="catalog-heading">
					<span>Available on your account</span><button
						class="text-button"
						disabled={ai.modelsLoading || ai.busy}
						onclick={() => ai.refreshModels()}
						><PatternIcon name="reset" size={14} />{ai.modelsLoading
							? 'Loading…'
							: 'Refresh'}</button
					>
				</div>
				<SelectMenu
					label="Language & vision"
					value={ai.openaiModel}
					options={ai.models}
					onchange={(value) => (ai.openaiModel = value)}
					disabled={ai.busy || ai.modelsLoading || !ai.models.length}
					placeholder={ai.modelsLoading ? 'Finding available models…' : 'Connect to see models'}
				/>
				{#if ai.speechModels.length}<SelectMenu
						label="Speech"
						value={ai.speechModel}
						options={ai.speechModels}
						onchange={(value) => (ai.speechModel = value)}
						disabled={ai.busy}
					/>{/if}
				{#if ai.imageModels.length}<SelectMenu
						label="Image generation"
						value={ai.imageModel}
						options={ai.imageModels}
						onchange={(value) => (ai.imageModel = value)}
						disabled={ai.busy}
					/>{/if}
				{#if ai.modelsError}<p class="error-notice" role="alert">{ai.modelsError}</p>{/if}

				<p class="control-help">
					{ai.useDevKey
						? 'Your local connection sends requests to OpenAI.'
						: 'Your key stays in page memory and is sent only to OpenAI.'}
					Prompts, selected images, and tool results are sent when you run a lab. API usage is billed
					to your account.
				</p>
			{/if}
			{#if ai.error}<div class="error-notice" role="alert">
					<PatternIcon name="alert" size={17} /><span>{ai.error}</span>
				</div>{/if}
		</div>
		<div class="dialog-actions">
			{#if ai.provider === 'local'}
				{#if ai.loading}<button class="secondary-button" onclick={() => ai.unload()}
						>Cancel download</button
					>
				{:else}<button
						class="primary-button"
						disabled={ai.busy}
						onclick={() => (ai.ready ? (ai.settingsOpen = false) : ai.loadLocal())}
					>
						<PatternIcon name={ai.ready ? 'check' : 'download'} size={16} />
						{ai.ready ? 'Use this model' : 'Download & load model'}
					</button>{/if}
			{:else}
				{#if !ai.useDevKey}<button
						class="secondary-button"
						disabled={ai.busy || !ai.apiKey}
						onclick={() => {
							ai.apiKey = '';
							void ai.refreshModels();
						}}>Forget key</button
					>{/if}
				<button
					class="primary-button"
					disabled={!ai.ready ||
						ai.busy ||
						ai.modelsLoading ||
						!ai.models.some((model) => model.value === ai.openaiModel)}
					onclick={() => (ai.settingsOpen = false)}>Use this model</button
				>
			{/if}
		</div>
	</dialog>{/if}

<style>
	.catalog-heading {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-top: 6px;
		gap: 12px;
		font-size: 12px;
		color: var(--muted);
	}
	.catalog-heading .text-button {
		padding: 6px 0;
		font-size: 12px;
	}
	.model-dialog h2 {
		font-size: 32px;
		margin: 10px 0;
	}
	.model-dialog .dialog-intro {
		font-size: 13px;
		line-height: 1.6;
		margin: 0 0 18px;
	}
	.model-dialog .provider-choices {
		gap: 10px;
		margin: 0 0 18px;
	}
	.model-dialog .provider-choices button {
		padding: 14px;
		gap: 6px;
		border-radius: 14px;
	}
	.model-dialog .provider-choices strong {
		font-size: 14px;
	}
	.model-dialog .provider-choices span {
		font-size: 11px;
	}
	.model-dialog .control-help {
		font-size: 12px;
		line-height: 1.65;
	}
	.model-dialog input {
		min-height: 44px;
		padding: 12px 14px;
		font-size: 14px;
		border-radius: 12px;
	}
	.model-dialog input:focus-visible {
		outline: 2px solid var(--focus);
		outline-offset: -2px;
	}
	.model-dialog .dialog-actions {
		display: flex;
		justify-content: flex-end;
		gap: 10px;
	}
	.model-dialog .dialog-actions button {
		min-height: 42px;
		padding: 10px 16px;
		font-size: 13px;
	}

	.model-dialog[open] {
		display: flex;
		flex-direction: column;
		height: auto;
		width: min(560px, calc(100vw - 24px));
		padding: 26px;
		gap: 0;
		max-height: calc(100dvh - 32px);
		overflow: hidden;
		transition:
			opacity 180ms ease,
			transform 180ms ease;
	}
	.model-dialog > :not(.model-configuration) {
		flex-shrink: 0;
	}
	.model-configuration {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		overscroll-behavior: contain;
		scrollbar-width: thin;
		padding: 3px;
		margin: 0 -3px;
	}
	.model-configuration > :global(*) {
		flex-shrink: 0;
	}
	.model-configuration .control-help {
		margin: 14px 0 18px;
	}
	.dialog-actions {
		grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
		padding-top: 18px;
	}
	.provider-choices button,
	.key-source button {
		transition:
			background 160ms ease,
			box-shadow 160ms ease,
			color 160ms ease;
	}
	@starting-style {
		.model-dialog[open] {
			opacity: 0;
			transform: translateY(8px);
		}
	}
	@media (max-height: 680px) {
		.model-dialog[open] {
			overflow-y: auto;
		}
		.model-configuration {
			flex: none;
			overflow: visible;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.model-dialog[open],
		.provider-choices button,
		.key-source button {
			transition: none;
		}
	}
	.key-source {
		display: flex;
		gap: 10px;
		margin: 0 0 10px;
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
