<script lang="ts">
	import { onDestroy } from 'svelte';
	import PatternIcon from '$lib/components/PatternIcon.svelte';
	import { TinyWordModel, everydayCorpus, adaptationCorpora } from '$lib/ml/word-adaptation';
	const untrained = new TinyWordModel();
	let baseModel = $state.raw(new TinyWordModel());
	let adaptedModel = $state.raw(new TinyWordModel());
	let domain = $state<'cafe' | 'space'>('cafe');
	let context = $state('the');
	let baseEpochs = $state(0);
	let adaptationEpochs = $state(0);
	let strength = $state(80);
	let training = $state<'base' | 'adapt' | null>(null);
	let timer: ReturnType<typeof setInterval> | undefined;
	const corpus = $derived(adaptationCorpora[domain]);
	const comparingAdaptation = $derived(training === 'adapt' || adaptationEpochs > 0);
	const before = $derived(comparingAdaptation ? baseModel : untrained);
	const after = $derived(comparingAdaptation ? adaptedModel : baseModel);
	const beforeLabel = $derived(comparingAdaptation ? 'Base model' : 'Untrained');
	const afterLabel = $derived(
		training !== null
			? 'Learning'
			: comparingAdaptation
				? 'Adapted model'
				: baseEpochs
					? 'Base model'
					: 'Untrained'
	);
	const comparison = $derived.by(() => {
		const first = before.predict(context),
			second = after.predict(context);
		const topWords = second
			.filter(({ word }) => !word.startsWith('<'))
			.slice(0, 5)
			.map(({ word }) => word);
		const strongestBefore = first.find(
			({ word }) => !word.startsWith('<') && !topWords.includes(word)
		);
		if (strongestBefore) topWords.push(strongestBefore.word);
		const rows = topWords.map((word) => ({
			word,
			before: first.find((entry) => entry.word === word)!.probability,
			after: second.find((entry) => entry.word === word)!.probability
		}));
		return {
			rows,
			maximum: Math.max(0.05, ...rows.flatMap((row) => [row.before, row.after])),
			otherBefore: 1 - rows.reduce((sum, row) => sum + row.before, 0),
			otherAfter: 1 - rows.reduce((sum, row) => sum + row.after, 0)
		};
	});
	const broadBefore = $derived(before.loss(everydayCorpus));
	const broadAfter = $derived(after.loss(everydayCorpus));
	const domainBefore = $derived(before.loss(corpus));
	const domainAfter = $derived(after.loss(corpus));
	const drift = $derived(after.distance(before));
	const matrixWords = $derived(
		domain === 'cafe'
			? ['coffee', 'espresso', 'latte', 'rich', 'smooth', 'milk']
			: ['planet', 'star', 'galaxy', 'distant', 'moon', 'telescope']
	);
	const matrixContexts = ['the', 'is', 'with', 'tastes'];
	function stop() {
		clearInterval(timer);
		if (training === 'base') adaptedModel = baseModel.clone();
		training = null;
	}
	function pretrain() {
		stop();
		baseModel = new TinyWordModel();
		adaptedModel = new TinyWordModel();
		baseEpochs = 0;
		adaptationEpochs = 0;
		training = 'base';
		timer = setInterval(() => {
			const next = baseModel.clone();
			next.train(everydayCorpus, 3);
			baseModel = next;
			baseEpochs += 3;
			if (baseEpochs >= 120) stop();
		}, 60);
	}
	function adapt() {
		stop();
		adaptedModel = baseModel.clone();
		adaptationEpochs = 0;
		training = 'adapt';
		timer = setInterval(() => {
			const count = Math.min(3, strength - adaptationEpochs);
			const next = adaptedModel.clone();
			next.train(corpus, count);
			adaptedModel = next;
			adaptationEpochs += count;
			if (adaptationEpochs >= strength) stop();
		}, 65);
	}
	function changeDomain(next: 'cafe' | 'space') {
		stop();
		domain = next;
		adaptationEpochs = 0;
		adaptedModel = baseModel.clone();
	}
	function changeStrength(value: number) {
		stop();
		strength = value;
		adaptationEpochs = 0;
		adaptedModel = baseModel.clone();
	}
	function reset() {
		stop();
		baseEpochs = 0;
		adaptationEpochs = 0;
		baseModel = new TinyWordModel();
		adaptedModel = new TinyWordModel();
	}
	onDestroy(stop);
