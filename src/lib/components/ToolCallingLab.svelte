<script lang="ts">
	import { onDestroy } from 'svelte';
	import type { AiSession } from '$lib/ai/session.svelte';
	import {
		calculatorTool,
		checkIntegerAnswer,
		MAX_INTEGER_DIGITS,
		multiplicationExamples,
		multiplyIntegers,
		normalizeInteger,
		type AnswerCheck
	} from '$lib/ai/calculator';
	import {
		calculatorInstructions,
		runCalculatorTrial,
		type CalculatorTurn
	} from '$lib/ai/calculator-experiment';
	import { functionTools } from '$lib/ai/tool-definitions';
	import CalculatorTranscript from './CalculatorTranscript.svelte';
	import ModelConnection from './ModelConnection.svelte';
	import PatternIcon from './PatternIcon.svelte';

	let { ai }: { ai: AiSession } = $props();
	const uid = $props.id();
	type Trial = {
		state: 'idle' | 'running' | 'done' | 'error';
		answer: string;
		draft: string;
		error: string;
		turns: CalculatorTurn[];
		check: AnswerCheck | null;
		usedCorrectOperands: boolean;
	};
	const fresh = (): Trial => ({
		state: 'idle',
		answer: '',
		draft: '',
		error: '',
		turns: [],
		check: null,
		usedCorrectOperands: false
	});
	let a = $state<string>(multiplicationExamples[1].a);
	let b = $state<string>(multiplicationExamples[1].b);
	let trials = $state({ without: fresh(), with: fresh() });
	const trace = $derived(trials.with.turns.flatMap((turn) => turn.tools));
	let runProvider = $state<'openai' | 'local'>('openai');

	let running = $state(false);
	let showExact = $state(false);
	let backend = $state('');
	let status = $state(
		'Choose two numbers, then compare the same model with and without a calculator.'
	);
	let controller: AbortController | undefined;
	const modes = [
		{
			id: 'without' as const,
			title: 'Without a tool',
			caption: 'The model generates every digit.',
			icon: 'language' as const
		},
		{
			id: 'with' as const,
			title: 'With a calculator',
			caption: 'The model can request an exact calculation.',
			icon: 'tool' as const
		}
	];
	const validation = $derived.by(() => {
		try {
			normalizeInteger(a);
			normalizeInteger(b);
			return '';
		} catch (error) {
			return error instanceof Error ? error.message : 'Enter two whole numbers.';
		}
	});
	const definition = $derived(
		functionTools([calculatorTool], backend ? runProvider : ai.provider)[0]
	);
	const question = $derived(
		validation ? '' : `What is ${normalizeInteger(a)} × ${normalizeInteger(b)}?`
	);
	const exact = $derived(validation ? '' : multiplyIntegers(a, b));
	const digits = (value: string) => value.replace(/^[+-]/, '').length;
	const conclusion = $derived.by(() => {
		if (running || trials.with.state !== 'done') return '';
		if (!trials.with.usedCorrectOperands)
			return 'The model did not successfully call the calculator with these operands. Inspect the trace, or try another model. A tool being available does not mean it was used correctly.';
		if (trials.with.check?.status !== 'exact')
			return 'The calculator returned the exact product, but the model’s final answer did not pass the check. Tool use still needs verification: the model can copy or format a result incorrectly.';
		if (trials.without.check?.status === 'exact')
			return 'Both answers are correct on this run. The tool trace shows where the second answer came from. Try longer numbers to explore the model’s unaided limits.';
		if (trials.without.check?.status === 'incorrect')
			return 'The unaided answer missed digits. With the calculator, the same model returned the exact product. The calculation happened in software, without retraining the model.';
		return 'The model used the calculator and returned the exact product. The unaided run did not produce a verifiable integer; its actual output is preserved above.';
	});
	function reset() {
		trials = { without: fresh(), with: fresh() };
		showExact = false;
		backend = '';
		status = 'Inputs changed. Run a fresh comparison.';
	}
	function preset(example: (typeof multiplicationExamples)[number]) {
		a = example.a;
		b = example.b;
		reset();
	}
	async function compare() {
		if (running || ai.busy || validation) return;
		if (!ai.ready) {
			ai.settingsOpen = true;
			return;
		}
		reset();
		running = true;
		backend = ai.label;
		runProvider = ai.provider;
		const abort = new AbortController();
		controller = abort;
		status =
			ai.provider === 'local'
				? 'Preparing two independent local workers…'
				: 'Starting both model requests together…';
		document.getElementById(`${uid}-comparison`)?.scrollIntoView({
			block: 'start',
			behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'
		});
		try {
			await ai.withParallelGeneration(async (generators) => {
				status = 'Both runs are live. Each exchange appears as it happens.';
				await Promise.all(
					modes.map(async (mode, index) => {
						const trial = trials[mode.id];
						trial.state = 'running';
						try {
							const result = await runCalculatorTrial({
								a,
								b,
								withTool: mode.id === 'with',
								signal: abort.signal,
								generate: generators[index],
								onEvent: (event) => {
									if (event.kind === 'turn') {
										trial.turns.push({
											number: event.turn,
											request: null,
											response: null,
											draft: '',
											tools: []
										});
										trial.draft = '';
										return;
									}
									const turn = trial.turns.at(-1)!;
									if (event.kind === 'request') turn.request = event.request;
									else if (event.kind === 'text') {
										trial.draft += event.text;
										turn.draft += event.text;
									} else if (event.kind === 'model') turn.response = event.response;
									else turn.tools.push(event);
								}
							});
							trial.answer = result.answer;
							trial.check = checkIntegerAnswer(result.answer, exact);
							trial.usedCorrectOperands = result.usedCorrectOperands;
							trial.state = 'done';
						} catch (error) {
							trial.state = 'error';
							trial.error = abort.signal.aborted
								? 'Stopped. Partial output has not been verified.'
								: error instanceof Error
									? error.message
									: 'The model request failed.';
						}
					})
				);
			}, abort.signal);
		} catch (error) {
			for (const trial of Object.values(trials)) {
				if (trial.state === 'done') continue;
				trial.state = 'error';
				trial.error = abort.signal.aborted
					? 'Stopped before the comparison was ready.'
					: error instanceof Error
						? error.message
						: 'Could not prepare the comparison.';
			}
		} finally {
			running = false;
			showExact = true;
			status = abort.signal.aborted
				? 'Comparison stopped. Run again to start fresh.'
				: 'Run finished. Compare each answer with the exact product below.';
		}
	}
	onDestroy(() => controller?.abort());
