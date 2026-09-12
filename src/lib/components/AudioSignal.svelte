<script lang="ts">
	import { onMount } from 'svelte';
	import PatternIcon from './PatternIcon.svelte';
	let { src, frames = false }: { src: string; frames?: boolean } = $props();
	let audio: HTMLAudioElement;
	let samples = $state.raw<Float32Array>(new Float32Array());
	let rate = $state(24000);
	let duration = $state(0);
	let time = $state(0);
	let paused = $state(true);
	let frameMs = $state(40);
	let selected = $state(0);
	let error = $state('');
	let pending = $state(true);
	let page = $state(0);
	let count = $derived(Math.max(1, Math.ceil((duration * 1000) / frameMs)));
	let bars = $derived.by(() =>
		Array.from({ length: 240 }, (_, i) => {
			const a = Math.floor((i * samples.length) / 240),
				b = Math.floor(((i + 1) * samples.length) / 240);
			let peak = 0;
			for (let j = a; j < b; j++) peak = Math.max(peak, Math.abs(samples[j]));
			return peak;
		})
	);
	let frameSamples = $derived.by(() => {
		const start = Math.floor((selected * frameMs * rate) / 1000),
			end = Math.min(samples.length, Math.floor(((selected + 1) * frameMs * rate) / 1000));
		return samples.slice(start, end);
	});
	let detail = $derived(
		Array.from(
			{ length: 200 },
			(_, i) =>
				`${i * 3},${50 - (frameSamples[Math.floor((i * frameSamples.length) / 200)] ?? 0) * 44}`
		).join(' ')
	);
	let spectrum = $derived.by(() => {
		// A Hann-windowed DFT of the real frame. Bins span 0–8 kHz.
		if (!frameSamples.length) return [];
		const n = frameSamples.length;
		return Array.from({ length: 48 }, (_, k) => {
			let re = 0,
				im = 0;
			const frequency = (k * 8000) / 48;
			for (let j = 0; j < n; j++) {
				const index = Math.floor((j * frameSamples.length) / n);
				const value = frameSamples[index] * (0.5 - 0.5 * Math.cos((2 * Math.PI * j) / (n - 1)));
				const phase = (2 * Math.PI * frequency * index) / rate;
				re += value * Math.cos(phase);
				im -= value * Math.sin(phase);
			}
			return Math.max(0, Math.min(1, (20 * Math.log10(Math.hypot(re, im) / n + 1e-6) + 70) / 60));
		});
	});
	function pick(index: number) {
		selected = Math.max(0, Math.min(count - 1, index));
		page = Math.floor(selected / 24);
	}
	async function playFrame() {
		if (!decoded) return;
		audio.pause();
		if (excerptContext) await excerptContext.close();
		excerptContext = new AudioContext();
		const source = excerptContext.createBufferSource();
		source.buffer = decoded;
		source.connect(excerptContext.destination);
		await excerptContext.resume();
		source.start(
			0,
			(selected * frameMs) / 1000,
			Math.min(frameMs / 1000, duration - (selected * frameMs) / 1000)
		);
	}

	function updated() {
		if (
			frames &&
			!paused &&
			audio.currentTime >= ((selected + 1) * frameMs) / 1000 &&
			segmentPlayback
		) {
			audio.pause();
			segmentPlayback = false;
		}
	}
	let segmentPlayback = false;
	let decoded: AudioBuffer | undefined;
	let excerptContext: AudioContext | undefined;
	function ended() {
		segmentPlayback = false;
	}
	onMount(() => {
		const abort = new AbortController();
		const context = new AudioContext();
		fetch(src, { signal: abort.signal })
			.then((r) => {
				if (!r.ok) throw new Error('Audio could not load.');
				return r.arrayBuffer();
			})
			.then((b) => context.decodeAudioData(b))
			.then((buffer) => {
				if (abort.signal.aborted) return;
				decoded = buffer;
				samples = buffer.getChannelData(0).slice();
				rate = buffer.sampleRate;
				duration = buffer.duration;
				pending = false;
			})
			.catch((e) => {
				if (!abort.signal.aborted) {
					error = e.message;
					pending = false;
				}
			})
			.finally(() => context.close());
		return () => {
			abort.abort();
			audio?.pause();
			void excerptContext?.close();
		};
	});
