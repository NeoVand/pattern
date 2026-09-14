<script lang="ts">
	import { asset } from '$app/paths';
	import AudioFramesLab from './AudioFramesLab.svelte';
	import { onMount } from 'svelte';
	import PatternIcon from './PatternIcon.svelte';
	import { imagePatches, tokenizeText, type Tokenization } from '$lib/ml/tokens';

	let mode = $state<'text' | 'image' | 'audio'>('text');
	let input = $state('A little curiosity changes everything.');
	let tokenization = $state.raw<Tokenization | null>(null);
	let tokenIndex = $state(0);
	let loading = $state(true);
	let error = $state('');
	let request = 0;
	let alive = true;
	let grid = $state(4);
	let separated = $state(false);
	let patchIndex = $state(5);
	let patchPage = $state(0);
	let photo = $state(asset('/images/vision-board.webp'));
	let dimensions = $state({ width: 1660, height: 948 });
	let patches = $derived(imagePatches(dimensions.width, dimensions.height, grid));
	let patch = $derived(patches[patchIndex]);
	let token = $derived(tokenization?.tokens[tokenIndex]);
	let fragments = $derived(tokenization?.tokens.some((item) => item.text === null));
	const presets = [
		{ label: 'A sentence', text: 'A little curiosity changes everything.' },
		{ label: 'Same word, different spaces', text: 'pattern pattern  pattern\npattern' },
		{ label: 'Across languages', text: 'Hello. Bonjour. こんにちは。 नमस्ते।' },
		{ label: 'An emoji', text: 'An astronaut: 🧑🏽‍🚀' }
	];
	const colors = [
		'var(--chart-blue)',
		'var(--chart-lavender)',
		'var(--chart-amber)',
		'var(--chart-cyan)',
		'var(--chart-rose)'
	];
	async function updateText(text: string) {
		input = text;
		const current = ++request;
		loading = true;
		error = '';
		try {
			const result = await tokenizeText(text);
			if (!alive || current !== request) return;
			tokenization = result;
			tokenIndex = 0;
		} catch (cause) {
			if (!alive || current !== request) return;
			error = cause instanceof Error ? cause.message : 'The tokenizer could not load.';
		} finally {
			if (alive && current === request) loading = false;
		}
	}
	function chooseGrid(value: number) {
		grid = value;
		void selectPatch(Math.min(patchIndex, value * value - 1));
	}
	function selectPatch(index: number) {
		patchIndex = index;
		patchPage = Math.floor(index / 24);
	}
	function imageLoaded(event: Event) {
		const image = event.currentTarget as HTMLImageElement;
		dimensions = { width: image.naturalWidth, height: image.naturalHeight };
	}
	onMount(() => {
		void updateText(input);
		return () => {
			alive = false;
			request++;
		};
	});
</script>

