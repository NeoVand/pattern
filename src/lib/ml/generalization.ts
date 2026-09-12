import { fitPolynomial, polynomialPredict, type Datum } from './polynomial';
import { random } from './models';

export const underlyingPattern = (x: number) => 0.8 - 1.4 * x * x;
/** A deliberately difficult, reproducible noise realization, not a claim about all data. */
export function generalizationData(noise = 1, seed = 6): Datum[] {
	const rng = random(seed);
	const train: Datum[] = Array.from({ length: 11 }, (_, i) => {
		const x = -1 + i / 5;
		return {
			x,
			y: underlyingPattern(x) + noise * (0.15 * (i % 2 ? 1 : -1) + 0.05 * (rng() - 0.5)),
			split: 'train'
		};
	});
	const heldout = (split: 'validation' | 'test', offset: number): Datum[] =>
		Array.from({ length: 20 }, (_, i) => {
			const x = -0.975 + i / 10 + offset;
			return { x, y: underlyingPattern(x) + noise * 0.35 * (rng() - 0.5), split };
		});
	return [...train, ...heldout('validation', 0), ...heldout('test', 0.04)];
}
/** Barycentric polynomial interpolation is stable and exact at each training abscissa. */
export function interpolateTraining(data: readonly Datum[]) {
	const weights = data.map(
		(p, i) => 1 / data.reduce((v, q, j) => (i === j ? v : v * (p.x - q.x)), 1)
	);
	return (x: number) => {
		let numerator = 0,
			denominator = 0;
		for (let i = 0; i < data.length; i++) {
			if (Math.abs(x - data[i].x) < 1e-12) return data[i].y;
			const w = weights[i] / (x - data[i].x);
			numerator += w * data[i].y;
			denominator += w;
		}
		return numerator / denominator;
	};
}
export function generalizationModels(data: Datum[]) {
	const train = data.filter((p) => p.split === 'train');
	return [1, 2, 10].map((degree) => {
		const coefficients = degree < 10 ? fitPolynomial(train, degree) : [];
		const predict =
			degree === 10
				? interpolateTraining(train)
				: (x: number) => polynomialPredict(coefficients, x);
		const error = (split: Datum['split']) => {
			const samples = data.filter((p) => p.split === split);
			return samples.reduce((sum, p) => sum + (predict(p.x) - p.y) ** 2, 0) / samples.length;
		};
		return {
			degree,
			predict,
			train: error('train'),
			validation: error('validation'),
			test: error('test')
		};
	});
}
