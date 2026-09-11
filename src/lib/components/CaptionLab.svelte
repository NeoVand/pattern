<script lang="ts">
	import PatternIcon from '$lib/components/PatternIcon.svelte';
	import { onDestroy } from 'svelte';
	import type { AiSession } from '$lib/ai/session.svelte';
	let { ai }: { ai: AiSession } = $props();
	const examples = [
		{
			src: '/images/caption-garden.webp',
			name: 'Garden',
			alt: 'A golden retriever, a red ball, and a garden bench'
		},
		{
			src: '/images/caption-coast.webp',
			name: 'Coast',
			alt: 'A white sailboat near a red lighthouse on a rocky coast'
		}
	];
	let image = $state(examples[0].src);
	let imageName = $state(examples[0].alt);
	let uploaded = $state(false);
	let patches = $state(false);
	let prompt = $state('Describe this image in one sentence.');
	let output = $state('');
	let running = $state(false);
	let error = $state('');
	let resultModel = $state('');
	let stopped = $state(false);
	let controller: AbortController | undefined;
	const ready = $derived(ai.provider === 'local' ? ai.visionReady : ai.ready);
	function select(src: string, name: string, upload = false) {
		image = src;
		imageName = name;
		uploaded = upload;
		output = '';
		error = '';
		stopped = false;
		resultModel = '';
	}
	async function readFile(event: Event) {
		const file = (event.target as HTMLInputElement).files?.[0];
		if (!file) return;
		if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
			error = 'Choose a PNG, JPEG, or WebP image.';
			return;
		}
		if (file.size > 15 * 1024 * 1024) {
			error = 'Choose an image smaller than 15 MB.';
			return;
		}
		try {
			select(await asDataUrl(file), file.name, true);
		} catch {
			error = 'This image could not be read.';
		}
	}
	function asDataUrl(blob: Blob): Promise<string> {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = () => resolve(String(reader.result));
			reader.onerror = reject;
			reader.readAsDataURL(blob);
		});
	}
	async function run() {
		if (!ready || ai.busy || ai.visionLoading) return;
		controller = new AbortController();
		const signal = controller.signal;
		running = true;
		output = '';
		error = '';
		stopped = false;
		resultModel = ai.provider === 'local' ? 'SmolVLM · 256M · on this device' : ai.openaiModel;
		try {
			const pixels = image.startsWith('data:')
				? image
				: await asDataUrl(await (await fetch(image, { signal })).blob());
			const result = await ai.caption({
				messages: [{ role: 'user', content: prompt, images: [pixels] }],
				maxTokens: 120,
				temperature: 0,
				signal,
				onText: (text) => {
					output += text;
				}
			});
			output = result.text;
		} catch (e) {
			if (e instanceof Error && e.name === 'AbortError') stopped = true;
			else error = e instanceof Error ? e.message : String(e);
		} finally {
			running = false;
		}
	}
	onDestroy(() => controller?.abort());
</script>

<div class="caption-intro">
	<span class="small-overline">03 / TURN PIXELS INTO WORDS</span>
	<h2>Beyond “what is it?”<br /><em>What is happening?</em></h2>
	<p>
		A vision-language model connects objects, their relationships, and words. It has already learned
		from images and text; here, we use that training to describe a new image.
	</p>
