<script lang="ts">
	import { asset } from '$app/paths';
	import { fly, fade } from 'svelte/transition';
	import { prefersReducedMotion } from 'svelte/motion';
	import PatternIcon from '$lib/components/PatternIcon.svelte';
	import { lessons } from '$lib/data/lessons';
	import { chapterArt } from '$lib/data/chapter-art';
	import ConceptPlate from '$lib/components/ConceptPlate.svelte';
	import FootwearPlate from '$lib/components/FootwearPlate.svelte';
	import GenerativeLab from '$lib/components/GenerativeLab.svelte';
	import TokenLab from '$lib/components/TokenLab.svelte';
	import PatternLab from '$lib/components/PatternLab.svelte';
	import DataSplitStory from '$lib/components/DataSplitStory.svelte';
	import ForecastLab from '$lib/components/ForecastLab.svelte';
	import TrainingLab from '$lib/components/TrainingLab.svelte';
	import ConvnetLab from '$lib/components/ConvnetLab.svelte';
	import ValidationLab from '$lib/components/ValidationLab.svelte';
	import AiMap from '$lib/components/AiMap.svelte';
	import LanguageLab from '$lib/components/LanguageLab.svelte';
	import AgentLab from '$lib/components/AgentLab.svelte';
	import ToolCallingLab from '$lib/components/ToolCallingLab.svelte';
	import LessonNotes from '$lib/components/LessonNotes.svelte';
	import { onMount, onDestroy } from 'svelte';
	import ImageClassifier from '$lib/components/ImageClassifier.svelte';
	import ModelSettings from '$lib/components/ModelSettings.svelte';
	import ClusteringLab from '$lib/components/ClusteringLab.svelte';
	import ReinforcementLab from '$lib/components/ReinforcementLab.svelte';
	import AdaptationLab from '$lib/components/AdaptationLab.svelte';
	import SelfSupervisedLab from '$lib/components/SelfSupervisedLab.svelte';
	import PretrainingStory from '$lib/components/PretrainingStory.svelte';
	import RetrievalLab from '$lib/components/RetrievalLab.svelte';
	import VisionLab from '$lib/components/VisionLab.svelte';
	import EvaluationLab from '$lib/components/EvaluationLab.svelte';
	import { AiSession } from '$lib/ai/session.svelte';
	const ai = new AiSession();
	onDestroy(() => ai.dispose());
	let theme = $state<'dark' | 'light'>('dark');
	function toggleTheme() {
		theme = theme === 'dark' ? 'light' : 'dark';
		document.documentElement.dataset.theme = theme;
		try {
			localStorage.setItem('pattern-theme', theme);
		} catch {
			/* Preferences can be unavailable in private browsing. */
		}
	}
	onMount(() => {
		theme = document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
		void ai.discoverDevelopmentKey();
	});
	let chapter = $state(0);
	let menuOpen = $state(false);
	let presenting = $state(false);
	let lesson = $derived(lessons[chapter]);
	function fromHash() {
		const index = lessons.findIndex((item) => `#${item.id}` === window.location.hash);
		if (index >= 0) {
			chapter = index;
			menuOpen = false;
		}
	}
	onMount(fromHash);
	function go(index: number) {
		if (index < 0 || index >= lessons.length) return;
		chapter = index;
		window.history.pushState(null, '', `#${lessons[index].id}`);
		menuOpen = false;
		window.scrollTo({ top: 0, behavior: 'instant' });
		requestAnimationFrame(() => document.querySelector('h1')?.focus({ preventScroll: true }));
	}
	function keyboard(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			presenting = false;
			menuOpen = false;
			return;
		}
		if (
			(event.target as HTMLElement)?.closest(
				'input,select,textarea,button,a,summary,dialog,[role="button"],[role="region"][tabindex="0"]'
			) ||
			event.altKey ||
			event.ctrlKey ||
			event.metaKey
		)
			return;
		if (event.key === 'ArrowRight') {
			event.preventDefault();
			go(chapter + 1);
		}
		if (event.key === 'ArrowLeft') {
			event.preventDefault();
			go(chapter - 1);
		}
	}
