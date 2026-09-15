export type TinyWeights = { w: number; b: number; v: number; c: number };
export type WeightName = keyof TinyWeights;
export type TinyExample = { x: number; y: number };
export const WEIGHT_NAMES: WeightName[] = ['w', 'b', 'v', 'c'];
export const INITIAL_TINY_WEIGHTS: TinyWeights = { w: 0.4, b: 0.1, v: -0.6, c: 0.2 };
export const TINY_EXAMPLES: TinyExample[] = [-1, -2 / 3, -1 / 3, 0, 1 / 3, 2 / 3, 1].map((x) => ({
	x,
	y: 0.8 * Math.tanh(1.4 * x - 0.2) + 0.1
}));

/** A scalar, one-hidden-neuron network. Loss is squared error, without a 1/2 factor. */
export function traceTiny(weights: TinyWeights, example: TinyExample) {
	const z = weights.w * example.x + weights.b;
	const h = Math.tanh(z);
	const prediction = weights.v * h + weights.c;
	const residual = prediction - example.y;
	const loss = residual ** 2;
	const outputSlope = 2 * residual;
	const activationSlope = 1 - h ** 2;
	const hiddenSlope = outputSlope * weights.v * activationSlope;
	const gradients: TinyWeights = {
		w: hiddenSlope * example.x,
		b: hiddenSlope,
		v: outputSlope * h,
		c: outputSlope
	};
	return { z, h, prediction, residual, loss, outputSlope, activationSlope, gradients };
}

export function updateTiny(weights: TinyWeights, example: TinyExample, rate: number): TinyWeights {
	const { gradients } = traceTiny(weights, example);
	return Object.fromEntries(
		WEIGHT_NAMES.map((key) => [key, weights[key] - rate * gradients[key]])
	) as TinyWeights;
}

export function finiteDifferenceTiny(
	weights: TinyWeights,
	example: TinyExample,
	key: WeightName,
	epsilon = 0.00001
) {
	return (
		(traceTiny({ ...weights, [key]: weights[key] + epsilon }, example).loss -
			traceTiny({ ...weights, [key]: weights[key] - epsilon }, example).loss) /
		(2 * epsilon)
	);
}

export function tinyMeanLoss(weights: TinyWeights) {
	return (
		TINY_EXAMPLES.reduce((sum, example) => sum + traceTiny(weights, example).loss, 0) /
		TINY_EXAMPLES.length
	);
}
