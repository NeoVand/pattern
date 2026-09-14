<script lang="ts">
	import { base } from '$app/paths';
	import { fade } from 'svelte/transition';
	import { prefersReducedMotion } from 'svelte/motion';
	import PatternIcon from '$lib/components/PatternIcon.svelte';
	import type { ChapterArt } from '$lib/data/chapter-art';

	let { art, target }: { art: ChapterArt; target: string } = $props();
	let expanded = $state(false);
	let zoomed = $state(false);
	let imageWidth = $derived(art.width ?? 1672);
	let imageHeight = $derived(art.height ?? 941);
	const id = $props.id();

	function openDialog(node: HTMLDialogElement) {
		node.showModal();
		return () => node.close();
	}
	function expandImage() {
		zoomed = false;
		expanded = true;
	}
	function jumpToLab() {
		const lab = document.getElementById(target);
		lab?.focus({ preventScroll: true });
		lab?.scrollIntoView({
			behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
				? 'instant'
				: 'smooth',
			block: 'start'
		});
	}
</script>

<figure class="concept-plate" style:--art-ratio={imageWidth / imageHeight}>
	<div class="art-frame" data-tone={art.tone}>
		<img
			src={`${base}/images/${art.asset}.webp?v=3`}
			srcset={`${base}/images/${art.asset}-800.webp?v=3 800w, ${base}/images/${art.asset}.webp?v=3 ${imageWidth}w`}
			sizes="(max-width: 680px) calc(100vw - 36px), (max-width: 980px) calc(100vw - 72px), (max-width: 1250px) calc(100vw - 295px), 820px"
			width={imageWidth}
			height={imageHeight}
			alt={art.alt}
			fetchpriority="high"
		/>
		<button
			class="expand-art"
			aria-label={`Expand illustration: ${art.title}`}
			onclick={expandImage}><PatternIcon name="imageExpand" size={17} /></button
		>
	</div>
	<figcaption>
		<p>{art.caption}</p>
		<div class="caption-actions">
			<button class="lab-link" onclick={jumpToLab}
				>{art.action}<PatternIcon name="arrowDown" size={16} /></button
			>
			<button
				class="touch-expand"
				aria-label={`Expand illustration: ${art.title}`}
				onclick={expandImage}><PatternIcon name="imageExpand" size={17} /></button
			>
		</div>
	</figcaption>
</figure>

