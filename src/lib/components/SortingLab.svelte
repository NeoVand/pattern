<script lang="ts">
	import PatternIcon from '$lib/components/PatternIcon.svelte';
	import { flip } from 'svelte/animate';
	import { cubicInOut } from 'svelte/easing';
	import { prefersReducedMotion } from 'svelte/motion';
	import { onDestroy } from 'svelte';
	import { sortingFrames } from '$lib/ml/sorting';
	let sequence = $state([4, 1, 6, 2, 5, 3]);
	let step = $state(0);
	let running = $state(false);
	let timer: ReturnType<typeof setInterval> | undefined;
	const frames = $derived(sortingFrames(sequence));
	const frame = $derived(frames[step]);
	const done = $derived(step === frames.length - 1);
	const instruction = $derived(
		frame.action === 'compare'
			? 0
			: frame.action === 'swap'
				? 1
				: frame.action === 'pass' || frame.action === 'done'
					? 2
					: -1
	);
	function stop() {
		clearInterval(timer);
		running = false;
	}
	function advance() {
		if (step < frames.length - 1) step++;
		if (step === frames.length - 1) stop();
	}
	function play() {
		if (running) {
			stop();
			return;
		}
		if (done) step = 0;
		running = true;
		timer = setInterval(advance, 650);
	}
	function reset(shuffle = false) {
		stop();
		step = 0;
		if (shuffle) {
			const next = [...sequence];
			for (let i = next.length - 1; i > 0; i--) {
				const j = Math.floor(Math.random() * (i + 1));
				[next[i], next[j]] = [next[j], next[i]];
			}
			sequence = next;
		}
	}
	onDestroy(stop);
</script>

<div class="sorting-lab">
	<div class="sort-stage">
		<div class="sort-stage-top">
			<span>SMALLEST <PatternIcon name="arrowRight" size={13} /> LARGEST</span><span
				>{frame.comparisons} comparisons · {frame.swaps} swaps</span
			>
		</div>
		<div class="sort-bars" aria-label={`Numbers in current order: ${frame.values.join(', ')}`}>
			{#each frame.values as value, index (value)}
				<div
					animate:flip={{ duration: prefersReducedMotion.current ? 0 : 420, easing: cubicInOut }}
					class="sort-bar-slot"
					class:comparing={frame.pair.includes(index)}
					class:swapping={frame.action === 'swap' && frame.pair.includes(index)}
					class:sorted={done}
				>
					<div
						class="sort-bar"
						style:--bar-shade={`color-mix(in srgb, var(--blue) ${42 + value * 8}%, var(--surface-raised))`}
						style:height={`${50 + value * 25}px`}
					>
						<span>{value}</span><i></i>
					</div>
					<span class="sort-position">{done ? '✓' : String(index + 1).padStart(2, '0')}</span>
				</div>
			{/each}
		</div>
		<p class="sort-narration" role="status">{frame.message}</p>
		<div class="sort-timeline">
			<label for="sorting-step">Follow each step <span>{step} / {frames.length - 1}</span></label>
			<input
				id="sorting-step"
				type="range"
				min="0"
				max={frames.length - 1}
				step="1"
				value={step}
				oninput={(event) => {
					stop();
					step = +event.currentTarget.value;
				}}
				aria-label="Algorithm step"
			/>
		</div>
		<div class="sort-controls">
			<button class="primary-button" onclick={play}
				>{#if running}<PatternIcon name="pause" size={16} /> Pause{:else if done}<PatternIcon
						name="reset"
						size={16}
					/> Run again{:else}<PatternIcon name="play" size={16} /> Run the algorithm{/if}</button
			>
			<button class="secondary-button" disabled={running || done} onclick={advance}
				><PatternIcon name="next" size={16} /> Step</button
			>
			<button class="icon-button" aria-label="Restart sorting" onclick={() => reset()}
				><PatternIcon name="reset" size={17} /></button
			>
			<button class="icon-button" aria-label="Shuffle the numbers" onclick={() => reset(true)}
				><PatternIcon name="shuffle" size={17} /></button
			>
		</div>
	</div>
	<div class="sort-explanation">
		<span class="small-overline">01 / FOLLOW A RULE</span>
		<h2>A recipe for<br /><em>the right answer.</em></h2>
		<ol class="algorithm-steps">
			{#each ['Compare two neighbors.', 'If the left is bigger, swap them.', 'Repeat until a full pass makes no swaps.'] as text, i (text)}<li
					class:current={instruction === i}
				>
					<span>{i + 1}</span>{text}
				</li>{/each}
		</ol>
		<div class="sort-insight">
			<PatternIcon name="check" size={18} />
			<p>We wrote the rule. It works on new numbers without learning from examples.</p>
		</div>
		<span class="algorithm-name">This algorithm is called bubble sort.</span>
	</div>
</div>

<style>
	.sort-bar {
		background: var(--bar-shade);
		color: var(--ink);
		transition:
			background 250ms ease,
			box-shadow 250ms ease;
	}
</style>