</script>

<div class="signal">
	<audio
		{@attach (node) => {
			audio = node;
		}}
		{src}
		bind:currentTime={time}
		bind:paused
		ondurationchange={() => {
			if (Number.isFinite(audio.duration)) duration = audio.duration;
		}}
		ontimeupdate={updated}
		onended={ended}
		preload="metadata"
	></audio>
	<div class="transport">
		<button
			class="play-audio"
			aria-label={paused ? 'Play full audio' : 'Pause audio'}
			disabled={pending}
			onclick={async () => {
				segmentPlayback = false;
				if (paused) {
					try {
						await audio.play();
					} catch {
						error = 'Playback could not start.';
					}
				} else audio.pause();
			}}><PatternIcon name={paused ? 'play' : 'pause'} size={19} /></button
		><span>{time.toFixed(1)} <small>/ {duration.toFixed(1)} s</small></span><span
			class="audio-label"
			><PatternIcon name="audio" size={17} />{frames
				? 'A voice, divided in time'
				: 'AI-generated voice'}</span
		>
	</div>
	<div class="wave-wrap">
		<svg class="wave" viewBox="0 0 720 116" role="img" aria-label="Waveform of the generated voice">
			{#each bars as value, i (i)}<line
					x1={i * 3 + 1}
					x2={i * 3 + 1}
					y1={58 - value * 48}
					y2={58 + value * 48}
					stroke={i / 240 <= time / duration ? 'var(--lavender)' : 'var(--blue)'}
					stroke-width="1.8"
					stroke-linecap="round"
				/>{/each}
			{#if frames}<rect
					x={(selected / count) * 720}
					y="5"
					width={Math.max(2, 720 / count)}
					height="106"
					fill="none"
					stroke="var(--locator)"
					stroke-width="1.5"
				/>{/if}
			<line
				x1={(time / Math.max(1, duration)) * 720}
				x2={(time / Math.max(1, duration)) * 720}
				y1="0"
				y2="116"
				stroke="var(--lavender)"
				stroke-width="1"
			/>
		</svg><input
			class="seek"
			type="range"
			min="0"
			max={Math.max(duration, 0.1)}
			step="0.01"
			value={frames ? (selected * frameMs) / 1000 : time}
			aria-label={frames ? 'Choose audio frame' : 'Seek audio'}
			oninput={(e) => {
				const value = +e.currentTarget.value;
				if (frames) pick(Math.floor((value * 1000) / frameMs));
				else audio.currentTime = value;
			}}
		/>
	</div>
	{#if pending}<p role="status">Reading the audio signal…</p>{/if}
	{#if error}<p role="alert">{error}</p>{/if}
	{#if frames && !pending}
		<div class="frame-toolbar">
			<div role="group" aria-label="Audio window length">
				{#each [20, 40, 80] as ms (ms)}<button
						aria-pressed={frameMs === ms}
						onclick={() => {
							frameMs = ms;
							pick(0);
						}}>{ms} ms</button
					>{/each}
			</div>
			<span>{count} consecutive windows · {Math.round(rate / 1000)} kHz audio</span>
		</div>
		<div class="frame-detail">
			<div>
				<span class="detail-label"
					>Frame {selected + 1} · {((selected * frameMs) / 1000).toFixed(2)}–{Math.min(
						duration,
						((selected + 1) * frameMs) / 1000
					).toFixed(2)} s</span
				><svg viewBox="0 0 600 100" role="img" aria-label="Samples in the selected audio frame"
					><line x1="0" x2="600" y1="50" y2="50" stroke="var(--line)" /><polyline
						points={detail}
						fill="none"
						stroke="var(--blue)"
						stroke-width="1.3"
					/></svg
				><button
					class="text-button"
					onclick={() => {
						segmentPlayback = true;
						void playFrame();
					}}><PatternIcon name="play" size={15} />Listen to this window</button
				>
			</div>
			<div>
				<span class="detail-label">Frequency content of this window</span><svg
					viewBox="0 0 288 100"
					role="img"
					aria-label="Windowed frequency spectrum, from zero to eight kilohertz"
					>{#each spectrum as level, k (k)}<rect
							x={k * 6}
							y={92 - level * 82}
							width="4"
							height={level * 82}
							rx="1"
							fill="var(--lavender)"
						/>{/each}</svg
				><small>0 → 8 kHz · quieter to louder</small>
			</div>
		</div>
		<div class="frame-pages">
			<button
				class="icon-button"
				aria-label="Previous audio frames"
				disabled={page === 0}
				onclick={() => page--}><PatternIcon name="arrowLeft" size={16} /></button
			><span>Windows {page * 24 + 1}–{Math.min(count, (page + 1) * 24)} of {count}</span><button
				class="icon-button"
				aria-label="Next audio frames"
				disabled={(page + 1) * 24 >= count}
				onclick={() => page++}><PatternIcon name="arrowRight" size={16} /></button
			>
		</div>
		<div class="frame-grid">
			{#each Array.from({ length: Math.min(24, count - page * 24) }, (_, i) => page * 24 + i) as index (index)}<button
					aria-label={`Inspect audio frame ${index + 1}`}
					aria-pressed={selected === index}
					onclick={() => pick(index)}
					><PatternIcon name="audio" size={18} /><span>{index + 1}</span></button
				>{/each}
		</div>
	{/if}
</div>

<style>
	.signal {
		min-width: 0;
	}
	.transport {
		display: flex;
		align-items: center;
		gap: 12px;
		color: var(--ink);
		font-size: 13px;
	}
	.transport small,
	.audio-label {
		color: var(--muted);
	}
	.audio-label {
		margin-left: auto;
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 12px;
	}
	.play-audio {
		width: 40px;
		height: 40px;
		border: 0;
		border-radius: 50%;
		background: var(--blue);
		color: var(--control-ink);
		display: grid;
		place-items: center;
	}
	.wave-wrap {
		margin: 16px 0;
		padding: 10px 14px;
		border-radius: 16px;
		background: var(--lab-inset);
	}
	.wave {
		width: 100%;
		display: block;
	}
	.seek {
		width: 100%;
		height: 18px;
		margin: 4px 0 0;
		accent-color: var(--lavender);
	}
	.frame-toolbar,
	.frame-pages {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 12px;
		color: var(--muted);
		font-size: 12px;
		margin: 18px 0;
	}
	.frame-toolbar > div {
		display: flex;
		gap: 4px;
	}
	.frame-toolbar button,
	.frame-grid button {
		border: 0;
		background: var(--lab-inset);
		color: var(--muted);
		border-radius: 8px;
		padding: 9px 12px;
		font-size: 12px;
	}
	button[aria-pressed='true'] {
		box-shadow: inset 0 0 0 1.5px var(--lavender);
		color: var(--lavender);
	}
	.frame-detail {
		display: grid;
		grid-template-columns: 1.5fr 1fr;
		gap: 22px;
		background: var(--lab-inset);
		padding: 20px;
		border-radius: 16px;
	}
	.frame-detail svg {
		width: 100%;
		max-height: 110px;
		margin-top: 12px;
		display: block;
	}
	.detail-label {
		font-size: 12px;
		color: var(--ink);
	}
	.frame-detail small {
		font-size: 11px;
		color: var(--muted);
	}
	.frame-detail .text-button {
		font-size: 12px;
		padding: 8px 0 0;
	}
	.frame-grid {
		display: grid;
		grid-template-columns: repeat(12, minmax(0, 1fr));
		gap: 5px;
	}
	.frame-grid button {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 5px;
		padding: 9px 2px;
	}
	.frame-grid span {
		font-size: 10px;
	}
	.frame-pages {
		justify-content: center;
	}
	@media (max-width: 650px) {
		.frame-grid {
			grid-template-columns: repeat(6, minmax(0, 1fr));
		}
		.frame-detail {
			grid-template-columns: 1fr;
			gap: 18px;
		}
		.frame-toolbar {
			align-items: flex-start;
			flex-direction: column;
		}
		.audio-label {
			font-size: 10px;
		}
	}
</style>
