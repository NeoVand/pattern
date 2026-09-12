import { random } from './models';

export const AUTOENCODER_SIDE = 28;
export const AUTOENCODER_PIXELS = 784;
export const MNIST_ARCHITECTURE = [784, 128, 32, 2, 32, 128, 784] as const;
export type LatentPoint = [number, number];
export type AutoencoderGradients = { weights: Float64Array[]; biases: Float64Array[] };

export const VAE_BETA = 1 / 784;
export const VAE_FRAME = { cx: 0, cy: 0, span: 3.8 };
/** Same smooth GELU used by JaxJS, with its analytic derivative. */
export function gelu(x: number): number {
	return 0.5 * x * (1 + Math.tanh(Math.sqrt(2 / Math.PI) * (x + 0.044715 * x ** 3)));
}
export function geluDerivative(x: number): number {
	const t = Math.tanh(Math.sqrt(2 / Math.PI) * (x + 0.044715 * x ** 3));
	return (
		0.5 * (1 + t) + 0.5 * x * (1 - t * t) * Math.sqrt(2 / Math.PI) * (1 + 3 * 0.044715 * x * x)
	);
}
/** CPU reference + immediate decoder for Jaxverse-style variational training.
 * The encoder emits two means and two log variances. The map plots the means;
 * training samples their Gaussian, penalized by KL to a unit Gaussian.
 * GELU hidden layers; linear mean/log-variance and readout. Pixel display alone
 * clips the linear reconstruction to [0,1]. Labels are never accepted. */
export class MnistAutoencoder {
	readonly sizes: number[];
	readonly weights: Float64Array[];
	readonly biases: Float64Array[];
	readonly bottleneck: number;
	private readonly firstMoment: AutoencoderGradients;
	private readonly secondMoment: AutoencoderGradients;
	step = 0;

	constructor(sizes: readonly number[] = MNIST_ARCHITECTURE, seed = 7) {
		this.sizes = [...sizes];
		this.bottleneck = Math.floor(sizes.length / 2);
		if (sizes[this.bottleneck] !== 2 || sizes[0] !== sizes.at(-1))
			throw new Error('Expected a symmetric autoencoder with a two-number bottleneck.');
		const rng = random(seed);
		this.weights = sizes.slice(1).map((width, layer) => {
			const limit = Math.sqrt(6 / sizes[layer]) * (layer === sizes.length - 2 ? 0.4 : 1);
			return Float64Array.from(
				{ length: (layer === this.bottleneck - 1 ? width * 2 : width) * sizes[layer] },
				() => (rng() * 2 - 1) * limit
			);
		});
		this.biases = sizes
			.slice(1)
			.map((width, layer) => new Float64Array(layer === this.bottleneck - 1 ? width * 2 : width));
		this.firstMoment = this.emptyGradients();
		this.secondMoment = this.emptyGradients();
	}
	private emptyGradients(): AutoencoderGradients {
		return {
			weights: this.weights.map((w) => new Float64Array(w.length)),
			biases: this.biases.map((b) => new Float64Array(b.length))
		};
	}
	private layer(input: ArrayLike<number>, index: number): { pre: Float64Array; out: Float64Array } {
		const pre = new Float64Array(this.biases[index].length),
			out = new Float64Array(pre.length);
		const weights = this.weights[index],
			biases = this.biases[index];
		for (let row = 0; row < pre.length; row++) {
			let sum = biases[row];
			for (let column = 0; column < input.length; column++)
				sum += weights[row * input.length + column] * input[column];
			pre[row] = sum;
			out[row] =
				index === this.weights.length - 1 || index === this.bottleneck - 1 ? sum : gelu(sum);
		}
		return { pre, out };
	}
	/** Read-only inspection: encode a real image, then decode the chosen map coordinate. */
	inspect(input: ArrayLike<number>, code: LatentPoint) {
		let state: ArrayLike<number> = input;
		const encoder: Float64Array[] = [];
		for (let i = 0; i < this.bottleneck; i++) {
			state = this.layer(state, i).out;
			encoder.push(state as Float64Array);
		}
		state = code;
		const decoder: Float64Array[] = [];
		for (let i = this.bottleneck; i < this.weights.length; i++) {
			state = this.layer(state, i).out;
			decoder.push(state as Float64Array);
		}
		return { encoder, decoder };
	}

