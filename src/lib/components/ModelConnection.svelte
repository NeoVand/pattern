<script lang="ts">
	import PatternIcon from '$lib/components/PatternIcon.svelte';
	import type { AiSession } from '$lib/ai/session.svelte';
	let { ai }: { ai: AiSession } = $props();
</script>

<div class="model-connection">
	<PatternIcon name="cpu" size={17} />
	<div>
		<strong>{ai.ready ? ai.label : 'Connect a real model'}</strong><span
			>{ai.ready
				? ai.provider === 'local'
					? 'Running on your device · WebGPU'
					: 'OpenAI · your API account'
				: 'Use an OpenAI key or download a model for this browser.'}</span
		>
	</div>
	<button class="secondary-button" onclick={() => (ai.settingsOpen = true)}
		><PatternIcon name="settings" size={14} />{ai.ready ? 'Change model' : 'Connect model'}</button
	>
</div>
