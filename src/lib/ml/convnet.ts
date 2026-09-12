/** A small NCHW ConvNet. OIHW weights match PyTorch and JaxJS lax.conv. */
export const CONV_SHAPES = [
	{ input: 1, output: 8, side: 14 },
	{ input: 8, output: 16, side: 7 },
	{ input: 16, output: 24, side: 4 }
] as const;
export const CONV_PARAMETERS = 8578;
export const CONV_TRAIN_COUNT = 10000;
export const CONV_CLASSES = [
	'T-shirt',
	'Trouser',
	'Pullover',
	'Dress',
	'Coat',
	'Sandal',
	'Shirt',
	'Sneaker',
	'Bag',
	'Ankle boot'
] as const;
export type ConvWeights = {
	kernels: Float32Array[];
	biases: Float32Array[];
	head: Float32Array;
	headBias: Float32Array;
};
export type ConvTrace = {
	maps: Float32Array[];
	logits: Float32Array;
	probabilities: Float32Array;
	prediction: number;
};
export type ConvAblation = { layer: number; channel: number };
export type ConvMetric = { accuracy: number; loss: number; count: number };
export interface ConvCheckpointMeta {
	parameterCount: number;
	trainingImages: number;
	validationImages: number;
	heldOutImages: number;
	epochs: number;
	sha256: string;
	train: ConvMetric;
	validation: ConvMetric;
	test: ConvMetric;
	heldOutMistakes: number[];
}

export function unpackConvWeights(packed: Float32Array): ConvWeights {
	if (packed.length !== CONV_PARAMETERS || !packed.every(Number.isFinite))
		throw new Error('The convolutional checkpoint is incomplete or invalid.');
	let cursor = 0;
	const take = (count: number) => {
		const out = packed.slice(cursor, cursor + count);
		cursor += count;
		return out;
	};
	const kernels: Float32Array[] = [],
		biases: Float32Array[] = [];
	for (const shape of CONV_SHAPES) {
		kernels.push(take(shape.output * shape.input * 9));
		biases.push(take(shape.output));
	}
	return { kernels, biases, head: take(384 * 10), headBias: take(10) };
}

export function seededConvWeights(seed = 37): Float32Array {
	let state = seed >>> 0;
	const random = () => {
		state = (Math.imul(1664525, state) + 1013904223) >>> 0;
		return state / 4294967296;
	};
	const packed = new Float32Array(CONV_PARAMETERS);
	let cursor = 0;
	for (const shape of [...CONV_SHAPES, { input: 384, output: 10, side: 1 }]) {
		const fanIn = shape.input * (shape.side === 1 ? 1 : 9);
		const limit = Math.sqrt(6 / fanIn);
		for (let n = 0; n < fanIn * shape.output; n++) packed[cursor++] = (random() * 2 - 1) * limit;
		cursor += shape.output;
	}
	return packed;
}

/** Cross-correlation with 3×3 learned kernels, stride 2, one zero-pad, then ReLU. */
export function conv2dRelu(
	input: Float32Array,
	inputSide: number,
	inputChannels: number,
	kernel: Float32Array,
	bias: Float32Array
): Float32Array {
	const side = Math.ceil(inputSide / 2),
		area = side * side,
		inputArea = inputSide * inputSide;
	const output = new Float32Array(bias.length * area);
	for (let channel = 0; channel < bias.length; channel++) {
		for (let y = 0; y < side; y++)
			for (let x = 0; x < side; x++) {
				let value = bias[channel];
				for (let source = 0; source < inputChannels; source++) {
					const kernelOffset = (channel * inputChannels + source) * 9;
					for (let ky = 0; ky < 3; ky++) {
						const iy = y * 2 + ky - 1;
						if (iy < 0 || iy >= inputSide) continue;
						for (let kx = 0; kx < 3; kx++) {
							const ix = x * 2 + kx - 1;
							if (ix >= 0 && ix < inputSide)
								value +=
									input[source * inputArea + iy * inputSide + ix] *
									kernel[kernelOffset + ky * 3 + kx];
						}
					}
				}
				output[channel * area + y * side + x] = Math.max(0, value);
			}
	}
	return output;
}

export function softmaxConv(logits: Float32Array): Float32Array {
	const max = Math.max(...logits);
	const values = Float32Array.from(logits, (value) => Math.exp(value - max));
	const sum = values.reduce((a, b) => a + b, 0);
	return values.map((value) => value / sum);
}

export function traceConv(
	weights: ConvWeights,
	pixels: Float32Array,
	ablation?: ConvAblation
): ConvTrace {
	if (pixels.length !== 784) throw new Error('A convolutional input must contain 28×28 pixels.');
	let input = pixels,
		side = 28;
	const maps: Float32Array[] = [];
	for (let layer = 0; layer < CONV_SHAPES.length; layer++) {
		const shape = CONV_SHAPES[layer];
		input = conv2dRelu(input, side, shape.input, weights.kernels[layer], weights.biases[layer]);
		if (ablation?.layer === layer)
			input.fill(0, ablation.channel * shape.side ** 2, (ablation.channel + 1) * shape.side ** 2);
		maps.push(input);
		side = shape.side;
	}
	const logits = new Float32Array(10);
	for (let label = 0; label < 10; label++) {
		let sum = weights.headBias[label];
		for (let i = 0; i < 384; i++) sum += input[i] * weights.head[label * 384 + i];
		logits[label] = sum;
	}
	const probabilities = softmaxConv(logits);
	return {
		maps,
		logits,
		probabilities,
		prediction: probabilities.indexOf(Math.max(...probabilities))
	};
}

export function convMap(trace: ConvTrace, layer: number, channel: number): Float32Array {
	const area = CONV_SHAPES[layer].side ** 2;
	return trace.maps[layer].subarray(channel * area, (channel + 1) * area);
}

export function convFilter(
	weights: ConvWeights,
	layer: number,
	channel: number,
	sourceChannel: number
): Float32Array {
	const offset = (channel * CONV_SHAPES[layer].input + sourceChannel) * 9;
	return weights.kernels[layer].subarray(offset, offset + 9);
}

/** Exact support in original input coordinates, before clipping padded borders. */
export function convReceptiveField(layer: number, x: number, y: number) {
	const stride = 2 ** (layer + 1),
		size = 2 ** (layer + 2) - 1,
		radius = (size - 1) / 2;
	const left = x * stride - radius,
		top = y * stride - radius;
	return {
		size,
		left,
		top,
		right: left + size,
		bottom: top + size,
		centerX: x * stride,
		centerY: y * stride
	};
}

export function evaluateConv(
	weights: ConvWeights,
	pixels: Float32Array,
	labels: Int32Array,
	start: number,
	count: number
): ConvMetric {
	const end = Math.min(start + count, labels.length);
	let correct = 0,
		loss = 0;
	for (let i = start; i < end; i++) {
		const result = traceConv(weights, pixels.subarray(i * 784, (i + 1) * 784));
		correct += Number(result.prediction === labels[i]);
		loss -= Math.log(Math.max(1e-10, result.probabilities[labels[i]]));
	}
	return { accuracy: correct / (end - start), loss: loss / (end - start), count: end - start };
}
