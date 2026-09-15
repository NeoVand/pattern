import { random } from './models';
import { fitPolynomial, polynomialLoss, polynomialPredict, type Datum } from './polynomial';

export type CurveSettings = { count: number; degree: number; penalty: number; seed: number };
export function challengeData(count: number, seed: number) {
	const make = (n: number, split: Datum['split'], offset: number) => {
		const rng = random(seed + offset);
		return Array.from({ length: n }, () => {
			const x = rng() * 2 - 1;
			return { x, y: 0.65 * Math.sin(3 * x) + (rng() - 0.5) * 0.6, split };
		});
	};
	return {
		train: make(count, 'train', 0),
		validation: make(30, 'validation', 1000),
		test: make(200, 'test', 2000)
	};
}
export function fitChallenge(settings: CurveSettings) {
	const data = challengeData(settings.count, settings.seed);
	const weights = fitPolynomial(data.train, settings.degree, settings.penalty * settings.count);
	return {
		data,
		weights,
		predict: (x: number) => polynomialPredict(weights, x),
		training: polynomialLoss(weights, data.train),
		validation: polynomialLoss(weights, data.validation),
		test: polynomialLoss(weights, data.test)
	};
}

export function repeatChallenge(settings: CurveSettings, repeats = 20) {
	return Array.from({ length: repeats }, (_, i) =>
		fitChallenge({ ...settings, seed: settings.seed + 37 * (i + 1) })
	);
}
