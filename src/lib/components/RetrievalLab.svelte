<script lang="ts">
	import { onDestroy, tick } from 'svelte';
	import type { AiSession } from '$lib/ai/session.svelte';
	import {
		fieldNotes,
		cosine,
		keywordScore,
		projectVectors,
		groundedMessages,
		type Passage
	} from '$lib/ai/retrieval';
	import PatternIcon from './PatternIcon.svelte';
	import ModelConnection from './ModelConnection.svelte';
	let { ai }: { ai: AiSession } = $props();
	let passages = $state<Passage[]>(fieldNotes.map((p) => ({ ...p })));
	let query = $state('Can I bring my nine-year-old, and what will it cost?');
	let mode = $state<'semantic' | 'keyword'>('semantic');
	let vectors = $state.raw<number[][]>([]);
	let queryVector = $state.raw<number[]>([]);
	let results = $state<{ id: string; score: number }[]>([]);
	let usedQuery = $state('');
	let selected = $state('B');
	let topK = $state(3);
	let running = $state(false);
	let phase = $state('');
	let error = $state('');
	let answer = $state('');
	let answerModel = $state('');
	let usedSources = $state<Passage[]>([]);
	let edit = $state(false);
	let draft = $state('');
	let controller: AbortController | undefined;
	let chosen = $derived(passages.find((p) => p.id === selected)!);
	let retrieved = $derived(results.slice(0, topK).map((r) => passages.find((p) => p.id === r.id)!));
	let coordinates = $derived(
		vectors.length ? projectVectors(queryVector.length ? [...vectors, queryVector] : vectors) : []
	);
	const accents: Record<string, string> = {
		Visit: 'var(--blue)',
		Plants: 'var(--lavender)',
		Food: 'var(--orange)'
	};
	function clearResults() {
		results = [];
		usedQuery = '';
		queryVector = [];
		answer = '';
		usedSources = [];
		error = '';
	}
	function switchMode(next: 'semantic' | 'keyword') {
		mode = next;
		clearResults();
	}
	function selectPreset(text: string) {
		query = text;
		clearResults();
	}
	async function reveal(id: string) {
		await tick();
		const node = document.getElementById(id);
		if (!node) return;
		node.focus({ preventScroll: true });
		const bounds = node.getBoundingClientRect();
		if (bounds.top < 96 || bounds.bottom > window.innerHeight - 24) {
			node.scrollIntoView({
				block: 'start',
				behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
			});
		}
	}
	function revealSource(id: string) {
		selected = id;
		edit = false;
		void reveal('retrieval-source');
	}
	async function search() {
		if (!query.trim() || running || ai.busy) return;
		controller = new AbortController();
		running = true;
		error = '';
		answer = '';
		usedSources = [];
		const q = query.trim();
		try {
			if (mode === 'semantic') {
				phase = vectors.length
					? 'Embedding your question…'
					: 'Embedding the field notes and question…';
				const input = vectors.length ? [q] : [...passages.map((p) => `${p.title}\n${p.body}`), q];
				const embedded = await ai.embed(input, controller.signal);
				if (!vectors.length) vectors = embedded.slice(0, -1);
				queryVector = embedded.at(-1)!;
				results = passages
					.map((p, i) => ({ id: p.id, score: cosine(vectors[i], queryVector) }))
					.sort((a, b) => b.score - a.score);
			} else {
				results = passages
					.map((p) => ({ id: p.id, score: keywordScore(q, `${p.title} ${p.body}`) }))
					.filter((r) => r.score > 0)
					.sort((a, b) => b.score - a.score);
			}
			usedQuery = q;
			if (results[0]) selected = results[0].id;
			void reveal('retrieval-results');
		} catch (e) {
			if (!controller.signal.aborted) error = e instanceof Error ? e.message : String(e);
		} finally {
			running = false;
			phase = '';
		}
	}
	async function generate() {
		if (running || ai.busy || !retrieved.length) return;
		if (!ai.ready) {
			ai.settingsOpen = true;
			return;
		}
		controller = new AbortController();
		running = true;
		error = '';
		answer = '';
		phase = 'Reading the retrieved sources…';
		usedSources = retrieved.map((p) => ({ ...p }));
		answerModel = ai.label;
		try {
			const result = await ai.generate({
				messages: groundedMessages(usedQuery, usedSources),
				signal: controller.signal,
				maxTokens: 500,
				temperature: 0.2,
				onText: (chunk) => {
					answer += chunk;
				}
			});
			answer = result.text;
		} catch (e) {
			if (!controller.signal.aborted) error = e instanceof Error ? e.message : String(e);
		} finally {
			running = false;
			phase = '';
		}
	}
	function stop() {
		controller?.abort();
	}
	function save() {
		if (!draft.trim()) return;
		passages = passages.map((p) => (p.id === selected ? { ...p, body: draft.trim() } : p));
		vectors = [];
		clearResults();
		edit = false;
	}
	onDestroy(stop);
