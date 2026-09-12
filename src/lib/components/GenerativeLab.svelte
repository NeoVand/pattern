<script lang="ts">
	import { onDestroy } from 'svelte';
	import type { AiSession } from '$lib/ai/session.svelte';
	import type { ImageOptions } from '$lib/ai/images';
	import PatternIcon from './PatternIcon.svelte';
	import ChoiceGroup from './ChoiceGroup.svelte';
	import SelectMenu from './SelectMenu.svelte';
	let { ai }: { ai: AiSession } = $props();
	const studies = [
		{
			name: 'Impossible garden',
			prompt:
				'An architectural photograph of a quiet botanical conservatory on the Moon. Blue glass domes, silver foliage, soft lunar light. Sophisticated editorial photography, restrained powder-blue and lavender palette, no text.'
		},
		{
			name: 'Material study',
			prompt:
				'A single elegant seashell made entirely of folded pale blue paper, delicate lavender shadow, on a seamless cool blue-grey background. Macro product photography. Exquisite folds, realistic paper texture, spacious composition. No text.'
		},
		{
			name: 'Explain an idea',
			prompt:
				'A beautiful scientific infographic showing a butterfly life cycle: Egg, Caterpillar, Chrysalis, Butterfly. Four accurate specimens, clearly connected clockwise, crisp elegant sans-serif labels. Powder blue and lavender accents on a clean cool white background. Calm, precise museum exhibit design.'
		}
	];
	let prompt = $state(studies[0].prompt),
		quality = $state<ImageOptions['quality']>('medium'),
		size = $state<ImageOptions['size']>('1024x1024');
	type Result = {
		id: number;
		url: string;
		prompt: string;
		model: string;
		quality: string;
		size: string;
		seconds: number;
	};
	let gallery = $state.raw<Result[]>([]),
		selected = $state(0),
		running = $state(false),
		error = $state(''),
		elapsed = $state(0);
	let controller: AbortController | undefined,
		timer: ReturnType<typeof setInterval> | undefined,
		nextId = 1;
	const current = $derived(gallery.find((r) => r.id === selected));
	const ready = $derived(ai.provider === 'openai' && ai.ready && !!ai.imageModel);
	async function create(repeat?: Result) {
		if (!ready) {
			ai.settingsOpen = true;
			return;
		}
		if (running || ai.busy) return;
		const input = {
			prompt: repeat?.prompt ?? prompt,
			size: (repeat?.size ?? size) as ImageOptions['size'],
			quality: (repeat?.quality ?? quality) as ImageOptions['quality']
		};
		if (repeat) ai.imageModel = repeat.model;
		running = true;
		error = '';
		elapsed = 0;
		controller = new AbortController();
		const start = performance.now();
		timer = setInterval(() => (elapsed = Math.floor((performance.now() - start) / 1000)), 1000);
		try {
			const output = await ai.createImage({ ...input, signal: controller.signal });
			if (controller.signal.aborted) return;
			const result = {
				...input,
				id: nextId++,
				url: URL.createObjectURL(output.blob),
				model: output.model,
				seconds: (performance.now() - start) / 1000
			};
			const previous = gallery;
			gallery = [...gallery.slice(-5), result];
			for (const old of previous.filter((x) => !gallery.includes(x))) URL.revokeObjectURL(old.url);
			selected = result.id;
		} catch (e) {
			if (!(e instanceof Error && e.name === 'AbortError'))
				error = e instanceof Error ? e.message : String(e);
		} finally {
			clearInterval(timer);
			running = false;
		}
	}
	onDestroy(() => {
		controller?.abort();
		clearInterval(timer);
		gallery.forEach((r) => URL.revokeObjectURL(r.url));
	});
</script>

