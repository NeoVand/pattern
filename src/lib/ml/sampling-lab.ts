export type DenoisingPair = { id: number; clean: number; noise: number; noisy: number };
export type ToyDenoiser = { weights: number[]; sigma: number; predict: (noisy: number) => number };

function randomFrom(seed: number) {
	let state = seed >>> 0;
	const uniform = () => {
		state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
		return (state + 0.5) / 4294967296;
	};
	return {
		uniform,
		normal: () => Math.sqrt(-2 * Math.log(uniform())) * Math.cos(2 * Math.PI * uniform())
	};
}
const CENTERS = Array.from({ length: 25 }, (_, index) => -4 + index / 3);
const basis = (x: number) => [
	1,
	...CENTERS.map((center) => Math.exp(-0.5 * ((x - center) / 0.4) ** 2))
];

/** Eight independently corrupted views per clean training value. */
export function denoisingPairs(
	seed: number,
	count: number,
	sigma: number,
	corruptions = 8
): DenoisingPair[] {
	const random = randomFrom(seed);
	return Array.from(
		{ length: count },
		() => (random.uniform() < 0.5 ? -1.25 : 1.25) + 0.18 * random.normal()
	).flatMap((clean, index) =>
		Array.from({ length: corruptions }, (_, repeat) => {
			const noise = random.normal();
			return { id: index * corruptions + repeat, clean, noise, noisy: clean + sigma * noise };
		})
	);
}

/** Pivoted elimination solves the positive-definite ridge normal equations. */
function solve(matrix: number[][], target: number[]) {
	const rows = matrix.map((row, index) => [...row, target[index]]);
	for (let column = 0; column < target.length; column++) {
		let pivot = column;
		for (let row = column + 1; row < target.length; row++)
			if (Math.abs(rows[row][column]) > Math.abs(rows[pivot][column])) pivot = row;
		[rows[column], rows[pivot]] = [rows[pivot], rows[column]];
		const scale = rows[column][column];
		if (Math.abs(scale) < 1e-12) throw new Error('The denoising fit is singular.');
		for (let entry = column; entry <= target.length; entry++) rows[column][entry] /= scale;
		for (let row = 0; row < target.length; row++) {
			if (row === column) continue;
			const factor = rows[row][column];
			for (let entry = column; entry <= target.length; entry++)
				rows[row][entry] -= factor * rows[column][entry];
		}
	}
	return rows.map((row) => row[target.length]);
}

export function fitToyDenoiser(pairs: DenoisingPair[], sigma: number): ToyDenoiser {
	const dimension = CENTERS.length + 1;
	const matrix = Array.from({ length: dimension }, () => Array(dimension).fill(0) as number[]);
	const target = Array(dimension).fill(0) as number[];
	for (const pair of pairs) {
		const features = basis(pair.noisy);
		for (let row = 0; row < dimension; row++) {
			target[row] += (features[row] * pair.clean) / pairs.length;
			for (let column = 0; column < dimension; column++)
				matrix[row][column] += (features[row] * features[column]) / pairs.length;
		}
	}
	for (let index = 0; index < dimension; index++) matrix[index][index] += 0.001;
	const weights = solve(matrix, target);
	return {
		weights,
		sigma,
		predict: (x) => basis(x).reduce((sum, value, index) => sum + value * weights[index], 0)
	};
}

export function denoisingLoss(pairs: DenoisingPair[], predict: (x: number) => number) {
	return (
		pairs.reduce((sum, pair) => sum + (predict(pair.noisy) - pair.clean) ** 2, 0) / pairs.length
	);
}

export function learnedScore(model: ToyDenoiser, x: number) {
	return (model.predict(x) - x) / model.sigma ** 2;
}

/** Unadjusted Langevin dynamics at one fixed noise level. This targets the smoothed density approximately. */
export function sampleDenoiser(
	model: ToyDenoiser,
	seed: number,
	count = 96,
	steps = 180,
	stepSize = 0.03
) {
	const random = randomFrom(seed);
	return Array.from({ length: count }, () => {
		const path = [random.normal() * 1.6];
		for (let step = 0; step < steps; step++) {
			const previous = path[path.length - 1];
			path.push(
				previous +
					0.5 * stepSize * learnedScore(model, previous) +
					Math.sqrt(stepSize) * random.normal()
			);
		}
		return path;
	});
}

/** Known density of the synthetic clean mixture after Gaussian corruption, used only as a reference. */
export function smoothedToyDensity(x: number, sigma: number) {
	const variance = 0.18 ** 2 + sigma ** 2;
	const density = (center: number) =>
		Math.exp(-((x - center) ** 2) / (2 * variance)) / Math.sqrt(2 * Math.PI * variance);
	return 0.5 * (density(-1.25) + density(1.25));
}
