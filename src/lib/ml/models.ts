export type Sample = { x: number[]; y: number; split: 'train' | 'validation' | 'test' };
export type LabKind =
	'regression' | 'classification' | 'forecast' | 'neural-classifier' | 'neural-regression';
export function random(seed = 42) {
	return () => {
		seed |= 0;
		seed = (seed + 0x6d2b79f5) | 0;
		let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
		t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}
export const sigmoid = (x: number) => 1 / (1 + Math.exp(-Math.max(-35, Math.min(35, x))));
export function dataset(kind: LabKind, seed = 42, noise = 0.12): Sample[] {
	const r = random(seed);
	return Array.from({ length: kind === 'forecast' ? 120 : 160 }, (_, i) => {
		const split = (i % 5 < 3 ? 'train' : i % 5 === 3 ? 'validation' : 'test') as Sample['split'];
		const x = r() * 1.8 - 0.9;
		if (kind === 'regression' || kind === 'neural-regression')
			return {
				x: [x],
				y:
					(kind === 'regression' ? 0.65 * x + 0.12 : Math.sin(x * 3.8) * 0.7) +
					(r() - 0.5) * noise * 2,
				split
			};
		if (kind === 'forecast') {
			const t = i / 119;
			return {
				x: [t * 2 - 1, Math.sin(t * 8 * Math.PI), Math.cos(t * 8 * Math.PI)],
				y: -0.5 + t * 0.8 + Math.sin(t * 8 * Math.PI) * 0.28 + (r() - 0.5) * noise,
				split: i < 84 ? 'train' : i < 102 ? 'validation' : 'test'
			};
		}
		if (kind === 'neural-classifier') {
			const label = i % 2;
			const angle = r() * Math.PI * 2;
			const radius = (label ? 0.7 : 0.26) + (r() - 0.5) * noise * 2;
			return { x: [Math.cos(angle) * radius, Math.sin(angle) * radius], y: label, split };
		}
		const y = r() * 1.8 - 0.9;
		return { x: [x, y], y: x * 0.65 + y + (r() - 0.5) * noise * 2 > 0.08 ? 1 : 0, split };
	});
}

/** Small dense network. Batch backpropagation and Adam; no simulated metrics. */
export class Network {
	weights: number[][][];
	biases: number[][];
	private mw: number[][][];
	private vw: number[][][];
	private mb: number[][];
	private vb: number[][];
	step = 0;
	constructor(
		public sizes: number[],
		public classification = false,
		seed = 7
	) {
		const r = random(seed);
		this.weights = sizes
			.slice(1)
			.map((size, l) =>
				Array.from({ length: size }, () =>
					Array.from({ length: sizes[l] }, () => (r() * 2 - 1) * Math.sqrt(6 / (sizes[l] + size)))
				)
			);
		this.biases = sizes.slice(1).map((size) => Array(size).fill(0));
		this.mw = this.weights.map((layer) => layer.map((row) => row.map(() => 0)));
		this.vw = this.weights.map((layer) => layer.map((row) => row.map(() => 0)));
		this.mb = this.biases.map((row) => row.map(() => 0));
		this.vb = this.biases.map((row) => row.map(() => 0));
	}
	activations(input: number[]) {
		const a = [input];
		for (let l = 0; l < this.weights.length; l++)
			a.push(
				this.weights[l].map((row, j) => {
					const z = row.reduce((sum, w, k) => sum + w * a[l][k], this.biases[l][j]);
					return l === this.weights.length - 1
						? this.classification
							? sigmoid(z)
							: z
						: Math.tanh(z);
				})
			);
		return a;
	}
	predict(input: number[]) {
		return this.activations(input).at(-1)![0];
	}
	train(data: Sample[], learningRate = 0.015) {
		if (!data.length) return;
		const gw = this.weights.map((layer) => layer.map((row) => row.map(() => 0)));
		const gb = this.biases.map((row) => row.map(() => 0));
		for (const sample of data) {
			const a = this.activations(sample.x);
			let delta = [(a.at(-1)![0] - sample.y) * (this.classification ? 1 : 2)];
			for (let l = this.weights.length - 1; l >= 0; l--) {
				for (let j = 0; j < delta.length; j++) {
					gb[l][j] += delta[j] / data.length;
					for (let k = 0; k < a[l].length; k++) gw[l][j][k] += (delta[j] * a[l][k]) / data.length;
				}
				if (l > 0)
					delta = a[l].map(
						(value, k) =>
							this.weights[l].reduce((sum, row, j) => sum + row[k] * delta[j], 0) *
							(1 - value * value)
					);
			}
		}
		this.step++;
		const update = (gradient: number, m: number, v: number) => {
			const nextM = 0.9 * m + 0.1 * gradient;
			const nextV = 0.999 * v + 0.001 * gradient * gradient;
			return [
				nextM,
				nextV,
				(learningRate * (nextM / (1 - 0.9 ** this.step))) /
					(Math.sqrt(nextV / (1 - 0.999 ** this.step)) + 1e-8)
			];
		};
		for (let l = 0; l < this.weights.length; l++)
			for (let j = 0; j < this.weights[l].length; j++) {
				const b = update(gb[l][j], this.mb[l][j], this.vb[l][j]);
				this.mb[l][j] = b[0];
				this.vb[l][j] = b[1];
				this.biases[l][j] -= b[2];
				for (let k = 0; k < this.weights[l][j].length; k++) {
					const w = update(gw[l][j][k], this.mw[l][j][k], this.vw[l][j][k]);
					this.mw[l][j][k] = w[0];
					this.vw[l][j][k] = w[1];
					this.weights[l][j][k] -= w[2];
				}
			}
	}
	loss(data: Sample[]) {
		return (
			data.reduce((sum, s) => {
				const p = this.predict(s.x);
				return (
					sum +
					(this.classification
						? -s.y * Math.log(Math.max(1e-9, p)) - (1 - s.y) * Math.log(Math.max(1e-9, 1 - p))
						: (p - s.y) ** 2)
				);
			}, 0) / data.length
		);
	}
	accuracy(data: Sample[]) {
		return data.filter((s) => (this.predict(s.x) >= 0.5 ? 1 : 0) === s.y).length / data.length;
	}
}
