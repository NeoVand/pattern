<script lang="ts">
	import { drinkLabels, labeledGuests, nearestGuestVote } from '$lib/ml/neighbors';
	import ConceptPlate from './ConceptPlate.svelte';
	import PatternIcon from './PatternIcon.svelte';
	const uid = $props.id();
	let sweetness = $state(5.4),
		intensity = $state(5.3),
		k = $state(5);
	const result = $derived(nearestGuestVote({ sweetness, intensity }, k));
	const colors = ['var(--chart-blue)', 'var(--chart-lavender)', 'var(--chart-amber)'];
	const x = (v: number) => 30 + v * 30,
		y = (v: number) => 330 - v * 30;
</script>

<div class="neighbor-lab">
	<header>
		<span class="small-overline">NEARBY EXAMPLES CAST A VOTE</span>
		<h3>What might this guest order?</h3>
		<p>
			Here, the 72 guests already have drink labels. Move a new guest and compare its <em>k</em> nearest
			neighbors.
		</p>
	</header>
	<details class="neighbor-guide">
		<summary
			><PatternIcon name="book" size={17} /><span>How nearest neighbors work</span><PatternIcon
				name="chevronDown"
				size={15}
			/></summary
		>
		<div class="neighbor-art">
			<ConceptPlate
				art={{
					asset: 'edition-4/nearest-neighbor-vote',
					title: 'Distance, neighbors, votes',
					alt: 'A new example finds its five closest neighbors. Their distances are ranked; three blue labels outvote two lavender labels, predicting blue.',
					caption: 'Measure the distances. Keep the nearest examples. Count their labels.',
					note: 'This illustration explains k-nearest-neighbor classification, with five schematic distances and a three-to-two vote. The café experiment calculates real Euclidean distances. Unlike k-means clustering, k-NN predicts from examples that already have labels.',
					action: 'Explore the distances',
					tone: 'dark',
					width: 1902,
					height: 827
				}}
				target={`${uid}-experiment`}
			/>
		</div>
	</details>
	<div class="neighbor-workspace" id={`${uid}-experiment`} tabindex="-1">
		<div>
			<svg
				viewBox="0 0 360 367"
				role="img"
				aria-label={`${k} nearest neighbors predict ${drinkLabels[result.prediction]}. ${result.votes.map((n, i) => `${n} votes for ${drinkLabels[i]}`).join(', ')}.`}
			>
				<defs
					><clipPath id={`${uid}-neighbors`}
						><rect x="30" y="30" width="300" height="300" /></clipPath
					></defs
				>
				<g clip-path={`url(#${uid}-neighbors)`}>
					{#each result.neighbors as point (point.id)}<line
							x1={x(sweetness)}
							y1={y(intensity)}
							x2={x(point.sweetness)}
							y2={y(point.intensity)}
							stroke={colors[point.label]}
							stroke-dasharray="3 4"
							opacity=".8"
						/>{/each}
					<circle
						cx={x(sweetness)}
						cy={y(intensity)}
						r={result.neighbors.at(-1)!.distance * 30}
						fill="none"
						stroke="var(--muted)"
						stroke-dasharray="4 5"
						opacity=".45"
					/>
					{#each labeledGuests as point (point.id)}<circle
							cx={x(point.sweetness)}
							cy={y(point.intensity)}
							r={result.neighbors.some((n) => n.id === point.id) ? 5 : 3}
							fill={colors[point.label]}
							opacity={result.neighbors.some((n) => n.id === point.id) ? 1 : 0.45}
						/>{/each}
					<path
						d={`M${x(sweetness) - 10},${y(intensity)}h6m8,0h6m-10,-10v6m0,8v6`}
						fill="none"
						stroke="var(--ink)"
						stroke-width="1.7"
					/><circle cx={x(sweetness)} cy={y(intensity)} r="5" fill="none" stroke="var(--ink)" />
				</g>
				{#each [0, 5, 10] as tick (tick)}<text x={x(tick)} y="349" text-anchor="middle">{tick}</text
					><text x="20" y={y(tick) + 4} text-anchor="end">{tick}</text>{/each}<text
					x="180"
					y="365"
					text-anchor="middle">Sweetness →</text
				><text transform="translate(9 177) rotate(-90)" text-anchor="middle"
					>Coffee intensity →</text
				>
			</svg>
			<div class="neighbor-legend">
				{#each drinkLabels as label, i (label)}<span style:color={colors[i]}>● {label}</span
					>{/each}<span>⊕ New guest</span>
			</div>
			<div class="neighbor-equation">
				<span>The closest example · guest {result.neighbors[0].id + 1}</span>
				<p>
					√[({sweetness.toFixed(2)} − {result.neighbors[0].sweetness.toFixed(2)})² + ({intensity.toFixed(
						2
					)} − {result.neighbors[0].intensity.toFixed(2)})²]
					<b>≈ {result.neighbors[0].distance.toFixed(2)}</b>
				</p>
				<small
					>Compare all 72 distances. The circle reaches neighbor {k}; only those {k} labels vote. A tied
					vote goes to the closest tied class.</small
				>
			</div>
		</div>
		<aside>
			<fieldset>
				<legend>Neighbors <em>k</em></legend>{#each [3, 5, 7] as n (n)}<button
						aria-pressed={k === n}
						onclick={() => (k = n)}>{n}</button
					>{/each}
			</fieldset>
			<label
				><span>Sweetness<output>{sweetness.toFixed(1)}</output></span><input
					type="range"
					min="1"
					max="9"
					step=".1"
					aria-label="Sweetness"
					bind:value={sweetness}
				/></label
			><label
				><span>Coffee intensity<output>{intensity.toFixed(1)}</output></span><input
					type="range"
					min="1"
					max="9"
					step=".1"
					aria-label="Coffee intensity"
					bind:value={intensity}
				/></label
			>
			<div class="neighbor-result">
				<span>Majority prediction</span><strong style:color={colors[result.prediction]}
					>{drinkLabels[result.prediction]}</strong
				>
				<p>{result.votes.map((n, i) => `${drinkLabels[i]} ${n}`).join(' · ')}</p>
			</div>
			<div class="neighbor-list">
				<div class="list-heading"><span>Nearest first</span><span>Distance</span></div>
				{#each result.neighbors as point, i (point.id)}<div>
						<span
							><small>{i + 1}</small><i style:background={colors[point.label]}></i>{drinkLabels[
								point.label
							]}</span
						><b>{point.distance.toFixed(2)}</b>
					</div>{/each}
			</div>
		</aside>
	</div>
	<footer>
		<strong>The model is the stored examples.</strong> There are no centers to update. This is classification
		using labeled data; k-means instead learns centers from unlabeled data. The dotted circle reaches
		the kth neighbor.
	</footer>
</div>

<style>
	.neighbor-guide {
		margin: 0 0 24px;
		border-radius: 12px;
		background: var(--lab-inset);
	}
	.neighbor-guide summary {
		display: flex;
		align-items: center;
		gap: 10px;
		list-style: none;
		cursor: pointer;
		padding: 13px 16px;
		font-size: 12px;
		color: var(--muted);
	}
	.neighbor-guide summary::-webkit-details-marker {
		display: none;
	}
	.neighbor-guide summary span {
		flex: 1;
	}
	.neighbor-guide summary:hover {
		color: var(--ink);
	}
	.neighbor-guide summary :global(svg:last-child) {
		transition: transform 180ms ease;
	}
	.neighbor-guide[open] summary :global(svg:last-child) {
		transform: rotate(180deg);
	}
	.neighbor-art {
		padding: 4px 18px 0;
	}
	.neighbor-art :global(.concept-plate) {
		margin-bottom: 0;
	}
	.neighbor-art :global(.art-frame) {
		max-width: 760px;
	}
	.neighbor-workspace {
		scroll-margin-top: 90px;
	}
	@media (prefers-reduced-motion: reduce) {
		.neighbor-guide summary :global(svg:last-child) {
			transition: none;
		}
	}
	h3 {
		font: italic clamp(29px, 3vw, 40px)/1.1 var(--serif);
		margin: 10px 0 0;
	}
	header p {
		font-size: 13px;
		color: var(--muted);
		line-height: 1.6;
		margin: 12px 0 22px;
		max-width: 70ch;
	}
	.small-overline {
		font-size: 10px;
	}
	.neighbor-workspace {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(260px, 1fr);
		gap: 26px;
		align-items: start;
	}
	.neighbor-workspace > div {
		min-width: 0;
	}
	svg {
		width: 100%;
		max-height: 320px;
		overflow: visible;
	}
	svg text {
		font: 10px var(--sans);
		fill: var(--muted);
	}
	.neighbor-legend {
		display: flex;
		justify-content: center;
		flex-wrap: wrap;
		gap: 13px;
		font-size: 10px;
		color: var(--muted);
		margin-top: 13px;
	}
	aside {
		font-size: 12px;
		line-height: 1.5;
		background: var(--lab-inset);
		border-radius: 17px;
		padding: 18px;
	}
	fieldset {
		border: 0;
		padding: 0;
		margin: 0 0 20px;
		display: flex;
		gap: 5px;
		align-items: center;
	}
	legend {
		float: left;
		font-size: 12px;
		margin-right: 15px;
		color: var(--muted);
	}
	fieldset button {
		width: 32px;
		height: 32px;
		border: 0;
		border-radius: 8px;
		background: var(--surface);
		color: var(--muted);
		font-size: 12px;
	}
	fieldset button[aria-pressed='true'] {
		background: var(--lavender);
		color: var(--surface);
	}
	label {
		display: block;
		margin-top: 14px;
	}
	label > span {
		display: flex;
		justify-content: space-between;
		color: var(--muted);
		font-size: 11px;
		margin-bottom: 8px;
	}
	label input {
		height: 20px;
		min-height: 20px;
		padding: 0;
		margin: 0;
		width: 100%;
	}
	output {
		font-family: var(--mono);
		color: var(--blue);
	}
	.neighbor-result {
		margin: 14px 0 10px;
	}
	.neighbor-result > span {
		font-size: 10px;
		color: var(--muted);
	}
	.neighbor-result strong {
		display: block;
		font: italic 29px var(--serif);
		margin-top: 5px;
	}
	.neighbor-result p {
		font-size: 10px;
		color: var(--muted);
		margin: 6px 0;
	}
	.neighbor-list > div {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-size: 11px;
		padding: 6px 0;
	}
	.neighbor-list span {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.neighbor-list small {
		color: var(--quiet);
		width: 8px;
	}
	.neighbor-list i {
		width: 5px;
		height: 5px;
		border-radius: 50%;
	}
	.neighbor-list b {
		font: 11px var(--mono);
	}
	.neighbor-list .list-heading {
		font-size: 10px;
		color: var(--quiet);
		padding-bottom: 8px;
	}
	.neighbor-equation {
		background: var(--lab-inset);
		padding: 14px;
		border-radius: 12px;
		margin-top: 20px;
		font-size: 11px;
		line-height: 1.5;
	}
	.neighbor-equation > span {
		color: var(--muted);
		font-size: 11px;
	}
	.neighbor-equation p {
		font: 11px/1.8 var(--mono);
		margin: 8px 0;
	}
	.neighbor-equation b {
		color: var(--blue);
		white-space: nowrap;
	}
	.neighbor-equation small {
		color: var(--muted);
		font-size: 10px;
		line-height: 1.6;
	}

	footer {
		margin-top: 22px;
		font-size: 11px;
		color: var(--muted);
		line-height: 1.7;
	}
	footer strong {
		color: var(--ink);
		font-weight: 550;
	}
	@container (max-width:660px) {
		.neighbor-workspace {
			grid-template-columns: 1fr;
		}
		svg {
			max-height: 300px;
		}
	}
</style>
