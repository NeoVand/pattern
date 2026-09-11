<script lang="ts">
	import PatternIcon from './PatternIcon.svelte';
	let selected = $state<'sneaker' | 'boot'>('boot');
</script>

<figure class="footwear-plate">
	<div class="footwear-image">
		<img
			src="/images/shoe-studies.webp"
			width="1536"
			height="1024"
			alt="A complete low-top sage sneaker and a complete brown ankle boot, including its tall shaft, standing on stone plinths."
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
		background: #ded1b8;
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
		left: 17.5%;
		top: 37%;
		border: 2px solid #fffaf1;
		border-radius: 50%;
		box-shadow:
			0 0 0 5px #24392a38,
			0 0 24px #24392a20;
		transition:
			left 420ms ease,
			top 420ms ease;
	}
	.feature-ring.boot {
		left: 60%;
		top: 20.5%;
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
			box-shadow: 0 0 0 3px #24392a38;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.feature-ring {
			transition: none;
		}
	}
</style>
