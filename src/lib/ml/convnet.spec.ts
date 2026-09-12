import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
	conv2dRelu,
	convMap,
	convReceptiveField,
	traceConv,
	unpackConvWeights,
	seededConvWeights,
	CONV_PARAMETERS
} from './convnet';
const bytes = readFileSync('static/data/fashion-convnet.f32');
const packed = new Float32Array(
	bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
);
const meta = JSON.parse(readFileSync('static/data/fashion-convnet.json', 'utf8'));
const weights = unpackConvWeights(packed);
const pixels = new Float32Array(meta.reference.pixels);

describe('Fashion-MNIST convolutional model', () => {
	it('matches independently exported PyTorch activations and logits, including padding and flatten order', () => {
		const trace = traceConv(weights, pixels);
		for (let layer = 0; layer < 3; layer++) {
			expect(trace.maps[layer].length).toBe(meta.reference.activations[layer].length);
			expect(
				Math.max(
					...trace.maps[layer].map((v, i) => Math.abs(v - meta.reference.activations[layer][i]))
				)
			).toBeLessThan(0.00004);
		}
		expect(
			Math.max(...trace.logits.map((v, i) => Math.abs(v - meta.reference.logits[i])))
		).toBeLessThan(0.0001);
		expect(trace.prediction).toBe(meta.reference.label);
		expect(trace.probabilities.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 6);
	});
	it('keeps a verifiable checkpoint and disjoint documented splits', () => {
		expect(packed.length).toBe(CONV_PARAMETERS);
		expect(createHash('sha256').update(bytes).digest('hex')).toBe(meta.sha256);
		expect(meta.trainingImages + meta.validationImages).toBe(12000);
		expect(meta.test.count).toBe(2000);
		expect(meta.test.accuracy).toBeGreaterThan(0.85);
	});
	it('uses learned cross-correlation, zero padding and ReLU', () => {
		const input = Float32Array.from([1, 2, 3, 4, 5, 6, 7, 8, 9]);
		const kernel = Float32Array.from([0, 0, 0, 0, 1, 0, 0, 0, 0]);
		expect(Array.from(conv2dRelu(input, 3, 1, kernel, new Float32Array([-2])))).toEqual([
			0, 1, 5, 7
		]);
	});
	it('mutes a real feature without modifying the checkpoint or earlier activations', () => {
		const normal = traceConv(weights, pixels),
			muted = traceConv(weights, pixels, { layer: 1, channel: 3 });
		expect(muted.maps[0]).toEqual(normal.maps[0]);
		expect(convMap(muted, 1, 3).every((x) => x === 0)).toBe(true);
		expect(muted.logits).not.toEqual(normal.logits);
		expect(traceConv(weights, pixels).logits).toEqual(normal.logits);
	});
	it('tracks exact receptive fields through all three strided layers', () => {
		expect(convReceptiveField(0, 4, 4)).toMatchObject({ size: 3, left: 7, top: 7, right: 10 });
		expect(convReceptiveField(1, 2, 2)).toMatchObject({ size: 7, left: 5, top: 5, right: 12 });
		expect(convReceptiveField(2, 1, 1)).toMatchObject({ size: 15, left: 1, top: 1, right: 16 });
	});
	it('starts an untrained model deterministically and rejects broken checkpoints', () => {
		expect(seededConvWeights()).toEqual(seededConvWeights());
		expect(unpackConvWeights(seededConvWeights()).head.length).toBe(3840);
		expect(() => unpackConvWeights(new Float32Array(40))).toThrow();
		expect(() => traceConv(weights, new Float32Array(14 * 14))).toThrow();
	});
});