</script>

<div class="retrieval-lab">
	<ModelConnection {ai} />
	<div class="retrieval-intro">
		<div>
			<PatternIcon name="retrieval" size={42} />
			<h2>A question finds<br /><em>its evidence.</em></h2>
		</div>
		<p>
			Search the Glasshouse’s field notes. Compare matching words with matching meaning, then let a
			model answer from the passages you found.
		</p>
	</div>
	<div class="search-stage">
		<div class="search-modes" role="group" aria-label="Retrieval method">
			<button
				class:active={mode === 'semantic'}
				aria-pressed={mode === 'semantic'}
				onclick={() => switchMode('semantic')}
				disabled={running}>Meaning <span>Embeddings</span></button
			><button
				class:active={mode === 'keyword'}
				aria-pressed={mode === 'keyword'}
				onclick={() => switchMode('keyword')}
				disabled={running}>Words <span>Keyword overlap</span></button
			>
		</div>
		<label for="retrieval-question">Ask the field notes</label>
		<div class="question-row">
			<textarea
				id="retrieval-question"
				rows="2"
				maxlength="1000"
				bind:value={query}
				oninput={clearResults}
				disabled={running}
				onkeydown={(e) => {
					if (e.key === 'Enter' && !e.shiftKey) {
						e.preventDefault();
						void search();
					}
				}}></textarea><button
				class="primary-button"
				onclick={search}
				disabled={running || ai.busy || !query.trim()}
				><PatternIcon name="scan" size={19} />{mode === 'semantic' && !vectors.length
					? 'Embed & search'
					: 'Search'}</button
			>
		</div>
		<div class="question-presets">
			<button
				disabled={running}
				aria-pressed={query === 'Can I bring my nine-year-old, and what will it cost?'}
				onclick={() => selectPreset('Can I bring my nine-year-old, and what will it cost?')}
				>A family visit</button
			><button
				disabled={running}
				aria-pressed={query === 'Can a visitor who uses a wheelchair reach both floors?'}
				onclick={() => selectPreset('Can a visitor who uses a wheelchair reach both floors?')}
				>Getting around</button
			><button
				disabled={running}
				aria-pressed={query === 'How many parking spaces are available?'}
				onclick={() => selectPreset('How many parking spaces are available?')}
				>Something missing</button
			>
		</div>
		<p class="search-footnote">
			{mode === 'semantic'
				? 'Real text-embedding-3-small vectors · 256 dimensions · OpenAI connection required.'
				: 'Exact word overlap, computed here. Related meanings without shared words can be missed.'}
		</p>
	</div>
	{#if running}<div class="retrieval-status" role="status">
			<span>{phase}</span><button onclick={stop}><PatternIcon name="stop" size={16} />Stop</button>
		</div>{/if}
	{#if error}<p class="error-notice" role="alert">{error}</p>{/if}
	<div class="retrieval-workspace">
		<div class="document-area">
			<div class="section-heading">
				<h3>The source library</h3>
				<span>{passages.length} short passages · fictional venue</span>
			</div>
			{#if coordinates.length}
				<div class="semantic-map" aria-label="Two-dimensional projection of actual embeddings">
					<svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"
						>{#if queryVector.length}{#each retrieved as p (p.id)}{@const i = passages.findIndex(
									(item) => item.id === p.id
								)}<line
									x1={coordinates.at(-1)!.x}
									y1={coordinates.at(-1)!.y}
									x2={coordinates[i].x}
									y2={coordinates[i].y}
								/>{/each}{/if}</svg
					>
					{#each passages as p, i (p.id)}<button
							class="map-point"
							class:selected={p.id === selected}
							style:left={`${coordinates[i].x}%`}
							style:top={`${coordinates[i].y}%`}
							style:--point={accents[p.topic]}
							aria-label={`Inspect ${p.title}`}
							onclick={() => {
								selected = p.id;
								edit = false;
							}}>{p.id}</button
						>{/each}
					{#if queryVector.length}<span
							class="query-point"
							style:left={`${coordinates.at(-1)!.x}%`}
							style:top={`${coordinates.at(-1)!.y}%`}>?</span
						>{/if}
				</div>
				<p class="projection-note">
					A 2D projection of the actual vectors. Ranking uses all 256 dimensions; distances here are
					approximate.
				</p>
			{:else}<div class="library-grid">
					{#each passages as p (p.id)}<button
							class:selected={selected === p.id}
							onclick={() => {
								selected = p.id;
								edit = false;
							}}
							><span class="document-letter" style:color={accents[p.topic]}>{p.id}</span><span
								>{p.title}<small>{p.topic}</small></span
							><PatternIcon name="arrowUpRight" size={16} /></button
						>{/each}
				</div>{/if}
			<article
				class="passage-reader"
				id="retrieval-source"
				tabindex="-1"
				aria-labelledby="source-title"
			>
				<div>
					<span class="source-id">SOURCE {chosen.id}</span><button
						disabled={running}
						onclick={() => {
							edit = !edit;
							draft = chosen.body;
						}}>{edit ? 'Cancel' : 'Edit this source'}</button
					>
				</div>
				<h3 id="source-title">{chosen.title}</h3>
				{#if edit}<textarea aria-label="Source passage" bind:value={draft} rows="5" maxlength="2000"
					></textarea><button class="primary-button" onclick={save} disabled={!draft.trim()}
						>Save & rebuild on next search</button
					>{:else}<p>{chosen.body}</p>{/if}
			</article>
		</div>
		<div
			class="ranking-area"
			id="retrieval-results"
			tabindex="-1"
			role="region"
			aria-label="Retrieved passages"
		>
			<div class="section-heading">
				<h3>{usedQuery ? 'Closest passages' : 'What will be retrieved?'}</h3>
				<PatternIcon name="layers" size={24} />
			</div>
			{#if usedQuery}<p class="query-snapshot">“{usedQuery}”</p>
				<div class="source-count">
					<span>Passages to use</span>{#each [1, 3, 5] as n (n)}<button
							class:active={topK === n}
							aria-pressed={topK === n}
							disabled={running}
							onclick={() => {
								topK = n;
								answer = '';
								usedSources = [];
							}}>{n}</button
						>{/each}
				</div>{/if}
			{#if results.length}<div class="rankings">
					{#each results as result, i (result.id)}{@const passage = passages.find(
							(p) => p.id === result.id
						)!}<button
							class:included={i < topK}
							aria-label={`Read source ${result.id}: ${passage.title}, similarity ${result.score.toFixed(2)}`}
							onclick={() => revealSource(result.id)}
							><span class="rank-id">{result.id}</span><span class="rank-title"
								>{passage.title}<i style:width={`${Math.max(0, result.score) * 100}%`}></i></span
							><span class="rank-score">{result.score.toFixed(2)}</span></button
						>{/each}
				</div>
				<p class="projection-note">
					{mode === 'semantic'
						? 'Cosine similarity, not a probability.'
						: 'Fraction of question words found in each passage.'} Highlighted passages become context.
				</p>
				<button
					class="primary-button answer-button"
					onclick={generate}
					disabled={running || ai.busy}
					><PatternIcon name="language" size={20} />{ai.ready
						? 'Answer with these sources'
						: 'Connect a model to answer'}</button
				>
			{:else}<div class="retrieval-empty">
					<PatternIcon name="embeddings" size={58} />
					<p>
						{usedQuery
							? 'No shared words were found. Try a different question or search by meaning.'
							: 'Similar wording and similar meaning are different things. Search to see which passages the model will receive.'}
					</p>
				</div>{/if}
		</div>
	</div>
	{#if answer || usedSources.length}<section class="grounded-answer">
			<div class="section-heading">
				<h3>The grounded answer</h3>
				<span>{answerModel}</span>
			</div>
			<div class="answer-text" aria-live="polite">{answer || 'Reading…'}</div>
			<div class="answer-sources">
				{#each usedSources as p (p.id)}<button onclick={() => revealSource(p.id)}
						>[{p.id}] {p.title}</button
					>{/each}
			</div>
			<p>
				These are the passages actually sent to the model. Citations are model output—check that
				each claim is supported.
			</p>
		</section>{/if}
	<div class="retrieval-takeaway">
		<PatternIcon name="idea" size={28} />
		<p>
			<strong>The weights did not change.</strong> Retrieval put relevant information into the context.
			Editing a source changes what the next answer can use, without retraining the language model.
		</p>
	</div>
</div>

<style>
	.retrieval-intro {
		display: flex;
		justify-content: space-between;
		gap: 40px;
		align-items: center;
		margin: 46px 0 30px;
	}
	.retrieval-intro > div {
		display: flex;
		align-items: center;
		gap: 23px;
		color: var(--green);
	}
	h2 {
		font-size: 31px;
		line-height: 1.17;
		font-weight: 450;
		letter-spacing: -0.8px;
		color: var(--ink);
		margin: 0;
	}
	h2 em {
		font: italic 1.2em var(--serif);
		color: var(--green);
	}
	.retrieval-intro > p {
		max-width: 420px;
		font-size: 14px;
		line-height: 1.8;
		color: var(--muted);
		margin: 0;
	}
	.search-stage {
		background: var(--surface);
		padding: 28px;
		border-radius: 22px;
	}
	.search-modes {
		display: flex;
		gap: 8px;
		margin-bottom: 27px;
	}
	.search-modes button {
		background: transparent;
		border: 0;
		color: var(--muted);
		padding: 11px 16px;
		border-radius: 12px;
		font-size: 14px;
		font-weight: 550;
	}
	.search-modes button.active {
		color: var(--ink);
		background: var(--paper);
	}
	.search-modes span {
		font-size: 11px;
		font-weight: 400;
		margin-left: 7px;
		color: var(--muted);
	}
	label {
		display: block;
		font-size: 12px;
		color: var(--muted);
		margin-bottom: 10px;
	}
	.question-row {
		display: flex;
		gap: 12px;
	}
	.question-row textarea {
		flex: 1;
		min-width: 0;
		background: var(--paper);
		border: 0;
		border-radius: 12px;
		padding: 16px;
		color: var(--ink);
		font: inherit;
		font-size: 14px;
		line-height: 1.6;
		height: 56px;
		min-height: 56px;
		resize: vertical;
	}
	.question-row button {
		margin: 0;
		white-space: nowrap;
		align-self: flex-start;
		min-height: 56px;
		min-width: 164px;
	}
	.question-presets {
		display: flex;
		flex-wrap: wrap;
		gap: 12px;
		margin-top: 17px;
	}
	.question-presets button {
		background: none;
		border: 0;
		padding: 4px 0;
		color: var(--green);
		font-size: 12px;
	}
	.question-presets button + button {
		margin-left: 6px;
	}
	.question-presets button[aria-pressed='true'] {
		color: var(--ink);
	}
	.search-footnote,
	.projection-note {
		font-size: 11px;
		line-height: 1.7;
		color: var(--quiet);
	}
	.search-footnote {
		margin: 18px 0 0;
	}
	.retrieval-workspace {
		display: grid;
		grid-template-columns: 1.15fr 1fr;
		gap: 34px;
		margin-top: 40px;
	}
	.section-heading {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 16px;
		margin-bottom: 21px;
	}
	.section-heading h3 {
		font-size: 16px;
		font-weight: 500;
		margin: 0;
	}
	.section-heading > span {
		font-size: 10px;
		color: var(--quiet);
	}
	.library-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 8px;
	}
	.library-grid button {
		display: flex;
		align-items: center;
		gap: 11px;
		background: var(--surface);
		border: 0;
		border-radius: 12px;
		text-align: left;
		padding: 18px 13px;
		color: var(--ink);
		font-size: 12px;
	}
	.library-grid button.selected {
		background: var(--accent-bg);
	}
	.document-letter {
		font: 24px var(--serif);
	}
	.library-grid button > span:nth-child(2) {
		flex: 1;
	}
	.library-grid small {
		display: block;
		margin-top: 5px;
		font-size: 10px;
		color: var(--muted);
	}
	.passage-reader {
		background: var(--surface);
		padding: 25px;
		border-radius: 18px;
		margin-top: 17px;
		min-height: 250px;
		scroll-margin-top: 96px;
	}
	.passage-reader:focus,
	.ranking-area:focus {
		outline: none;
	}
	.ranking-area {
		scroll-margin-top: 96px;
		min-width: 0;
	}
	.passage-reader > div {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 15px;
	}
	.source-id {
		font: 10px var(--mono);
		letter-spacing: 0.07em;
		color: var(--green);
	}
	.passage-reader button {
		border: 0;
		background: none;
		font-size: 11px;
		color: var(--green);
	}
	.passage-reader h3 {
		font-size: 20px;
		font-weight: 450;
		margin: 20px 0 12px;
	}
	.passage-reader p {
		font-size: 13px;
		line-height: 1.9;
		color: var(--muted);
		margin: 0;
	}
	.passage-reader textarea {
		width: 100%;
		background: var(--paper);
		color: var(--ink);
		border: 0;
		border-radius: 10px;
		padding: 14px;
		font-family: inherit;
		font-size: 13px;
		line-height: 1.8;
		resize: vertical;
	}
	.passage-reader .primary-button {
		background: var(--accent);
		color: var(--paper);
		margin-top: 12px;
	}
	.semantic-map {
		--blue: var(--chart-blue);
		--lavender: var(--chart-lavender);
		--orange: var(--chart-amber);
		height: 330px;
		position: relative;
		overflow: hidden;
		border-radius: 20px;
		background: radial-gradient(ellipse at 50% 50%, #30435f55, transparent 65%), var(--plot);
	}
	.semantic-map svg {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
	}
	.semantic-map line {
		stroke: var(--chart-blue);
		stroke-width: 0.2;
		stroke-dasharray: 1.2 1.2;
		opacity: 0.4;
	}
	.map-point,
	.query-point {
		position: absolute;
		transform: translate(-50%, -50%);
		width: 33px;
		height: 33px;
		border-radius: 50%;
		border: 0;
		background: var(--point);
		color: var(--plot);
		display: grid;
		place-items: center;
		font: 12px var(--mono);
		box-shadow: 0 0 0 6px color-mix(in srgb, var(--chart-blue) 4.31%, transparent);
	}
	.map-point.selected {
		box-shadow: 0 0 0 7px color-mix(in srgb, var(--chart-blue) 13.73%, transparent);
	}
	.query-point {
		background: #f6f0d8;
		box-shadow: 0 0 25px #f6f0d83a;
		width: 37px;
		height: 37px;
	}
	.query-snapshot {
		font: italic 22px/1.4 var(--serif);
		color: var(--muted);
		margin: 0 0 23px;
	}
	.source-count {
		display: flex;
		align-items: center;
		gap: 6px;
		margin-bottom: 20px;
	}
	.source-count > span {
		font-size: 11px;
		color: var(--quiet);
		margin-right: auto;
	}
	.source-count button {
		border: 0;
		border-radius: 8px;
		background: var(--surface);
		color: var(--muted);
		height: 33px;
		width: 33px;
		font: 11px var(--mono);
	}
	.source-count button.active {
		background: var(--accent-bg);
		color: var(--green);
	}
	.rankings {
		display: grid;
		gap: 7px;
	}
	.rankings button {
		display: flex;
		align-items: center;
		gap: 14px;
		text-align: left;
		background: transparent;
		border: 0;
		color: var(--muted);
		padding: 13px 12px;
		border-radius: 12px;
		opacity: 0.65;
	}
	.rankings button.included {
		background: var(--surface);
		color: var(--ink);
		opacity: 1;
	}
	.rank-id {
		font: 22px var(--serif);
		color: var(--green);
	}
	.rank-title {
		flex: 1;
		font-size: 12px;
		min-width: 0;
	}
	.rank-title i {
		display: block;
		height: 3px;
		background: var(--green);
		margin-top: 9px;
		border-radius: 3px;
		opacity: 0.45;
		transition: width 180ms ease;
	}
	.rank-score {
		font: 11px var(--mono);
	}
	.answer-button {
		width: 100%;
		margin-top: 21px;
	}
	.retrieval-empty {
		display: grid;
		place-items: center;
		min-height: 290px;
		color: var(--green);
		padding: 30px;
		background: var(--surface);
		border-radius: 18px;
	}
	.retrieval-empty p {
		font-size: 13px;
		line-height: 1.85;
		text-align: center;
		color: var(--muted);
		max-width: 280px;
	}
	.grounded-answer {
		margin-top: 35px;
		background: var(--surface);
		padding: 30px;
		border-radius: 22px;
	}
	.answer-text {
		font-size: 16px;
		line-height: 1.9;
		white-space: pre-wrap;
		color: var(--ink);
	}
	.answer-sources {
		display: flex;
		flex-wrap: wrap;
		gap: 9px;
		margin-top: 25px;
	}
	.answer-sources button {
		border: 0;
		background: var(--paper);
		border-radius: 8px;
		color: var(--green);
		padding: 9px 12px;
		font-size: 11px;
	}
	.grounded-answer > p {
		font-size: 11px;
		color: var(--quiet);
		line-height: 1.7;
		margin-bottom: 0;
	}
	.retrieval-takeaway {
		display: flex;
		align-items: center;
		gap: 23px;
		padding: 30px 5px;
		color: var(--green);
	}
	.retrieval-takeaway p {
		margin: 0;
		font-size: 13px;
		line-height: 1.9;
		color: var(--muted);
	}
	.retrieval-takeaway strong {
		color: var(--ink);
		font-weight: 500;
	}
	.retrieval-status {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-top: 16px;
		color: var(--muted);
		font-size: 12px;
	}
	.retrieval-status button {
		display: flex;
		gap: 6px;
		align-items: center;
		background: var(--surface);
		border: 0;
		color: var(--ink);
		padding: 9px 14px;
		border-radius: 10px;
	}
	@media (max-width: 900px) {
		.retrieval-workspace {
			gap: 22px;
		}
		.library-grid {
			grid-template-columns: 1fr;
		}
		.retrieval-intro {
			gap: 25px;
		}
		.retrieval-intro > p {
			max-width: 340px;
		}
	}
	@media (max-width: 680px) {
		.retrieval-intro {
			display: block;
			margin-top: 32px;
		}
		.retrieval-intro > p {
			margin-top: 20px;
		}
		.search-stage {
			padding: 20px 16px;
		}
		.search-modes {
			gap: 3px;
		}
		.search-modes button {
			padding: 10px 11px;
		}
		.search-modes span {
			display: block;
			margin: 5px 0 0;
		}
		.question-row {
			flex-direction: column;
		}
		.question-row textarea {
			font-size: 16px;
			height: 88px;
			min-height: 88px;
		}
		.question-row button {
			width: 100%;
			min-height: 48px;
		}
		.retrieval-workspace {
			grid-template-columns: 1fr;
			margin-top: 28px;
		}
		.library-grid {
			grid-template-columns: 1fr 1fr;
		}
		.library-grid button {
			padding: 15px 10px;
			font-size: 11px;
		}
		.library-grid button :global(svg) {
			display: none;
		}
		.semantic-map {
			height: 290px;
		}
		.grounded-answer {
			padding: 22px;
		}
		.answer-text {
			font-size: 14px;
		}
		.section-heading {
			align-items: flex-start;
		}
		.section-heading > span {
			max-width: 125px;
			text-align: right;
			line-height: 1.5;
		}
		.retrieval-takeaway {
			align-items: flex-start;
		}
		.retrieval-takeaway :global(svg) {
			flex-shrink: 0;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.rank-title i {
			transition: none;
		}
	}
</style>
