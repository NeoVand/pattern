<script lang="ts">
	import type { CalculatorTurn } from '$lib/ai/calculator-experiment';
	import PatternIcon from './PatternIcon.svelte';
	let { turns, running }: { turns: CalculatorTurn[]; running: boolean } = $props();
</script>

<div class="transcript" aria-label="Complete model exchange">
	{#each turns as turn (turn.number)}
		<section class="model-turn" aria-label={`Model turn ${turn.number}`}>
			<header>
				<PatternIcon name="language" size={15} /><strong>Model turn {turn.number}</strong><span
					>{turn.response ? 'Received' : running ? 'Generating…' : 'Incomplete'}</span
				>
			</header>
			{#if turn.request}<details class="request-inspector">
					<summary>Full request sent to the model</summary>
					<!-- This scrollable payload must be reachable and scrollable with the keyboard. -->
					<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
					<pre
						tabindex="0"
						role="region"
						aria-label={`Request payload for turn ${turn.number}`}>{JSON.stringify(
							turn.request,
							null,
							2
						)}</pre>
				</details>{/if}
			<span class="transcript-label">MODEL OUTPUT · VERBATIM</span>
			{#if turn.response}
				{#if turn.response.rawText || turn.response.text}<pre class="verbatim">{turn.response
							.rawText ?? turn.response.text}</pre>
				{:else}<p class="trace-note">No text was returned in this turn.</p>{/if}
				{#each turn.response.calls as call (call)}
					<div class="model-call">
						<span class="transcript-label"
							>{turn.response.rawText !== undefined
								? 'PARSED TOOL CALL'
								: 'FUNCTION CALL PRODUCED BY THE MODEL'}</span
						>
						<pre>{JSON.stringify(
								turn.response.nativeItems?.find(
									(item) => item.type === 'function_call' && item.call_id === call.id
								) ?? call,
								null,
								2
							)}</pre>
					</div>
				{/each}
				{#if turn.response.nativeItems}<details>
						<summary>Complete response output</summary>
						<!-- This scrollable payload must be reachable and scrollable with the keyboard. -->
						<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
						<pre
							tabindex="0"
							role="region"
							aria-label={`Response payload for turn ${turn.number}`}>{JSON.stringify(
								turn.response.nativeItems,
								null,
								2
							)}</pre>
					</details>{/if}
			{:else}<pre class="verbatim">{turn.draft ||
						(running ? 'Waiting for output…' : 'No text received.')}</pre>{/if}
		</section>
		{#each turn.tools as event (event)}
			<section class="tool-return" aria-label={`Tool result for ${event.call.id}`}>
				<header>
					<PatternIcon name="tool" size={15} /><strong>App → model</strong><span
						>{'error' in event.output ? 'Tool error' : 'Tool result'}</span
					>
				</header>
				<p class="call-id">{event.call.name} · {event.call.id}</p>
				<span class="transcript-label">EXACT RETURNED CONTENT</span>
				<pre>{JSON.stringify(event.output)}</pre>
			</section>
		{/each}
	{/each}
</div>

<style>
	.transcript {
		min-width: 0;
		margin-top: 18px;
	}
	.model-turn,
	.tool-return {
		min-width: 0;
		padding: 18px 0;
		border-top: 1px solid var(--line);
	}
	header {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 14px;
		color: var(--ink);
		font-size: 12px;
	}
	header strong {
		font-weight: 550;
	}
	header > span {
		margin-left: auto;
		color: var(--quiet);
		font-size: 10px;
	}
	.transcript-label {
		display: block;
		margin-top: 14px;
		font: 9px var(--mono);
		color: var(--quiet);
		letter-spacing: 0.05em;
	}
	pre {
		white-space: pre-wrap;
		overflow-wrap: anywhere;
		font: 11px/1.8 var(--mono);
		margin: 10px 0 0;
		padding: 13px;
		border-radius: 9px;
		color: var(--ink);
		background: var(--input);
	}
	.verbatim {
		font-size: 13px;
		line-height: 1.8;
	}
	.trace-note {
		color: var(--quiet);
	}
	.trace-note {
		font-size: 11px;
		margin: 8px 0 0;
	}
	.tool-return {
		border-left: 2px solid var(--chart-lavender);
		padding: 16px;
		margin: 8px 0 18px;
		background: color-mix(in srgb, var(--chart-lavender) 5%, transparent);
		border-radius: 0 10px 10px 0;
	}
	.tool-return header {
		color: var(--chart-lavender);
	}
	.call-id {
		overflow-wrap: anywhere;
		font: 10px/1.7 var(--mono);
		color: var(--muted);
	}
	summary {
		cursor: pointer;
		color: var(--muted);
		font-size: 11px;
		padding: 9px 0;
	}
	details pre {
		max-height: 380px;
		overflow: auto;
	}
</style>