</div>
<div class="caption-lab">
	<div class="caption-image-column">
		<div class="caption-photograph">
			<img src={image} alt={imageName} width="1536" height="1024" />
			{#if patches}<div class="image-patches" aria-hidden="true">
					{#each Array.from({ length: 48 }, (_, i) => i) as cell (cell)}<i></i>{/each}
				</div>{/if}
			<button
				class="patch-toggle"
				class:active={patches}
				aria-pressed={patches}
				onclick={() => (patches = !patches)}
				><PatternIcon name="grid" size={16} /> {patches ? 'Hide patches' : 'See as patches'}</button
			>
			<span class="image-origin">{uploaded ? 'Your image' : 'AI-generated example'}</span>
		</div>
		<div class="caption-image-options">
			{#each examples as item (item.src)}<button
					disabled={running}
					aria-pressed={image === item.src}
					class:selected={image === item.src}
					onclick={() => select(item.src, item.alt)}
					><img src={item.src} alt="" width="72" height="48" /><span>{item.name}</span></button
				>{/each}
			<label class="upload-image" class:disabled={running}
				><PatternIcon name="upload" size={18} /><span>Your image</span><input
					type="file"
					accept="image/png,image/jpeg,image/webp"
					aria-label="Upload an image to caption"
					disabled={running}
					onchange={readFile}
				/></label
			>
		</div>
		<p class="patch-explanation">
			{patches
				? 'Illustrative patches. A vision encoder transforms image regions into numerical features.'
				: 'Choose a scene, or bring your own image. The model receives the actual pixels.'}
		</p>
	</div>
	<div class="caption-output-column">
		<div class="caption-model-choice" aria-label="Captioning provider">
			<button
				disabled={ai.busy || ai.visionLoading || ai.loading}
				aria-pressed={ai.provider === 'local'}
				onclick={() => (ai.provider = 'local')}>On this device</button
			><button
				disabled={ai.busy || ai.visionLoading || ai.loading}
				aria-pressed={ai.provider === 'openai'}
				onclick={() => (ai.provider = 'openai')}>OpenAI</button
			>
		</div>
		<div class="caption-output" aria-live="polite" aria-busy={running}>
			<span class="small-overline"
				>{running ? 'READING THE IMAGE…' : output ? 'MODEL CAPTION' : 'IMAGE → LANGUAGE'}</span
			>
			{#if output}<p class="generated-caption">{output}</p>
				<small>{resultModel}{stopped ? ' · stopped' : ''}</small>{:else}<p
					class="caption-placeholder"
				>
					A scene goes in.<br /><em>A description comes out.</em>
				</p>{/if}
			{#if error || ai.visionError}<p class="error-notice" role="alert">
					{error || ai.visionError}
				</p>{/if}
		</div>
		{#if ai.visionLoading}<div class="caption-download" role="status">
				<span
					>{ai.visionProgress.status === 'progress'
						? 'Downloading vision model…'
						: 'Preparing the vision model…'}</span
				>{#if typeof ai.visionProgress.progress === 'number'}<progress
						max="100"
						value={ai.visionProgress.progress}
					></progress><small
						>{Math.round(ai.visionProgress.progress)}% of {ai.visionProgress.file
							?.split('/')
							.at(-1)}</small
					>{/if}<button class="text-button" onclick={() => ai.unloadVision()}
					>Cancel download</button
				>
			</div>
		{:else if !ready}
			{#if ai.provider === 'local'}<button
					class="primary-button"
					disabled={ai.busy || ai.loading}
					onclick={() => ai.loadVision()}
					><PatternIcon name="download" size={17} /> Load vision model</button
				>
				<p class="caption-model-note">
					SmolVLM 256M · about 1 GB, downloaded once.<br />Images stay on this device. Requires
					WebGPU.
				</p>
			{:else}<button class="primary-button" onclick={() => (ai.settingsOpen = true)}
					><PatternIcon name="settings" size={17} /> Connect OpenAI</button
				>
				<p class="caption-model-note">
					Use your API key and a model with vision.<br />The image and prompt are sent to OpenAI.
				</p>{/if}
		{:else}<div class="caption-run-row">
				<button
					class="primary-button"
					disabled={!running && ai.busy}
					onclick={() => (running ? controller?.abort() : run())}
					>{#if running}<PatternIcon name="stop" size={15} /> Stop{:else}<PatternIcon
							name="play"
							size={16}
						/> Write a caption{/if}</button
				><span>{ai.provider === 'local' ? 'SmolVLM · 256M' : ai.openaiModel}</span>
			</div>{/if}
		<details class="caption-question">
			<summary>Ask something else</summary><label for="caption-prompt"
				>Question about the image</label
			><textarea id="caption-prompt" bind:value={prompt} disabled={running} rows="2" maxlength="800"
			></textarea>
		</details>
	</div>
</div>
<div class="vision-pipeline">
	<span><strong>Image</strong><small>Pixels</small></span><PatternIcon
		name="arrowRight"
		size={18}
	/><span><strong>Vision encoder</strong><small>Visual features</small></span><PatternIcon
		name="arrowRight"
		size={18}
	/><span><strong>Language model</strong><small>Words in context</small></span><PatternIcon
		name="arrowRight"
		size={18}
	/><span><strong>Caption</strong><small>A predicted description</small></span>
</div>
<p class="caption-footnote">
	A caption is a prediction, not a verified account. Compare the words with the image: even a fluent
	answer can invent a detail.
</p>
