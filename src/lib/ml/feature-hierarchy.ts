import { convReceptiveField } from './convnet';

export interface FeatureExample {
	index: number;
	label: number;
	x: number;
	y: number;
	score: number;
}
export interface FeatureAtlas {
	checkpointSha256: string;
	sampleCount: number;
	layers: {
		layer: number;
		size: number;
		side: number;
		channels: { channel: number; examples: FeatureExample[] }[];
	}[];
}
export const FEATURE_STAGES = [
	{
		title: 'Edges',
		summary: 'Light beside dark',
		size: 3,
		meaning: 'A tiny window can find a boundary. It cannot yet tell a sleeve from a shoe.',
		features: [
			{
				channel: 3,
				name: 'A vertical boundary',
				detail:
					'The strongest patches have a dark strip on the left and brighter fabric on the right. The same boundary appears in many kinds of clothing.'
			},
			{
				channel: 6,
				name: 'A narrow bright stroke',
				detail:
					'A slender bright region sits beside darker pixels. Similar local strokes occur on trouser legs, seams, and garment outlines.'
			},
			{
				channel: 7,
				name: 'A lower edge',
				detail:
					'Bright pixels above darker ones form a small lower boundary. The filter responds to that local contrast across different objects.'
			}
		]
	},
	{
		title: 'Contours',
		summary: 'Edges meet and turn',
		size: 7,
		meaning:
			'This layer combines earlier responses over a larger window: corners, bends, and longer borders begin to emerge.',
		features: [
			{
				channel: 2,
				name: 'A turning lower contour',
				detail:
					'These patches show bright material meeting dark space along a bend. Boot soles, coat hems, and a sandal produce similar local contours.'
			},
			{
				channel: 10,
				name: 'A rising outline',
				detail:
					'The matched boundaries rise diagonally through the window. Here that pattern appears around shoulders and other sloping garment edges.'
			},
			{
				channel: 11,
				name: 'A broad lower border',
				detail:
					'Several edge responses combine into a wider border. Look at the bright band above the dark background, on shoes and clothing alike.'
			}
		]
	},
	{
		title: 'Parts',
		summary: 'Contours form structure',
		size: 15,
		meaning:
			'A wider view can respond to arrangements of contours that resemble recognizable garment parts.',
		features: [
			{
				channel: 6,
				name: 'Toe and upper',
				detail:
					'The best matches share a shoe-like profile: a low toe rises toward the upper. Sneakers and ankle boots can both contain this arrangement.'
			},
			{
				channel: 8,
				name: 'Separated trouser legs',
				detail:
					'Two long bright regions flank a dark gap. All six strongest examples here come from trousers; the filter sees the arrangement, not the word “trouser.”'
			},
			{
				channel: 22,
				name: 'Straps and open spaces',
				detail:
					'The strongest patches contain narrow bright structures around dark gaps. Here they come from sandals, where straps repeat that arrangement.'
			}
		]
	}
] as const;

export function featurePatch(
	pixels: Float32Array,
	layer: number,
	x: number,
	y: number
): Float32Array {
	const field = convReceptiveField(layer, x, y);
	const patch = new Float32Array(field.size ** 2);
	for (let py = 0; py < field.size; py++)
		for (let px = 0; px < field.size; px++) {
			const ix = field.left + px,
				iy = field.top + py;
			patch[py * field.size + px] =
				ix >= 0 && ix < 28 && iy >= 0 && iy < 28 ? pixels[iy * 28 + ix] : 0;
		}
	return patch;
}

/** Remove structure by blending the receptive field toward its own mean, not black. */
export function flattenFeaturePatch(
	pixels: Float32Array,
	layer: number,
	x: number,
	y: number,
	amount: number
): Float32Array {
	const field = convReceptiveField(layer, x, y),
		patch = featurePatch(pixels, layer, x, y);
	const mean = patch.reduce((sum, value) => sum + value, 0) / patch.length;
	const result = pixels.slice(),
		mix = Math.max(0, Math.min(1, amount));
	for (let py = Math.max(0, field.top); py < Math.min(28, field.bottom); py++)
		for (let px = Math.max(0, field.left); px < Math.min(28, field.right); px++) {
			const index = py * 28 + px;
			result[index] += (mean - result[index]) * mix;
		}
	return result;
}