<div class="generative-lab">
	<div class="generation-principle">
		<div>
			<PatternIcon name="database" size={22} /><span>Examples</span><small
				>Teach patterns during training</small
			>
		</div>
		<PatternIcon name="arrowRight" size={18} />
		<div>
			<PatternIcon name="neural" size={22} /><span>Learned model</span><small
				>Weights stay fixed here</small
			>
		</div>
		<PatternIcon name="arrowRight" size={18} />
		<div>
			<PatternIcon name="sparkles" size={22} /><span>New possibility</span><small
				>Your prompt guides generation</small
			>
		</div>
	</div>
	<div class="creative-studio">
		<div class="creative-controls">
			<span class="studio-kicker">THE IMAGE STUDIO</span>
			<h2>One idea.<br /><em>Many possibilities.</em></h2>
			<p>
				Keep the prompt, generate again, and compare. Variation comes from generation—not another
				round of training.
			</p>
			<div class="study-presets">
				{#each studies as study (study.name)}<button
						disabled={running}
						aria-pressed={prompt === study.prompt}
						onclick={() => (prompt = study.prompt)}>{study.name}</button
					>{/each}
			</div>
			<label for="image-prompt">Describe an image</label><textarea
				id="image-prompt"
				bind:value={prompt}
				maxlength="4000"
				rows="5"
				disabled={running}></textarea>
			<SelectMenu
				label="Image model"
				value={ai.imageModel}
				options={ai.imageModels}
				onchange={(v) => (ai.imageModel = v)}
				disabled={running || ai.busy || !ai.imageModels.length}
				placeholder="Connect OpenAI to see models"
			/>
			<ChoiceGroup
				label="Shape"
				value={size}
				options={[
					{ value: '1024x1024', label: 'Square' },
					{ value: '1536x1024', label: 'Landscape' },
					{ value: '1024x1536', label: 'Portrait' }
				]}
				onchange={(v) => (size = v)}
				disabled={running}
			/>
			<ChoiceGroup
				label="Rendering quality"
				value={quality}
				options={[
					{ value: 'low', label: 'Draft' },
					{ value: 'medium', label: 'Balanced' },
					{ value: 'high', label: 'Detailed' }
				]}
				onchange={(v) => (quality = v)}
				disabled={running}
			/>
			<div class="creative-actions">
				<button
					class="primary-button"
					disabled={running || ai.busy || !prompt.trim()}
					onclick={() => create()}
					><PatternIcon name="sparkles" size={17} />{ready
						? 'Create an image'
						: 'Connect image model'}</button
				>{#if running}<button class="text-button" onclick={() => controller?.abort()}>Cancel</button
					>{/if}
			</div>
			<p class="request-note">
				One image per request. Higher quality takes more time and API usage. Your prompt is sent to
				OpenAI.
			</p>
			{#if error}<p class="error-notice" role="alert">{error}</p>{/if}
		</div>
		<div class="creative-gallery">
			<div class="canvas-top">
				<span>{current ? 'GENERATED IMAGE' : 'A SPACE FOR YOUR IDEA'}</span><span
					>{current
						? `${current.size.replace('x', ' × ')} · ${current.seconds.toFixed(0)}s`
						: 'No image generated yet'}</span
				>
			</div>
			<div class="image-canvas" class:has-image={!!current} aria-busy={running}>
				{#if current}<img src={current.url} alt={current.prompt} />{:else}<div class="blank-canvas">
						<PatternIcon name="sparkles" size={45} />
						<h3>What could exist?</h3>
						<p>
							A place, a material, a visual explanation.<br />Describe it, then explore the
							possibilities.
						</p>
					</div>{/if}{#if running}<div class="render-progress" role="status">
						<i></i><span
							>Creating your image · {elapsed}s<small
								>Detailed images can take a couple of minutes.</small
							></span
						>
					</div>{/if}
			</div>
			{#if current}<div class="result-tools">
					<span
						>{ai.imageModels.find((m) => m.value === current.model)?.label ?? current.model} · {current.quality}</span
					><button disabled={running || ai.busy} onclick={() => create(current)}
						><PatternIcon name="shuffle" size={15} />Same prompt, new image</button
					><!-- Blob URLs are local downloads, not SvelteKit navigation. -->
					<!-- eslint-disable svelte/no-navigation-without-resolve -->
					<a
						href={current.url}
						download={`pattern-image-${current.id}.png`}
						aria-label="Download generated image"><PatternIcon name="download" size={18} /></a
					>
					<!-- eslint-enable svelte/no-navigation-without-resolve -->
				</div>
				<details class="used-prompt">
					<summary>Prompt used for this image</summary>
					<p>{current.prompt}</p>
				</details>{/if}
			{#if gallery.length > 1}<div class="generation-history" aria-label="Generated variations">
					{#each gallery as result (result.id)}<button
							aria-pressed={selected === result.id}
							onclick={() => (selected = result.id)}
							><img src={result.url} alt={`Generation ${result.id}`} /><span
								>Variation {result.id}</span
							></button
						>{/each}
				</div>{/if}
		</div>
	</div>
	<div class="generative-reading">
		<div>
			<PatternIcon name="classification" size={22} />
			<h3>Recognition asks “what is it?”</h3>
			<p>An image classifier estimates a category from pixels.</p>
		</div>
		<div>
			<PatternIcon name="sparkles" size={22} />
			<h3>Generation asks “what could it be?”</h3>
			<p>
				A prompt conditions a model to produce a new example. Different model families generate in
				different ways; this API does not expose its internal sampling steps.
			</p>
		</div>
		<div>
			<PatternIcon name="evaluation" size={22} />
			<h3>A plausible image can be wrong.</h3>
			<p>
				Inspect labels, geometry, and factual details. A convincing illustration is not evidence
				that a process is correct.
			</p>
		</div>
	</div>
</div>

<style>
	.generative-lab {
		container-type: inline-size;
	}
	.generation-principle {
		display: grid;
		grid-template-columns: 1fr 25px 1fr 25px 1fr;
		align-items: center;
		gap: 18px;
		margin: 12px 0 30px;
		padding: 24px;
		background: var(--surface);
		border-radius: 20px;
		color: var(--lavender);
	}
	.generation-principle > div {
		display: grid;
		grid-template-columns: 24px 1fr;
		gap: 6px 12px;
		align-items: center;
	}
	.generation-principle span {
		font-size: 14px;
		color: var(--ink);
	}
	.generation-principle small {
		grid-column: 2;
		font-size: 11px;
		color: var(--muted);
		line-height: 1.5;
	}
	.creative-studio {
		display: grid;
		grid-template-columns: minmax(250px, 0.8fr) minmax(0, 1.3fr);
		gap: 32px;
		padding: 28px;
		background: var(--surface);
		border-radius: 24px;
	}
	.studio-kicker,
	.canvas-top {
		font: 10px var(--mono);
		letter-spacing: 0.1em;
		color: var(--muted);
	}
	.studio-kicker {
		color: var(--lavender);
	}
	h2 {
		font-size: 31px;
		font-weight: 400;
		line-height: 1.15;
		margin: 16px 0;
	}
	h2 em {
		font-family: var(--serif);
		color: var(--lavender);
	}
	.creative-controls > p {
		font-size: 12px;
		color: var(--muted);
		line-height: 1.75;
	}
	.study-presets {
		display: flex;
		flex-wrap: wrap;
		gap: 7px;
		margin: 18px 0;
	}
	.study-presets button {
		font-size: 10px;
		border: 0;
		background: var(--lab-inset);
		color: var(--muted);
		padding: 8px 10px;
		border-radius: 8px;
	}
	.study-presets button[aria-pressed='true'] {
		background: var(--selection-fill);
		color: var(--selection-ink);
	}
	label {
		display: block;
		margin: 18px 0 8px;
		font-size: 12px;
		color: var(--muted);
	}
	textarea {
		display: block;
		width: 100%;
		resize: vertical;
		background: var(--lab-inset);
		border: 0;
		color: var(--ink);
		font: 12px/1.7 var(--sans);
		padding: 14px;
		border-radius: 12px;
	}
	.creative-actions {
		display: flex;
		align-items: center;
		gap: 15px;
		margin-top: 20px;
	}
	.creative-controls .request-note {
		margin-top: 8px;
		font-size: 10px;
	}
	.creative-gallery {
		min-width: 0;
	}
	.canvas-top {
		display: flex;
		justify-content: space-between;
		gap: 12px;
		line-height: 1.6;
		margin-bottom: 14px;
		letter-spacing: 0;
	}
	.image-canvas {
		background:
			radial-gradient(
				ellipse at 30% 25%,
				color-mix(in srgb, var(--blue) 11%, transparent),
				transparent 60%
			),
			var(--lab-inset);
		border-radius: 18px;
		height: clamp(360px, 45vw, 560px);
		position: relative;
		display: grid;
		place-items: center;
		overflow: hidden;
		aspect-ratio: auto;
	}
	.image-canvas > img {
		position: absolute;
		inset: 0;
		display: block;
		width: 100%;
		height: 100%;
		object-fit: contain;
		max-height: 100%;
	}
	.blank-canvas {
		display: grid;
		justify-items: center;
		text-align: center;
		color: var(--lavender);
		padding: 25px;
	}
	.blank-canvas h3 {
		font: italic 37px var(--serif);
		color: var(--ink);
		margin: 23px 0 10px;
	}
	.blank-canvas p {
		font-size: 12px;
		line-height: 1.8;
		color: var(--muted);
	}
	.render-progress {
		position: absolute;
		bottom: 18px;
		left: 18px;
		right: 18px;
		display: flex;
		align-items: center;
		gap: 12px;
		background: color-mix(in srgb, var(--surface) 90%, transparent);
		backdrop-filter: blur(20px);
		padding: 14px;
		border-radius: 12px;
		font-size: 12px;
	}
	.render-progress small {
		display: block;
		font-size: 10px;
		color: var(--muted);
		margin-top: 5px;
	}
	.render-progress i {
		width: 15px;
		height: 15px;
		border: 2px solid var(--line);
		border-top-color: var(--blue);
		border-radius: 50%;
		animation: turn 1.5s linear infinite;
	}
	.result-tools {
		display: flex;
		align-items: center;
		gap: 14px;
		margin: 15px 0;
		font-size: 10px;
		color: var(--muted);
		flex-wrap: wrap;
	}
	.result-tools button {
		margin-left: auto;
		border: 0;
		background: var(--lab-inset);
		color: var(--ink);
		padding: 9px;
		border-radius: 8px;
		display: flex;
		align-items: center;
		gap: 7px;
		font-size: 11px;
	}
	.result-tools a {
		color: var(--ink);
	}
	.used-prompt {
		font-size: 11px;
		color: var(--muted);
		line-height: 1.7;
	}
	.generation-history {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
		margin-top: 18px;
	}
	.generation-history button {
		width: 92px;
		flex: 0 0 92px;
		padding: 5px;
		border: 1px solid transparent;
		background: var(--lab-inset);
		border-radius: 10px;
		color: var(--muted);
		font-size: 10px;
	}
	.generation-history button[aria-pressed='true'] {
		border-color: var(--blue);
		color: var(--ink);
	}
	.generation-history img {
		display: block;
		aspect-ratio: 1.5;
		width: 100%;
		object-fit: cover;
		border-radius: 6px;
		margin-bottom: 7px;
	}
	.generative-reading {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 28px;
		margin: 30px 8px;
		color: var(--blue);
	}
	.generative-reading h3 {
		font-size: 14px;
		font-weight: 500;
		color: var(--ink);
	}
	.generative-reading p {
		font-size: 12px;
		line-height: 1.8;
		color: var(--muted);
	}
	button:disabled {
		opacity: 0.5;
		cursor: default;
	}
	@keyframes turn {
		to {
			rotate: 360deg;
		}
	}
	@container (max-width:750px) {
		.creative-studio {
			grid-template-columns: 1fr;
			padding: 20px;
			gap: 25px;
		}
		.image-canvas {
			height: auto;
			aspect-ratio: 1;
			min-height: 0;
		}
		.generation-principle {
			gap: 9px;
			padding: 18px;
			grid-template-columns: 1fr 15px 1fr 15px 1fr;
		}
		.generation-principle > div {
			display: flex;
			flex-direction: column;
			text-align: center;
		}
		.generation-principle span {
			font-size: 11px;
		}
		.generation-principle small {
			font-size: 9px;
		}
		.generative-reading {
			grid-template-columns: 1fr;
			gap: 15px;
		}
		.generative-reading h3 {
			display: inline;
			margin-left: 8px;
		}
		.generative-reading p {
			margin-top: 8px;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.render-progress i {
			animation: none;
		}
	}
</style>
