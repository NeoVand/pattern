import { random } from './models';
export type Datum = { x: number; y: number; split: 'train' | 'validation' | 'test' };
export function makeCurveData(seed = 18, trainingCount = 18): Datum[] {
	const r = random(seed);
	return Array.from({ length: 60 + Math.max(0, trainingCount - 18) }, (_, i) => {
		const x = r() * 1.9 - 0.95;
		return {
			x,
			y: 0.65 * Math.sin(x * 3) + (r() - 0.5) * 0.44,
			split: i < 18 || i >= 60 ? 'train' : i < 39 ? 'validation' : 'test'
		};
	});
}
export function fitPolynomial(data: Datum[], degree: number, regularization = 1e-7) {
	const n = degree + 1;
	const a = Array.from({ length: n }, (_, i) =>
		Array.from({ length: n + 1 }, (_, j) =>
			j === n
				? data.reduce((sum, p) => sum + p.y * p.x ** i, 0)
				: data.reduce((sum, p) => sum + p.x ** (i + j), 0) +
					(i === j ? Math.max(1e-9, regularization) : 0)
		)
	);
	for (let col = 0; col < n; col++) {
		let pivot = col;
		for (let row = col + 1; row < n; row++)
			if (Math.abs(a[row][col]) > Math.abs(a[pivot][col])) pivot = row;
		[a[col], a[pivot]] = [a[pivot], a[col]];
		const divisor = a[col][col];
		for (let j = col; j <= n; j++) a[col][j] /= divisor;
		for (let row = 0; row < n; row++)
			if (row !== col) {
				const factor = a[row][col];
				for (let j = col; j <= n; j++) a[row][j] -= factor * a[col][j];
			}
	}
	return a.map((row) => row[n]);
}
export function polynomialPredict(coefficients: number[], x: number) {
	return coefficients.reduceRight((value, coefficient) => value * x + coefficient, 0);
}
export function polynomialLoss(coefficients: number[], data: Datum[]) {
	return (
		data.reduce((sum, p) => sum + (polynomialPredict(coefficients, p.x) - p.y) ** 2, 0) /
		data.length
	);
}
