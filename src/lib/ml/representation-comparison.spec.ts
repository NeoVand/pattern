import { expect, test } from 'vitest';
import {
	fitRepresentations,
	representationData,
	scoreRepresentation
} from './representation-comparison';

test('independent seeded samples reproduce and each model returns valid probabilities', () => {
	const train = representationData('rings', 96, 123);
	expect(train).toEqual(representationData('rings', 96, 123));
	expect(train[0]).not.toEqual(representationData('rings', 96, 1832)[0]);
	const models = fitRepresentations(train);
	for (const model of models) {
		for (const item of representationData('rings', 128, 9232)) {
			expect(model.predict(item.x, item.y)).toBeGreaterThanOrEqual(0);
			expect(model.predict(item.x, item.y)).toBeLessThanOrEqual(1);
		}
	}
});

test('the supplied radius feature helps rings and loses information needed for a diagonal', () => {
	const ringModels = fitRepresentations(representationData('rings', 192, 123));
	const ringTest = representationData('rings', 512, 9232);
	expect(scoreRepresentation(ringModels[1], ringTest).accuracy).toBeGreaterThan(0.9);
	expect(scoreRepresentation(ringModels[1], ringTest).accuracy).toBeGreaterThan(
		scoreRepresentation(ringModels[0], ringTest).accuracy + 0.2
	);
	expect(scoreRepresentation(ringModels[3], ringTest).accuracy).toBeGreaterThan(0.75);
	const diagonal = fitRepresentations(representationData('diagonal', 192, 123));
	const diagonalTest = representationData('diagonal', 512, 9232);
	expect(scoreRepresentation(diagonal[0], diagonalTest).accuracy).toBeGreaterThan(0.9);
	expect(scoreRepresentation(diagonal[1], diagonalTest).accuracy).toBeLessThan(0.65);
});

test('tree training learns data-dependent thresholds rather than a supplied circular boundary', () => {
	const data = representationData('xor', 192, 43);
	const model = fitRepresentations(data, 1)[2];
	expect(model.parameters).toBeGreaterThan(1);
	expect(scoreRepresentation(model, data).accuracy).toBeGreaterThan(0.85);
});
