/** Focused adaptation of Jaxverse's jitted MLP worker. Training and inspection
 * are fixed-shape tensor programs; only snapshots cross the worker boundary. */
import { init, defaultDevice, numpy as np, nn, jit, valueAndGrad, tree } from '@jax-js/jax';
import { MnistAutoencoder, MNIST_ARCHITECTURE, VAE_BETA } from './autoencoder';

// JaxJS's consumed-array trees have recursive runtime shapes at jit boundaries.
/* eslint-disable @typescript-eslint/no-explicit-any */
type Params = { w: any[]; b: any[] };
const widths = MNIST_ARCHITECTURE;
const dispose = (p: any) => {
	if (p) for (const leaf of tree.leaves(p) as any[]) leaf.dispose();
};
function means(p: Params, x: any) {
	let h = x;
	for (let k = 0; k < 3; k++) {
		h = np.dot(h, p.w[k]).add(p.b[k]);
		if (k < 2) h = nn.gelu(h);
	}
	// Decoder leaves were not consumed by this partial pass.
	for (let k = 3; k < 6; k++) {
		p.w[k].dispose();
		p.b[k].dispose();
	}
	const [mu, lv] = np.split(h, 2, 1);
	lv.dispose();
	return mu;
}
function forward(p: Params, x: any, eps: any | null = null): { out: any; kl: any | null } {
	let h = x,
		kl: any = null;
	for (let k = 0; k < 6; k++) {
		h = np.dot(h, p.w[k]).add(p.b[k]);
		if (k === 2) {
			const [mu, lv] = np.split(h, 2, 1);
			if (eps) {
				kl = np.mean(np.sum(np.square(mu.ref).add(np.exp(lv.ref)).sub(1).sub(lv.ref), 1)).mul(0.5);
				h = mu.add(np.exp(lv.mul(0.5)).mul(eps));
			} else {
				lv.dispose();
				h = mu;
			}
		} else if (k < 5) h = nn.gelu(h);
	}
	return { out: h, kl };
}
function objective(p: Params, x: any, eps: any) {
	const { out, kl } = forward(p, x.ref, eps);
	return np.mean(np.square(out.sub(x))).add(kl.mul(VAE_BETA));
}
export class MnistJax {
	device = '';
	step = 0;
	private params: Params | null = null;
	private first: Params | null = null;
	private second: Params | null = null;
	// Optax's Adam reads count.item() for bias correction, forcing two GPU
	// roundtrips per batch. This mathematically identical fused update keeps
	// all moments on device; only two scalar corrections enter from the CPU.
	private update = jit(
		(p: Params, first: Params, second: Params, x: any, eps: any, c1: any, c2: any) => {
			const [loss, gradients] = valueAndGrad((pp: Params) => objective(pp, x, eps))(tree.ref(p));
			const m = tree.map(
				(g: any, old: any) => g.mul(0.1).add(old.mul(0.9)),
				tree.ref(gradients),
				first
			) as Params;
			const v = tree.map(
				(g: any, old: any) => np.square(g).mul(0.01).add(old.mul(0.99)),
				gradients,
				second
			) as unknown as Params;
			const params = tree.map(
				(weight: any, mu: any, nu: any) =>
					weight.sub(
						mu
							.div(c1.ref)
							.mul(0.003)
							.div(np.sqrt(nu.div(c2.ref)).add(1e-8))
					),
				p,
				tree.ref(m),
				tree.ref(v)
			);
			c1.dispose();
			c2.dispose();
			return { params, first: m, second: v, loss };
		}
	);
	private read = jit((p: Params, train: any, test: any) => {
		const z = means(tree.ref(p), test.ref);
		const testOut = forward(tree.ref(p), test.ref).out;
		const trainOut = forward(tree.ref(p), train.ref).out;
		const trainLoss = np.mean(np.square(trainOut.sub(train)), 1);
		const testLoss = np.mean(np.square(testOut.sub(test)), 1);
		const packed: any[] = [];
		for (let k = 0; k < 6; k++) packed.push(p.w[k].transpose().reshape([-1]), p.b[k]);
		return np.concatenate([...packed, z.reshape([-1]), trainLoss, testLoss]);
	});
	async initialize(checkpoint?: Float32Array, force?: 'wasm' | 'webgpu') {
		const supported = await Promise.race([
			init(...((force ? [force] : ['webgpu', 'wasm', 'cpu']) as ('webgpu' | 'wasm' | 'cpu')[])),
			new Promise<null>((resolve) => setTimeout(() => resolve(null), 8000))
		]);
		const available = supported ?? (await init('wasm', 'cpu'));
		this.device = available.includes('webgpu')
			? 'webgpu'
			: available.includes('wasm')
				? 'wasm'
				: 'cpu';
		defaultDevice(this.device as 'webgpu' | 'wasm' | 'cpu');
		this.reset(checkpoint);
	}
	reset(checkpoint?: Float32Array) {
		dispose(this.params);
		dispose(this.first);
		dispose(this.second);
		const reference = new MnistAutoencoder();
		if (checkpoint) reference.load(checkpoint);
		this.params = { w: [], b: [] };
		for (let k = 0; k < 6; k++) {
			const fout = k === 2 ? 4 : widths[k + 1];
			this.params.w.push(
				np.array(Float32Array.from(reference.weights[k])).reshape([fout, widths[k]]).transpose()
			);
			this.params.b.push(np.array(Float32Array.from(reference.biases[k])));
		}
		this.first = tree.map(
			(leaf: any) => np.zerosLike(leaf),
			tree.ref(this.params)
		) as unknown as Params;
		this.second = tree.map(
			(leaf: any) => np.zerosLike(leaf),
			tree.ref(this.params)
		) as unknown as Params;
		this.step = 0;
	}
	async train(batch: Float32Array, noise: Float32Array, sync: boolean): Promise<number> {
		const x = np.array(batch.slice()).reshape([batch.length / 784, 784]);
		const e = np.array(noise.slice()).reshape([noise.length / 2, 2]);
		const { params, first, second, loss } = this.update(
			this.params!,
			this.first!,
			this.second!,
			x,
			e,
			np.array(1 - 0.9 ** (this.step + 1)),
			np.array(1 - 0.99 ** (this.step + 1))
		);
		this.params = params;
		this.first = first;
		this.second = second;
		this.step++;
		if (sync) return Number((await loss.data())[0]);
		loss.dispose();
		return NaN;
	}
	async snapshot(train: Float32Array, test: Float32Array) {
		const packed = (await this.read(
			tree.ref(this.params!),
			np.array(train.slice()).reshape([train.length / 784, 784]),
			np.array(test.slice()).reshape([test.length / 784, 784])
		).data()) as Float32Array;
		if (!packed.every(Number.isFinite))
			throw new Error('The training backend returned non-finite values.');
		const trainCount = train.length / 784,
			testCount = test.length / 784;
		const count = packed.length - testCount * 2 - trainCount - testCount;
		const codeEnd = count + testCount * 2;
		// Average per-image MSE in float64 JS: a single float32 reduction over
		// 1.6M pixels loses measurable precision on some WebAssembly kernels.
		return {
			weights: packed.slice(0, count),
			codes: packed.slice(count, codeEnd),
			trainLoss:
				packed.subarray(codeEnd, codeEnd + trainCount).reduce((a, b) => a + b, 0) / trainCount,
			testLoss: packed.subarray(codeEnd + trainCount).reduce((a, b) => a + b, 0) / testCount
		};
	}
	dispose() {
		dispose(this.params);
		dispose(this.first);
		dispose(this.second);
		this.params = null;
		this.first = null;
		this.second = null;
	}
}
