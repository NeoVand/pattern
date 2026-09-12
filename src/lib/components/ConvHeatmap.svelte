<script lang="ts">
	import { canvasColor, observeCanvasTheme } from '$lib/ui/canvas-theme';
	let {
		values,
		side,
		scale = 1,
		kind = 'activation',
		label = ''
	}: {
		values: Float32Array;
		side: number;
		scale?: number;
		kind?: 'image' | 'activation' | 'weight';
		label?: string;
	} = $props();
	function draw(canvas: HTMLCanvasElement) {
		const context = canvas.getContext('2d');
		if (!context) return;
		return observeCanvasTheme(() => {
			const background = kind === 'image' ? [24, 29, 37] : canvasColor(canvas, '--plot-soft');
			const positive = kind === 'image' ? [226, 232, 239] : canvasColor(canvas, '--chart-lavender');
			const negative = canvasColor(canvas, '--chart-blue');
			const image = context.createImageData(side, side);
			for (let i = 0; i < side * side; i++) {
				const v = Math.max(-1, Math.min(1, (values[i] || 0) / (scale || 1)));
				const target = kind === 'weight' && v < 0 ? negative : positive;
				for (let c = 0; c < 3; c++)
					image.data[i * 4 + c] = background[c] + (target[c] - background[c]) * Math.abs(v);
				image.data[i * 4 + 3] = 255;
			}
			context.putImageData(image, 0, 0);
		});
	}
</script>

<canvas
	width={side}
	height={side}
	aria-label={label || undefined}
	aria-hidden={label ? undefined : true}
	role={label ? 'img' : undefined}
	{@attach draw}
></canvas>

<style>
	canvas {
		display: block;
		width: 100%;
		height: 100%;
		aspect-ratio: 1;
		image-rendering: pixelated;
		border-radius: inherit;
	}
</style>
