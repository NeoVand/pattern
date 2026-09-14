<script lang="ts">
	import { inspectionMarkerPath } from '$lib/ui/inspection-marker';
	import { untrack } from 'svelte';
	import { prefersReducedMotion } from 'svelte/motion';
	import {
		DIGIT_COLORS,
		DIGIT_LIGHT_COLORS,
		makeDigitAtlas,
		type LatentFrame
	} from '$lib/ml/mnist-visuals';
	import { VAE_FRAME, type LatentPoint } from '$lib/ml/autoencoder';
	let {
		pixels,
		labels,
		codes,
		selected,
		probe,
		pair,
		mode = 'digits',
		probeMode = false,
		filter = -1,
		datasetName = 'MNIST',
		imageName = 'digits',
		onselect,
		onprobe
	}: {
		pixels: Float32Array;
		labels: Int32Array;
		codes: Float32Array;
		selected: number;
		probe: LatentPoint;
		pair: [number, number] | null;
		mode?: 'digits' | 'points';
		probeMode?: boolean;
		filter?: number;
		datasetName?: string;
		imageName?: string;
		onselect: (index: number) => void;
		onprobe: (code: LatentPoint) => void;
	} = $props();
	type DrawState = {
		codes: Float32Array;
		selected: number;
		probe: LatentPoint;
		pair: [number, number] | null;
		mode: 'digits' | 'points';
		filter: number;
		reduced: boolean;
	};
	const drawState = $derived({
		codes,
		selected,
		probe,
		pair,
		mode,
		filter,
		reduced: prefersReducedMotion.current
	});
	let updateCanvas: ((state: DrawState) => void) | undefined;
	function synchronize() {
		updateCanvas?.(drawState);
	}
	let paintedCodes = new Float32Array(),
		paintedFrame: LatentFrame = VAE_FRAME;

	let canvasElement: HTMLCanvasElement | undefined;
	let width = 600,
		height = 470;
	const margin = 36;
	function screenX(value: number) {
		return width / 2 + (((value - paintedFrame.cx) / paintedFrame.span) * (width - margin * 2)) / 2;
	}
	function screenY(value: number) {
		return (
			height / 2 - (((value - paintedFrame.cy) / paintedFrame.span) * (height - margin * 2)) / 2
		);
	}
	let pointer: number | null = null;
	let pointerStart: [number, number] = [0, 0];
	function eventPoint(event: PointerEvent): [number, number] {
		const rect = canvasElement!.getBoundingClientRect();
		return [event.clientX - rect.left, event.clientY - rect.top];
	}
	function probeAt(event: PointerEvent) {
		if (!canvasElement) return;
		const [x, y] = eventPoint(event);
		onprobe([
			Math.max(
				-paintedFrame.span,
				Math.min(
					paintedFrame.span,
					paintedFrame.cx + ((x - width / 2) * 2 * paintedFrame.span) / (width - margin * 2)
				)
			),
			Math.max(
				-paintedFrame.span,
				Math.min(
					paintedFrame.span,
					paintedFrame.cy - ((y - height / 2) * 2 * paintedFrame.span) / (height - margin * 2)
				)
			)
		]);
	}
	function choose(event: PointerEvent) {
		if (!canvasElement || event.button !== 0) return;
		pointer = event.pointerId;
		pointerStart = [event.clientX, event.clientY];
		(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
		if (probeMode) {
			probeAt(event);
			return;
		}
		inspectAt(event);
	}
	function inspectAt(event: PointerEvent) {
		const [x, y] = eventPoint(event);
		let closest = -1,
			best = Infinity;
		for (let i = 0; i < labels.length; i++) {
			if (filter >= 0 && labels[i] !== filter) continue;
			const distance =
				(screenX(paintedCodes[i * 2]) - x) ** 2 + (screenY(paintedCodes[i * 2 + 1]) - y) ** 2;
			if (distance < best) {
				closest = i;
				best = distance;
			}
		}
		if (closest >= 0) onselect(closest);
	}
	function drag(event: PointerEvent) {
		if (pointer !== event.pointerId) {
			if (pointer === null && event.pointerType === 'mouse' && !probeMode) inspectAt(event);
			return;
		}
		if (
			probeMode ||
			Math.hypot(event.clientX - pointerStart[0], event.clientY - pointerStart[1]) > 3
		)
			probeAt(event);
	}
	function release(event: PointerEvent) {
		if (pointer !== event.pointerId) return;
		pointer = null;
		const target = event.currentTarget as HTMLElement;
		if (target.hasPointerCapture(event.pointerId)) target.releasePointerCapture(event.pointerId);
	}
	function keyboard(event: KeyboardEvent) {
		if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Enter', ' '].includes(event.key))
			return;
		event.preventDefault();
		if (probeMode) {
			const step = paintedFrame.span * 0.06;
			onprobe([
				probe[0] + (event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0),
				probe[1] + (event.key === 'ArrowDown' ? -step : event.key === 'ArrowUp' ? step : 0)
			]);
		} else
			onselect(
				(selected +
					(event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1) +
					labels.length) %
					labels.length
			);
	}
	function mount(canvas: HTMLCanvasElement) {
		canvasElement = canvas;
		const context = canvas.getContext('2d')!;
		let target: Float32Array = new Float32Array(),
			from = new Float32Array();
		let began = 0,
			raf = 0,
			moving = false;
		let atlas: HTMLCanvasElement | null = null,
			light = false,
			colors = DIGIT_COLORS,
			background = '#171c27',
			muted = '#8290a8',
			locator = '#e2eaff';
		let latest = {
			selected: 0,
			probe: [0, 0] as LatentPoint,
			pair: null as [number, number] | null,
			mode: 'digits',
			filter: -1
		};
		function request() {
			if (!raf) raf = requestAnimationFrame(draw);
		}
		function theme() {
			light = document.documentElement.dataset.theme === 'light';
			colors = light ? DIGIT_LIGHT_COLORS : DIGIT_COLORS;
			const style = getComputedStyle(canvas);
			background = style.getPropertyValue('--lab-inset').trim();
			muted = style.getPropertyValue('--quiet').trim();
			locator = style.getPropertyValue('--locator').trim();
			atlas = makeDigitAtlas(
				untrack(() => pixels),
				untrack(() => labels),
				colors
			);
			request();
		}
		function draw(now: number) {
			raf = 0;
			const amount = moving ? Math.min(1, (now - began) / 220) : 1,
				eased = 1 - (1 - amount) ** 3;
			if (moving) {
				for (let i = 0; i < target.length; i++)
					paintedCodes[i] = from[i] + (target[i] - from[i]) * eased;
			}
			const ratio = Math.min(devicePixelRatio || 1, 2);
			const nextWidth = canvas.clientWidth,
				nextHeight = canvas.clientHeight;
			if (!nextWidth || !nextHeight) return;
			width = nextWidth;
			height = nextHeight;
			if (
				canvas.width !== Math.round(width * ratio) ||
				canvas.height !== Math.round(height * ratio)
			) {
				canvas.width = Math.round(width * ratio);
				canvas.height = Math.round(height * ratio);
			}
			context.setTransform(ratio, 0, 0, ratio, 0, 0);
			context.clearRect(0, 0, width, height);
			context.fillStyle = background;
			context.fillRect(0, 0, width, height);
			const plotWidth = width - margin * 2,
				plotHeight = height - margin * 2,
				left = margin,
				top = margin;
			context.strokeStyle = light ? '#35497010' : '#9cadcd0e';
			context.lineWidth = 1;
			for (let i = 0; i < 5; i++) {
				const p = i / 4;
				context.beginPath();
				context.moveTo(left + p * plotWidth, top);
				context.lineTo(left + p * plotWidth, top + plotHeight);
				context.moveTo(left, top + p * plotHeight);
				context.lineTo(left + plotWidth, top + p * plotHeight);
				context.stroke();
			}
			context.font = '10px ui-monospace, monospace';
			context.fillStyle = muted;
			context.textAlign = 'center';
			context.fillText('LATENT 1', width / 2, height - 10);
			context.save();
			context.translate(13, height / 2);
			context.rotate(-Math.PI / 2);
			context.fillText('LATENT 2', 0, 0);
			context.restore();
			for (const sign of [-1, 1]) {
				context.fillText(
					(paintedFrame.cx + sign * paintedFrame.span).toFixed(1),
					width / 2 + (sign * plotWidth) / 2,
					height - 25
				);
			}
			for (let i = 0; i < paintedCodes.length / 2; i++) {
				const filtered = latest.filter >= 0 && labels[i] !== latest.filter;
				context.globalAlpha = filtered ? 0.035 : latest.mode === 'digits' ? 0.22 : 0.65;
				context.fillStyle = colors[labels[i]];
				context.beginPath();
				context.arc(
					screenX(paintedCodes[i * 2]),
					screenY(paintedCodes[i * 2 + 1]),
					latest.mode === 'digits' ? 1.3 : 2.1,
					0,
					Math.PI * 2
				);
				context.fill();
			}
			context.globalAlpha = 1;
			if (atlas && latest.mode === 'digits') {
				const size = width < 440 ? 13 : 18;
				for (let i = 0; i < labels.length; i++) {
					context.globalAlpha = latest.filter >= 0 && labels[i] !== latest.filter ? 0.035 : 0.67;
					context.drawImage(
						atlas,
						(i % 50) * 28,
						Math.floor(i / 50) * 28,
						28,
						28,
						screenX(paintedCodes[i * 2]) - size / 2,
						screenY(paintedCodes[i * 2 + 1]) - size / 2,
						size,
						size
					);
				}
			}
			context.globalAlpha = 1;
			if (latest.pair) {
				context.strokeStyle = light ? '#7960b48c' : '#c7b6f28c';
				context.setLineDash([4, 5]);
				context.beginPath();
				context.moveTo(
					screenX(paintedCodes[latest.pair[0] * 2]),
					screenY(paintedCodes[latest.pair[0] * 2 + 1])
				);
				context.lineTo(
					screenX(paintedCodes[latest.pair[1] * 2]),
					screenY(paintedCodes[latest.pair[1] * 2 + 1])
				);
				context.stroke();
				context.setLineDash([]);
			}
			const idx = latest.selected;
			const px = screenX(idx >= 0 ? paintedCodes[idx * 2] : latest.probe[0]),
				py = screenY(idx >= 0 ? paintedCodes[idx * 2 + 1] : latest.probe[1]);
			context.save();
			context.translate(px, py);
			context.strokeStyle = locator;
			context.lineWidth = 1.5;
			context.lineCap = 'round';
			context.lineJoin = 'round';
			context.stroke(new Path2D(inspectionMarkerPath(idx >= 0 ? 13 : 10, 4)));
			context.restore();
			if (amount < 1) request();
			else moving = false;
		}
		theme();
		const observer = new ResizeObserver(() => {
			request();
		});
		observer.observe(canvas);
		const themes = new MutationObserver(theme);
		themes.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
		updateCanvas = (state) => {
			if (state.codes !== target) {
				from =
					paintedCodes.length === state.codes.length ? paintedCodes.slice() : state.codes.slice();
				target = state.codes;
				const first = paintedCodes.length !== target.length;
				paintedCodes = from.slice();
				if (first || state.reduced) {
					paintedCodes = target.slice();
					moving = false;
				} else {
					began = performance.now();
					moving = true;
				}
			}
			latest = state;
			request();
		};
		return () => {
			cancelAnimationFrame(raf);
			observer.disconnect();
			themes.disconnect();
			canvasElement = undefined;
			updateCanvas = undefined;
		};
	}
</script>

<button
	class="latent-map"
	aria-label={`Explore ${labels.length.toLocaleString('en-US')} held-out ${datasetName} ${imageName} in the actual two-dimensional encoding. ${probeMode ? 'Drag the probe to decode any coordinate; arrow keys move it.' : 'Click to inspect an image, drag to explore between images; arrow keys browse examples.'}`}
	onpointerdown={choose}
	onpointermove={drag}
	onpointerup={release}
	onpointercancel={release}
	onlostpointercapture={() => {
		pointer = null;
	}}
	data-digit-count={labels.length}
	data-frame-span={paintedFrame.span}
	onkeydown={keyboard}
>
	<canvas
		{@attach mount}
		{@attach synchronize}
		aria-label={`Colorized ${datasetName} images at their learned encoder coordinates`}
	></canvas>
</button>

<style>
	.latent-map {
		display: block;
		width: 100%;
		padding: 0;
		border: 0;
		background: var(--ssl-inset);
		border-radius: 18px;
		overflow: hidden;
		cursor: crosshair;
		touch-action: none;
	}
	.latent-map:active {
		transform: none;
	}
	.latent-map:focus-visible {
		outline: 2px solid var(--focus);
		outline-offset: 4px;
	}
	canvas {
		display: block;
		width: 100%;
		height: 510px;
		max-height: 65vw;
	}
	@media (max-width: 700px) {
		canvas {
			height: 390px;
			max-height: none;
		}
	}
	@media (max-width: 440px) {
		canvas {
			height: 330px;
		}
	}
</style>
