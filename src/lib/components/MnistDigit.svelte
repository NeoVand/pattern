<script lang="ts">
	import { canvasColor, observeCanvasTheme } from '$lib/ui/canvas-theme';
	import { DIGIT_COLORS, DIGIT_LIGHT_COLORS } from '$lib/ml/mnist-visuals';
	let {
		pixels,
		label = 'Handwritten digit',
		color = '#c6b5ee'
	}: { pixels: ArrayLike<number>; label?: string; color?: string } = $props();
	function paint(canvas: HTMLCanvasElement) {
		const ctx = canvas.getContext('2d');
		if (!ctx) return;
		return observeCanvasTheme(() => {
			const image = ctx.createImageData(28, 28);
			const index = DIGIT_COLORS.indexOf(color);
			const light = document.documentElement.dataset.theme === 'light';
			const hex = light && index >= 0 ? DIGIT_LIGHT_COLORS[index] : color;
			const rgb =
				light && index < 0
					? canvasColor(canvas, '--lavender')
					: [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
			for (let i = 0; i < 784; i++) {
				const offset = i * 4;
				image.data[offset] = rgb[0];
				image.data[offset + 1] = rgb[1];
				image.data[offset + 2] = rgb[2];
				image.data[offset + 3] = Math.round(Math.max(0, Math.min(1, pixels[i] ?? 0)) * 255);
			}
			ctx.putImageData(image, 0, 0);
		});
	}
</script>

<span class="digit-image" role="img" aria-label={label}
	><canvas width="28" height="28" aria-hidden="true" {@attach paint}></canvas></span
>

<style>
	.digit-image {
		display: block;
		width: 100%;
	}
	canvas {
		display: block;
		width: 100%;
		aspect-ratio: 1;
		background: var(--plot-soft);
		border-radius: 10px;
		padding: 5px;
		box-sizing: border-box;
		image-rendering: auto;
	}
</style>
