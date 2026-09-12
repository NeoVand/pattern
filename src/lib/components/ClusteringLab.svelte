<script lang="ts">
	import { onDestroy } from 'svelte';
	import PatternIcon from './PatternIcon.svelte';
	import NearestNeighborLab from './NearestNeighborLab.svelte';
	import {
		advanceClusters,
		clusterBoundaries,
		cafePreferences,
		clusterRegions,
		startClusters
	} from '$lib/ml/cafe-clusters';
	const colors = [
		'var(--chart-blue)',
		'var(--chart-lavender)',
		'var(--chart-amber)',
		'var(--chart-cyan)',
		'var(--chart-rose)'
	];
	const initialPoints = cafePreferences();
	let seed = 19;
	let points = $state.raw(initialPoints),
		k = $state(3),
		fit = $state.raw(startClusters(initialPoints, 3));
	let selected = $state(0),
		running = $state(false),
		view = $state<'means' | 'neighbors'>('means');
	let timer: ReturnType<typeof setInterval> | undefined;
	const regions = $derived(clusterRegions(fit.centers));
	const boundaries = $derived(clusterBoundaries(fit.centers));
	const guest = $derived(points[selected]);
	const distances = $derived(
		fit.centers.map((c) => Math.hypot(guest.sweetness - c.sweetness, guest.intensity - c.intensity))
	);
	const nearest = $derived(distances.indexOf(Math.min(...distances)));
	const assigned = $derived(fit.assignments[0] >= 0);
	const means = $derived(
		fit.centers.map((center, g) => {
			const members = points.filter((_, i) => fit.assignments[i] === g);
			return {
				n: members.length,
				x: members.reduce((n, p) => n + p.sweetness, 0),
				y: members.reduce((n, p) => n + p.intensity, 0),
				center
			};
		})
	);
	const narration = $derived(
		fit.phase === 'done'
			? 'The centers have settled. Different starting centers can produce a different solution.'
			: fit.phase === 'move'
				? 'Assignments are fixed. Next, replace each center with the average of its members.'
				: fit.iteration > 0
					? 'Centers moved. Colors retain the previous assignments; now reassign each guest to its nearest center.'
					: 'Centers are fixed. Assign every guest to whichever center is closest.'
	);
	const x = (v: number) => 32 + v * 31,
		y = (v: number) => 332 - v * 31;
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
		if (running) timer = setInterval(advance, 1100);
	}
	function restart(groups = k, newGuests = false) {
		stop();
		k = groups;
		if (newGuests) {
			points = cafePreferences(++seed);
			selected = 0;
		}
		fit = startClusters(points, k, seed - 14);
	}
	onDestroy(stop);
</script>

