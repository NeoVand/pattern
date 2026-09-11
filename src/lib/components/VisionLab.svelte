<script lang="ts">
	import { onDestroy } from 'svelte';
	import type { AiSession } from '$lib/ai/session.svelte';
	import PatternIcon from './PatternIcon.svelte';
	let { ai }: { ai: AiSession } = $props();
	type Mode = 'read' | 'spatial' | 'scene' | 'compare';
	type Picture = { src: string; name: string; alt: string; uploaded?: boolean };
	const pictures: Picture[] = [
		{
			src: '/images/vision-board.webp',
			name: 'Invitation',
			alt: 'An illustrated natural-history exhibition invitation with printed details and objects'
		},
		{
			src: '/images/caption-garden.webp',
			name: 'Garden',
			alt: 'A dog in a garden with a bench and a red ball'
		},
		{
			src: '/images/caption-coast.webp',
			name: 'Coast',
			alt: 'A sailboat on the sea near a lighthouse'
		},
		{
			src: '/images/shoe-studies.webp',
			name: 'Objects',
			alt: 'A photographic study of different shoes'
		}
	];
	const modes: { id: Mode; title: string; question: string; description: string }[] = [
		{
			id: 'read',
			title: 'Read text',
			question:
				'Read the exhibition invitation. List its title, location, dates, and opening hours exactly as printed. If a detail is missing or hard to read, say so. Keep the answer concise.',
			description: 'Read the words in the image, then check them against the original.'
		},
		{
			id: 'spatial',
			title: 'Find relationships',
			question:
				'Name three visible objects in this image. Describe where each is positioned relative to the others. Separate what you can see from anything you are unsure about.',
			description: 'An object is one thing. Its relationship to the scene is another.'
		},
		{
			id: 'scene',
			title: 'Describe a scene',
			question:
				'Describe what is happening in this image in two sentences. Mention concrete visual evidence. Do not invent anything outside the frame.',
			description: 'Connect objects, actions, and setting in a short description.'
		},
		{
			id: 'compare',
			title: 'Compare images',
			question:
				'Compare image 1 and image 2. Give two specific differences and one visual similarity. Refer to each image by number and use only visible evidence.',
			description: 'Two images become part of the same context. The model can reason across them.'
		}
	];
	let mode = $state<Mode>('read');
	let question = $state(modes[0].question);
	let chosen = $state<Picture[]>([pictures[0], pictures[2]]);
	let slot = $state(0);
	let detail = $state(false);
	let running = $state(false);
	let output = $state('');
	let error = $state('');
	let stopped = $state(false);
	let resultModel = $state('');
	let resultQuestion = $state('');
	let resultImages = $state<string[]>([]);
	let outputTokens = $state<number>();
	let elapsedMs = $state(0);
	let controller: AbortController | undefined;
	let readingFile = $state(false);
	const activeMode = $derived(modes.find((item) => item.id === mode)!);
	const ready = $derived(ai.provider === 'local' ? ai.visionReady : ai.ready);
	const compare = $derived(mode === 'compare');
	const visiblePictures = $derived(compare ? chosen : [chosen[0]]);
	const isLocalCompare = $derived(compare && ai.provider === 'local');
	const blocked = $derived(running || readingFile || ai.visionLoading || ai.loading);
	function clearResult() {
		output = '';
		error = '';
		stopped = false;
		resultModel = '';
		resultQuestion = '';
		resultImages = [];
		outputTokens = undefined;
		elapsedMs = 0;
	}
	function chooseMode(next: Mode) {
		mode = next;
		question = modes.find((item) => item.id === next)!.question;
		slot = 0;
		detail = false;
		chosen =
			next === 'compare'
				? [pictures[1], pictures[2]]
				: next === 'scene'
					? [pictures[1], pictures[2]]
					: [pictures[0], pictures[2]];
		clearResult();
	}
	function choosePicture(picture: Picture) {
		chosen[slot] = picture;
		clearResult();
	}
	function asDataUrl(blob: Blob): Promise<string> {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = () => resolve(String(reader.result));
			reader.onerror = () => reject(new Error('The image could not be read.'));
			reader.readAsDataURL(blob);
		});
	}
	async function uploadImage(event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
			error = 'Choose a PNG, JPEG, or WebP image.';
			input.value = '';
			return;
		}
		if (file.size > 8 * 1024 * 1024) {
			error = 'Choose an image smaller than 8 MB.';
			input.value = '';
			return;
		}
		readingFile = true;
		try {
			choosePicture({
				src: await asDataUrl(file),
				name: file.name,
				alt: `Uploaded image: ${file.name}`,
				uploaded: true
			});
		} catch (cause) {
			error = cause instanceof Error ? cause.message : String(cause);
		} finally {
			readingFile = false;
			input.value = '';
		}
	}
	async function pixels(picture: Picture, signal: AbortSignal) {
		if (picture.src.startsWith('data:')) return picture.src;
		const response = await fetch(picture.src, { signal });
		if (!response.ok || !response.headers.get('content-type')?.startsWith('image/'))
			throw new Error(
				'This example image could not be loaded. Choose another image or upload your own.'
			);
		return asDataUrl(await response.blob());
	}
	async function run() {
		if (!question.trim() || ai.busy || blocked || isLocalCompare) return;
		if (!ready) {
			if (ai.provider === 'openai') ai.settingsOpen = true;
			return;
		}
		clearResult();
		running = true;
		controller = new AbortController();
		const signal = controller.signal;
		resultModel = ai.provider === 'local' ? 'SmolVLM · 256M · this device' : ai.label;
		resultQuestion = question.trim();
		const currentPictures = [...visiblePictures];
		resultImages = currentPictures.map((picture) => picture.name);
		const started = performance.now();
		try {
			const images = await Promise.all(currentPictures.map((picture) => pixels(picture, signal)));
			signal.throwIfAborted();
			const completion = await ai.caption({
				messages: [{ role: 'user', content: resultQuestion, images }],
				temperature: 0,
				maxTokens: 420,
				signal,
				onText: (chunk) => (output += chunk)
			});
			output = completion.text;
			outputTokens = completion.outputTokens;
		} catch (cause) {
			if (signal.aborted) stopped = true;
			else error = cause instanceof Error ? cause.message : String(cause);
		} finally {
			elapsedMs = Math.round(performance.now() - started);
			running = false;
		}
	}
	onDestroy(() => controller?.abort());
