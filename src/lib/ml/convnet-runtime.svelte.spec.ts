import { beforeAll, describe, expect, it } from 'vitest';
import { init, defaultDevice, numpy as np, tree } from '@jax-js/jax';
import { ConvJaxTrainer, convJaxPredict, loadConvJax } from './convnet-jax';
import { traceConv, unpackConvWeights } from './convnet';

let packed: Float32Array;
let pixels: Float32Array;
let reference: { logits: number[]; label: number };
beforeAll(async () => {
	await init('wasm');
	defaultDevice('wasm');
	packed = new Float32Array(await (await fetch('/data/fashion-convnet.f32')).arrayBuffer());
	const meta = await (await fetch('/data/fashion-convnet.json')).json();
	reference = meta.reference;
	pixels = new Float32Array(meta.reference.pixels);
});

describe('real JaxJS convolutional runtime', () => {
	it('agrees with the independent PyTorch checkpoint in browser WebAssembly', async () => {
		const params = loadConvJax(packed);
		const logits = await convJaxPredict(
			tree.ref(params),
			np.array(new Float32Array(pixels)).reshape([1, 1, 28, 28])
		).data();
		tree.dispose(params);
		expect(
			Math.max(...logits.map((value, index) => Math.abs(value - reference.logits[index])))
		).toBeLessThan(0.0001);
	});
	it('backpropagates through every convolution and preserves arrays across snapshots', async () => {
		const trainer = new ConvJaxTrainer(packed);
		const batch = new Float32Array(8 * 784),
			labels = new Float32Array(80);
		for (let i = 0; i < 8; i++) {
			batch.set(pixels, i * 784);
			labels[i * 10 + reference.label] = 1;
		}
		const before = await trainer.step(batch, labels);
		let after = before;
		for (let i = 0; i < 4; i++) after = await trainer.step(batch, labels);
		const trained = await trainer.packed();
		expect(after).toBeLessThan(before / 4);
		const old = unpackConvWeights(packed),
			updated = unpackConvWeights(trained);
		for (let layer = 0; layer < 3; layer++)
			expect(updated.kernels[layer].some((v, i) => v !== old.kernels[layer][i])).toBe(true);
		expect(trained.every(Number.isFinite)).toBe(true);
		expect(await trainer.packed()).toEqual(trained);
		expect(traceConv(updated, pixels).prediction).toBe(reference.label);
		trainer.dispose();
	});
});