{#if expanded}
	<dialog
		class="art-dialog"
		in:fade={{ duration: prefersReducedMotion.current ? 0 : 180 }}
		{@attach openDialog}
		onclose={() => (expanded = false)}
		aria-labelledby={`${id}-title`}
		aria-describedby={`${id}-note`}
	>
		<header class="art-toolbar">
			<h2 id={`${id}-title`}>{art.title}</h2>
			<div class="art-tools">
				<button
					class="zoom-button"
					aria-label={zoomed ? 'Fit image' : 'Zoom in'}
					aria-pressed={zoomed}
					onclick={() => (zoomed = !zoomed)}
					>{#if zoomed}<PatternIcon name="zoomOut" size={17} /><span>Fit image</span
						>{:else}<PatternIcon name="zoomIn" size={17} /><span>Zoom in</span>{/if}</button
				>
				<button class="close-art" aria-label="Close illustration" onclick={() => (expanded = false)}
					><PatternIcon name="close" size={21} /></button
				>
			</div>
		</header>
		<!-- Keyboard users need to pan the enlarged illustration. -->
		<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
		<div
			class="image-viewport"
			class:zoomed
			role="region"
			aria-label="Illustration; scroll to explore when zoomed"
			tabindex="0"
		>
			<img
				src={`${base}/images/${art.asset}.webp?v=3`}
				width={imageWidth}
				height={imageHeight}
				alt={art.alt}
			/>
		</div>
		<p class="art-note" id={`${id}-note`}>{art.note}</p>
	</dialog>
{/if}

<style>
	.concept-plate {
		margin: 0 0 24px;
	}
	.art-frame {
		position: relative;
		max-width: min(100%, 820px, calc(420px * var(--art-ratio)));
		margin-inline: auto;
		overflow: hidden;
		border-radius: 15px;
		background: transparent;
		isolation: isolate;
	}
	.art-frame[data-tone='light'] {
		background: transparent;
	}
	.art-frame > img {
		display: block;
		width: 100%;
		height: auto;
		max-height: 420px;
		object-fit: contain;
	}
	.expand-art {
		position: absolute;
		top: 10px;
		right: 10px;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 34px;
		min-height: 34px;
		padding: 0;
		border: 1px solid #ffffff30;
		border-radius: 50%;
		background: color-mix(in srgb, var(--surface) 72%, transparent);
		color: var(--ink);
		backdrop-filter: blur(20px) saturate(140%);
		font-size: 11px;
		opacity: 0;
		transform: translateY(3px);
		transition:
			opacity 180ms ease,
			transform 180ms ease,
			background 150ms ease;
	}
	.art-frame:hover .expand-art,
	.art-frame:focus-within .expand-art {
		opacity: 1;
		transform: translateY(0);
	}
	.expand-art:hover {
		background: var(--surface-raised);
	}
	figcaption {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		padding: 14px 1px 10px;
	}
	figcaption p {
		margin: 0;
		font-size: 13px;
		line-height: 1.65;
		color: var(--muted);
	}
	.caption-actions {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 14px;
		flex-shrink: 0;
	}
	.touch-expand {
		display: none;
		align-items: center;
		justify-content: center;
		width: 44px;
		height: 44px;
		flex-shrink: 0;
		padding: 0;
		border: 0;
		border-radius: 50%;
		background: color-mix(in srgb, var(--surface) 72%, transparent);
		color: var(--ink);
	}
	.touch-expand:hover {
		background: var(--surface-raised);
	}
	.lab-link {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 14px;
		flex-shrink: 0;
		border: 0;
		background: none;
		color: var(--green);
		font-size: 12px;
		font-weight: 600;
		padding: 9px 0 9px 10px;
		white-space: nowrap;
	}
	.lab-link:hover {
		color: var(--ink);
	}
	.art-dialog {
		width: min(1500px, calc(100vw - 48px));
		max-width: none;
		max-height: calc(100dvh - 48px);
		margin: auto;
		padding: 0;
		border: 1px solid var(--line);
		border-radius: 16px;
		background: var(--paper);
		color: var(--ink);
		box-shadow: 0 25px 100px #0007;
	}
	.art-dialog[open] {
		display: flex;
		flex-direction: column;
	}
	.art-dialog::backdrop {
		background: #101217dd;
		backdrop-filter: blur(10px);
	}
	.art-toolbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 24px;
		padding: 16px 22px;
		flex-shrink: 0;
	}
	.art-toolbar h2 {
		font-size: 17px;
		font-weight: 500;
		letter-spacing: -0.02em;
		margin: 0;
	}
	.art-tools {
		display: flex;
		align-items: center;
		gap: 14px;
		flex-shrink: 0;
	}
	.zoom-button,
	.close-art {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		background: var(--surface);
		border: 1px solid var(--line);
		border-radius: 7px;
		color: var(--ink);
		min-height: 44px;
		padding: 8px 11px;
		font-size: 12px;
	}
	.close-art {
		padding: 8px;
		background: none;
		border-color: transparent;
	}
	.zoom-button:hover,
	.close-art:hover {
		background: var(--surface-raised);
	}
	.image-viewport {
		min-height: 0;
		overflow: auto;
		overscroll-behavior: contain;
		background: var(--paper);
		text-align: center;
	}
	.image-viewport img {
		display: block;
		width: 100%;
		height: auto;
		max-height: calc(100dvh - 218px);
		object-fit: contain;
		margin: auto;
	}
	.image-viewport.zoomed img {
		width: 1660px;
		max-width: none;
		max-height: none;
	}
	.art-note {
		margin: 0;
		padding: 17px 24px 20px;
		font-size: 12px;
		line-height: 1.7;
		color: var(--muted);
		flex-shrink: 0;
	}
	@media (hover: none), (pointer: coarse), (max-width: 680px) {
		.expand-art {
			display: none;
		}
		.touch-expand {
			display: flex;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.expand-art {
			transition: none;
		}
	}
	@media (max-width: 680px) {
		.concept-plate {
			margin-bottom: 25px;
		}
		.art-frame {
			border-radius: 10px;
		}
		.caption-actions {
			width: 100%;
		}
		figcaption {
			align-items: flex-start;
			flex-direction: column;
			gap: 8px;
			padding: 13px 0 15px;
		}
		figcaption p {
			font-size: 12px;
		}
		.lab-link {
			padding: 6px 0;
			min-height: 44px;
		}
		.art-dialog {
			width: calc(100vw - 16px);
			max-height: calc(100dvh - 32px);
			border-radius: 11px;
		}
		.art-toolbar {
			padding: 12px;
			gap: 10px;
		}
		.art-toolbar h2 {
			font-size: 14px;
			line-height: 1.35;
		}
		.art-tools {
			gap: 3px;
		}
		.zoom-button {
			width: 44px;
			padding: 8px;
		}
		.zoom-button span {
			display: none;
		}
		.art-note {
			padding: 14px;
			font-size: 11px;
		}
	}
</style>
