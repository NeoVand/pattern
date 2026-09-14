<script lang="ts">
	import { asset } from '$app/paths';
	import PatternIcon from './PatternIcon.svelte';
	let selected = $state<'sneaker' | 'boot'>('boot');
</script>

<figure class="footwear-plate">
	<div class="footwear-image">
		<img
			src={asset('/images/edition-3/shoe-studies.webp')}
			srcset={`${asset('/images/edition-3/shoe-studies-800.webp')} 800w, ${asset('/images/edition-3/shoe-studies.webp')} 1932w`}
			sizes="(max-width: 700px) 92vw, 900px"
			width="1932"
			height="814"
			alt="A complete blue and ivory sneaker beside a slate ankle boot, with rear-view photographs revealing their low and high collars."
		/>
		<span class="feature-ring" class:boot={selected === 'boot'} aria-hidden="true"></span>
	</div>
	<figcaption>
		<div class="silhouettes" role="group" aria-label="Compare the shoe silhouettes">
			<button
				class:active={selected === 'sneaker'}
				aria-pressed={selected === 'sneaker'}
				onclick={() => (selected = 'sneaker')}
			>
				<span class="specimen-number">01</span><span
					><strong>Sneaker</strong><small>A low collar below the ankle</small></span
				><PatternIcon name="eye" size={19} />
			</button>
			<button
				class:active={selected === 'boot'}
				aria-pressed={selected === 'boot'}
				onclick={() => (selected = 'boot')}
			>
				<span class="specimen-number">02</span><span
					><strong>Ankle boot</strong><small>A shaft that rises around the ankle</small></span
				><PatternIcon name="eye" size={19} />
			</button>
		</div>
		<p>
			Shape offers a clue. Color and laces alone don’t decide the category. The model below learns
			from the small grayscale examples.
		</p>
	</figcaption>
</figure>

<style>
	.footwear-plate {
		margin: 0 0 42px;
	}
	.footwear-image {
		position: relative;
		overflow: hidden;
		border-radius: 22px;
		background: transparent;
	}
	.footwear-image img {
		display: block;
		width: 100%;
		height: auto;
	}
	.feature-ring {
		position: absolute;
		pointer-events: none;
		width: 12%;
		aspect-ratio: 1;
		left: 3%;
		top: 24%;
		border: 2px solid #708bb0;
		border-radius: 50%;
		box-shadow:
			0 0 0 5px #a8c3df22,
			0 0 24px #a8c3df18;
		transition:
			left 420ms ease,
			top 420ms ease;
	}
	.feature-ring.boot {
		left: 59%;
		top: 3%;
	}
	.silhouettes {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 14px;
		margin-top: 18px;
	}
	.silhouettes button {
		display: flex;
		align-items: center;
		gap: 18px;
		min-width: 0;
		padding: 20px 23px;
		color: var(--muted);
		background: transparent;
		border: 0;
		border-radius: 16px;
		text-align: left;
		transition: background 160ms ease;
	}
	.silhouettes button:hover,
	.silhouettes button.active {
		background: var(--surface);
		color: var(--ink);
	}
	.silhouettes button:focus-visible {
		outline: 2px solid var(--green);
		outline-offset: 3px;
	}
	.specimen-number {
		color: var(--green);
		font-family: 'Instrument Serif', Georgia, serif;
		font-size: 30px;
	}
	.silhouettes button > span:nth-child(2) {
		flex: 1;
		min-width: 0;
	}
	strong {
		display: block;
		font-size: 18px;
		font-weight: 500;
	}
	small {
		display: block;
		margin-top: 6px;
		font-size: 12px;
		line-height: 1.5;
		color: var(--muted);
	}
	figcaption > p {
		margin: 17px 0 0;
		color: var(--muted);
		font-size: 12px;
		line-height: 1.7;
	}
	@media (min-width: 1100px) {
		.footwear-plate {
			display: grid;
			grid-template-columns: minmax(0, 1fr) 270px;
			gap: 28px;
			align-items: center;
		}
		.silhouettes {
			grid-template-columns: 1fr;
			gap: 8px;
			margin-top: 0;
		}
		.silhouettes button {
			gap: 12px;
			padding: 17px 15px;
		}
		strong {
			font-size: 16px;
		}
		figcaption > p {
			padding-inline: 15px;
		}
	}
	@media (max-width: 680px) {
		.footwear-plate {
			margin-bottom: 28px;
		}
		.footwear-image {
			border-radius: 14px;
		}
		.silhouettes {
			gap: 5px;
			margin-top: 10px;
		}
		.silhouettes button {
			padding: 14px 11px;
			gap: 10px;
			align-items: flex-start;
		}
		.specimen-number {
			font-size: 22px;
		}
		strong {
			font-size: 15px;
		}
		small {
			font-size: 11px;
		}
		.silhouettes :global(svg) {
			display: none;
		}
		.feature-ring {
			border-width: 1.5px;
			box-shadow: 0 0 0 3px color-mix(in srgb, var(--plot) 21.96%, transparent);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.feature-ring {
			transition: none;
		}
	}
</style>