<section class="clustering-lab" aria-label="Clustering and nearest neighbors">
	<div class="algorithm-switch" role="group" aria-label="Compare learning algorithms">
		<button
			aria-pressed={view === 'means'}
			onclick={() => {
				stop();
				view = 'means';
			}}><PatternIcon name="clustering" size={17} />Find groups <span>k-means</span></button
		>
		<button
			aria-pressed={view === 'neighbors'}
			onclick={() => {
				stop();
				view = 'neighbors';
			}}><PatternIcon name="classification" size={17} />Predict a label <span>k-NN</span></button
		>
	</div>
	{#if view === 'neighbors'}<NearestNeighborLab />{:else}
		<header>
			<div>
				<span class="small-overline">72 GUESTS · TWO MEASURED PREFERENCES</span>
				<h3>Find the centers of similarity.</h3>
			</div>
			<div class="cluster-actions">
				<button class="primary-button" disabled={fit.phase === 'done'} onclick={run}
					><PatternIcon name={running ? 'pause' : 'play'} size={15} />{running
						? 'Pause'
						: 'Find the groups'}</button
				><button class="icon-button" aria-label="Start over" onclick={() => restart()}
					><PatternIcon name="reset" size={17} /></button
				>
			</div>
		</header>
		<div class="cluster-toolbar">
			<fieldset>
				<legend>Groups <em>k</em></legend>{#each [2, 3, 4, 5] as groups (groups)}<button
						aria-pressed={k === groups}
						onclick={() => restart(groups)}>{groups}</button
					>{/each}
			</fieldset>
			<button class="text-button" onclick={() => restart(k, true)}
				><PatternIcon name="shuffle" size={14} />New guests</button
			><span
				>{fit.phase === 'done'
					? 'SETTLED'
					: `ROUND ${String(fit.iteration + 1).padStart(2, '0')}`}</span
			>
		</div>
		<div class="cluster-workspace">
			<div class="cluster-chart">
				<svg
					viewBox="0 0 368 368"
					role="img"
					aria-label="Café guest preferences. Dashed boundaries separate nearest-center regions. Dotted connections show distances for the example guest."
				>
					{#each regions as region, index (index)}<polygon
							points={region.map(([a, b]) => `${x(a)},${y(b)}`).join(' ')}
							fill={colors[index]}
							opacity={assigned ? 0.09 : 0.035}
						/>{/each}
					{#each [0, 5, 10] as tick (tick)}<text x={x(tick)} y="350" text-anchor="middle"
							>{tick}</text
						><text x="22" y={y(tick) + 4} text-anchor="end">{tick}</text>{/each}
					{#each boundaries as edge, i (i)}<line
							x1={x(edge[0][0])}
							y1={y(edge[0][1])}
							x2={x(edge[1][0])}
							y2={y(edge[1][1])}
							class="cluster-boundary"
						/>{/each}
					{#each fit.centers as center, i (i)}<line
							x1={x(guest.sweetness)}
							y1={y(guest.intensity)}
							x2={x(center.sweetness)}
							y2={y(center.intensity)}
							stroke={colors[i]}
							class="distance-ray"
							class:nearest={i === nearest}
						/>{/each}
					{#each points as point, i (point.id)}<circle
							cx={x(point.sweetness)}
							cy={y(point.intensity)}
							r="3.3"
							fill={assigned ? colors[fit.assignments[i]] : 'var(--plot-muted)'}
							opacity=".85"
						/>{/each}
					{#each fit.centers as center, i (i)}
						{#if fit.phase === 'move' && means[i].n}<line
								x1={x(center.sweetness)}
								y1={y(center.intensity)}
								x2={x(means[i].x / means[i].n)}
								y2={y(means[i].y / means[i].n)}
								stroke={colors[i]}
								stroke-width="1.5"
							/><circle
								cx={x(means[i].x / means[i].n)}
								cy={y(means[i].y / means[i].n)}
								r="8"
								fill="none"
								stroke={colors[i]}
								stroke-dasharray="2 3"
							/>{/if}
						<g
							class="center-mark"
							style:transform={`translate(${x(center.sweetness)}px,${y(center.intensity)}px)`}
							><path
								d="M0,-9 9,0 0,9 -9,0Z"
								fill="var(--surface)"
								stroke={colors[i]}
								stroke-width="2"
							/><text y="3.5" text-anchor="middle" style:fill={colors[i]}>{i + 1}</text></g
						>
					{/each}
					<circle
						cx={x(guest.sweetness)}
						cy={y(guest.intensity)}
						r="8"
						fill="none"
						stroke="var(--ink)"
						stroke-width="1.2"
					/>
					<text x="187" y="367" text-anchor="middle">Sweetness →</text><text
						transform="translate(8 177) rotate(-90)"
						text-anchor="middle">Coffee intensity →</text
					>
				</svg>
				<div class="map-legend">
					<span>● Guest</span><span>◇ Learned center</span><span>◌ Next average</span>
				</div>
				<div class="example-row">
					<span>Example guest <strong>{selected + 1}</strong></span>
					<div>
						<button
							class="icon-button"
							aria-label="Previous example guest"
							onclick={() => (selected = (selected + 71) % 72)}
							><PatternIcon name="arrowLeft" size={14} /></button
						><button
							class="icon-button"
							aria-label="Next example guest"
							onclick={() => (selected = (selected + 1) % 72)}
							><PatternIcon name="arrowRight" size={14} /></button
						>
					</div>
					<strong>{assigned ? `Group ${fit.assignments[selected] + 1}` : 'Unassigned'}</strong>
				</div>
				<div class="distance-strip">
					{#each distances as distance, i (i)}<div class:closest={i === nearest}>
							<span style:color={colors[i]}>Center {i + 1}</span><b>{distance.toFixed(2)}</b><small
								>{i === nearest ? 'nearest' : 'distance'}</small
							>
						</div>{/each}
				</div>
			</div>
			<aside class="cluster-model">
				<div class="step-tabs">
					<span class:active={fit.phase === 'assign'}>1 · Assign nearest</span><PatternIcon
						name="arrowRight"
						size={14}
					/><span class:active={fit.phase === 'move'}>2 · Average</span>
				</div>
				<p class="narration" role="status">{narration}</p>
				<div class="model-heading">
					<strong>The model: {k} centers</strong><span>{k * 2} learned numbers</span>
				</div>
				<div class="center-table" role="table" aria-label="Learned centers and member counts">
					<div class="table-head" role="row">
						<span role="columnheader">Center</span><span role="columnheader">Sweetness</span><span
							role="columnheader">Intensity</span
						><span role="columnheader">Guests</span>
					</div>
					{#each means as m, i (i)}<div role="row" class:highlight={i === nearest}>
							<span role="cell" style:color={colors[i]}>◇ {i + 1}</span><span role="cell"
								>{m.center.sweetness.toFixed(2)}{#if fit.phase === 'move' && m.n}<small
										>→ {(m.x / m.n).toFixed(2)}</small
									>{/if}</span
							><span role="cell"
								>{m.center.intensity.toFixed(2)}{#if fit.phase === 'move' && m.n}<small
										>→ {(m.y / m.n).toFixed(2)}</small
									>{/if}</span
							><span role="cell">{m.n}</span>
						</div>{/each}
				</div>
				<div class="calculation">
					<span>Guest {selected + 1} → center {nearest + 1}</span>
					<p>
						√[({guest.sweetness.toFixed(2)} − {fit.centers[nearest].sweetness.toFixed(2)})² + ({guest.intensity.toFixed(
							2
						)} − {fit.centers[nearest].intensity.toFixed(2)})²]
						<b>= {distances[nearest].toFixed(2)}</b>
					</p>
					<small>The smallest Euclidean distance wins. Both features share a 0–10 scale.</small>
				</div>
				<div class="mean-calculation">
					<span>Moving center {nearest + 1}</span>
					<p>
						{#if means[nearest].n}Average sweetness: {means[nearest].x.toFixed(2)} ÷ {means[nearest]
								.n} = <b>{(means[nearest].x / means[nearest].n).toFixed(2)}</b>. Average intensity
							the same way.{:else}Assign guests first. Then average their sweetness and intensity
							separately.{/if}
					</p>
				</div>
				<div class="step-footer">
					<button
						class="secondary-button"
						disabled={running || fit.phase === 'done'}
						onclick={advance}
						>{fit.phase === 'move' ? 'Move centers' : 'Assign nearest'}<PatternIcon
							name="arrowRight"
							size={14}
						/></button
					><span
						>Total squared distance<strong
							>{fit.inertia === null ? '—' : fit.inertia.toFixed(1)}</strong
						></span
					>
				</div>
			</aside>
		</div>
		<p class="cluster-footnote">
			k-means learns centers from unlabeled examples. k-nearest neighbors uses labeled examples to
			vote on a new label. Compare them using the tabs above. Café data is synthetic.
		</p>
	{/if}
</section>

<style>
	.clustering-lab {
		background: var(--surface);
		border-radius: 24px;
		padding: clamp(18px, 3vw, 34px);
		container-type: inline-size;
	}
	.algorithm-switch {
		display: flex;
		gap: 7px;
		flex-wrap: wrap;
		margin-bottom: 26px;
	}
	.algorithm-switch button {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 10px 13px;
		border: 1px solid transparent;
		border-radius: 11px;
		background: var(--lab-inset);
		color: var(--muted);
		font-size: 12px;
	}
	.algorithm-switch button[aria-pressed='true'] {
		border-color: var(--lavender);
		color: var(--ink);
		background: color-mix(in srgb, var(--lavender) 12%, var(--lab-inset));
	}
	.algorithm-switch span {
		font-size: 10px;
		color: var(--quiet);
	}
	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 18px;
		margin-bottom: 20px;
	}
	h3 {
		font: italic clamp(29px, 3vw, 40px)/1.1 var(--serif);
		margin: 10px 0 0;
	}
	.small-overline {
		font-size: 10px;
	}
	.cluster-actions {
		display: flex;
		align-items: center;
		gap: 6px;
	}
	.cluster-actions .primary-button {
		font-size: 12px;
		min-height: 40px;
		padding: 10px 14px;
		white-space: nowrap;
	}
	.cluster-toolbar {
		display: flex;
		align-items: center;
		gap: 18px;
		margin-bottom: 16px;
	}
	.cluster-toolbar fieldset {
		display: flex;
		align-items: center;
		gap: 4px;
		margin: 0;
		padding: 0;
		border: 0;
	}
	.cluster-toolbar legend {
		float: left;
		margin-right: 12px;
		font-size: 12px;
		color: var(--muted);
	}
	.cluster-toolbar fieldset button {
		height: 32px;
		width: 32px;
		border: 0;
		border-radius: 8px;
		background: var(--lab-inset);
		color: var(--muted);
		font-size: 12px;
	}
	.cluster-toolbar fieldset button[aria-pressed='true'] {
		background: var(--lavender);
		color: var(--surface);
	}
	.cluster-toolbar > .text-button {
		font-size: 11px;
	}
	.cluster-toolbar > span {
		margin-left: auto;
		font: 10px var(--mono);
		color: var(--quiet);
	}
	.cluster-workspace {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(290px, 1fr);
		gap: 24px;
		align-items: start;
	}
	.cluster-chart {
		min-width: 0;
		max-width: 470px;
		width: 100%;
		justify-self: center;
	}
	.cluster-chart > svg {
		display: block;
		width: 100%;
		max-height: 310px;
		overflow: visible;
	}
	.cluster-chart text {
		font: 10px var(--sans);
		fill: var(--muted);
	}
	.cluster-boundary {
		stroke: var(--plot-muted);
		stroke-width: 1;
		stroke-dasharray: 4 5;
		opacity: 0.75;
	}
	.distance-ray {
		stroke-width: 1;
		stroke-dasharray: 3 4;
		opacity: 0.45;
	}
	.distance-ray.nearest {
		stroke-width: 1.8;
		opacity: 1;
	}
	.center-mark {
		transition: transform 0.65s cubic-bezier(0.22, 1, 0.36, 1);
	}
	.center-mark text {
		font: 10px var(--mono);
	}
	.map-legend {
		display: flex;
		justify-content: center;
		gap: 16px;
		color: var(--muted);
		font-size: 10px;
		margin: 12px 0;
	}
	.example-row {
		display: flex;
		align-items: center;
		gap: 10px;
		font-size: 11px;
		color: var(--muted);
	}
	.example-row > div {
		display: flex;
	}
	.example-row .icon-button {
		width: 28px;
		height: 28px;
	}
	.example-row > strong {
		margin-left: auto;
		color: var(--ink);
		font-weight: 500;
	}
	.distance-strip {
		display: flex;
		gap: 6px;
		margin-top: 9px;
	}
	.distance-strip > div {
		font-size: 11px;
		flex: 1;
		min-width: 0;
		padding: 7px 6px;
		line-height: 1.25;
		border: 1px solid transparent;
		border-radius: 10px;
		background: var(--lab-inset);
		text-align: center;
	}
	.distance-strip > div.closest {
		border-color: var(--lavender);
	}
	.distance-strip span {
		font-size: 10px;
	}
	.distance-strip b {
		display: block;
		font: 16px var(--mono);
		margin: 4px 0;
	}
	.distance-strip small {
		font-size: 9px;
		color: var(--quiet);
	}
	.cluster-model {
		font-size: 12px;
		line-height: 1.5;
		background: var(--lab-inset);
		border-radius: 17px;
		padding: 18px;
	}
	.step-tabs {
		display: flex;
		align-items: center;
		gap: 10px;
		font-size: 11px;
		color: var(--quiet);
	}
	.step-tabs span.active {
		color: var(--lavender);
		font-weight: 600;
	}
	.narration {
		font-size: 12px;
		line-height: 1.65;
		color: var(--muted);
		min-height: 0;
		margin: 10px 0 14px;
	}
	.model-heading {
		display: flex;
		justify-content: space-between;
		gap: 8px;
		align-items: baseline;
		margin-bottom: 10px;
	}
	.model-heading strong {
		font-size: 13px;
		font-weight: 550;
	}
	.model-heading span {
		font-size: 9px;
		color: var(--quiet);
	}
	.center-table > div {
		display: grid;
		grid-template-columns: 0.7fr 1fr 1fr 0.65fr;
		gap: 8px;
		align-items: center;
		border-radius: 7px;
		padding: 8px 6px;
		font: 12px var(--mono);
	}
	.center-table .table-head {
		font: 9px var(--sans);
		color: var(--quiet);
	}
	.center-table .highlight {
		background: color-mix(in srgb, var(--lavender) 9%, transparent);
	}
	.center-table small {
		display: block;
		font-size: 9px;
		color: var(--blue);
		margin-top: 4px;
	}
	.center-table [role='cell']:last-child {
		text-align: right;
	}
	.calculation,
	.mean-calculation {
		margin-top: 12px;
	}
	.calculation > span,
	.mean-calculation > span {
		font-size: 11px;
		font-weight: 550;
	}
	.calculation p {
		font: 11px/1.8 var(--mono);
		margin: 7px 0;
	}
	.calculation b {
		white-space: nowrap;
		color: var(--blue);
	}
	.calculation small,
	.mean-calculation p {
		font-size: 10px;
		color: var(--muted);
		line-height: 1.65;
		margin: 6px 0 0;
	}
	.mean-calculation b {
		color: var(--blue);
		font-family: var(--mono);
	}
	.step-footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 14px;
		margin-top: 14px;
	}
	.step-footer button {
		width: auto;
		margin-top: 0;
		flex-shrink: 0;
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 11px;
		padding: 10px 12px;
		border: 0;
		border-radius: 9px;
		color: var(--ink);
		background: var(--surface);
	}
	.step-footer > span {
		font-size: 9px;
		color: var(--quiet);
		text-align: right;
	}
	.step-footer strong {
		display: block;
		font: 16px var(--mono);
		color: var(--ink);
		margin-top: 5px;
	}
	.cluster-footnote {
		font-size: 11px;
		line-height: 1.7;
		color: var(--muted);
		margin: 21px 0 0;
		max-width: 95ch;
	}
	@container (max-width:660px) {
		header {
			align-items: flex-start;
			flex-direction: column;
			gap: 15px;
		}
		.cluster-workspace {
			grid-template-columns: 1fr;
			gap: 20px;
		}
		.cluster-model {
			padding: 18px;
		}
		.cluster-toolbar {
			gap: 8px;
			flex-wrap: wrap;
		}
		.algorithm-switch button {
			font-size: 11px;
		}
		.algorithm-switch span {
			display: none;
		}
		.cluster-chart > svg {
			max-height: 320px;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.center-mark {
			transition: none;
		}
	}
</style>
