<script lang="ts">
	import type { MnistAutoencoder, LatentPoint } from '$lib/ml/autoencoder';
	import MnistDigit from './MnistDigit.svelte';
	import PatternIcon from './PatternIcon.svelte';
	let {
		model,
		revision,
		pixels,
		code,
		mode
	}: {
		model: MnistAutoencoder;
		revision: number;
		pixels: ArrayLike<number>;
		code: LatentPoint;
		mode: 'image' | 'probe' | 'morph';
	} = $props();
	let focus = $state(3);
	const trace = $derived.by(() => {
		void revision;
		return model.inspect(pixels, code);
	});
	const names = [
		'Pixels',
		'Encoder',
		'Encoder',
		'Latent space',
		'Decoder',
		'Decoder',
		'Reconstruction'
	];
	const descriptions = [
		'The encoder receives all 784 brightness values. No digit labels enter this network.',
		'128 densely connected neurons combine the image pixels. A smooth GELU activation makes their responses nonlinear.',
		'32 neurons compress those responses. Two linear heads then predict a mean and a log variance for each latent coordinate.',
		'Training samples two coordinates from the predicted Gaussian. The map displays its mean; exploring the map supplies your own coordinates to the decoder.',
		'32 decoder neurons expand the two coordinates. Nearby points can produce similar strokes because training regularizes the latent distribution.',
		'128 neurons combine those responses into the structure needed to rebuild the digit. Every square here is one actual neuron.',
		'784 linear outputs reconstruct the pixels. The training objective combines reconstruction error with a KL penalty. Displayed pixels alone are clipped to 0–1.'
	];
	const layers = $derived([
		Array.from(pixels),
		Array.from(trace.encoder[0]),
		Array.from(trace.encoder[1]),
		code,
		Array.from(trace.decoder[0]),
		Array.from(trace.decoder[1]),
		Array.from(trace.decoder[2])
	]);
	function strength(value: number, values: number[]) {
		const scale = Math.max(0.01, ...values.map(Math.abs));
		return Math.min(1, Math.abs(value) / scale);
	}
</script>

