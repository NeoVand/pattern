import { CONV_SHAPES, convFilter, type ConvTrace, type ConvWeights } from './convnet';

/** Exact inputs to one convolutional unit, including zero padding and every incoming map. */
export function inspectConvNeuron(
	weights: ConvWeights,
	trace: ConvTrace,
	pixels: Float32Array,
	layer: number,
	channel: number,
	x: number,
	y: number
) {
	const input = layer ? trace.maps[layer - 1] : pixels;
	const side = layer ? CONV_SHAPES[layer - 1].side : 28;
	const bias = weights.biases[layer][channel];
	let total = bias;
	const sources = Array.from({ length: CONV_SHAPES[layer].input }, (_, source) => {
		const kernel = convFilter(weights, layer, channel, source);
		const values = new Float32Array(9);
		let contribution = 0;
		for (let ky = 0; ky < 3; ky++)
			for (let kx = 0; kx < 3; kx++) {
				const ix = x * 2 + kx - 1,
					iy = y * 2 + ky - 1;
				const index = ky * 3 + kx;
				values[index] =
					ix >= 0 && ix < side && iy >= 0 && iy < side
						? input[source * side * side + iy * side + ix]
						: 0;
				const product = values[index] * kernel[index];
				contribution += product;
				total += product;
			}
		return { values, kernel, contribution };
	});
	return { sources, bias, total, response: Math.max(0, total) };
}

export function kernelMagnitude(
	weights: ConvWeights,
	layer: number,
	output: number,
	input: number
) {
	const slice = convFilter(weights, layer, output, input);
	return Math.sqrt(slice.reduce((sum, value) => sum + value * value, 0) / slice.length);
}
