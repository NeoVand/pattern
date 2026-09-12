<script lang="ts">
	import { tick } from 'svelte';
	import PatternIcon from './PatternIcon.svelte';
	import type { ModelOption } from '$lib/ai/catalog';
	let {
		label,
		value,
		options,
		onchange,
		disabled = false,
		placeholder = 'Choose a model'
	}: {
		label: string;
		value: string;
		options: ModelOption[];
		onchange: (value: string) => void;
		disabled?: boolean;
		placeholder?: string;
	} = $props();
	const id = $props.id();
	let open = $state(false);
	let root: HTMLDivElement;
	let trigger: HTMLButtonElement;
	let selected = $derived(options.find((x) => x.value === value));
	async function expand() {
		open = !open;
		if (open) {
			await tick();
			root.querySelector<HTMLButtonElement>('[aria-selected="true"]')?.focus();
		}
	}
	function choose(next: string) {
		onchange(next);
		open = false;
		trigger.focus();
	}
	function keys(event: KeyboardEvent) {
		const buttons = Array.from(root.querySelectorAll<HTMLButtonElement>('[role="option"]'));
		const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
		if (event.key === 'Escape') {
			event.preventDefault();
			open = false;
			trigger.focus();
		}
		if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
			event.preventDefault();
			buttons[
				event.key === 'Home'
					? 0
					: event.key === 'End'
						? buttons.length - 1
						: (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length
			]?.focus();
		}
	}
</script>

<svelte:document
	onpointerdown={(event) => {
		if (open && !root.contains(event.target as Node)) open = false;
	}}
/>
<div
	class="select-menu"
	{@attach (node) => {
		root = node;
	}}
>
	<span id={id + '-label'} class="select-label">{label}</span>
	<button
		class="select-trigger"
		{@attach (node) => {
			trigger = node;
		}}
		{disabled}
		aria-labelledby={id + '-label ' + id + '-value'}
		aria-haspopup="listbox"
		aria-expanded={open}
		onclick={expand}
	>
		<span id={id + '-value'}>{selected?.label ?? placeholder}</span><PatternIcon
			name="chevronDown"
			size={17}
		/>
	</button>
	{#if open}<div
			class="select-options"
			role="listbox"
			tabindex="-1"
			aria-labelledby={id + '-label'}
			onkeydown={keys}
		>
			{#each options as option (option.value)}<button
					role="option"
					aria-selected={value === option.value}
					tabindex={value === option.value ? 0 : -1}
					onclick={() => choose(option.value)}
					><span
						><strong>{option.label}</strong>{#if option.detail}<small>{option.detail}</small
							>{/if}</span
					>{#if value === option.value}<PatternIcon name="check" size={17} />{/if}</button
				>{/each}
		</div>{/if}
</div>

<style>
	.select-menu {
		position: relative;
		margin: 10px 0;
		min-width: 0;
	}
	.select-label {
		display: block;
		color: var(--muted);
		font-size: 12px;
		margin-bottom: 8px;
	}
	.select-trigger {
		width: 100%;
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 12px;
		padding: 12px 14px;
		border: 1px solid var(--line);
		border-radius: 12px;
		background: var(--input);
		color: var(--ink);
		font-size: 14px;
		min-height: 46px;
		text-align: left;
	}
	.select-options {
		margin-top: 6px;
		padding: 5px;
		max-height: 230px;
		overflow-y: auto;
		background: var(--input);
		border-radius: 12px;
		border: 1px solid var(--line);
	}
	.select-options button {
		width: 100%;
		display: flex;
		justify-content: space-between;
		align-items: center;
		border: 0;
		background: transparent;
		color: var(--ink);
		border-radius: 8px;
		padding: 10px;
		text-align: left;
	}
	.select-options button:hover,
	.select-options button[aria-selected='true'] {
		background: var(--surface-raised);
	}
	strong {
		font-size: 13px;
		font-weight: 550;
	}
	small {
		display: block;
		color: var(--muted);
		font-size: 11px;
		margin-top: 3px;
	}
	button:focus-visible {
		outline: 2px solid var(--focus);
		outline-offset: -2px;
	}
</style>
