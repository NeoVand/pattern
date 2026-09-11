<script lang="ts">
	import PatternIcon from '$lib/components/PatternIcon.svelte';
	import type { ChapterArt } from '$lib/data/chapter-art';

	let { art, target }: { art: ChapterArt; target: string } = $props();
	let expanded = $state(false);
	let zoomed = $state(false);
	let imageWidth = $derived(art.width ?? (art.asset === 'ai-atlas' ? 1660 : 1659));
	const id = $props.id();

	function openDialog(node: HTMLDialogElement) {
		node.showModal();
		return () => node.close();
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

<figure class="concept-plate">
	<div class="art-frame" data-tone={art.tone}>
		<img
			src={`/images/${art.asset}.webp`}
			srcset={`/images/${art.asset}-800.webp 800w, /images/${art.asset}.webp ${imageWidth}w`}
			sizes="(max-width: 680px) calc(100vw - 36px), (max-width: 980px) calc(100vw - 72px), (max-width: 1250px) calc(100vw - 295px), calc(100vw - 324px)"
			width={imageWidth}
			height={art.height ?? 948}
			alt={art.alt}
			fetchpriority="high"
		/>
		<button
			class="expand-art"
			aria-label={`Expand illustration: ${art.title}`}
			onclick={() => {
				zoomed = false;
				expanded = true;
			}}><PatternIcon name="expand" size={15} /><span>View details</span></button
		>
	</div>
	<figcaption>
		<p>{art.caption}</p>
		<button class="lab-link" onclick={jumpToLab}
			>{art.action}<PatternIcon name="arrowDown" size={16} /></button
		>
	</figcaption>
</figure>

{#if expanded}
	<dialog
		class="art-dialog"
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
		<!-- svelte-ignore a11y_no_noninteractive_tabindex (Keyboard users need to pan the enlarged illustration.) -->
		<div
			class="image-viewport"
			class:zoomed
			role="region"
			aria-label="Illustration; scroll to explore when zoomed"
			tabindex="0"
		>
			<img
				src={`/images/${art.asset}.webp`}
				width={imageWidth}
				height={art.height ?? 948}
				alt={art.alt}
			/>
		</div>
		<p class="art-note" id={`${id}-note`}>{art.note}</p>
	</dialog>
{/if}

<style>
	.concept-plate {
		margin: 0 0 32px;
	}
	.art-frame {
		position: relative;
		overflow: hidden;
		border-radius: 15px;
		background: #111817;
		isolation: isolate;
	}
	.art-frame[data-tone='light'] {
		background: #e9e4d8;
	}
	.art-frame > img {
		display: block;
		width: 100%;
		height: auto;
	}
	.expand-art {
		position: absolute;
		top: 16px;
		right: 16px;
		display: flex;
		align-items: center;
		gap: 8px;
		min-height: 36px;
		padding: 8px 11px;
		border: 1px solid #ffffff30;
		border-radius: 7px;
		background: #111817c9;
		color: #f1f0e6;
		backdrop-filter: blur(12px);
		font-size: 11px;
		transition: background 150ms ease;
	}
	.expand-art:hover {
		background: #111817;
	}
	[data-tone='light'] .expand-art {
		background: #f8f5ebdb;
		color: #303b31;
		border-color: #303b3129;
	}
	[data-tone='light'] .expand-art:hover {
		background: #fffdf6;
	}
	figcaption {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		padding: 17px 1px 20px;
	}
	figcaption p {
		margin: 0;
		font-size: 13px;
		line-height: 1.65;
		color: var(--muted);
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
		background: #08100de6;
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
		min-height: 38px;
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
		background: #111817;
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
	@media (max-width: 680px) {
		.concept-plate {
			margin-bottom: 25px;
		}
		.art-frame {
			border-radius: 10px;
		}
		.expand-art {
			top: 8px;
			right: 8px;
			padding: 7px;
			min-height: 32px;
		}
		.expand-art span {
			display: none;
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
			min-height: 36px;
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
			width: 38px;
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