</script>

<svelte:head
	><title>Pattern — A field guide to machine learning</title><meta
		name="description"
		content="Understand machine learning by seeing it happen. An interactive field guide with real model training, visual lessons, neural networks, language models, and agents."
	/></svelte:head
>
<svelte:window onkeydown={keyboard} onhashchange={fromHash} />
<a class="skip-link" href="#main-content">Skip to lesson</a>
<div class:presenting class="app-shell">
	<header class="site-header">
		<a
			class="brand"
			href="#patterns"
			onclick={(event) => {
				event.preventDefault();
				go(0);
			}}
			aria-label="Pattern home"
			><span class="brand-symbol" aria-hidden="true"
				><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></span
			>pattern<span class="brand-period">.</span></a
		><span class="header-description">A FIELD GUIDE TO MACHINE LEARNING</span>
		<div class="header-actions">
			<button
				class="icon-button theme-toggle"
				aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
				onclick={toggleTheme}
				>{#if theme === 'dark'}<PatternIcon name="sun" size={19} />{:else}<PatternIcon
						name="moon"
						size={19}
					/>{/if}</button
			>
			<button
				class="header-model-button"
				aria-label={`Model settings: ${ai.ready ? ai.label : 'Connect a model'}`}
				onclick={() => (ai.settingsOpen = true)}
				><PatternIcon name="cpu" size={17} /><i class:ready={ai.ready}></i>{ai.ready
					? ai.label
					: 'Connect a model'}</button
			><button
				class="icon-button presentation-button"
				aria-label={presenting ? 'Exit presentation mode' : 'Enter presentation mode'}
				aria-pressed={presenting}
				onclick={() => (presenting = !presenting)}
				><PatternIcon name="presentation" size={18} strokeWidth={1.6} /></button
			><button
				class="icon-button mobile-menu"
				aria-label="Toggle chapters"
				aria-expanded={menuOpen}
				onclick={() => (menuOpen = !menuOpen)}
				>{#if menuOpen}<PatternIcon name="close" size={20} />{:else}<PatternIcon
						name="menu"
						size={20}
					/>{/if}</button
			>
		</div>
	</header>
	{#if menuOpen}<button
			class="sidebar-scrim"
			aria-label="Close chapter menu"
			onclick={() => (menuOpen = false)}
			transition:fade={{ duration: prefersReducedMotion.current ? 0 : 180 }}
		></button>{/if}
	<aside class:open={menuOpen} class="sidebar">
		<nav aria-label="Chapters">
			{#each lessons as item, i (item.id)}{#if i === 0 || item.group !== lessons[i - 1].group}<div
						class="nav-group"
					>
						{item.group}
					</div>{/if}<button
					class:active={chapter === i}
					aria-current={chapter === i ? 'step' : undefined}
					onclick={() => go(i)}
					><PatternIcon name={item.icon} size={18} strokeWidth={1.6} class="nav-icon" /><span
						>{item.title}</span
					></button
				>{/each}
		</nav>
	</aside>
	<main id="main-content">
		{#key lesson.id}<div
				class="chapter-page"
				data-family={lesson.group}
				in:fly={{
					y: prefersReducedMotion.current ? 0 : 8,
					duration: prefersReducedMotion.current ? 0 : 240
				}}
			>
				<div class="chapter-context">
					<span>{lesson.title}</span><span
						>{String(chapter + 1).padStart(2, '0')} / {String(lessons.length).padStart(
							2,
							'0'
						)}</span
					>
				</div>
				{#if chapter === 0}
					<section class="intro-cover" id={lesson.id}>
						<div class="intro-cover-copy">
							<h1 tabindex="-1">Some rules<br />we write.<br /><em>Others we learn.</em></h1>
							<p>
								From sorting numbers to seeing the world.<br />Four problems. Two ways to solve
								them.
							</p>
						</div>
						<img
							src={asset('/images/edition-3/rules-to-learning.webp')}
							alt="Rules: sort 7, 3, 5 into 3, 5, 7. Learning: varied boot images feed a network that recognizes a boot."
							width="1942"
							height="620"
							fetchpriority="high"
						/>
					</section>
				{:else}
					<section class="lesson-header" class:illustrated={!!chapterArt[lesson.id]} id={lesson.id}>
						<div>
							<h1 tabindex="-1">{lesson.headline}<br /><em>{lesson.accent}</em></h1>
						</div>
						<p class="lesson-description">{lesson.description}</p>
					</section>
				{/if}
				{#if chapterArt[lesson.id]}
					<ConceptPlate art={chapterArt[lesson.id]} target={`lab-${lesson.id}`} />
				{/if}
				<section
					id={`lab-${lesson.id}`}
					class="chapter-lab"
					tabindex="-1"
					aria-label={lesson.prompt}
				>
					{#if lesson.id === 'patterns'}<PatternLab {ai} />
					{:else if lesson.id === 'training'}<TrainingLab kind="regression" /><DataSplitStory />
					{:else if lesson.id === 'generalization'}<ValidationLab />
					{:else if lesson.id === 'classification'}<FootwearPlate /><ImageClassifier />
					{:else if lesson.id === 'forecasting'}<ForecastLab />
					{:else if lesson.id === 'clustering'}<ClusteringLab />
					{:else if lesson.id === 'reinforcement'}<ReinforcementLab />
					{:else if lesson.id === 'deep-learning'}<TrainingLab kind="neural-classifier" />
					{:else if lesson.id === 'representations'}<ConvnetLab />
					{:else if lesson.id === 'self-supervised'}<SelfSupervisedLab /><PretrainingStory />
					{:else if lesson.id === 'adaptation'}<AdaptationLab />
					{:else if lesson.id === 'modern-ai'}<AiMap />
					{:else if lesson.id === 'tokens'}<TokenLab />
					{:else if lesson.id === 'language'}<LanguageLab {ai} />
					{:else if lesson.id === 'generative'}<GenerativeLab {ai} />
					{:else if lesson.id === 'vision'}<VisionLab {ai} />
					{:else if lesson.id === 'retrieval'}<RetrievalLab {ai} />
					{:else if lesson.id === 'tool-calling'}<ToolCallingLab {ai} />
					{:else if lesson.id === 'agents'}<AgentLab {ai} />
					{:else}<EvaluationLab {ai} />{/if}
				</section>
				{#if chapter > 0}<p class="lesson-caption">{lesson.idea}</p>{/if}
				<LessonNotes chapter={lesson.noteIndex} />
				<footer class="lesson-footer">
					<button class="text-button" disabled={chapter === 0} onclick={() => go(chapter - 1)}
						><PatternIcon name="arrowLeft" size={16} /> Previous</button
					><span class="keyboard-hint"><kbd>←</kbd><kbd>→</kbd></span><button
						class="next-button"
						onclick={() => go(chapter === lessons.length - 1 ? 0 : chapter + 1)}
						><span
							><small>{chapter === lessons.length - 1 ? 'BACK TO THE BEGINNING' : 'UP NEXT'}</small
							>{lessons[(chapter + 1) % lessons.length].title}</span
						><PatternIcon name="arrowRight" size={20} /></button
					>
				</footer>
			</div>{/key}
	</main>
</div>

<ModelSettings {ai} />

<style>
	.lesson-header.illustrated {
		padding: 4px 0 0;
		margin-bottom: 24px;
	}
	.chapter-lab {
		scroll-margin-top: calc(var(--header-height) + 20px);
	}
	.chapter-lab:focus {
		outline: none;
	}
</style>