<section class="autoencoder-network" aria-label="The actual variational autoencoder architecture">
	<div class="architecture-heading">
		<span><PatternIcon name="neural" size={19} />The network behind the map</span><small
			>{mode === 'image'
				? 'Encode this digit → reconstruct its mean'
				: 'Explore mode → decode your chosen point'}</small
		>
	</div>
	<div class="architecture-flow">
		{#each layers as values, index (index)}<button
				class="architecture-layer"
				class:inactive={mode !== 'image' && index < 3}
				aria-pressed={focus === index}
				aria-label={`Inspect ${names[index]}: ${values.length} ${index === 3 ? 'coordinates' : 'units'}`}
				onclick={() => (focus = index)}
			>
				<span class="layer-name">{names[index]}</span>
				<div class="layer-body">
					{#if index === 0 || index === 6}<div class="architecture-digit">
							<MnistDigit
								pixels={values}
								label={index === 0 ? 'Input digit' : 'Reconstructed digit'}
							/>
						</div>
					{:else if index === 3}<div class="latent-nodes"><i></i><i></i></div>
					{:else}<div class="neuron-matrix" style:--columns={values.length === 128 ? 8 : 4}>
							{#each values as value, j (j)}<i
									style:background={`color-mix(in srgb, ${value < 0 ? 'var(--blue)' : 'var(--lavender)'} ${15 + 85 * strength(value, values)}%, var(--lab-inset))`}
								></i>{/each}
						</div>{/if}
				</div>
				<strong>{values.length}</strong><small
					>{index === 0 || index === 6
						? 'pixels'
						: index === 3
							? 'coordinates'
							: 'GELU neurons'}</small
				>
			</button>{/each}
	</div>
	<div class="variational-branch">
		<span>Encoder heads</span><span
			>μ <b>{trace.encoder[2][0].toFixed(2)}, {trace.encoder[2][1].toFixed(2)}</b></span
		><span>log σ² <b>{trace.encoder[2][2].toFixed(2)}, {trace.encoder[2][3].toFixed(2)}</b></span
		><PatternIcon name="arrowRight" size={15} /><span
			>{mode === 'image' ? 'Mean on the map' : 'Chosen map point'}
			<b>{code[0].toFixed(2)}, {code[1].toFixed(2)}</b></span
		>
	</div>
	<div class="architecture-caption" aria-live="polite">
		<PatternIcon name={focus === 3 ? 'clustering' : 'layers'} size={18} />
		<p><strong>{names[focus]}.</strong> {descriptions[focus]}</p>
	</div>
	<small class="architecture-note"
		>All hidden-layer neurons are shown. Connections between dense layers are bundled; brightness
		shows the magnitude of the current activation, scaled per layer.{mode !== 'image'
			? ' Dimmed encoder values belong to the last inspected digit; only the decoder follows your map point.'
			: ''}</small
	>
</section>

<style>
	.autoencoder-network {
		background: var(--lab-inset);
		padding: 22px;
		border-radius: 20px;
		margin: 0 0 28px;
		container-type: inline-size;
	}
	.architecture-heading {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 14px;
		margin-bottom: 22px;
	}
	.architecture-heading > span {
		display: flex;
		align-items: center;
		gap: 9px;
		font-size: 14px;
		font-weight: 550;
	}
	.architecture-heading small {
		font-size: 11px;
		color: var(--muted);
	}
	.architecture-flow {
		display: grid;
		grid-template-columns: repeat(7, minmax(0, 1fr));
		gap: 20px;
		align-items: stretch;
	}
	.architecture-layer {
		position: relative;
		border: 0;
		border-radius: 10px;
		padding: 10px 5px;
		background: transparent;
		color: var(--ink);
		min-width: 0;
	}
	.architecture-layer:after {
		content: '→';
		position: absolute;
		right: -17px;
		top: 45%;
		color: var(--quiet);
		font-size: 19px;
	}
	.architecture-layer:last-child:after {
		display: none;
	}
	.architecture-layer[aria-pressed='true'] {
		background: var(--surface);
		box-shadow: inset 0 0 0 1px var(--line);
	}
	.layer-name {
		font-size: 10px;
		color: var(--muted);
		display: block;
		white-space: nowrap;
	}
	.layer-body {
		height: 103px;
		display: grid;
		place-items: center;
		margin: 10px 0;
	}
	.architecture-digit {
		width: min(100%, 78px);
	}
	.neuron-matrix {
		display: grid;
		grid-template-columns: repeat(var(--columns), 1fr);
		gap: 2px;
		width: calc(var(--columns) * 6px);
	}
	.neuron-matrix i {
		height: 4px;
		border-radius: 1px;
	}
	.latent-nodes {
		display: flex;
		gap: 8px;
	}
	.latent-nodes i {
		width: 18px;
		height: 18px;
		background: var(--lavender);
		border-radius: 50%;
		box-shadow: 0 0 20px color-mix(in srgb, var(--lavender) 20%, transparent);
	}
	.architecture-layer > strong {
		font-family: var(--mono);
		font-size: 14px;
		font-weight: 500;
		display: block;
	}
	.architecture-layer > small {
		font-size: 9px;
		color: var(--muted);
		display: block;
		margin-top: 5px;
	}
	.inactive {
		opacity: 0.4;
	}
	.variational-branch {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 14px;
		flex-wrap: wrap;
		margin: 18px 0;
		color: var(--muted);
		font-size: 10px;
	}
	.variational-branch b {
		font-family: var(--mono);
		font-weight: 400;
		color: var(--lavender);
		margin-left: 5px;
	}
	.architecture-caption {
		display: flex;
		gap: 10px;
		align-items: flex-start;
		padding-top: 4px;
	}
	.architecture-caption :global(svg) {
		flex-shrink: 0;
		color: var(--lavender);
		margin-top: 4px;
	}
	.architecture-caption p {
		font-size: 12px;
		line-height: 1.7;
		color: var(--muted);
		margin: 0;
	}
	.architecture-caption strong {
		font-weight: 550;
		color: var(--ink);
	}
	.architecture-note {
		display: block;
		color: var(--quiet);
		font-size: 10px;
		line-height: 1.7;
		margin-top: 12px;
	}
	@container (max-width:600px) {
		.architecture-flow {
			grid-template-columns: repeat(3, minmax(0, 1fr));
			gap: 10px;
		}
		.architecture-layer:nth-child(4) {
			grid-column: 1/-1;
			display: grid;
			grid-template-columns: 1fr 1fr 1fr;
			align-items: center;
		}
		.architecture-layer:nth-child(4) .layer-body {
			height: 36px;
			margin: 0;
		}
		.architecture-layer:nth-child(4) > small {
			grid-column: 3;
		}
		.architecture-layer:nth-child(3):after,
		.architecture-layer:nth-child(4):after {
			display: none;
		}
		.architecture-layer:nth-child(4) .layer-name {
			font-size: 12px;
		}
		.architecture-heading {
			align-items: flex-start;
			flex-direction: column;
		}
		.layer-body {
			height: 94px;
		}
	}

	@container (max-width:600px) {
		.architecture-layer:nth-child(4) {
			margin: 12px 0;
		}
		.architecture-layer:nth-child(4):before {
			content: '↓';
			position: absolute;
			top: -24px;
			right: 14%;
			font-size: 18px;
			color: var(--quiet);
		}
		.architecture-layer:nth-child(4):after {
			content: '↓';
			display: block;
			right: auto;
			left: 14%;
			top: auto;
			bottom: -24px;
			font-size: 18px;
		}
	}
</style>
