<script lang="ts">
	import { onDestroy } from 'svelte';
	import PatternIcon from '$lib/components/PatternIcon.svelte';
	import {
		advanceClusters,
		cafePreferences,
		clusterRegions,
		startClusters
	} from '$lib/ml/cafe-clusters';
	const colors = ['#a7d6b1', '#c1acf0', '#edbd88', '#8ac8dc', '#e3a8bd'];
	const initialPoints = cafePreferences();
	let seed = 19;
	let points = $state.raw(initialPoints);
	let k = $state(3);
	let fit = $state.raw(startClusters(initialPoints, 3));
	let selected = $state(0);
	let running = $state(false);
	let timer: ReturnType<typeof setInterval> | undefined;
	const regions = $derived(clusterRegions(fit.centers));
	const assigned = $derived(fit.assignments[0] >= 0);
	const guest = $derived(points[selected]);
	const group = $derived(fit.assignments[selected]);
	const counts = $derived(
		fit.centers.map((_, group) => fit.assignments.filter((value) => value === group).length)
	);
	const narration = $derived(
		fit.phase === 'done'
			? 'The centers have stopped moving. This is one solution for these starting points.'
			: fit.phase === 'move'
				? 'Each guest joins the nearest center. Next, move each center to the average of its guests.'
				: fit.iteration > 0
					? 'The centers moved to their group averages. Some guests may now be closer to another center.'
					: 'Seventy-two guests. Two preferences each. No one supplied the groups.'
	);
	function stop() {
		clearInterval(timer);
		running = false;
	}
	function advance() {
		fit = advanceClusters(points, fit);
		if (fit.phase === 'done') stop();
	}
	function run() {
		if (running) return stop();
		running = true;
		advance();
		if (running) timer = setInterval(advance, 700);
	}
	function restart(groups = k, newGuests = false) {
		stop();
		k = groups;
		if (newGuests) {
			seed++;
			points = cafePreferences(seed);
			selected = 0;
		}
		fit = startClusters(points, groups, seed - 14);
	}
	function pointKey(event: KeyboardEvent, index: number) {
		const direction = ['ArrowRight', 'ArrowDown'].includes(event.key)
			? 1
			: ['ArrowLeft', 'ArrowUp'].includes(event.key)
				? -1
				: 0;
		if (!direction) return;
		event.preventDefault();
		event.stopPropagation();
		selected = (index + direction + points.length) % points.length;
		(event.currentTarget as HTMLElement).parentElement
			?.querySelector<HTMLButtonElement>(`[data-point="${selected}"]`)
			?.focus();
	}
	onDestroy(stop);
</script>

