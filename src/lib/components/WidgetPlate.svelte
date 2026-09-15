<script lang="ts">
	import { asset } from '$app/paths';
	let {
		kind
	}: {
		kind:
			| 'gradient-update'
			| 'representation-choice'
			| 'transfer-features'
			| 'forecast-benchmark'
			| 'retrieval-check';
	} = $props();
	const plates = {
		'gradient-update': {
			alt: 'Ivory cards form a cycle: Predict, Measure error, Follow the slope, and Adjust.',
			caption: 'Open up one small correction.',
			note: 'The cards illustrate the learning cycle. Below, inspect the actual values and derivatives that change a weight.'
		},
		'representation-choice': {
			alt: 'A tray of blue stones around a lavender center sits beside concentric measuring rings labeled Distance from center.',
			caption: 'What we measure changes what is easy to learn.',
			note: 'The trays illustrate two ways to describe a position. The experiment compares measured coordinates and radius features on shared examples; the stones are an analogy, not plotted data.'
		},
		'transfer-features': {
			alt: 'Unlabeled clothing cards pass through a blue lens toward cards labeled Shirt, Skirt, and Jacket.',
			caption: 'A learned representation deserves a second test.',
			note: 'The lens represents reused features. Measure whether this encoder helps a new classification task with a small number of labels.'
		},
		'forecast-benchmark': {
			alt: 'An accordion calendar follows repeated seasonal waves from Earlier observations to Forecast and Check later.',
			caption: 'Move the starting point. Keep the future ahead.',
			note: 'The calendar is a schematic of repeated forecasting. The rolling-origin scores and interval coverage below are computed from separate forecasts.'
		},
		'retrieval-check': {
			alt: 'Botanical cards follow Find, Read, and Verify stages, tracing a fern to its source record.',
			caption: 'Finding a source is one check. Using it well is another.',
			note: 'The specimen cards illustrate an evidence trail. The audit measures source retrieval separately from the answer and its citations.'
		}
	};
	const plate = $derived(plates[kind]);
</script>

<figure class="widget-plate">
	<img
		src={asset(`/images/edition-5/${kind}.webp`)}
		srcset={`${asset(`/images/edition-5/${kind}-800.webp`)} 800w, ${asset(`/images/edition-5/${kind}.webp`)} 1942w`}
		sizes="(max-width: 600px) 250px, 300px"
		alt={plate.alt}
		width="1942"
		height="809"
		loading="lazy"
	/>
	<figcaption>
		<span>LOOK A LITTLE CLOSER</span>
		<h2>{plate.caption}</h2>
		<p>{plate.note}</p>
	</figcaption>
</figure>

<style>
	.widget-plate {
		display: grid;
		grid-template-columns: minmax(180px, 300px) 1fr;
		align-items: center;
		gap: 28px;
		margin: 50px 0 22px;
	}
	img {
		display: block;
		width: 100%;
		height: auto;
	}
	figcaption {
		min-width: 0;
	}
	span {
		font: 9px var(--mono);
		letter-spacing: 0.09em;
		color: var(--muted);
	}
	h2 {
		margin: 9px 0;
		font: 28px/1.1 var(--serif);
		color: var(--ink);
	}
	p {
		margin: 0;
		font: 12px/1.65 var(--sans);
		color: var(--muted);
		max-width: 48ch;
	}
	@media (max-width: 600px) {
		.widget-plate {
			grid-template-columns: 1fr;
			gap: 14px;
			margin-top: 36px;
		}
		img {
			max-width: 250px;
		}
		h2 {
			font-size: 25px;
		}
	}
</style>
