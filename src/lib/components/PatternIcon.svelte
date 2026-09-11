<script lang="ts">
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import type { ComponentProps } from 'svelte';
	import { patternIcons, type PatternIconName } from '$lib/data/icons';

	interface Props extends Omit<ComponentProps<typeof HugeiconsIcon>, 'icon'> {
		name: PatternIconName;
		size?: number;
		strokeWidth?: number;
	}

	let { name, size = 20, strokeWidth = 1.6, ...rest }: Props = $props();
</script>

{#key name}
	<HugeiconsIcon
		icon={patternIcons[name]}
		{size}
		{strokeWidth}
		aria-hidden="true"
		focusable="false"
		{...rest}
	/>
{/key}
