import { numpy as np, nn, lax, jit, valueAndGrad, tree, type Array as JaxArray } from '@jax-js/jax';
import { CONV_SHAPES, unpackConvWeights } from './convnet';

export type ConvJaxParams = {
	kernels: JaxArray[];
	biases: JaxArray[];
	head: JaxArray;
	headBias: JaxArray;
};
export function loadConvJax(packed: Float32Array): ConvJaxParams {
	const weights = unpackConvWeights(packed);
	return {
		kernels: weights.kernels.map((kernel, layer) =>
			np
				.array(new Float32Array(kernel))
				.reshape([CONV_SHAPES[layer].output, CONV_SHAPES[layer].input, 3, 3])
		),
		biases: weights.biases.map((bias) => np.array(new Float32Array(bias))),
		head: np.array(new Float32Array(weights.head)).reshape([10, 384]),
		headBias: np.array(new Float32Array(weights.headBias))
	};
}

/** Consumes one reference to every parameter and the input. */
export function convJaxForward(params: ConvJaxParams, input: JaxArray): JaxArray {
	const batch = input.shape[0];
	let h = input;
	for (let layer = 0; layer < CONV_SHAPES.length; layer++) {
		h = nn.relu(
			lax
				.conv(
					h,
					params.kernels[layer],
					[2, 2],
					[
						[1, 1],
						[1, 1]
					]
				)
				.add(params.biases[layer].reshape([1, CONV_SHAPES[layer].output, 1, 1]))
		);
	}
	return np.dot(h.reshape([batch, 384]), np.transpose(params.head)).add(params.headBias);
}
export const convJaxPredict = jit(convJaxForward);
export const convJaxGrad = jit((params: ConvJaxParams, input: JaxArray, labels: JaxArray) =>
	valueAndGrad((p: ConvJaxParams) =>
		np.mean(np.sum(nn.logSoftmax(convJaxForward(p, input), -1).mul(labels), -1).neg())
	)(params)
);

export async function packConvJax(params: ConvJaxParams): Promise<Float32Array> {
	const leaves = [
		...params.kernels.flatMap((kernel, layer) => [kernel, params.biases[layer]]),
		params.head,
		params.headBias
	];
	const buffers = await Promise.all(
		leaves.map(async (leaf) => new Float32Array(await leaf.ref.data()))
	);
	const output = new Float32Array(buffers.reduce((sum, array) => sum + array.length, 0));
	let cursor = 0;
	for (const values of buffers) {
		output.set(values, cursor);
		cursor += values.length;
	}
	return output;
}
export class ConvJaxTrainer {
	params: ConvJaxParams;
	private first: ConvJaxParams;
	private second: ConvJaxParams;
	private steps = 0;
	// A fused Adam update avoids Optax's synchronous scalar GPU reads.
	private update = jit(
		(
			params: ConvJaxParams,
			first: ConvJaxParams,
			second: ConvJaxParams,
			x: JaxArray,
			y: JaxArray,
			c1: JaxArray,
			c2: JaxArray
		) => {
			const [loss, gradients] = convJaxGrad(tree.ref(params), x, y);
			const m = tree.map(
				(g: JaxArray, old: JaxArray) => g.mul(0.1).add(old.mul(0.9)),
				tree.ref(gradients),
				first
			) as unknown as ConvJaxParams;
			const v = tree.map(
				(g: JaxArray, old: JaxArray) => np.square(g).mul(0.001).add(old.mul(0.999)),
				gradients,
				second
			) as unknown as ConvJaxParams;
			const next = tree.map(
				(w: JaxArray, mu: JaxArray, nu: JaxArray) =>
					w.sub(
						mu
							.div(c1.ref)
							.mul(0.0006)
							.div(np.sqrt(nu.div(c2.ref)).add(1e-8))
					),
				params,
				tree.ref(m),
				tree.ref(v)
			) as unknown as ConvJaxParams;
			c1.dispose();
			c2.dispose();
			return { params: next, first: m, second: v, loss };
		}
	);
	constructor(packed: Float32Array) {
		this.params = loadConvJax(packed);
		this.first = tree.map(
			(leaf: JaxArray) => np.zerosLike(leaf),
			tree.ref(this.params)
		) as unknown as ConvJaxParams;
		this.second = tree.map(
			(leaf: JaxArray) => np.zerosLike(leaf),
			tree.ref(this.params)
		) as unknown as ConvJaxParams;
	}
	async step(input: Float32Array, labels: Float32Array): Promise<number> {
		const x = np.array(new Float32Array(input)).reshape([input.length / 784, 1, 28, 28]);
		const y = np.array(new Float32Array(labels)).reshape([input.length / 784, 10]);
		const out = this.update(
			this.params,
			this.first,
			this.second,
			x,
			y,
			np.array(1 - 0.9 ** (this.steps + 1)),
			np.array(1 - 0.999 ** (this.steps + 1))
		);
		this.params = out.params;
		this.first = out.first;
		this.second = out.second;
		this.steps++;
		return (await out.loss.data())[0];
	}
	async packed() {
		return packConvJax(this.params);
	}
	dispose() {
		tree.dispose(this.params);
		tree.dispose(this.first);
		tree.dispose(this.second);
		this.update.dispose();
	}
}