<div class="clustering-lab">
	<div class="cluster-layout">
		<div class="preference-stage">
			<div class="stage-heading">
				<span>THE CAFÉ, WITHOUT LABELS</span><span>{points.length} guests</span>
			</div>
			<div class="map-shell">
				<span class="y-label">Coffee intensity</span>
				<div class="preference-map" aria-label="Café guest preference map">
					<svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
						{#each regions as region, index (index)}
							<polygon
								points={region.map(([x, y]) => `${x * 10},${100 - y * 10}`).join(' ')}
								fill={colors[index]}
								opacity={assigned ? 0.13 : 0.035}
							/>
						{/each}
					</svg>
					{#each points as point (point.id)}
						<button
							class="guest-point"
							class:chosen={selected === point.id}
							data-point={point.id}
							style:left={`${point.sweetness * 10}%`}
							style:top={`${100 - point.intensity * 10}%`}
							style:--point-color={assigned ? colors[fit.assignments[point.id]] : '#b8c4b8'}
							aria-label={`Guest ${point.id + 1}: sweetness ${point.sweetness.toFixed(1)}, intensity ${point.intensity.toFixed(1)}${assigned ? `, group ${fit.assignments[point.id] + 1}` : ', not assigned'}`}
							aria-pressed={selected === point.id}
							tabindex={selected === point.id ? 0 : -1}
							onclick={() => (selected = point.id)}
							onkeydown={(event) => pointKey(event, point.id)}><span></span></button
						>
					{/each}
					{#each fit.centers as center, index (index)}
						<div
							class="cluster-center"
							style:left={`${center.sweetness * 10}%`}
							style:top={`${100 - center.intensity * 10}%`}
							style:--center-color={colors[index]}
							aria-hidden="true"
						>
							<span>{index + 1}</span>
						</div>
					{/each}
				</div>
				<div class="x-scale"><span>0</span><span>Sweetness</span><span>10</span></div>
			</div>
			<div class="map-legend">
				<span><i class="dot"></i> Guest</span><span><i class="diamond"></i> Group center</span><span
					>Illustrative café data</span
				>
			</div>
		</div>
		<aside class="cluster-controls">
			<div class="lab-signature">
				<PatternIcon name="clustering" size={25} /><span>Discover the groups</span>
			</div>
			<h2>Similar tastes.<br /><em>Shared neighborhoods.</em></h2>
			<p>
				Clustering finds structure without an answer key. We choose how many groups to look for; the
				algorithm finds their centers.
			</p>
			<fieldset class="group-picker">
				<legend>Number of groups <span>k</span></legend>
				<div>
					{#each [2, 3, 4, 5] as groups (groups)}<button
							aria-pressed={k === groups}
							onclick={() => restart(groups)}>{groups}</button
						>{/each}
				</div>
			</fieldset>
			<div class="cluster-actions">
				<button class="run-button" disabled={fit.phase === 'done'} onclick={run}
					>{running ? 'Pause' : 'Find the groups'}<PatternIcon
						name="arrowRight"
						size={16}
					/></button
				><button class="step-button" disabled={running || fit.phase === 'done'} onclick={advance}
					>{fit.phase === 'move' ? 'Move centers' : 'Assign nearest'}</button
				>
			</div>
			<div class="sub-actions">
				<button onclick={() => restart()}>Start over</button><button
					onclick={() => restart(k, true)}>New guests</button
				>
			</div>
			<div class="guest-inspector">
				<div>
					<span>Guest {String(guest.id + 1).padStart(2, '0')}</span><strong
						style:color={group >= 0 ? colors[group] : undefined}
						>{group >= 0 ? `Group ${group + 1}` : 'Unassigned'}</strong
					>
				</div>
				<label
					>Sweetness <span>{guest.sweetness.toFixed(1)} / 10</span><meter
						min="0"
						max="10"
						value={guest.sweetness}>{guest.sweetness.toFixed(1)}</meter
					></label
				>
				<label
					>Intensity <span>{guest.intensity.toFixed(1)} / 10</span><meter
						min="0"
						max="10"
						value={guest.intensity}>{guest.intensity.toFixed(1)}</meter
					></label
				>
				<small>Select a guest on the map. Arrow keys move between guests.</small>
			</div>
		</aside>
	</div>
	<div class="cluster-reading">
		<div class="narration" role="status">
			<span
				>{fit.phase === 'done'
					? 'SETTLED'
					: `ROUND ${String(fit.iteration + 1).padStart(2, '0')}`}</span
			>
			<p>{narration}</p>
		</div>
		<div class="cluster-summary">
			{#each counts as count, index (index)}<span
					><i style:background={colors[index]}></i><strong>{assigned ? count : '—'}</strong> in
					group {index + 1}</span
				>{/each}
			<span class="spread-score"
				><strong>{fit.inertia === null ? '—' : (fit.inertia / points.length).toFixed(2)}</strong> mean
				squared distance</span
			>
		</div>
	</div>
	<p class="cluster-footnote">
		The shaded regions show each center’s territory. Groups describe these two measured
		preferences—not fixed kinds of people. Changing k or the starting centers can change the answer.
	</p>
</div>

<style>
	.clustering-lab {
		margin: 28px 0;
	}
	.cluster-layout {
		display: grid;
		grid-template-columns: minmax(0, 1.65fr) minmax(260px, 1fr);
		gap: 36px;
		align-items: start;
	}
	.preference-stage {
		background: #101b17;
		color: #dce7de;
		border-radius: 22px;
		padding: 25px 24px 20px;
		overflow: hidden;
	}
	.stage-heading {
		display: flex;
		justify-content: space-between;
		gap: 12px;
		color: #9bada0;
		font-size: 10px;
		letter-spacing: 0.1em;
	}
	.stage-heading span:last-child {
		letter-spacing: 0;
	}
	.map-shell {
		padding: 34px 6px 5px 26px;
		position: relative;
	}
	.preference-map {
		position: relative;
		aspect-ratio: 1.15;
		isolation: isolate;
	}
	.preference-map svg {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		overflow: hidden;
		border-radius: 5px;
	}
	.y-label {
		position: absolute;
		left: -6px;
		top: 51%;
		writing-mode: vertical-rl;
		transform: rotate(180deg);
		font-size: 11px;
		color: #a7b9ac;
	}
	.x-scale {
		display: flex;
		justify-content: space-between;
		margin-top: 14px;
		color: #a7b9ac;
		font-size: 11px;
	}
	.guest-point {
		position: absolute;
		transform: translate(-50%, -50%);
		width: 24px;
		height: 24px;
		display: grid;
		place-items: center;
		padding: 0;
		border: 0;
		background: transparent;
		border-radius: 50%;
		cursor: pointer;
		z-index: 2;
	}
	.guest-point span {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: var(--point-color);
		transition:
			background 0.4s,
			box-shadow 0.2s;
	}
	.guest-point.chosen span,
	.guest-point:hover span {
		box-shadow:
			0 0 0 4px #101b17,
			0 0 0 5px var(--point-color);
	}
	.guest-point:focus-visible {
		outline: 2px solid white;
		outline-offset: 3px;
	}
	.cluster-center {
		position: absolute;
		pointer-events: none;
		transform: translate(-50%, -50%);
		width: 23px;
		height: 23px;
		border-radius: 5px;
		background: var(--center-color);
		color: #14201a;
		display: grid;
		place-items: center;
		font-size: 11px;
		font-weight: 700;
		box-shadow: 0 2px 14px #0007;
		z-index: 3;
		transition:
			top 0.6s,
			left 0.6s;
		rotate: 45deg;
	}
	.cluster-center span {
		rotate: -45deg;
	}
	.map-legend {
		display: flex;
		align-items: center;
		gap: 17px;
		padding-top: 18px;
		color: #9bada0;
		font-size: 10px;
	}
	.map-legend span {
		display: inline-flex;
		align-items: center;
		gap: 7px;
	}
	.map-legend span:last-child {
		margin-left: auto;
		font-size: 9px;
	}
	.dot {
		width: 5px;
		height: 5px;
		border-radius: 50%;
		background: #bbcec0;
	}
	.diamond {
		width: 8px;
		height: 8px;
		rotate: 45deg;
		border-radius: 2px;
		background: #bbcec0;
	}
	.cluster-controls {
		padding: 10px 0;
		min-width: 0;
	}
	.lab-signature {
		display: flex;
		gap: 9px;
		align-items: center;
		color: var(--muted);
		font-size: 12px;
	}
	h2 {
		font-weight: 500;
		font-size: clamp(26px, 2.35vw, 37px);
		line-height: 1.13;
		letter-spacing: -0.035em;
		margin: 20px 0 14px;
	}
	h2 em {
		font-family: 'Instrument Serif', serif;
		font-weight: 400;
		font-size: 1.14em;
	}
	.cluster-controls > p {
		font-size: 13px;
		color: var(--muted);
		line-height: 1.7;
		margin: 0 0 23px;
		max-width: 36ch;
	}
	.group-picker {
		margin: 0 0 20px;
		padding: 0;
		border: 0;
	}
	.group-picker legend {
		font-size: 12px;
		margin-bottom: 10px;
		width: 100%;
	}
	.group-picker legend span {
		margin-left: 8px;
		font-family: 'Instrument Serif', serif;
		font-style: italic;
		color: var(--muted);
	}
	.group-picker > div {
		display: flex;
		gap: 7px;
	}
	.group-picker button {
		border: 0;
		width: 44px;
		height: 37px;
		border-radius: 10px;
		color: var(--muted);
		background: var(--surface-raised);
		font-size: 13px;
		cursor: pointer;
	}
	.group-picker button[aria-pressed='true'] {
		background: var(--accent-bg);
		color: var(--green);
	}
	.cluster-actions {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
	}
	.cluster-actions button {
		min-height: 41px;
		padding: 10px 15px;
		border-radius: 11px;
		font-size: 12px;
		cursor: pointer;
		border: 0;
	}
	.run-button {
		background: var(--green);
		color: var(--paper);
		display: inline-flex;
		align-items: center;
		gap: 12px;
		font-weight: 600;
	}
	.step-button {
		background: var(--surface-raised);
		color: var(--ink);
	}
	button:disabled {
		opacity: 0.4;
		cursor: default;
	}
	.sub-actions {
		display: flex;
		gap: 20px;
		margin-top: 13px;
	}
	.sub-actions button {
		background: none;
		border: 0;
		padding: 3px 0;
		color: var(--muted);
		font-size: 11px;
		cursor: pointer;
	}
	.sub-actions button:hover {
		color: var(--ink);
	}
	.guest-inspector {
		margin-top: 25px;
		padding: 19px;
		border-radius: 16px;
		background: var(--surface);
	}
	.guest-inspector > div {
		display: flex;
		justify-content: space-between;
		font-size: 11px;
		margin-bottom: 17px;
	}
	.guest-inspector strong {
		font-weight: 500;
		background: #14201a;
		padding: 3px 6px;
		border-radius: 5px;
	}
	.guest-inspector label {
		display: block;
		font-size: 10px;
		color: var(--muted);
		margin: 10px 0;
	}
	.guest-inspector label > span {
		float: right;
		font-variant-numeric: tabular-nums;
	}
	meter {
		display: block;
		appearance: none;
		width: 100%;
		height: 5px;
		margin-top: 8px;
		border-radius: 8px;
		background: var(--surface-raised);
		border: 0;
	}
	meter::-webkit-meter-bar {
		background: var(--surface-raised);
		border: 0;
	}
	meter::-webkit-meter-optimum-value {
		background: var(--green);
		border-radius: 6px;
	}
	meter::-moz-meter-bar {
		background: var(--green);
		border-radius: 6px;
	}
	.guest-inspector small {
		display: block;
		color: var(--quiet);
		font-size: 9px;
		line-height: 1.6;
		margin-top: 14px;
	}
	.cluster-reading {
		display: flex;
		align-items: start;
		gap: 30px;
		justify-content: space-between;
		padding: 28px 0 12px;
	}
	.narration {
		max-width: 540px;
	}
	.narration > span {
		font-size: 9px;
		letter-spacing: 0.12em;
		color: var(--quiet);
	}
	.narration p {
		font-size: 14px;
		color: var(--ink);
		line-height: 1.65;
		margin: 8px 0 0;
	}
	.cluster-summary {
		display: flex;
		flex-wrap: wrap;
		justify-content: end;
		gap: 10px 16px;
		padding-top: 8px;
		max-width: 310px;
	}
	.cluster-summary > span {
		display: flex;
		align-items: center;
		gap: 5px;
		color: var(--quiet);
		font-size: 10px;
	}
	.cluster-summary i {
		display: inline-block;
		width: 6px;
		height: 6px;
		border-radius: 50%;
	}
	.cluster-summary strong {
		color: var(--ink);
		font-weight: 500;
	}
	.cluster-summary .spread-score {
		flex-basis: 100%;
		justify-content: end;
		margin-top: 6px;
	}
	.cluster-footnote {
		color: var(--muted);
		font-size: 11px;
		line-height: 1.8;
		max-width: 780px;
		margin: 18px 0 0;
	}
	@media (max-width: 1100px) {
		.cluster-layout {
			gap: 24px;
			grid-template-columns: minmax(0, 1.3fr) minmax(240px, 1fr);
		}
		.preference-stage {
			padding: 22px 16px 18px;
		}
	}
	@media (max-width: 760px) {
		.cluster-layout {
			grid-template-columns: 1fr;
			gap: 20px;
		}
		.cluster-controls {
			padding: 0 4px;
		}
		.cluster-controls > p {
			max-width: 52ch;
		}
		h2 {
			font-size: 30px;
		}
		.guest-inspector {
			margin-top: 22px;
		}
		.cluster-reading {
			flex-direction: column;
			gap: 8px;
		}
		.cluster-summary {
			justify-content: start;
			max-width: none;
		}
		.cluster-summary .spread-score {
			justify-content: start;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.cluster-center,
		.guest-point span {
			transition: none;
		}
	}
</style>
