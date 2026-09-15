import { expect, test } from 'vitest';
import { challengeData, fitChallenge } from './generalization-challenge';
test('more training data preserves held-out samples and the training prefix', () => {
	const small = challengeData(12, 6),
		large = challengeData(60, 6);
	expect(large.train.slice(0, 12)).toEqual(small.train);
	expect(large.validation).toEqual(small.validation);
	expect(large.test).toEqual(small.test);
});
test('a weight penalty constrains a high-degree fit and all errors are measured', () => {
	const settings = { count: 12, degree: 10, seed: 6, penalty: 0 };
	const flexible = fitChallenge(settings),
		regularized = fitChallenge({ ...settings, penalty: 0.1 });
	expect(regularized.weights.reduce((s, w) => s + w * w, 0)).toBeLessThan(
		flexible.weights.reduce((s, w) => s + w * w, 0)
	);
	expect(regularized.test).toBeCloseTo(
		regularized.data.test.reduce((s, p) => s + (regularized.predict(p.x) - p.y) ** 2, 0) / 200
	);
});