	encode(input: ArrayLike<number>): LatentPoint {
		let state = input;
		for (let layer = 0; layer < this.bottleneck; layer++) state = this.layer(state, layer).out;
		return [state[0], state[1]];
	}
	decode(code: LatentPoint): Float64Array {
		let state: ArrayLike<number> = code;
		for (let layer = this.bottleneck; layer < this.weights.length; layer++)
			state = this.layer(state, layer).out;
		return state as Float64Array;
	}
	reconstruct(input: ArrayLike<number>): Float64Array {
		return this.decode(this.encode(input));
	}
	loss(images: readonly ArrayLike<number>[]): number {
		return images.length
			? images.reduce((sum, input) => sum + pixelError(input, this.reconstruct(input)), 0) /
					images.length
			: 0;
	}
	private forward(input: ArrayLike<number>, noise: LatentPoint = [0, 0]) {
		const activations: ArrayLike<number>[] = [input],
			pres: Float64Array[] = [];
		let moments: Float64Array = new Float64Array(4),
			kl = 0;
		for (let k = 0; k < this.weights.length; k++) {
			const { pre, out } = this.layer(activations[k], k);
			pres.push(pre);
			if (k === this.bottleneck - 1) {
				moments = out;
				activations.push(
					Float64Array.from([0, 1], (j) => out[j] + Math.exp(out[j + 2] / 2) * noise[j])
				);
				for (let j = 0; j < 2; j++)
					kl += 0.5 * (out[j] ** 2 + Math.exp(out[j + 2]) - 1 - out[j + 2]);
			} else activations.push(out);
		}
		return { activations, pres, moments, kl };
	}
	objective(images: readonly ArrayLike<number>[], noise?: readonly LatentPoint[]): number {
		return (
			images.reduce((sum, input, i) => {
				const pass = this.forward(input, noise?.[i]);
				return sum + pixelError(input, pass.activations.at(-1)!) + VAE_BETA * pass.kl;
			}, 0) / Math.max(1, images.length)
		);
	}
	gradients(
		images: readonly ArrayLike<number>[],
		noise?: readonly LatentPoint[]
	): AutoencoderGradients {
		const gradient = this.emptyGradients();
		for (let sample = 0; sample < images.length; sample++) {
			const input = images[sample],
				eps = noise?.[sample] ?? [0, 0];
			const { activations, pres, moments } = this.forward(input, eps);
			let delta = Float64Array.from(
				activations.at(-1)!,
				(pixel, i) => (2 * (pixel - input[i])) / (input.length * images.length)
			);
			for (let layer = this.weights.length - 1; layer >= 0; layer--) {
				if (layer === this.bottleneck - 1) {
					const latentDelta = delta;
					delta = new Float64Array(4);
					for (let j = 0; j < 2; j++) {
						delta[j] = latentDelta[j] + (VAE_BETA * moments[j]) / images.length;
						delta[j + 2] =
							latentDelta[j] * eps[j] * 0.5 * Math.exp(moments[j + 2] / 2) +
							(VAE_BETA * 0.5 * (Math.exp(moments[j + 2]) - 1)) / images.length;
					}
				} else if (layer < this.weights.length - 1) {
					for (let j = 0; j < delta.length; j++) delta[j] *= geluDerivative(pres[layer][j]);
				}
				const previous = activations[layer],
					priorDelta = new Float64Array(previous.length);
				const gw = gradient.weights[layer],
					gb = gradient.biases[layer],
					w = this.weights[layer];
				for (let row = 0; row < delta.length; row++) {
					const d = delta[row],
						start = row * previous.length;
					gb[row] += d;
					for (let column = 0; column < previous.length; column++) {
						gw[start + column] += d * previous[column];
						if (layer > 0) priorDelta[column] += w[start + column] * d;
					}
				}
				delta = priorDelta;
			}
		}
		return gradient;
	}
	train(images: readonly ArrayLike<number>[], rate = 0.003, noise?: readonly LatentPoint[]): void {
		if (!images.length) return;
		const gradients = this.gradients(images, noise);
		this.step++;
		const c1 = 1 - 0.9 ** this.step,
			c2 = 1 - 0.99 ** this.step;
		for (const key of ['weights', 'biases'] as const)
			for (let layer = 0; layer < this[key].length; layer++) {
				const values = this[key][layer],
					g = gradients[key][layer],
					m = this.firstMoment[key][layer],
					v = this.secondMoment[key][layer];
				for (let i = 0; i < values.length; i++) {
					m[i] = 0.9 * m[i] + 0.1 * g[i];
					v[i] = 0.99 * v[i] + 0.01 * g[i] * g[i];
					values[i] -= (rate * (m[i] / c1)) / (Math.sqrt(v[i] / c2) + 1e-8);
				}
			}
	}
	/** Portable weights in layer order: output-major matrix, then bias. Optimizer starts fresh. */
	pack(): Float32Array {
		const packed = new Float32Array(
			this.weights.reduce((n, w, i) => n + w.length + this.biases[i].length, 0)
		);
		let offset = 0;
		for (let i = 0; i < this.weights.length; i++) {
			packed.set(this.weights[i], offset);
			offset += this.weights[i].length;
			packed.set(this.biases[i], offset);
			offset += this.biases[i].length;
		}
		return packed;
	}
	load(packed: Float32Array): void {
		const expected = this.weights.reduce((n, w, i) => n + w.length + this.biases[i].length, 0);
		if (packed.length !== expected || !packed.every(Number.isFinite))
			throw new Error('Invalid autoencoder checkpoint.');
		let offset = 0;
		for (let i = 0; i < this.weights.length; i++) {
			this.weights[i].set(packed.subarray(offset, offset + this.weights[i].length));
			offset += this.weights[i].length;
			this.biases[i].set(packed.subarray(offset, offset + this.biases[i].length));
			offset += this.biases[i].length;
		}
		for (const state of [this.firstMoment, this.secondMoment])
			for (const key of ['weights', 'biases'] as const) for (const row of state[key]) row.fill(0);
		this.step = 0;
	}
}
export function pixelError(original: ArrayLike<number>, rebuilt: ArrayLike<number>): number {
	let sum = 0;
	for (let i = 0; i < original.length; i++) sum += (original[i] - rebuilt[i]) ** 2;
	return sum / original.length;
}
export function interpolateCode(a: LatentPoint, b: LatentPoint, amount: number): LatentPoint {
	const t = Math.max(0, Math.min(1, amount));
	return [a[0] * (1 - t) + b[0] * t, a[1] * (1 - t) + b[1] * t];
}
export function closestCodes(codes: readonly LatentPoint[], point: LatentPoint, count = 3) {
	return codes
		.map((code, index) => ({ index, distance: Math.hypot(code[0] - point[0], code[1] - point[1]) }))
		.sort((a, b) => a.distance - b.distance)
		.slice(0, count);
}