</script>

<div class="vision-lab">
	<div class="vision-model-bar">
		<div class="vision-model-label">
			<PatternIcon name="vision" size={23} />
			<div>
				<strong>{ai.provider === 'local' ? 'SmolVLM · 256M' : ai.label}</strong><span
					>{ai.provider === 'local'
						? ready
							? 'Vision model ready on this device'
							: 'Local vision model · WebGPU'
						: ready
							? 'OpenAI vision connection ready'
							: 'Connect OpenAI to explore images'}</span
				>
			</div>
		</div>
		<button
			class="vision-settings"
			disabled={running || ai.busy}
			onclick={() => (ai.settingsOpen = true)}
			>Model settings <PatternIcon name="arrowRight" size={14} /></button
		>
	</div>
	<div class="vision-modes" role="group" aria-label="Vision tasks">
		{#each modes as item (item.id)}<button
				aria-pressed={mode === item.id}
				disabled={blocked}
				onclick={() => chooseMode(item.id)}>{item.title}</button
			>{/each}
	</div>
	<div class="vision-workbench">
		<div class="vision-input">
			<div class="vision-images" class:two-images={compare}>
				{#each visiblePictures as picture, index (index)}
					<div class="vision-picture">
						<!-- svelte-ignore a11y_no_noninteractive_tabindex (The zoomed image region must receive keyboard focus so arrow keys can scroll it.) -->
						<div
							class="image-scroll"
							class:detail
							tabindex={detail ? 0 : undefined}
							role="region"
							aria-label={`Image ${index + 1}${detail ? ' detail, scroll to explore' : ''}`}
						>
							<img src={picture.src} alt={picture.alt} width="1536" height="1024" />
						</div>
						<div class="image-label">
							<span>{compare ? `Image ${index + 1} · ` : ''}{picture.name}</span><span
								>{picture.uploaded ? 'Your image' : 'Generated example'}</span
							>
						</div>
					</div>
				{/each}
			</div>
			<div class="image-toolbar">
				{#if compare}<div class="image-slots" role="group" aria-label="Image to replace">
						<button aria-pressed={slot === 0} disabled={blocked} onclick={() => (slot = 0)}
							>Image 1</button
						><button aria-pressed={slot === 1} disabled={blocked} onclick={() => (slot = 1)}
							>Image 2</button
						>
					</div>{:else}<span class="image-instruction">Choose an image</span>{/if}
				<button class="detail-toggle" aria-pressed={detail} onclick={() => (detail = !detail)}
					>{detail ? 'Fit image' : 'See detail'} <PatternIcon name="vision" size={15} /></button
				>
			</div>
			<div class="picture-picker">
				{#each pictures as picture (picture.src)}<button
						disabled={blocked}
						aria-pressed={chosen[slot].src === picture.src}
						onclick={() => choosePicture(picture)}
						><img src={picture.src} alt="" width="84" height="60" /><span>{picture.name}</span
						></button
					>{/each}
				<label class="vision-upload" class:disabled={blocked}
					><PatternIcon name="vision" size={22} /><span
						>{readingFile ? 'Reading…' : 'Your image'}</span
					><input
						type="file"
						accept="image/png,image/jpeg,image/webp"
						aria-label={`Upload ${compare ? `image ${slot + 1}` : 'an image'} for vision analysis`}
						disabled={blocked}
						onchange={uploadImage}
					/></label
				>
			</div>
			<p class="image-note">{activeMode.description}</p>
		</div>
		<div class="vision-conversation">
			<label class="question-label" for="vision-question">Ask the image</label>
			<textarea
				id="vision-question"
				rows="5"
				bind:value={question}
				maxlength="2000"
				disabled={blocked}></textarea>
			<div class="vision-provider" role="group" aria-label="Vision provider">
				<button
					disabled={blocked || ai.busy}
					aria-pressed={ai.provider === 'openai'}
					onclick={() => (ai.provider = 'openai')}>OpenAI</button
				><button
					disabled={blocked || ai.busy}
					aria-pressed={ai.provider === 'local'}
					onclick={() => (ai.provider = 'local')}>On this device</button
				>
			</div>
			{#if isLocalCompare}<div class="vision-connection-note">
					<p>
						The local model reads one image at a time. Use OpenAI for this two-image comparison.
					</p>
					<button class="primary-button" disabled={blocked} onclick={() => (ai.provider = 'openai')}
						>Use OpenAI <PatternIcon name="arrowRight" size={16} /></button
					>
				</div>
			{:else if ai.visionLoading && ai.provider === 'local'}<div
					class="vision-download"
					role="status"
				>
					<p>Preparing the vision model…</p>
					{#if typeof ai.visionProgress.progress === 'number'}<progress
							max="100"
							value={ai.visionProgress.progress}
						></progress><small
							>{Math.round(ai.visionProgress.progress)}% · {ai.visionProgress.file
								?.split('/')
								.at(-1)}</small
						>{/if}<button class="vision-settings" onclick={() => ai.unloadVision()}
						>Cancel download</button
					>
				</div>
			{:else if !ready && ai.provider === 'local'}<button
					class="primary-button"
					disabled={ai.busy || ai.loading}
					onclick={() => ai.loadVision()}
					>Load vision model <PatternIcon name="arrowRight" size={16} /></button
				>
				<p class="vision-connection-note">
					About 1 GB, downloaded once. Requires WebGPU. This small model is better at simple scenes
					than detailed documents.
				</p>
			{:else}<button
					class="primary-button"
					disabled={!running && (ai.busy || blocked || !question.trim())}
					onclick={() => (running ? controller?.abort() : ready ? run() : (ai.settingsOpen = true))}
					>{running
						? 'Stop reading'
						: ready
							? 'Ask the model'
							: 'Connect OpenAI'}{#if !running}<PatternIcon
							name="arrowRight"
							size={17}
						/>{/if}</button
				>{/if}
			<p class="vision-transfer">
				{ai.provider === 'openai'
					? 'The selected image pixels and your question are sent to OpenAI.'
					: 'The selected image and its question stay on this device.'}
			</p>
			{#if error || ai.visionError}<p class="error-notice" role="alert">
					{error || ai.visionError}
				</p>{/if}
			<div class="vision-answer" aria-busy={running}>
				<span class="answer-label"
					>{running
						? 'Reading & responding…'
						: output
							? 'The model’s answer'
							: 'An answer from pixels'}</span
				>
				{#if output}<div class="vision-response">{output}</div>{:else}<p class="vision-empty">
						Words, objects,<br /><em>and the spaces between.</em>
					</p>{/if}
				{#if resultModel}<div class="answer-meta" role="status">
						<span>{resultModel}{stopped ? ' · stopped' : ''}</span><span
							>{elapsedMs ? `${(elapsedMs / 1000).toFixed(1)} s` : 'Generating'}{outputTokens !==
							undefined
								? ` · ${outputTokens} tokens`
								: ''}</span
						>
					</div>{/if}
			</div>
		</div>
	</div>
	{#if resultQuestion}<details class="vision-run-record">
			<summary>What the model received</summary>
			<p>
				<strong>Images:</strong>
				{resultImages.join(' + ')}. Actual pixels are included; example descriptions are not sent.
			</p>
			<p><strong>Question:</strong> {resultQuestion}</p>
		</details>{/if}
	<div class="vision-reading-guide">
		<div>
			<span>01</span>
			<h3>Look.</h3>
			<p>Start with an image you can inspect yourself.</p>
		</div>
		<div>
			<span>02</span>
			<h3>Ask.</h3>
			<p>A question directs the model’s attention to different evidence.</p>
		</div>
		<div>
			<span>03</span>
			<h3>Verify.</h3>
			<p>Check the words against the pixels. Fluent explanations can still miss details.</p>
		</div>
	</div>
</div>

<style>
	.vision-lab {
		margin-top: 22px;
	}
	.vision-model-bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 18px;
		padding: 10px 0 22px;
	}
	.vision-model-label {
		display: flex;
		align-items: center;
		gap: 13px;
		color: var(--green);
	}
	.vision-model-label strong,
	.vision-model-label span {
		display: block;
	}
	.vision-model-label strong {
		font-size: 13px;
		font-weight: 500;
		color: var(--ink);
	}
	.vision-model-label span {
		font-size: 11px;
		color: var(--quiet);
		margin-top: 4px;
	}
	.vision-settings {
		display: flex;
		align-items: center;
		gap: 8px;
		background: transparent;
		border: 0;
		color: var(--muted);
		padding: 8px 0;
		font-size: 11px;
	}
	.vision-modes {
		display: flex;
		flex-wrap: wrap;
		gap: 7px;
		margin: 7px 0 27px;
	}
	.vision-modes button {
		border: 0;
		border-radius: 30px;
		padding: 12px 19px;
		color: var(--muted);
		background: var(--surface);
		font-size: 12px;
	}
	.vision-modes button[aria-pressed='true'] {
		background: var(--accent-bg);
		color: var(--green);
	}
	.vision-workbench {
		display: grid;
		grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr);
		gap: 32px;
		align-items: start;
	}
	.vision-images {
		display: grid;
		gap: 12px;
	}
	.vision-images.two-images {
		grid-template-columns: 1fr 1fr;
	}
	.vision-picture {
		min-width: 0;
	}
	.image-scroll {
		display: flex;
		justify-content: center;
		align-items: center;
		overflow: hidden;
		border-radius: 20px;
		background: color-mix(in srgb, var(--ink) 3%, var(--surface));
		aspect-ratio: 3 / 2;
	}
	.image-scroll img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: contain;
	}
	.two-images .image-scroll {
		aspect-ratio: 3 / 2;
	}
	.image-scroll.detail {
		display: block;
		overflow: auto;
	}
	.image-scroll.detail img {
		width: 1200px;
		height: auto;
		max-width: none;
	}
	.image-label {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		gap: 5px;
		padding: 10px 4px 0;
		font-size: 10px;
		color: var(--quiet);
	}
	.image-label span:first-child {
		color: var(--muted);
		overflow-wrap: anywhere;
	}
	.image-toolbar {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 16px;
		margin-top: 22px;
	}
	.image-instruction {
		font-size: 11px;
		color: var(--muted);
	}
	.detail-toggle {
		border: 0;
		background: transparent;
		color: var(--muted);
		display: flex;
		align-items: center;
		gap: 7px;
		font-size: 11px;
		padding: 7px 0;
	}
	.detail-toggle[aria-pressed='true'] {
		color: var(--green);
	}
	.image-slots,
	.vision-provider {
		display: flex;
		gap: 3px;
		padding: 4px;
		background: var(--surface);
		border-radius: 30px;
		width: fit-content;
	}
	.image-slots button,
	.vision-provider button {
		padding: 8px 13px;
		font-size: 11px;
		color: var(--muted);
		background: transparent;
		border: 0;
		border-radius: 25px;
	}
	.image-slots button[aria-pressed='true'],
	.vision-provider button[aria-pressed='true'] {
		color: var(--ink);
		background: var(--surface-raised);
	}
	.picture-picker {
		display: grid;
		grid-template-columns: repeat(5, minmax(0, 1fr));
		gap: 9px;
		margin-top: 14px;
	}
	.picture-picker button {
		min-width: 0;
		border: 0;
		border-radius: 12px;
		background: transparent;
		color: var(--muted);
		padding: 5px;
		text-align: left;
	}
	.picture-picker button[aria-pressed='true'] {
		background: var(--accent-bg);
		color: var(--green);
	}
	.picture-picker button img {
		display: block;
		width: 100%;
		height: auto;
		aspect-ratio: 1.4;
		object-fit: cover;
		border-radius: 9px;
	}
	.picture-picker button span {
		display: block;
		font-size: 10px;
		text-align: center;
		margin: 8px 0 4px;
	}
	.vision-upload {
		position: relative;
		display: flex;
		justify-content: center;
		align-items: center;
		flex-direction: column;
		gap: 9px;
		background: var(--surface);
		border-radius: 12px;
		font-size: 10px;
		cursor: pointer;
		color: var(--muted);
		text-align: center;
	}
	.vision-upload.disabled {
		opacity: 0.5;
	}
	.vision-upload input {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		opacity: 0;
		cursor: pointer;
	}
	.vision-upload:focus-within {
		outline: 2px solid var(--green);
		outline-offset: 3px;
	}
	.image-note {
		color: var(--quiet);
		font-size: 11px;
		line-height: 1.7;
		margin: 15px 4px 0;
	}
	.vision-conversation {
		min-width: 0;
	}
	.question-label {
		display: block;
		color: var(--ink);
		font-size: 12px;
		margin: 0 0 12px;
	}
	textarea {
		display: block;
		width: 100%;
		min-height: 148px;
		resize: vertical;
		background: var(--surface);
		color: var(--ink);
		border: 0;
		border-radius: 15px;
		padding: 17px;
		font-family: inherit;
		line-height: 1.7;
		font-size: 12px;
	}
	.vision-provider {
		margin: 18px 0;
	}
	.vision-conversation .primary-button {
		margin: 0;
		width: 100%;
	}
	.vision-transfer {
		color: var(--quiet);
		font-size: 10px;
		line-height: 1.6;
		margin: 12px 0 0;
	}
	.vision-connection-note,
	.vision-connection-note p {
		color: var(--muted);
		font-size: 11px;
		line-height: 1.7;
	}
	.vision-connection-note p {
		margin: 0 0 15px;
	}
	.vision-download {
		font-size: 12px;
		color: var(--muted);
	}
	.vision-download p {
		margin: 0 0 13px;
	}
	.vision-download progress {
		display: block;
		width: 100%;
		height: 5px;
		accent-color: var(--green);
	}
	.vision-download small {
		display: block;
		overflow-wrap: anywhere;
		margin-top: 8px;
	}
	.vision-answer {
		padding: 24px 0 8px;
		margin-top: 9px;
	}
	.answer-label {
		font-size: 10px;
		color: var(--quiet);
	}
	.vision-response {
		font-size: 13px;
		line-height: 1.85;
		color: var(--ink);
		white-space: pre-wrap;
		overflow-wrap: anywhere;
		margin-top: 17px;
	}
	.vision-empty {
		font-family: 'Instrument Serif', serif;
		font-size: 31px;
		line-height: 1.25;
		font-weight: 400;
		color: var(--muted);
		margin: 21px 0 0;
	}
	.vision-empty em {
		color: var(--green);
	}
	.answer-meta {
		display: flex;
		flex-wrap: wrap;
		gap: 6px 14px;
		font-size: 10px;
		color: var(--quiet);
		margin-top: 18px;
		line-height: 1.5;
	}
	.vision-run-record {
		margin-top: 25px;
		max-width: 780px;
	}
	.vision-run-record summary {
		color: var(--muted);
		font-size: 11px;
		cursor: pointer;
		padding: 8px 0;
	}
	.vision-run-record p {
		font-size: 12px;
		line-height: 1.7;
		color: var(--muted);
	}
	.vision-reading-guide {
		display: grid;
		grid-template-columns: 1fr 1fr 1fr;
		gap: 35px;
		padding: 40px 8px 10px;
	}
	.vision-reading-guide > div > span {
		font-family: 'JetBrains Mono Variable', monospace;
		font-size: 10px;
		color: var(--quiet);
	}
	h3 {
		font-family: 'Instrument Serif', serif;
		font-size: 34px;
		font-weight: 400;
		margin: 12px 0 10px;
		color: var(--ink);
	}
	.vision-reading-guide p {
		font-size: 12px;
		color: var(--muted);
		line-height: 1.7;
		max-width: 220px;
		margin: 0;
	}
	@media (max-width: 1150px) {
		.vision-workbench {
			gap: 24px;
			grid-template-columns: minmax(0, 1.35fr) minmax(0, 1fr);
		}
		.vision-modes button {
			padding: 11px 16px;
		}
	}
	@media (max-width: 820px) {
		.vision-workbench {
			grid-template-columns: 1fr;
			gap: 30px;
		}
		.image-scroll {
			max-height: 540px;
		}
		.vision-conversation {
			display: block;
		}
		.vision-empty {
			font-size: 34px;
		}
		.vision-reading-guide {
			gap: 22px;
		}
	}
	@media (max-width: 480px) {
		.vision-model-bar {
			align-items: flex-start;
		}
		.vision-model-label span {
			max-width: 170px;
			line-height: 1.5;
		}
		.vision-settings {
			font-size: 10px;
		}
		.vision-modes {
			gap: 6px;
		}
		.vision-modes button {
			padding: 10px 13px;
			font-size: 11px;
		}
		.picture-picker {
			gap: 4px;
		}
		.picture-picker button {
			padding: 4px;
		}
		.picture-picker button span,
		.vision-upload {
			font-size: 9px;
		}
		.image-scroll,
		.picture-picker button img {
			border-radius: 12px;
		}
		.vision-reading-guide {
			grid-template-columns: 1fr;
			gap: 25px;
			padding-top: 30px;
		}
		.vision-reading-guide > div {
			display: grid;
			grid-template-columns: 24px 85px 1fr;
			align-items: baseline;
			gap: 10px;
		}
		.vision-reading-guide h3 {
			font-size: 29px;
			margin: 0;
		}
		.vision-reading-guide p {
			font-size: 11px;
		}
	}
</style>