<div class="token-lab">
	<div class="token-modes" role="group" aria-label="Explore tokens">
		<button
			class:active={mode === 'text'}
			aria-pressed={mode === 'text'}
			onclick={() => (mode = 'text')}><PatternIcon name="language" />Text into tokens</button
		>
		<button
			class:active={mode === 'image'}
			aria-pressed={mode === 'image'}
			onclick={() => (mode = 'image')}><PatternIcon name="grid" />Image into patches</button
		>
		<button
			class:active={mode === 'audio'}
			aria-pressed={mode === 'audio'}
			onclick={() => (mode = 'audio')}><PatternIcon name="audio" />Audio into frames</button
		>
	</div>
	{#if mode === 'text'}
		<div class="token-opening">
			<h2>A sentence, <em>in pieces.</em></h2>
			<p>
				A language model reads a sequence of tokens. A token can be a word, part of a word,
				punctuation—or even part of a character.
			</p>
		</div>
		<div class="text-workbench">
			<div class="input-heading">
				<label for="token-input">Write something</label><span>o200k_base · runs on your device</span
				>
			</div>
			<textarea
				id="token-input"
				value={input}
				oninput={(event) => void updateText(event.currentTarget.value)}
				maxlength={600}
				rows="3"
				spellcheck="false"
				aria-describedby="token-input-help"></textarea>
			<div class="presets" role="group" aria-label="Text examples">
				{#each presets as preset (preset.label)}<button
						class:chosen={input === preset.text}
						onclick={() => void updateText(preset.text)}>{preset.label}</button
					>{/each}
			</div>
			<div class="token-counts" aria-live="polite">
				<div><strong>{tokenization?.characters ?? '—'}</strong><span>characters</span></div>
				<PatternIcon name="arrowRight" />
				<div><strong>{tokenization?.tokens.length ?? '—'}</strong><span>tokens</span></div>
				<p id="token-input-help">
					Spaces belong to tokens too.<br /><span class="space-symbol">·</span> marks a space;
					<span class="space-symbol">↵</span> marks a new line.
				</p>
			</div>
			{#if error}<p class="error" role="alert">
					{error} <button onclick={() => void updateText(input)}>Try loading again</button>
				</p>{/if}
			{#if loading && !tokenization}<div class="loading" role="status">
					Opening the vocabulary…
				</div>{/if}
			<div class="token-ribbon" aria-label="Actual token sequence" aria-busy={loading}>
				{#each tokenization?.tokens ?? [] as item (`${item.position}:${item.id}`)}
					<button
						class:selected={tokenIndex === item.position}
						class:fragment={item.text === null}
						class:formatting-token={item.annotation !== null}
						style:--token-color={colors[item.position % colors.length]}
						aria-label={`Token ${item.position + 1}, ID ${item.id}, ${item.text === null ? 'part of a Unicode character' : JSON.stringify(item.text)}`}
						aria-pressed={tokenIndex === item.position}
						onclick={() => (tokenIndex = item.position)}
						><span class="token-piece">{item.display}</span><span class="token-id">{item.id}</span
						></button
					>
				{/each}
				{#if tokenization && !tokenization.tokens.length}<p>Your tokens will appear here.</p>{/if}
			</div>
			{#if fragments}<p class="fragment-note">
					Dotted pieces contain UTF-8 bytes that need neighboring tokens to form a character. Their
					hexadecimal bytes are shown instead of a broken symbol.
				</p>{/if}
		</div>
		{#if token}
			<div class="token-detail">
				<div class="selected-number">
					<span>Token {token.position + 1}</span><strong>{token.id}</strong>
					<p>A vocabulary ID, not a meaning or a score.</p>
				</div>
				<div class="selected-bytes">
					<span>What this token contains</span>
					<div class="byte-row">
						{#each token.bytes as byte, byteIndex (`${token.position}:${byteIndex}`)}<code
								>{byte.toString(16).padStart(2, '0').toUpperCase()}</code
							>{/each}
					</div>
					<p>
						{token.text === null
							? 'This piece is not valid text on its own. Its bytes join the next or previous token.'
							: (token.annotation ??
								`${token.bytes.length} UTF-8 ${token.bytes.length === 1 ? 'byte' : 'bytes'}. The visible text is ${JSON.stringify(token.text)}.`)}
					</p>
				</div>
			</div>
		{/if}
		<div class="token-takeaways">
			<div>
				<PatternIcon name="book" />
				<h3>A learned vocabulary</h3>
				<p>
					Byte-pair encoding builds reusable pieces from frequent patterns in text. The vocabulary
					stays fixed while you type.
				</p>
			</div>
			<div>
				<PatternIcon name="layers" />
				<h3>IDs become vectors</h3>
				<p>
					The model looks up a learned embedding for each ID, then processes those vectors in
					context.
				</p>
			</div>
			<div>
				<PatternIcon name="check" />
				<h3>The text survives</h3>
				<p>
					Decode the complete sequence and you get the original text back, including spaces and
					emoji.
				</p>
			</div>
		</div>
		<details class="token-method">
			<summary>About this tokenizer</summary>
			<p>
				This is real byte-pair encoding with the o200k_base vocabulary, using gpt-tokenizer.
				Different tokenizers can split the same text differently. This counts your text only; API
				messages also include formatting and other input. “Characters” counts visible grapheme
				clusters. A token boundary can fall inside one.
			</p>
			<a href="https://github.com/openai/tiktoken" target="_blank" rel="noreferrer"
				>OpenAI’s tokenizer documentation <PatternIcon name="arrowUpRight" size={15} /></a
			>
		</details>
	{:else if mode === 'image'}
		<div class="token-opening">
			<h2>A picture, <em>as a sequence.</em></h2>
			<p>
				Many vision transformers divide an image into patches. Each region becomes a vector, with
				position information to preserve where it came from.
			</p>
		</div>
		<div class="image-controls">
			<div class="photo-options" role="group" aria-label="Image to divide">
				<button
					class:chosen={photo.includes('vision-board')}
					aria-pressed={photo.includes('vision-board')}
					onclick={() => (photo = asset('/images/vision-board.webp'))}>The Glasshouse</button
				><button
					class:chosen={photo.includes('caption-garden')}
					aria-pressed={photo.includes('caption-garden')}
					onclick={() => (photo = asset('/images/caption-garden.webp'))}>A garden</button
				>
			</div>
			<div class="grid-options" role="group" aria-label="Patch grid">
				{#each [4, 8, 12] as value (value)}<button
						class:chosen={grid === value}
						aria-pressed={grid === value}
						onclick={() => chooseGrid(value)}>{value} × {value}</button
					>{/each}
			</div>
		</div>
		<img class="source-preload" src={photo} alt="" onload={imageLoaded} />
		<div class="image-workbench">
			<div class="patch-main">
				<div class="patch-surface" class:separated>
					<div
						class="patch-grid"
						class:dense={grid > 4}
						style:--grid={grid}
						style:aspect-ratio={`${dimensions.width} / ${dimensions.height}`}
					>
						{#each patches as piece (`${grid}:${piece.index}`)}
							<button
								class:selected={patchIndex === piece.index}
								class="image-patch"
								aria-label={`Select patch ${piece.index + 1}, row ${piece.row + 1}, column ${piece.column + 1}`}
								aria-pressed={patchIndex === piece.index}
								onclick={() => void selectPatch(piece.index)}
							>
								<svg
									viewBox={`${piece.x} ${piece.y} ${piece.width} ${piece.height}`}
									preserveAspectRatio="none"
									aria-hidden="true"
									><image href={photo} width={dimensions.width} height={dimensions.height} /></svg
								><span>{piece.index + 1}</span>
							</button>
						{/each}
					</div>
				</div>
				<div class="image-bottom">
					<span><strong>{patches.length}</strong> image regions</span><button
						class="split-button"
						onclick={() => (separated = !separated)}
						><PatternIcon name={separated ? 'minimize' : 'expand'} size={19} />{separated
							? 'Reassemble image'
							: 'Separate patches'}</button
					>
				</div>
			</div>
			<aside class="patch-inspector" aria-label="Selected image patch">
				<div class="inspector-heading">
					<span>Patch {patch.index + 1} of {patches.length}</span>
					<div>
						<button
							aria-label="Previous patch"
							disabled={patchIndex === 0}
							onclick={() => void selectPatch(patchIndex - 1)}
							><PatternIcon name="arrowLeft" size={18} /></button
						><button
							aria-label="Next patch"
							disabled={patchIndex === patches.length - 1}
							onclick={() => void selectPatch(patchIndex + 1)}
							><PatternIcon name="arrowRight" size={18} /></button
						>
					</div>
				</div>
				<svg
					class="patch-zoom"
					viewBox={`${patch.x} ${patch.y} ${patch.width} ${patch.height}`}
					role="img"
					aria-label={`Magnified patch ${patch.index + 1}`}
					><image href={photo} width={dimensions.width} height={dimensions.height} /></svg
				>
				<div class="patch-location">
					<div><span>Row / column</span><strong>{patch.row + 1} / {patch.column + 1}</strong></div>
					<div><span>Source pixels</span><strong>{patch.width} × {patch.height}</strong></div>
				</div>
				<p>
					This region contains color values. A learned projection turns those values into an
					embedding.
				</p>
			</aside>
		</div>
		<div class="sequence-heading">
			<h3>Read the patches in order</h3>
			<span>Left to right, then the next row</span>
		</div>
		<div class="patch-sequence" role="group" aria-label="Image patch sequence">
			{#each patches.slice(patchPage * 24, (patchPage + 1) * 24) as piece (`sequence:${grid}:${piece.index}`)}<button
					class:selected={piece.index === patchIndex}
					data-patch-index={piece.index}
					aria-label={`Sequence position ${piece.index + 1}`}
					aria-pressed={piece.index === patchIndex}
					onclick={() => void selectPatch(piece.index)}
					><svg
						viewBox={`${piece.x} ${piece.y} ${piece.width} ${piece.height}`}
						preserveAspectRatio="none"
						aria-hidden="true"
						><image href={photo} width={dimensions.width} height={dimensions.height} /></svg
					><span>{piece.index + 1}</span></button
				>{/each}
		</div>
		<div class="patch-pages">
			<button
				class="icon-button"
				aria-label="Previous patch positions"
				disabled={patchPage === 0}
				onclick={() => patchPage--}><PatternIcon name="arrowLeft" size={16} /></button
			><span
				>Positions {patchPage * 24 + 1}–{Math.min(patches.length, (patchPage + 1) * 24)} of {patches.length}</span
			><button
				class="icon-button"
				aria-label="Next patch positions"
				disabled={(patchPage + 1) * 24 >= patches.length}
				onclick={() => patchPage++}><PatternIcon name="arrowRight" size={16} /></button
			>
		</div>
		<div class="vision-pipeline">
			<div><PatternIcon name="scan" size={26} /><span>Patch pixels</span></div>
			<PatternIcon name="arrowRight" size={18} />
			<div><PatternIcon name="layers" size={26} /><span>Learned projection</span></div>
			<span class="plus">+</span>
			<div><PatternIcon name="grid" size={26} /><span>Position</span></div>
			<PatternIcon name="arrowRight" size={18} />
			<div><PatternIcon name="neural" size={26} /><span>Transformer</span></div>
		</div>
		<p class="vision-explanation">
			The patch is a piece of the picture, not a word describing it. Its embedding carries visual
			information; position tells the model where that piece belongs.
		</p>
		<details class="token-method">
			<summary>What this visualization represents</summary>
			<p>
				The regions above are actual pieces of the full source image: nothing is cropped away. The
				grid is an educational choice. Real encoders may resize, pad, tile, merge patches, or add
				special tokens. This diagram illustrates the projection; it does not run a vision encoder or
				display learned features. These patch counts are not text vocabulary IDs or OpenAI image
				billing counts.
			</p>
			<a
				href="https://research.google/pubs/an-image-is-worth-16x16-words-transformers-for-image-recognition-at-scale/"
				target="_blank"
				rel="noreferrer"
				>The original Vision Transformer paper <PatternIcon name="arrowUpRight" size={15} /></a
			>
		</details>
	{:else}<AudioFramesLab />
	{/if}
</div>

<style>
	.token-lab {
		color: var(--ink);
	}
	.token-modes {
		display: flex;
		gap: 7px;
		padding: 6px;
		background: var(--surface);
		border-radius: 18px;
		width: fit-content;
		margin-bottom: 32px;
	}
	.token-modes button {
		display: flex;
		gap: 9px;
		align-items: center;
		padding: 13px 19px;
		border: 0;
		border-radius: 13px;
		color: var(--muted);
		background: transparent;
		font-size: 14px;
		cursor: pointer;
	}
	.token-modes button.active {
		background: var(--paper);
		color: var(--ink);
		box-shadow: 0 4px 18px #00000007;
	}
	.token-opening {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 40px;
		align-items: center;
		margin-bottom: 35px;
	}
	h2 {
		font: normal clamp(30px, 3vw, 44px)/1.1 var(--serif);
		letter-spacing: -0.025em;
		margin: 0;
	}
	h2 em {
		color: var(--green);
	}
	.token-opening p {
		font-size: 15px;
		line-height: 1.8;
		color: var(--muted);
		margin: 0;
		max-width: 490px;
	}
	.text-workbench {
		padding: 28px;
		border-radius: 24px;
		background: var(--surface);
	}
	.input-heading {
		display: flex;
		justify-content: space-between;
		gap: 12px;
		align-items: center;
		margin-bottom: 12px;
	}
	.input-heading label {
		font-size: 14px;
		font-weight: 500;
	}
	.input-heading span {
		font-size: 11px;
		color: var(--quiet);
	}
	textarea {
		width: 100%;
		box-sizing: border-box;
		resize: vertical;
		min-height: 112px;
		background: var(--paper);
		color: var(--ink);
		border: 0;
		border-radius: 15px;
		padding: 20px;
		font: 24px/1.5 var(--serif);
		outline-offset: 4px;
	}
	.presets,
	.photo-options,
	.grid-options {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
	}
	.presets {
		margin-top: 14px;
	}
	.presets button,
	.photo-options button,
	.grid-options button {
		background: transparent;
		border: 0;
		color: var(--muted);
		padding: 9px 12px;
		border-radius: 10px;
		font-size: 12px;
		cursor: pointer;
	}
	.presets button.chosen,
	.photo-options button.chosen,
	.grid-options button.chosen {
		background: var(--accent-bg);
		color: var(--green);
	}
	.token-counts {
		display: flex;
		align-items: center;
		gap: 24px;
		padding: 30px 3px 27px;
	}
	.token-counts div {
		display: flex;
		flex-direction: column;
		gap: 3px;
	}
	.token-counts strong {
		font: 36px/1.1 var(--serif);
	}
	.token-counts span {
		font-size: 12px;
		color: var(--muted);
	}
	.token-counts p {
		margin: 0 0 0 auto;
		font-size: 12px;
		line-height: 1.8;
		color: var(--quiet);
	}
	.token-counts .space-symbol {
		font: 16px var(--mono);
		color: var(--ink);
	}
	.token-ribbon {
		display: flex;
		flex-wrap: wrap;
		gap: 9px;
		min-height: 90px;
		align-content: flex-start;
	}
	.token-ribbon button {
		padding: 14px 13px 10px;
		min-width: 45px;
		color: var(--ink);
		background: color-mix(in srgb, var(--token-color) 20%, var(--paper));
		border: 1px solid transparent;
		border-radius: 12px;
		cursor: pointer;
		display: flex;
		flex-direction: column;
		gap: 13px;
		max-width: 100%;
	}
	.token-ribbon button.selected {
		box-shadow:
			0 0 0 2px var(--token-color),
			0 6px 18px #00000008;
	}
	.token-ribbon button.fragment {
		border-style: dashed;
		border-color: color-mix(in srgb, var(--token-color) 65%, transparent);
	}
	.token-piece {
		font: 21px/1.3 var(--serif);
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}
	.token-ribbon button.fragment .token-piece,
	.token-ribbon button.formatting-token .token-piece {
		font: 12px/2.3 var(--mono);
	}
	.token-id {
		font: 10px var(--mono);
		color: var(--muted);
	}
	.token-ribbon > p,
	.fragment-note,
	.loading {
		font-size: 13px;
		color: var(--muted);
		line-height: 1.7;
	}
	.fragment-note {
		margin: 20px 0 0;
		max-width: 650px;
	}
	.token-detail {
		display: grid;
		grid-template-columns: 1fr 2fr;
		gap: 35px;
		padding: 28px 4px 36px;
	}
	.selected-number > span,
	.selected-bytes > span {
		font-size: 12px;
		color: var(--muted);
	}
	.selected-number strong {
		display: block;
		font: 29px var(--mono);
		font-weight: 400;
		margin: 8px 0;
	}
	.token-detail p {
		color: var(--quiet);
		font-size: 12px;
		line-height: 1.7;
		margin: 10px 0 0;
	}
	.byte-row {
		display: flex;
		flex-wrap: wrap;
		gap: 5px;
		margin-top: 12px;
	}
	.byte-row code {
		padding: 7px;
		border-radius: 7px;
		background: var(--surface);
		color: var(--muted);
		font: 11px var(--mono);
	}
	.token-takeaways {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 28px;
		padding-top: 14px;
	}
	.token-takeaways :global(svg) {
		color: var(--green);
	}
	.token-takeaways h3 {
		font: 22px var(--serif);
		margin: 13px 0 9px;
	}
	.token-takeaways p {
		color: var(--muted);
		font-size: 13px;
		line-height: 1.8;
		margin: 0;
	}
	.token-method {
		margin-top: 30px;
		color: var(--muted);
		font-size: 12px;
		line-height: 1.8;
	}
	.token-method summary {
		cursor: pointer;
		width: fit-content;
	}
	.token-method p {
		max-width: 840px;
		margin: 12px 0;
	}
	.token-method a {
		display: inline-flex;
		gap: 5px;
		align-items: center;
		color: var(--green);
		text-decoration: none;
	}
	.error {
		font-size: 13px;
		color: var(--orange);
	}
	.error button {
		color: inherit;
		background: none;
		border: 0;
		text-decoration: underline;
		cursor: pointer;
	}
	.image-controls {
		display: flex;
		justify-content: space-between;
		gap: 15px;
		margin-bottom: 18px;
	}
	.source-preload {
		display: none;
	}
	.image-workbench {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 235px;
		gap: 25px;
		align-items: start;
	}
	.patch-main {
		min-width: 0;
	}
	.patch-surface {
		background: var(--surface);
		border-radius: 22px;
		padding: 18px;
	}
	.patch-grid {
		display: grid;
		grid-template-columns: repeat(var(--grid), minmax(0, 1fr));
		grid-template-rows: repeat(var(--grid), minmax(0, 1fr));
		gap: 0;
		transition: gap 0.65s cubic-bezier(0.2, 0.75, 0.2, 1);
	}
	.separated .patch-grid {
		gap: 5px;
	}
	.image-patch {
		position: relative;
		border: 0;
		padding: 0;
		background: transparent;
		min-width: 0;
		min-height: 0;
		cursor: pointer;
		transition:
			filter 0.3s,
			border-radius 0.65s,
			box-shadow 0.3s;
	}
	.image-patch svg {
		display: block;
		width: 100%;
		height: 100%;
	}
	.image-patch.selected {
		box-shadow: 0 0 0 2px var(--green);
		z-index: 1;
	}
	.image-patch span {
		position: absolute;
		bottom: 3px;
		left: 3px;
		border-radius: 3px;
		padding: 2px 4px;
		color: #fff;
		background: #151c27bb;
		font: 9px var(--mono);
		opacity: 0;
		transition: opacity 0.35s;
	}
	.separated .image-patch span,
	.image-patch.selected span {
		opacity: 1;
	}
	.image-bottom {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 10px;
		padding: 18px 1px 0;
	}
	.image-bottom > span {
		font-size: 12px;
		color: var(--muted);
	}
	.image-bottom strong {
		font: 23px var(--serif);
		color: var(--ink);
		margin-right: 4px;
	}
	.split-button {
		border: 0;
		border-radius: 11px;
		background: var(--accent-bg);
		color: var(--green);
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 11px 14px;
		font-size: 12px;
		cursor: pointer;
	}
	.patch-inspector {
		border-radius: 20px;
		background: var(--surface);
		padding: 16px;
	}
	.inspector-heading {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 3px;
		font-size: 11px;
		color: var(--muted);
	}
	.inspector-heading > div {
		display: flex;
	}
	.inspector-heading button {
		border: 0;
		padding: 10px 7px;
		background: transparent;
		color: var(--ink);
		cursor: pointer;
	}
	button:disabled {
		opacity: 0.35;
		cursor: default;
	}
	.patch-zoom {
		display: block;
		width: 100%;
		aspect-ratio: 1.45;
		background: var(--paper);
		margin: 9px 0 18px;
		border-radius: 10px;
	}
	.patch-location {
		display: flex;
		justify-content: space-between;
		gap: 12px;
	}
	.patch-location div {
		display: flex;
		flex-direction: column;
		gap: 7px;
	}
	.patch-location span {
		font-size: 10px;
		color: var(--quiet);
	}
	.patch-location strong {
		font: 13px var(--mono);
		color: var(--ink);
	}
	.patch-inspector p {
		color: var(--muted);
		font-size: 11px;
		line-height: 1.8;
		margin: 18px 0 0;
	}
	.sequence-heading {
		display: flex;
		justify-content: space-between;
		gap: 15px;
		align-items: center;
		margin: 32px 0 14px;
	}
	.sequence-heading h3 {
		margin: 0;
		font: 22px var(--serif);
	}
	.sequence-heading > span {
		font-size: 11px;
		color: var(--quiet);
	}
	.patch-sequence {
		position: relative;
		display: flex;
		gap: 8px;
		overflow-x: auto;
		padding: 4px 3px 12px;
		scrollbar-width: thin;
		scrollbar-color: var(--quiet) transparent;
	}
	.patch-sequence button {
		flex: 0 0 54px;
		border: 0;
		background: var(--surface);
		padding: 0;
		color: var(--muted);
		cursor: pointer;
		border-radius: 7px;
		overflow: hidden;
	}
	.patch-sequence button.selected {
		box-shadow: 0 0 0 2px var(--green);
	}
	.patch-sequence svg {
		display: block;
		width: 54px;
		height: 38px;
	}
	.patch-sequence span {
		display: block;
		padding: 5px;
		font: 10px var(--mono);
	}
	.vision-pipeline {
		margin: 30px auto 15px;
		padding: 23px;
		display: flex;
		justify-content: center;
		gap: 22px;
		align-items: center;
		background: var(--surface);
		border-radius: 18px;
		color: var(--quiet);
	}
	.vision-pipeline > div {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
		color: var(--green);
	}
	.vision-pipeline div > span {
		color: var(--muted);
		font-size: 11px;
		text-align: center;
	}
	.plus {
		font: 23px var(--serif);
	}
	.vision-explanation {
		margin: 0 auto;
		max-width: 600px;
		font-size: 13px;
		line-height: 1.8;
		color: var(--muted);
		text-align: center;
	}
	@media (max-width: 1050px) {
		.image-workbench {
			grid-template-columns: minmax(0, 1fr) 200px;
			gap: 15px;
		}
		.patch-inspector {
			padding: 13px;
		}
		.vision-pipeline {
			gap: 16px;
		}
	}
	@media (max-width: 760px) {
		.token-opening {
			grid-template-columns: 1fr;
			gap: 17px;
			margin-bottom: 25px;
		}
		.token-opening p {
			max-width: none;
		}
		.text-workbench {
			padding: 20px;
		}
		.token-takeaways {
			gap: 20px;
		}
		.image-workbench {
			grid-template-columns: 1fr;
		}
		.patch-inspector {
			display: grid;
			grid-template-columns: 120px 1fr;
			gap: 12px 20px;
		}
		.inspector-heading {
			grid-column: 1/-1;
		}
		.patch-zoom {
			grid-column: 1;
			grid-row: 2/4;
			margin: 0;
			align-self: center;
		}
		.patch-inspector p {
			margin: 0;
		}
		.vision-pipeline {
			gap: 16px;
		}
	}
	@media (max-width: 520px) {
		.token-modes {
			width: 100%;
			box-sizing: border-box;
			margin-bottom: 25px;
		}
		.token-modes button {
			flex: 1;
			padding: 12px 8px;
			font-size: 12px;
			gap: 7px;
			justify-content: center;
		}
		.token-opening h2 {
			font-size: 34px;
		}
		.token-opening p {
			font-size: 14px;
		}
		.text-workbench {
			padding: 16px;
			border-radius: 18px;
		}
		.input-heading {
			flex-wrap: wrap;
			gap: 5px;
		}
		.input-heading span {
			font-size: 10px;
		}
		textarea {
			font-size: 22px;
			padding: 16px;
		}
		.presets {
			gap: 3px;
		}
		.presets button {
			font-size: 10px;
			padding: 9px 8px;
		}
		.token-counts {
			gap: 22px;
			flex-wrap: wrap;
			padding: 24px 0 20px;
		}
		.token-counts p {
			flex: 1 0 100%;
			margin: 0;
		}
		.token-counts strong {
			font-size: 32px;
		}
		.token-ribbon {
			gap: 8px;
		}
		.token-ribbon button {
			padding: 12px 10px 9px;
		}
		.token-piece {
			font-size: 20px;
		}
		.token-detail {
			grid-template-columns: 1fr;
			gap: 22px;
			padding: 28px 3px;
		}
		.token-takeaways {
			grid-template-columns: 1fr;
			gap: 25px;
			padding-top: 10px;
		}
		.token-takeaways > div {
			display: grid;
			grid-template-columns: 23px 1fr;
			gap: 0 13px;
		}
		.token-takeaways h3 {
			margin: 0 0 7px;
		}
		.token-takeaways p {
			grid-column: 2;
		}
		.image-controls {
			flex-wrap: wrap;
			gap: 9px;
		}
		.photo-options button,
		.grid-options button {
			padding: 9px 10px;
		}
		.patch-surface {
			padding: 13px;
			border-radius: 16px;
		}
		.separated .patch-grid {
			gap: 3px;
		}
		.image-patch span {
			bottom: 1px;
			left: 1px;
			font-size: 7px;
			padding: 1px 2px;
		}
		.image-bottom {
			padding-top: 14px;
		}
		.split-button {
			padding: 11px 10px;
			font-size: 11px;
		}
		.patch-inspector {
			grid-template-columns: 100px 1fr;
			gap: 13px;
			padding: 16px;
			margin-top: 10px;
		}
		.dense .image-patch:not(.selected) span {
			opacity: 0;
		}
		.inspector-heading button {
			width: 44px;
			height: 44px;
		}
		.patch-location span {
			font-size: 9px;
		}
		.patch-location strong {
			font-size: 11px;
		}
		.patch-inspector p {
			font-size: 11px;
		}
		.sequence-heading {
			align-items: start;
			flex-direction: column;
			gap: 7px;
			margin-top: 25px;
		}
		.vision-pipeline {
			gap: 8px;
			padding: 19px 10px;
		}
		.vision-pipeline > div {
			flex: 1;
			gap: 10px;
		}
		.vision-pipeline > div > span {
			font-size: 9px;
		}
		.vision-pipeline > :global(svg) {
			width: 13px;
			flex-shrink: 0;
		}
		.vision-explanation {
			text-align: left;
			font-size: 12px;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.patch-grid,
		.image-patch,
		.image-patch span {
			transition: none;
		}
	}

	.patch-sequence {
		display: grid;
		grid-template-columns: repeat(12, minmax(0, 1fr));
		gap: 7px;
		overflow: visible;
		padding: 8px 3px;
	}
	.patch-sequence button {
		width: 100%;
		min-width: 0;
	}
	.patch-sequence svg {
		width: 100%;
		height: auto;
		aspect-ratio: 1.4;
	}
	.patch-sequence button.selected {
		box-shadow: 0 0 0 1.5px var(--lavender);
	}
	.patch-pages {
		display: flex;
		justify-content: center;
		align-items: center;
		gap: 18px;
		color: var(--muted);
		font-size: 12px;
		margin: 12px 0;
	}
	@media (max-width: 650px) {
		.token-modes {
			width: 100%;
			gap: 3px;
			padding: 4px;
		}
		.token-modes button {
			flex: 1;
			flex-direction: column;
			gap: 6px;
			font-size: 11px;
			padding: 10px 5px;
		}
		.patch-sequence {
			grid-template-columns: repeat(6, minmax(0, 1fr));
		}
	}
</style>
