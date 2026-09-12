import { expect, test } from 'vitest';
import { MnistAutoencoder, interpolateCode, closestCodes, pixelError } from './autoencoder';

test('GELU variational gradients match finite differences through means, log variances and decoder', () => {
	const model = new MnistAutoencoder([4, 3, 2, 3, 4], 11);
	const inputs = [
		[0.2, 0.7, 0.1, 0.8],
		[0.9, 0.3, 0.6, 0.05]
	];
	const noise: [number, number][] = [
		[-0.4, 0.7],
		[0.2, -0.8]
	];
	const gradients = model.gradients(inputs, noise);
	for (const key of ['weights', 'biases'] as const)
		for (let layer = 0; layer < 4; layer++) {
			const index = Math.floor(model[key][layer].length / 2),
				original = model[key][layer][index],
				epsilon = 1e-5;
			model[key][layer][index] = original + epsilon;
			const plus = model.objective(inputs, noise);
			model[key][layer][index] = original - epsilon;
			const minus = model.objective(inputs, noise);
			model[key][layer][index] = original;
			expect(gradients[key][layer][index]).toBeCloseTo((plus - minus) / (2 * epsilon), 7);
		}
});
test('the decoder consumes exactly two encoder values and packed weights reproduce predictions', () => {
	const model = new MnistAutoencoder([4, 3, 2, 3, 4], 11),
		input = [0.2, 0.7, 0.1, 0.8];
	const encoded = model.encode(input);
	expect(encoded).toHaveLength(2);
	expect([...model.reconstruct(input)]).toEqual([...model.decode(encoded)]);
	for (let i = 0; i < 50; i++) model.train([input]);
	const saved = model.pack(),
		restored = new MnistAutoencoder([4, 3, 2, 3, 4], 90);
	restored.load(saved);
	expect(restored.loss([input])).toBeCloseTo(model.loss([input]), 6);
	const before = restored.pack();
	restored.encode(input);
	restored.decode([-1, 2]);
	restored.loss([input]);
	expect(restored.pack()).toEqual(before);
	expect(() => restored.load(new Float32Array(3))).toThrow('Invalid');
});
test('latent interpolation and nearest-example distances use actual coordinates', () => {
	const a: [number, number] = [-2, 3],
		b: [number, number] = [4, -1];
	expect(interpolateCode(a, b, 0)).toEqual(a);
	expect(interpolateCode(a, b, 1)).toEqual(b);
	expect(interpolateCode(a, b, 0.5)).toEqual([1, 1]);
	expect(closestCodes([a, b, [1, 1]], [0.9, 1], 2).map((v) => v.index)).toEqual([2, 0]);
	expect(pixelError([0, 1], [0.5, 0.5])).toBe(0.25);
});

test('architecture inspection exposes every neuron and the actual chosen-point decoder without changing weights', () => {
	const model = new MnistAutoencoder();
	const input = new Float32Array(784).fill(0.2);
	const code: [number, number] = [0.7, -0.4];
	const saved = model.weights.map((w) => w.slice());
	const trace = model.inspect(input, code);
	expect(trace.encoder.map((x) => x.length)).toEqual([128, 32, 4]);
	expect(trace.decoder.map((x) => x.length)).toEqual([32, 128, 784]);
	expect(Array.from(trace.encoder[2].slice(0, 2))).toEqual(model.encode(input));
	expect(trace.decoder[2]).toEqual(model.decode(code));
	expect(model.weights).toEqual(saved);
});
