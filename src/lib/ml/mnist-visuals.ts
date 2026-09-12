export const DIGIT_COLORS = [
	'#b69bef',
	'#efa66c',
	'#81bbd6',
	'#83aefa',
	'#e68eb4',
	'#d8bd82',
	'#8ccbe5',
	'#ce9d78',
	'#aebbef',
	'#94a7c4'
];
export const DIGIT_LIGHT_COLORS = [
	'#8e64c1',
	'#ba6c2f',
	'#327ba4',
	'#477cce',
	'#bb5e8d',
	'#9a762d',
	'#388fab',
	'#996b43',
	'#6c77b9',
	'#5e7198'
];
export type LatentFrame = { cx: number; cy: number; span: number };
export function makeDigitAtlas(
	pixels: Float32Array,
	labels: Int32Array,
	colors: string[]
): HTMLCanvasElement {
	const canvas = document.createElement('canvas');
	canvas.width = 28 * 50;
	canvas.height = 28 * Math.ceil(labels.length / 50);
	const context = canvas.getContext('2d')!;
	const img = context.createImageData(canvas.width, canvas.height);
	const rgb = colors.map((hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)));
	for (let digit = 0; digit < labels.length; digit++)
		for (let py = 0; py < 28; py++)
			for (let px = 0; px < 28; px++) {
				const value = pixels[digit * 784 + py * 28 + px],
					offset = ((Math.floor(digit / 50) * 28 + py) * canvas.width + (digit % 50) * 28 + px) * 4;
				img.data[offset] = rgb[labels[digit]][0];
				img.data[offset + 1] = rgb[labels[digit]][1];
				img.data[offset + 2] = rgb[labels[digit]][2];
				img.data[offset + 3] = Math.round(value * 255);
			}
	context.putImageData(img, 0, 0);
	return canvas;
}
