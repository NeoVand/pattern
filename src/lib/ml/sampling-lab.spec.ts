import { expect, test } from 'vitest';
import {
	denoisingLoss,
	denoisingPairs,
	fitToyDenoiser,
	learnedScore,
	sampleDenoiser,
	smoothedToyDensity
} from './sampling-lab';

test('the denoiser learns corrupted-to-clean reconstruction on independent values', () => {
	const train = denoisingPairs(187, 64, 0.55);
	const validation = denoisingPairs(1201, 64, 0.55);
	const model = fitToyDenoiser(train, 0.55);
	expect(model.weights).toHaveLength(26);
	expect(denoisingLoss(train, model.predict)).toBeLessThan(denoisingLoss(train, (x) => x));
	expect(denoisingLoss(validation, model.predict)).toBeLessThan(
		denoisingLoss(validation, (x) => x) * 0.7
	);
	expect(learnedScore(model, -2)).toBeGreaterThan(0);
	expect(learnedScore(model, 2)).toBeLessThan(0);
});

test('sampling uses both learned drift and reproducible random motion', () => {
	const model = fitToyDenoiser(denoisingPairs(187, 64, 0.55), 0.55);
	const paths = sampleDenoiser(model, 701, 20, 50);
	expect(paths).toEqual(sampleDenoiser(model, 701, 20, 50));
	expect(paths).not.toEqual(sampleDenoiser(model, 702, 20, 50));
	expect(paths[0]).toHaveLength(51);
	const identity = { ...model, predict: (x: number) => x };
	const freePaths = sampleDenoiser(identity, 701, 20, 50);
	expect(paths[0][0]).toBe(freePaths[0][0]);
	expect(paths[0][1] - freePaths[0][1]).toBeCloseTo(
		0.5 * 0.03 * learnedScore(model, paths[0][0]),
		10
	);
	expect(paths.every((path) => path.every(Number.isFinite))).toBe(true);
});

test('reference density is normalized and reflects corruption width', () => {
	const integral = Array.from(
		{ length: 2000 },
		(_, index) => smoothedToyDensity(-10 + (index + 0.5) * 0.01, 0.55) * 0.01
	).reduce((sum, value) => sum + value, 0);
	expect(integral).toBeCloseTo(1, 5);
	expect(smoothedToyDensity(0, 1)).toBeGreaterThan(smoothedToyDensity(0, 0.25));
});
