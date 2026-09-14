<script lang="ts">
	import { asset } from '$app/paths';
	import AudioSignal from './AudioSignal.svelte';
	import PatternIcon from './PatternIcon.svelte';
</script>

<section class="audio-frames">
	<header>
		<h2>A voice, <em>in moments.</em></h2>
		<p>
			Sound is a stream of samples. Short windows expose how its frequencies change over time—the
			raw material for audio representations.
		</p>
	</header>
	<AudioSignal src={asset('/audio/curiosity.wav')} frames />
	<div class="audio-process">
		<div>
			<PatternIcon name="audio" /><strong>Samples</strong><span
				>A pressure signal measured over time.</span
			>
		</div>
		<PatternIcon name="arrowRight" />
		<div>
			<PatternIcon name="grid" /><strong>Frames</strong><span
				>Small windows, often overlapping in speech systems.</span
			>
		</div>
		<PatternIcon name="arrowRight" />
		<div>
			<PatternIcon name="layers" /><strong>Representations</strong><span
				>Frequency features or learned audio codes.</span
			>
		</div>
	</div>
	<p class="method">
		This view computes real, non-overlapping windows and a windowed frequency spectrum from the
		narration. These windows are an illustration of audio preparation, not the internal tokens of
		GPT Audio. Audio models may use spectrograms, continuous embeddings, or learned discrete codecs.
	</p>
</section>

<style>
	.audio-frames header {
		margin: 24px 0 30px;
		max-width: 720px;
	}
	.audio-frames h2 {
		font-size: clamp(28px, 3vw, 40px);
		margin: 0 0 12px;
	}
	.audio-frames p {
		font-size: 14px;
		color: var(--muted);
		line-height: 1.75;
	}
	.audio-process {
		display: grid;
		grid-template-columns: 1fr auto 1fr auto 1fr;
		gap: 20px;
		align-items: center;
		margin: 30px 0;
	}
	.audio-process > div {
		display: grid;
		gap: 9px;
	}
	.audio-process strong {
		font-size: 14px;
		color: var(--ink);
		font-weight: 550;
	}
	.audio-process span {
		font-size: 12px;
		color: var(--muted);
		line-height: 1.6;
	}
	.audio-process :global(svg) {
		color: var(--lavender);
	}
	.audio-frames .method {
		font-size: 12px;
	}
	@media (max-width: 650px) {
		.audio-process {
			gap: 10px;
		}
		.audio-process span {
			font-size: 11px;
		}
		.audio-process > :global(svg) {
			width: 12px;
		}
	}
</style>