</script>

<div class="adaptation-lab">
	<div class="adaptation-layout">
		<div class="adaptation-controls">
			<div class="lab-signature">
				<PatternIcon name="adaptation" size={25} /><span>Pretraining → adaptation</span>
			</div>
			<h2>Learn broadly.<br /><em>Then specialize.</em></h2>
			<p>
				A base model learns from general text. Adaptation continues learning from a narrower
				collection, changing the same parameters.
			</p>
			<div class="corpus-step">
				<div class="corpus-top">
					<span class="step-number">01</span>
					<div>
						<h3>General text</h3>
						<span>Gardens, journeys, food, everyday life</span>
					</div>
					<strong>{everydayCorpus.length}<small>sentences</small></strong>
				</div>
				<details>
					<summary>Read the base corpus</summary>
					<div class="corpus-text">
						{#each everydayCorpus as sentence (sentence)}<p>{sentence}.</p>{/each}
					</div>
				</details>
				<button class="train-base" disabled={training !== null} onclick={pretrain}
					>{baseEpochs ? 'Pretrain again' : 'Pretrain the model'}<span
						>{baseEpochs ? `${baseEpochs} passes` : '120 passes'}</span
					></button
				>
			</div>
			<div class="corpus-step domain-step">
				<div class="corpus-top">
					<span class="step-number">02</span>
					<div>
						<h3>Domain text</h3>
						<span>The same model, a new emphasis</span>
					</div>
					<strong>{corpus.length}<small>sentences</small></strong>
				</div>
				<fieldset class="domain-picker">
					<legend class="visually-hidden">Adaptation corpus</legend><button
						aria-pressed={domain === 'cafe'}
						onclick={() => changeDomain('cafe')}>Café</button
					><button aria-pressed={domain === 'space'} onclick={() => changeDomain('space')}
						>Astronomy</button
					>
				</fieldset>
				<details>
					<summary>Read the adaptation corpus</summary>
					<div class="corpus-text">
						{#each corpus as sentence (sentence)}<p>{sentence}.</p>{/each}
					</div>
				</details>
				<fieldset class="strength-picker">
					<legend>Amount of adaptation</legend>
					<div>
						{#each [{ value: 20, label: 'Light' }, { value: 80, label: 'Focused' }, { value: 240, label: 'Strong' }] as option (option.value)}<button
								aria-pressed={strength === option.value}
								onclick={() => changeStrength(option.value)}>{option.label}</button
							>{/each}
					</div>
				</fieldset>
				<button class="train-adapt" disabled={baseEpochs === 0 || training !== null} onclick={adapt}
					>Adapt the model<span
						>{adaptationEpochs ? `${adaptationEpochs} passes` : `${strength} passes`}</span
					></button
				>
			</div>
			<div class="training-status" role="status">
				{#if training}<span class="status-dot"></span><span
						>{training === 'base'
							? `Pretraining · ${baseEpochs} / 120 passes`
							: `Adapting · ${adaptationEpochs} / ${strength} passes`}</span
					><button onclick={stop}>Stop</button>{:else}<span
						>{adaptationEpochs
							? 'Adaptation complete. Change the context to compare predictions.'
							: baseEpochs
								? 'The base model is ready. Now adapt it to a domain.'
								: 'Start with pretraining, then watch the predictions shift.'}</span
					>{/if}
			</div>
		</div>
		<div class="prediction-studio">
			<div class="prediction-top">
				<span>NEXT-WORD DISTRIBUTION</span><span>Computed here, from learned weights</span>
			</div>
			<label class="context-input" for="adaptation-context"
				><span>Continue this text</span><input
					id="adaptation-context"
					type="text"
					bind:value={context}
					maxlength="160"
					autocomplete="off"
					spellcheck="false"
					placeholder="the"
				/></label
			>
			<div class="context-presets">
				{#each ['the', 'tastes', 'is'] as word (word)}<button
						aria-pressed={context === word}
						onclick={() => (context = word)}>{word} …</button
					>{/each}<span
					>Sees only <strong
						>{after.contextWord(context) === '<start>'
							? 'sentence start'
							: after.contextWord(context)}</strong
					></span
				>
			</div>
			{#if !after.knownContext(context)}<p class="unknown-context">
					This final word is outside the tiny vocabulary. Its untrained “unknown” row gives equal
					probabilities.
				</p>{/if}
			<div class="comparison-legend">
				<span><i class="before-key"></i>{beforeLabel}</span><span
					><i class="after-key"></i>{afterLabel}</span
				>
			</div>
			<div class="word-predictions">
				{#each comparison.rows as row (row.word)}<div class="word-row">
						<span>{row.word}</span>
						<div class="paired-bars">
							<div>
								<i class="before-bar" style:width={`${(row.before / comparison.maximum) * 100}%`}
								></i>
							</div>
							<div>
								<i class="after-bar" style:width={`${(row.after / comparison.maximum) * 100}%`}></i>
							</div>
						</div>
						<div class="paired-values">
							<span>{(row.before * 100).toFixed(1)}%</span><strong
								>{(row.after * 100).toFixed(1)}%</strong
							>
						</div>
					</div>{/each}
			</div>
			<div class="other-words">
				<span>All other words</span><span
					>{(comparison.otherBefore * 100).toFixed(1)}% → {(comparison.otherAfter * 100).toFixed(
						1
					)}%</span
				>
			</div>
			<p class="scale-note">
				Bars share a 0–{Math.ceil(comparison.maximum * 100)}% scale. These are the small model’s
				actual probabilities.
			</p>
			<div class="parameter-view">
				<div>
					<h3>Parameters that changed</h3>
					<span>{drift.toFixed(3)} RMS change</span>
				</div>
				<div
					class="weight-matrix"
					role="img"
					aria-label={`Parameter changes for four context words and six domain words. Average change across all parameters: ${drift.toFixed(3)}.`}
				>
					<div class="matrix-header">
						<span></span>{#each matrixWords as word (word)}<span>{word}</span>{/each}
					</div>
					{#each matrixContexts as from (from)}<div class="matrix-row">
							<span>{from}</span>{#each matrixWords as word (word)}{@const delta =
									after.weight(from, word) - before.weight(from, word)}
								<div
									title={`${from} → ${word}: ${delta >= 0 ? '+' : ''}${delta.toFixed(3)}`}
									style:--weight-color={delta >= 0 ? '#a9cf9f' : '#c4ade7'}
									style:--weight-opacity={Math.min(0.9, Math.abs(delta) / 5)}
								></div>{/each}
						</div>{/each}
				</div>
				<p>
					<i class="positive-key"></i> Increased <i class="negative-key"></i> Decreased
					<span>Input edits leave these parameters unchanged.</span>
				</p>
			</div>
		</div>
	</div>
	<div class="adaptation-outcomes">
		<div>
			<span>GENERAL TEXT LOSS</span><strong
				>{broadBefore.toFixed(2)} <i>→</i> {broadAfter.toFixed(2)}</strong
			>
			<p>
				{adaptationEpochs && broadAfter > broadBefore + 0.05
					? 'Some earlier patterns faded as the model specialized.'
					: 'The base corpus measures how well earlier patterns are retained.'}
			</p>
		</div>
		<div>
			<span>DOMAIN TEXT LOSS</span><strong
				>{domainBefore.toFixed(2)} <i>→</i> {domainAfter.toFixed(2)}</strong
			>
			<p>
				{adaptationEpochs && domainAfter < domainBefore - 0.05
					? 'Domain examples became easier for the model to predict.'
					: 'Adaptation should make these domain examples less surprising.'}
			</p>
		</div>
		<div class="adaptation-distinction">
			<PatternIcon name="adaptation" size={28} />
			<p><strong>Context changes the input.<br />Training changes the model.</strong></p>
			<button onclick={reset}>Reset both models</button>
		</div>
	</div>
	<p class="adaptation-footnote">
		A real, tiny word-level softmax model: {baseModel.vocabulary.length} vocabulary entries and {baseModel.weights.length.toLocaleString()}
		parameters, trained with gradient descent. It uses one preceding word, so it cannot represent an LLM’s
		long context or reasoning. The losses shown are on the visible training corpora, not held-out evaluation.
		The example makes pretraining, adaptation, and forgetting tangible.
	</p>
</div>

<style>
	.adaptation-lab {
		margin: 28px 0;
	}
	.adaptation-layout {
		display: grid;
		grid-template-columns: minmax(270px, 0.9fr) minmax(0, 1.2fr);
		gap: 40px;
		align-items: start;
	}
	.adaptation-controls {
		padding: 10px 0 0;
	}
	.lab-signature {
		display: flex;
		align-items: center;
		gap: 9px;
		font-size: 12px;
		color: var(--muted);
	}
	h2 {
		font-weight: 500;
		font-size: clamp(27px, 2.6vw, 40px);
		line-height: 1.13;
		letter-spacing: -0.035em;
		margin: 20px 0 14px;
	}
	h2 em {
		font-family: 'Instrument Serif', serif;
		font-weight: 400;
		font-size: 1.14em;
	}
	.adaptation-controls > p {
		color: var(--muted);
		font-size: 13px;
		line-height: 1.7;
		max-width: 43ch;
		margin-bottom: 25px;
	}
	.corpus-step {
		background: var(--surface);
		border-radius: 17px;
		padding: 20px;
		margin: 14px 0;
	}
	.corpus-top {
		display: flex;
		align-items: center;
		gap: 12px;
	}
	.step-number {
		align-self: start;
		color: var(--quiet);
		font-size: 10px;
		margin-top: 3px;
	}
	.corpus-top h3 {
		font-size: 14px;
		font-weight: 500;
		margin: 0 0 6px;
	}
	.corpus-top div > span {
		color: var(--quiet);
		font-size: 9px;
	}
	.corpus-top > strong {
		margin-left: auto;
		font-family: 'Instrument Serif', serif;
		font-weight: 400;
		font-size: 24px;
		display: flex;
		flex-direction: column;
		align-items: center;
	}
	.corpus-top small {
		font-size: 8px;
		font-family: 'DM Sans Variable', sans-serif;
		color: var(--quiet);
		margin-top: 3px;
	}
	details {
		margin: 17px 0;
	}
	summary {
		font-size: 10px;
		color: var(--muted);
		cursor: pointer;
	}
	.corpus-text {
		padding: 10px 0 0;
		max-height: 190px;
		overflow-y: auto;
	}
	.corpus-text p {
		font-size: 11px;
		line-height: 1.8;
		color: var(--muted);
		margin: 6px 0;
	}
	.train-base,
	.train-adapt {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 8px;
		width: 100%;
		padding: 11px 13px;
		min-height: 41px;
		border-radius: 10px;
		border: 0;
		font-size: 11px;
		cursor: pointer;
		font-weight: 500;
	}
	.train-base {
		color: var(--ink);
		background: var(--surface-raised);
	}
	.train-adapt {
		color: var(--paper);
		background: var(--green);
	}
	.train-base span,
	.train-adapt span {
		font-size: 9px;
		opacity: 0.75;
		font-weight: 400;
	}
	button:disabled {
		opacity: 0.4;
		cursor: default;
	}
	.domain-picker {
		display: flex;
		border: 0;
		padding: 0;
		margin: 18px 0 12px;
		gap: 7px;
	}
	.domain-picker button {
		background: var(--surface-raised);
		color: var(--muted);
		padding: 8px 12px;
		border: 0;
		border-radius: 9px;
		font-size: 11px;
		cursor: pointer;
	}
	.domain-picker button[aria-pressed='true'] {
		background: var(--accent-bg);
		color: var(--green);
	}
	.strength-picker {
		border: 0;
		padding: 0;
		margin: 15px 0;
	}
	.strength-picker legend {
		font-size: 10px;
		color: var(--muted);
		margin-bottom: 10px;
	}
	.strength-picker > div {
		display: flex;
		gap: 5px;
	}
	.strength-picker button {
		flex: 1;
		background: none;
		border: 0;
		border-radius: 8px;
		padding: 7px 6px;
		color: var(--quiet);
		font-size: 10px;
		cursor: pointer;
	}
	.strength-picker button[aria-pressed='true'] {
		background: var(--surface-raised);
		color: var(--ink);
	}
	.training-status {
		font-size: 10px;
		color: var(--muted);
		line-height: 1.7;
		display: flex;
		align-items: start;
		gap: 8px;
		min-height: 36px;
		margin: 16px 5px 0;
	}
	.status-dot {
		display: block;
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--green);
		margin-top: 5px;
	}
	.training-status > button {
		margin-left: auto;
		padding: 0;
		background: none;
		border: 0;
		color: var(--ink);
		cursor: pointer;
		font-size: 10px;
	}
	.prediction-studio {
		min-width: 0;
		border-radius: 22px;
		background: #101b17;
		color: #dae6dc;
		padding: 25px 28px;
	}
	.prediction-top {
		display: flex;
		justify-content: space-between;
		gap: 14px;
		font-size: 9px;
		color: #94a798;
		letter-spacing: 0.09em;
	}
	.prediction-top span:last-child {
		letter-spacing: 0;
		font-size: 8px;
	}
	.context-input {
		display: block;
		margin-top: 29px;
	}
	.context-input > span {
		display: block;
		color: #9cad9e;
		font-size: 11px;
		margin-bottom: 12px;
	}
	.context-input input {
		box-sizing: border-box;
		width: 100%;
		background: #1b2a21;
		color: #e8ede2;
		font-family: 'Instrument Serif', serif;
		font-size: 38px;
		border: 0;
		border-radius: 12px;
		padding: 16px 20px;
		line-height: 1;
	}
	.context-input input:focus-visible {
		outline: 2px solid #a9cf9f;
		outline-offset: 3px;
	}
	.context-presets {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		align-items: center;
		margin-top: 13px;
	}
	.context-presets button {
		border: 0;
		border-radius: 6px;
		background: #1c2a21;
		color: #9fb4a3;
		font-size: 10px;
		padding: 6px 9px;
		cursor: pointer;
	}
	.context-presets button[aria-pressed='true'] {
		color: #d6e7ce;
		background: #31412d;
	}
	.context-presets > span {
		color: #879f8e;
		font-size: 9px;
		margin-left: auto;
		overflow-wrap: anywhere;
	}
	.context-presets strong {
		color: #c9d9cb;
		font-weight: 500;
	}
	.unknown-context {
		font-size: 10px;
		line-height: 1.7;
		color: #e0be92;
		margin: 15px 0;
	}
	.comparison-legend {
		display: flex;
		gap: 21px;
		margin: 30px 0 20px;
		font-size: 10px;
		color: #a6b9aa;
	}
	.comparison-legend > span {
		display: flex;
		align-items: center;
		gap: 7px;
	}
	.comparison-legend i,
	.parameter-view > p i {
		display: inline-block;
		width: 6px;
		height: 6px;
		border-radius: 50%;
	}
	.before-key,
	.before-bar {
		background: #9c8bba;
	}
	.after-key,
	.after-bar {
		background: #b4d7a3;
	}
	.word-predictions {
		display: grid;
		gap: 14px;
	}
	.word-row {
		display: grid;
		grid-template-columns: 74px 1fr 46px;
		align-items: center;
		gap: 13px;
	}
	.word-row > span {
		font-size: 14px;
		color: #d7e4d8;
	}
	.paired-bars,
	.paired-values {
		display: grid;
		gap: 5px;
	}
	.paired-bars > div {
		height: 5px;
		border-radius: 4px;
	}
	.paired-bars i {
		display: block;
		height: 5px;
		border-radius: 4px;
		transition: width 0.15s;
		min-width: 1px;
	}
	.paired-values {
		gap: 3px;
		text-align: right;
		font-size: 8px;
		font-variant-numeric: tabular-nums;
	}
	.paired-values span {
		color: #b0a3c4;
	}
	.paired-values strong {
		color: #c2deb2;
		font-weight: 500;
	}
	.other-words {
		display: flex;
		justify-content: space-between;
		gap: 16px;
		font-size: 10px;
		color: #98aa9c;
		margin-top: 23px;
	}
	.scale-note {
		font-size: 8px;
		line-height: 1.7;
		color: #819889;
		margin: 13px 0 0;
	}
	.parameter-view {
		margin-top: 30px;
	}
	.parameter-view > div:first-child {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
	}
	.parameter-view h3 {
		font-size: 11px;
		font-weight: 500;
		margin: 0;
	}
	.parameter-view > div:first-child > span {
		color: #94a898;
		font-size: 9px;
		font-variant-numeric: tabular-nums;
	}
	.weight-matrix {
		margin: 16px 0 13px;
		display: grid;
		gap: 5px;
	}
	.matrix-header,
	.matrix-row {
		display: grid;
		grid-template-columns: 34px repeat(6, minmax(0, 1fr));
		gap: 5px;
	}
	.matrix-header span {
		font-size: 6px;
		color: #96aa9c;
		text-align: center;
		padding-bottom: 4px;
	}
	.matrix-row > span {
		font-size: 9px;
		color: #a7baac;
		align-self: center;
	}
	.matrix-row > div {
		height: 14px;
		border-radius: 3px;
		background: #25352a;
		position: relative;
	}
	.matrix-row > div::after {
		content: '';
		position: absolute;
		inset: 0;
		border-radius: 3px;
		background: var(--weight-color);
		opacity: var(--weight-opacity);
	}
	.parameter-view > p {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 5px;
		font-size: 8px;
		color: #8fa596;
		margin: 0;
	}
	.positive-key {
		background: #a9cf9f;
	}
	.negative-key {
		background: #c4ade7;
		margin-left: 8px;
	}
	.parameter-view > p > span {
		margin-left: auto;
		font-size: 7px;
	}
	.adaptation-outcomes {
		display: grid;
		grid-template-columns: 1fr 1fr 1.05fr;
		gap: 35px;
		margin: 35px 0 24px;
	}
	.adaptation-outcomes > div > span {
		color: var(--quiet);
		font-size: 9px;
		letter-spacing: 0.08em;
	}
	.adaptation-outcomes > div > strong {
		display: block;
		font-family: 'Instrument Serif', serif;
		font-weight: 400;
		font-size: 35px;
		margin: 9px 0 11px;
	}
	.adaptation-outcomes i {
		font-family: 'DM Sans Variable', sans-serif;
		font-size: 17px;
		font-style: normal;
		color: var(--quiet);
		vertical-align: middle;
		margin: 0 6px;
	}
	.adaptation-outcomes p {
		color: var(--muted);
		font-size: 11px;
		line-height: 1.7;
		margin: 0;
		max-width: 30ch;
	}
	.adaptation-distinction {
		display: flex;
		flex-direction: column;
		align-items: start;
		justify-content: start;
		gap: 12px;
	}
	.adaptation-distinction p strong {
		color: var(--ink);
		font-size: 12px;
		font-weight: 500;
	}
	.adaptation-distinction button {
		font-size: 10px;
		color: var(--quiet);
		border: 0;
		padding: 0;
		background: none;
		cursor: pointer;
	}
	.adaptation-footnote {
		color: var(--muted);
		font-size: 11px;
		line-height: 1.8;
		margin: 0;
		max-width: 880px;
	}
	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}
	@media (max-width: 1100px) {
		.adaptation-layout {
			gap: 24px;
			grid-template-columns: minmax(250px, 0.9fr) minmax(0, 1.1fr);
		}
		.prediction-studio {
			padding: 23px 20px;
		}
		.prediction-top span:last-child {
			display: none;
		}
		.corpus-step {
			padding: 17px;
		}
		.word-row {
			grid-template-columns: 64px 1fr 39px;
			gap: 10px;
		}
	}
	@media (max-width: 760px) {
		.adaptation-layout {
			grid-template-columns: 1fr;
			gap: 25px;
		}
		.adaptation-controls > p {
			max-width: 52ch;
		}
		h2 {
			font-size: 31px;
		}
		.adaptation-outcomes {
			grid-template-columns: 1fr 1fr;
			gap: 26px;
		}
		.adaptation-distinction {
			grid-column: 1 / -1;
		}
		.prediction-studio {
			padding: 23px 20px;
		}
		.context-input input {
			font-size: 34px;
		}
		.word-row {
			grid-template-columns: 62px 1fr 40px;
			gap: 10px;
		}
		.parameter-view > p > span {
			flex-basis: 100%;
			margin: 7px 0 0;
		}
		.paired-values {
			font-size: 10px;
		}
		.scale-note {
			font-size: 10px;
		}
		.matrix-header span {
			font-size: 8px;
		}
		.matrix-row > span {
			font-size: 10px;
		}
		.matrix-row > div {
			height: 18px;
		}
		.parameter-view > p {
			font-size: 9px;
		}
		.parameter-view > p > span {
			font-size: 9px;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.paired-bars i {
			transition: none;
		}
	}
</style>