</script>

<ModelConnection {ai} />

<section class="calculator-lab" aria-label="Large multiplication with tool calling">
	<header class="calculator-header">
		<div>
			<span class="eyebrow">THE CALCULATOR EXPERIMENT</span>
			<h3>One question. Two ways to answer.</h3>
		</div>
		<p>
			Two runs, started together. The same model and prompt. One has a calculator. Follow every
			message.
		</p>
	</header>
	<form
		onsubmit={(event) => {
			event.preventDefault();
			void compare();
		}}
	>
		<div class="examples" role="group" aria-label="Multiplication examples">
			{#each multiplicationExamples as example (example.label)}
				<button
					type="button"
					aria-pressed={a === example.a && b === example.b}
					disabled={running}
					onclick={() => preset(example)}>{example.label}</button
				>
			{/each}
		</div>
		<div class="operands">
			<label for={`${uid}-a`}
				><span>First number <small>{digits(a.trim())} digits</small></span>
				<input
					id={`${uid}-a`}
					type="text"
					inputmode="numeric"
					autocomplete="off"
					spellcheck="false"
					maxlength={MAX_INTEGER_DIGITS + 1}
					value={a}
					oninput={(event) => {
						a = event.currentTarget.value;
						reset();
					}}
					disabled={running}
					aria-describedby={`${uid}-hint`}
				/></label
			>
			<span class="multiply-sign" aria-hidden="true">×</span>
			<label for={`${uid}-b`}
				><span>Second number <small>{digits(b.trim())} digits</small></span>
				<input
					id={`${uid}-b`}
					type="text"
					inputmode="numeric"
					autocomplete="off"
					spellcheck="false"
					maxlength={MAX_INTEGER_DIGITS + 1}
					value={b}
					oninput={(event) => {
						b = event.currentTarget.value;
						reset();
					}}
					disabled={running}
					aria-describedby={`${uid}-hint`}
				/></label
			>
		</div>
		<p class="input-hint" id={`${uid}-hint`}>
			{validation ||
				`Up to ${MAX_INTEGER_DIGITS} digits per number. Whole numbers only; omit commas.`}
		</p>
		<div class="run-actions">
			{#if running}<button type="button" class="primary-button" onclick={() => controller?.abort()}
					><PatternIcon name="stop" size={15} /> Stop comparison</button
				>
			{:else}<button type="submit" class="primary-button" disabled={!!validation || ai.busy}
					><PatternIcon name="play" size={15} />{ai.ready
						? 'Compare both runs'
						: 'Connect a model to compare'}</button
				>{/if}
			<button
				type="button"
				class="secondary-button"
				disabled={!!validation || running}
				onclick={() => (showExact = !showExact)}
				>{showExact ? 'Hide exact product' : 'Try the calculator only'}</button
			>
			<span class="input-hint">Calculator alone needs no model.</span>
			{#if ai.provider === 'local'}<span class="input-hint"
					>Parallel local runs load a second copy of the model from the browser cache.</span
				>{/if}
		</div>
	</form>

	<section class="request-setup" aria-label="What the model receives">
		<div class="prompt-definition">
			<span class="eyebrow">THE SAME PROMPT, IN BOTH RUNS</span>
			<h4>User message</h4>
			<pre class="question-text">{question || 'Enter two valid integers above.'}</pre>
			<h4>System instructions</h4>
			<pre>{calculatorInstructions}</pre>
			<p class="input-hint">
				Separate conversations. Neither sees the other’s answer. The exact product is only sent back
				after a real tool call.
			</p>
		</div>
		<div class="schema-definition">
			<span class="eyebrow">ADDED ONLY TO THE RUN WITH A CALCULATOR</span>
			<h4>The tool definition</h4>
			<!-- Keyboard users need to scroll the complete schema without switching chapters. -->
			<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
			<pre
				class="schema-code"
				tabindex="0"
				role="region"
				aria-label="Tool definition">{JSON.stringify(definition, null, 2)}</pre>
			<p class="input-hint">
				This is the definition supplied to {backend ||
					(ai.provider === 'openai' ? 'OpenAI' : 'the local model')}. It describes a function; it
				does not contain the answer.
			</p>
		</div>
	</section>

	<div id={`${uid}-comparison`} class="comparison" aria-busy={running}>
		{#each modes as mode (mode.id)}
			{@const trial = trials[mode.id]}
			<article class="answer-card" class:assisted={mode.id === 'with'} aria-label={mode.title}>
				<header>
					<span><PatternIcon name={mode.icon} size={19} />{mode.title}</span>
					<span
						class="verdict"
						class:correct={trial.check?.status === 'exact'}
						class:incorrect={trial.check?.status === 'incorrect'}
					>
						{trial.state === 'running'
							? 'Running…'
							: trial.state === 'error'
								? 'Not completed'
								: trial.check?.status === 'exact'
									? 'Exact match'
									: trial.check?.status === 'incorrect'
										? 'Incorrect'
										: trial.check
											? 'Not verified'
											: 'Ready'}
					</span>
				</header>
				<p class="card-caption">{mode.caption}</p>
				{#if trial.state === 'idle'}<div class="answer-empty">
						<PatternIcon name={mode.icon} size={28} />
						<p>
							{mode.id === 'without'
								? 'Can the model generate the whole product correctly?'
								: 'Can a small tool make the answer reliable?'}
						</p>
					</div>
				{/if}
				{#if trial.state === 'done'}<div class="final-answer">
						<span class="eyebrow">FINAL ANSWER · VERBATIM</span>
						<div class="model-answer">{trial.answer || 'No final text returned.'}</div>
					</div>{/if}

				{#if trial.error}<p class="trial-error" role="alert">{trial.error}</p>{/if}
				{#if trial.check?.status === 'incorrect'}<p class="difference">
						Off by <strong>{trial.check.difference}</strong>
					</p>
				{:else if trial.check?.status === 'unverified'}<p class="input-hint">
						The answer was not a single full integer. Inspect the original text above; it has not
						been marked correct.
					</p>{/if}
				<CalculatorTranscript turns={trial.turns} running={trial.state === 'running'} />
				<footer>
					<span>{backend || 'Your connected model'}</span><span
						>{mode.id === 'without'
							? 'No tools supplied'
							: trial.state === 'idle'
								? 'Calculator available'
								: `${trace.length} tool call${trace.length === 1 ? '' : 's'}`}</span
					>
				</footer>
			</article>
		{/each}
	</div>
	<p class="run-status" role="status">{status}</p>

	{#if showExact && exact}<div class="exact-product">
			<div>
				<PatternIcon name="checkCircle" size={20} /><span
					>THE EXACT PRODUCT <small>{digits(exact)} digits · calculated in your browser</small
					></span
				>
			</div>
			<output aria-label="Exact product">{exact}</output>
			<p>
				This is the calculator’s result. The model’s answers above are checked against it and are
				never replaced with it.
			</p>
		</div>{/if}
	{#if conclusion}<p class="conclusion">
			<PatternIcon name="idea" size={20} /><span>{conclusion}</span>
		</p>{/if}
</section>

<section class="tool-story" aria-label="How the calculator tool works">
	<header>
		<span class="eyebrow">WHAT ACTUALLY HAPPENS</span>
		<h3>A tool is a function with a description.</h3>
		<p>
			We give the model a name, explain what it does, and define its inputs. The app runs the
			function when the model requests it.
		</p>
	</header>
	<ol class="handoff">
		<li>
			<span class="step-number">01</span><PatternIcon name="language" size={23} />
			<h4>The model asks</h4>
			<p>It requests <code>multiply_integers</code> with two numbers.</p>
		</li>
		<li>
			<span class="step-number">02</span><PatternIcon name="tool" size={23} />
			<h4>The app calculates</h4>
			<p>Our function multiplies the integers, preserving every digit.</p>
		</li>
		<li>
			<span class="step-number">03</span><PatternIcon name="database" size={23} />
			<h4>The result returns</h4>
			<p>The exact product becomes new context for the model.</p>
		</li>
		<li>
			<span class="step-number">04</span><PatternIcon name="checkCircle" size={23} />
			<h4>The model answers</h4>
			<p>It uses the returned number. We still check the final answer.</p>
		</li>
	</ol>
	<div class="tool-definition">
		<div>
			<span class="eyebrow">OUR TOOL</span><code>multiply_integers(a, b)</code>
			<p>Two whole numbers in. One exact product out.</p>
		</div>
		<div>
			<span class="eyebrow">WHY KEEP THE DIGITS AS TEXT?</span>
			<p>
				Ordinary JavaScript numbers cannot represent every integer above 9,007,199,254,740,991. We
				send the digits as strings and multiply with <code>BigInt</code>, which keeps integer
				arithmetic exact.
			</p>
		</div>
	</div>
	<div class="implementation">
		<h4>The function the app executes</h4>
		<p>
			After checking that both arguments are decimal integer strings, the calculator runs this exact
			operation:
		</p>
		<pre><code>const product = (BigInt(a) * BigInt(b)).toString();</code></pre>
		<p>
			The transcripts above preserve every model turn, function call, and returned value. Open a
			turn’s full request or complete response to inspect its original payload.
		</p>
	</div>
</section>

<div class="lab-explanation">
	<span class="eyebrow">A NEW CAPABILITY, WITH THE SAME WEIGHTS</span>
	<p>
		A language model learns patterns that can support arithmetic, but long multiplication is not
		guaranteed to be exact. A calculator supplies a precise operation during inference. Neither run
		retrains the model. Results vary: an unaided model may get it right, or a model with tools may
		use the wrong inputs. That is why both answers and the actual calls remain visible.
	</p>
</div>

<style>
	.calculator-lab,
	.tool-story {
		min-width: 0;
		padding: clamp(20px, 3vw, 36px);
		background: var(--surface);
		border-radius: 24px;
	}
	.calculator-header {
		display: flex;
		justify-content: space-between;
		align-items: end;
		gap: 28px;
		margin-bottom: 26px;
	}
	h3 {
		font: italic clamp(28px, 3vw, 40px)/1.12 var(--serif);
		letter-spacing: -0.025em;
		margin: 8px 0 0;
	}
	.calculator-header > p {
		max-width: 300px;
		margin: 0;
		color: var(--muted);
		font-size: 13px;
		line-height: 1.65;
	}
	.examples {
		display: flex;
		gap: 6px;
		flex-wrap: wrap;
		margin-bottom: 20px;
	}
	.examples button {
		border: 0;
		border-radius: 8px;
		background: var(--lab-inset);
		color: var(--muted);
		padding: 9px 13px;
		font-size: 12px;
	}
	.examples button[aria-pressed='true'] {
		background: var(--selection-fill);
		color: var(--selection-ink);
	}
	.operands {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 24px minmax(0, 1fr);
		gap: 14px;
		align-items: end;
	}
	.operands label {
		min-width: 0;
	}
	.operands label > span {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		margin-bottom: 9px;
		font-size: 12px;
		color: var(--muted);
	}
	small {
		font-size: 10px;
		color: var(--quiet);
	}
	.operands input {
		width: 100%;
		min-width: 0;
		box-sizing: border-box;
		border: 1px solid var(--line);
		background: var(--input);
		color: var(--ink);
		border-radius: 10px;
		padding: 15px 13px;
		font: 13px var(--mono);
	}
	.multiply-sign {
		padding-bottom: 11px;
		text-align: center;
		color: var(--lavender);
		font: 28px var(--serif);
	}
	.input-hint {
		color: var(--quiet);
		font-size: 11px;
		line-height: 1.6;
	}
	.run-actions {
		display: flex;
		gap: 12px;
		align-items: center;
		flex-wrap: wrap;
		margin: 18px 0 26px;
	}
	.run-actions > button {
		width: auto;
		margin-top: 0;
	}
	.request-setup {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 24px;
		padding: 24px 0;
		margin-bottom: 14px;
		border-top: 1px solid var(--line);
	}
	.request-setup > div {
		min-width: 0;
	}
	.request-setup h4 {
		margin-top: 18px;
	}
	.request-setup pre {
		margin: 10px 0 18px;
		font-size: 11px;
	}
	.request-setup .schema-code {
		max-height: 340px;
		overflow: auto;
	}
	.final-answer {
		padding-top: 24px;
	}
	.final-answer .model-answer {
		min-height: 0;
		padding-top: 12px;
	}
	.comparison {
		scroll-margin-top: calc(var(--header-height, 70px) + 20px);
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 16px;
	}
	.answer-card {
		background: var(--lab-inset);
		border-radius: 15px;
		padding: 22px;
		min-width: 0;
		display: flex;
		flex-direction: column;
	}
	.answer-card.assisted {
		background: color-mix(in srgb, var(--chart-lavender) 7%, var(--lab-inset));
	}
	.answer-card header,
	.answer-card footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		flex-wrap: wrap;
	}
	.answer-card header > span:first-child {
		display: flex;
		align-items: center;
		gap: 9px;
		font-size: 14px;
		font-weight: 550;
	}
	.verdict {
		font: 10px var(--mono);
		color: var(--quiet);
	}
	.verdict.correct {
		color: var(--chart-cyan);
	}
	.verdict.incorrect {
		color: var(--chart-amber);
	}
	.card-caption {
		color: var(--muted);
		font-size: 12px;
		line-height: 1.6;
		margin: 12px 0 0;
	}
	.answer-empty {
		min-height: 140px;
		display: flex;
		justify-content: center;
		align-items: center;
		flex-direction: column;
		gap: 10px;
		color: var(--quiet);
	}
	.answer-empty p {
		font-size: 12px;
		text-align: center;
		max-width: 260px;
		line-height: 1.7;
		margin: 0;
	}
	.model-answer {
		min-height: 100px;
		padding: 25px 0 16px;
		font: 17px/1.85 var(--mono);
		overflow-wrap: anywhere;
		white-space: pre-wrap;
	}
	.answer-card footer {
		margin-top: auto;
		padding-top: 14px;
		border-top: 1px solid var(--line);
		color: var(--quiet);
		font-size: 10px;
	}
	.difference,
	.trial-error {
		font-size: 12px;
		color: var(--chart-amber);
		line-height: 1.65;
		overflow-wrap: anywhere;
		margin: 0 0 16px;
	}
	.difference strong {
		font-family: var(--mono);
		font-weight: 450;
	}
	.run-status {
		margin: 16px 0 0;
		font-size: 11px;
		line-height: 1.7;
		color: var(--muted);
	}
	.exact-product {
		margin-top: 22px;
		padding: 22px;
		border: 1px solid color-mix(in srgb, var(--chart-cyan) 30%, transparent);
		border-radius: 15px;
	}
	.exact-product > div {
		display: flex;
		align-items: center;
		gap: 12px;
		color: var(--chart-cyan);
		font: 10px var(--mono);
	}
	.exact-product small {
		display: block;
		margin-top: 6px;
		font: 11px var(--sans);
	}
	.exact-product output {
		display: block;
		margin-top: 18px;
		font: clamp(17px, 2vw, 23px)/1.7 var(--mono);
		overflow-wrap: anywhere;
	}
	.exact-product > p {
		margin: 12px 0 0;
		font-size: 11px;
		color: var(--quiet);
		line-height: 1.7;
	}
	.conclusion {
		display: flex;
		align-items: start;
		gap: 12px;
		margin: 22px 0 0;
		color: var(--muted);
		font-size: 13px;
		line-height: 1.8;
	}
	.conclusion :global(svg) {
		flex-shrink: 0;
		color: var(--lavender);
		margin-top: 3px;
	}
	.tool-story {
		margin-top: 22px;
	}
	.tool-story > header > p {
		max-width: 700px;
		color: var(--muted);
		font-size: 13px;
		line-height: 1.8;
	}
	.handoff {
		list-style: none;
		padding: 0;
		margin: 26px 0;
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 12px;
	}
	.handoff li {
		position: relative;
		min-width: 0;
		padding: 22px 18px;
		background: var(--lab-inset);
		border-radius: 13px;
	}
	.handoff li > :global(svg) {
		color: var(--lavender);
		margin-bottom: 12px;
	}
	.step-number {
		position: absolute;
		right: 16px;
		top: 20px;
		font: 10px var(--mono);
		color: var(--quiet);
	}
	h4 {
		margin: 0;
		font-size: 13px;
		font-weight: 550;
	}
	.handoff p {
		font-size: 12px;
		line-height: 1.7;
		color: var(--muted);
		margin: 10px 0 0;
	}
	code {
		font-family: var(--mono);
		overflow-wrap: anywhere;
	}
	.handoff code {
		font-size: 10px;
	}
	.tool-definition {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1.4fr);
		gap: 26px;
		margin: 24px 0;
	}
	.tool-definition > div > code {
		display: block;
		color: var(--lavender);
		font-size: 15px;
		margin-top: 12px;
	}
	.tool-definition p,
	.implementation p {
		font-size: 12px;
		line-height: 1.85;
		color: var(--muted);
		margin-bottom: 0;
	}
	.implementation {
		margin: 20px 0 30px;
	}
	pre {
		min-width: 0;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
		font: 11px/1.9 var(--mono);
		color: var(--muted);
		background: var(--lab-inset);
		padding: 16px;
		border-radius: 10px;
	}
	button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	@media (max-width: 1000px) {
		.calculator-header {
			display: block;
		}
		.calculator-header > p {
			margin-top: 14px;
			max-width: none;
		}
		.handoff {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}
	@media (max-width: 620px) {
		.request-setup,
		.comparison,
		.tool-definition {
			grid-template-columns: minmax(0, 1fr);
		}
		.operands {
			grid-template-columns: minmax(0, 1fr);
			gap: 12px;
		}
		.multiply-sign {
			display: none;
		}
		.run-actions > button {
			width: 100%;
			justify-content: center;
		}
		.answer-card {
			padding: 18px;
		}
		.handoff li {
			padding: 18px 14px;
		}
	}
</style>
