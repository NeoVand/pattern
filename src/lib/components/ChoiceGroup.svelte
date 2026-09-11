<script lang="ts" generics="T extends string | number | boolean">
	let {
		label,
		value,
		options,
		onchange,
		disabled = false
	}: {
		label: string;
		value: T;
		options: { value: T; label: string }[];
		onchange: (value: T) => void;
		disabled?: boolean;
	} = $props();
</script>

<fieldset class="choice-group" {disabled}>
	<legend>{label}</legend>
	<div>
		{#each options as option (String(option.value))}<button
				type="button"
				aria-pressed={value === option.value}
				class:selected={value === option.value}
				onclick={() => onchange(option.value)}>{option.label}</button
			>{/each}
	</div>
</fieldset>
