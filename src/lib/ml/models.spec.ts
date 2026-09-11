import { describe, expect, it } from 'vitest';
import { dataset, Network, type LabKind } from './models';
import { fitPolynomial, makeCurveData, polynomialLoss } from './polynomial';

function trainModel(kind: LabKind, sizes: number[], epochs = 600) {
	const data = dataset(kind);
	const model = new Network(sizes, kind === 'classification' || kind === 'neural-classifier', 49);
	const training = data.filter((p) => p.split === 'train');
	const initial = model.loss(training);
	for (let i = 0; i < epochs; i++) model.train(training);
	return {
		model,
		initial,
		training,
		validation: data.filter((p) => p.split === 'validation'),
		test: data.filter((p) => p.split === 'test')
	};
}

describe('the learning labs use working models', () => {
	it('learns a linear relationship and generalizes to held-out samples', () => {
		const { model, initial, training, test } = trainModel('regression', [1, 1]);
		expect(model.loss(training)).toBeLessThan(initial / 10);
		expect(model.loss(test)).toBeLessThan(0.01);
		expect(model.weights[0][0][0]).toBeCloseTo(0.65, 1);
	});
	it('learns a two-feature classifier', () => {
		const { model, test } = trainModel('classification', [2, 1]);
		// Boundary-adjacent examples include label noise; the default learning rate is deliberately moderate.
		expect(model.accuracy(test)).toBeGreaterThan(0.85);
		expect(model.loss(test)).toBeLessThan(0.3);
		expect(model.predict([-0.8, -0.8])).toBeLessThan(0.1);
		expect(model.predict([0.8, 0.8])).toBeGreaterThan(0.9);
	});
	it('a nonlinear network solves a ring that a linear model cannot', () => {
		const linear = trainModel('neural-classifier', [2, 1]);
		const deep = trainModel('neural-classifier', [2, 12, 12, 1]);
		expect(deep.model.accuracy(deep.test)).toBeGreaterThan(0.95);
		expect(deep.model.accuracy(deep.test)).toBeGreaterThan(
			linear.model.accuracy(linear.test) + 0.2
		);
	});
	it('the second neural network learns a curved continuous target', () => {
		const { model, initial, test } = trainModel('neural-regression', [1, 12, 12, 1]);
		expect(model.loss(test)).toBeLessThan(0.015);
		expect(model.loss(test)).toBeLessThan(initial / 5);
	});
	it('learns trend and seasonality using only the past', () => {
		const { model, training, validation, test } = trainModel('forecast', [3, 1]);
		expect(Math.max(...training.map((p) => p.x[0]))).toBeLessThan(
			Math.min(...validation.map((p) => p.x[0]))
		);
		expect(Math.max(...validation.map((p) => p.x[0]))).toBeLessThan(
			Math.min(...test.map((p) => p.x[0]))
		);
		expect(model.loss(test)).toBeLessThan(0.005);
	});
	it('keeps model updates finite across exposed learning rates', () => {
		for (const rate of [0.003, 0.015, 0.05]) {
			const model = new Network([2, 12, 12, 1], true);
			const training = dataset('neural-classifier').filter((p) => p.split === 'train');
			for (let i = 0; i < 80; i++) model.train(training, rate);
			expect(Number.isFinite(model.loss(training))).toBe(true);
		}
	});
});

describe('the generalization experiment', () => {
	it('fits training points more closely without promising better validation', () => {
		const data = makeCurveData();
		const train = data.filter((p) => p.split === 'train');
		const validation = data.filter((p) => p.split === 'validation');
		const simple = fitPolynomial(train, 1);
		const balanced = fitPolynomial(train, 3);
		const flexible = fitPolynomial(train, 12);
		expect(polynomialLoss(flexible, train)).toBeLessThan(polynomialLoss(balanced, train));
		expect(polynomialLoss(balanced, validation)).toBeLessThan(polynomialLoss(simple, validation));
		expect(polynomialLoss(balanced, validation)).toBeLessThan(polynomialLoss(flexible, validation));
	});
	it('uses stable synthetic data and disjoint splits', () => {
		expect(dataset('classification', 42)).toEqual(dataset('classification', 42));
		expect(dataset('classification', 43)).not.toEqual(dataset('classification', 42));
		const data = dataset('classification');
		expect(data.filter((p) => p.split === 'train')).toHaveLength(96);
		expect(data.filter((p) => p.split === 'validation')).toHaveLength(32);
		expect(data.filter((p) => p.split === 'test')).toHaveLength(32);
	});
});

describe('visible overfitting controls', () => {
	it('adds training examples without changing either held-out set', () => {
		const small = makeCurveData(6, 18),
			large = makeCurveData(6, 100);
		expect(large.filter((p) => p.split !== 'train')).toEqual(
			small.filter((p) => p.split !== 'train')
		);
		expect(large.filter((p) => p.split === 'train')).toHaveLength(100);
	});
	it('regularization improves the unstable flexible fit on the teaching dataset', () => {
		const data = makeCurveData(6),
			training = data.filter((p) => p.split === 'train'),
			validation = data.filter((p) => p.split === 'validation');
		const free = fitPolynomial(training, 12),
			regularized = fitPolynomial(training, 12, 0.03);
		expect(polynomialLoss(regularized, validation)).toBeLessThan(polynomialLoss(free, validation));
		expect(polynomialLoss(regularized, training)).toBeGreaterThan(polynomialLoss(free, training));
	});
});
