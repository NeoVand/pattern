<script lang="ts">
	import './layout.css';
	import './refinements.css';
	import './image-led.css';
	import './elegance.css';
	import './theme.css';
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>
{@render children()}
