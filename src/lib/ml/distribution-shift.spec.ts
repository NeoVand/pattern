import { expect, test } from 'vitest';
import {
	causalIntervention,
	evaluateShift,
	fitShiftModel,
	makeShiftPoints,
	runDistributionShift,
	shiftDefaults
} from './distribution-shift';

test('source shortcut fits its source but fails when its correlation is reversed', () => {
	const experiment = runDistributionShift(shiftDefaults);
	expect(experiment.sourceScore.accuracy).toBeGreaterThan(0.9);
	expect(experiment.shiftScore.accuracy).toBeLessThan(0.6);
	expect(experiment.model.weights[1]).toBeGreaterThan(experiment.model.weights[0]);
	expect(experiment.model.loss).toBeLessThan(Math.log(2));
	expect(experiment.groups.reduce((sum, group) => sum + group.total, 0)).toBe(400);
	expect(experiment.groups.reduce((sum, group) => sum + group.correct, 0)).toBe(
		experiment.shiftScore.correct
	);
});

test('representative data improves shifted performance more than eight times as much biased data', () => {
	for (const seed of [13, 23, 37]) {
		const more = runDistributionShift({ ...shiftDefaults, seed, size: 960 });
		const diverse = runDistributionShift({ ...shiftDefaults, seed, diverse: true });
		expect(diverse.shiftScore.accuracy).toBeGreaterThan(0.75);
		expect(diverse.shiftScore.accuracy! - more.shiftScore.accuracy!).toBeGreaterThan(0.2);
	}
});

test('excluding the shortcut holds its weight at zero and exposes a useful shape signal', () => {
	const result = runDistributionShift({ ...shiftDefaults, useBackground: false });
	expect(result.model.weights[1]).toBe(0);
	expect(result.shiftScore.accuracy).toBeGreaterThan(0.8);
});

test('changing evaluation outcomes never changes the trained model and predictions', () => {
	const train = makeShiftPoints(80, 0.95, 7);
	const model = fitShiftModel(train);
	const before = structuredClone(model);
	const rows = makeShiftPoints(100, 0.05, 97);
	const original = evaluateShift(model, rows);
	const flipped = evaluateShift(
		model,
		rows.map((row) => ({ ...row, label: (1 - row.label) as 0 | 1 }))
	);
	expect(original.predictions.map((row) => row.prediction)).toEqual(
		flipped.predictions.map((row) => row.prediction)
	);
	expect(original.correct + flipped.correct).toBe(100);
	expect(model).toEqual(before);
	expect(fitShiftModel(train)).toEqual(before);
});

test('under the supplied mechanism, changing drinks changes observational predictions but not visitors', () => {
	const baseline = causalIntervention(0);
	const changed = causalIntervention(20);
	expect(changed.slope).toBeGreaterThan(1.3);
	expect(changed.predictedVisits - baseline.predictedVisits).toBeGreaterThan(25);
	expect(changed.intervenedVisits).toBe(baseline.intervenedVisits);
	for (let i = 0; i < changed.days.length; i++) {
		expect(changed.intervention[i].temperature).toBe(changed.days[i].temperature);
		expect(changed.intervention[i].visits).toBe(changed.days[i].visits);
		expect(changed.intervention[i].drinks - changed.days[i].drinks).toBeCloseTo(20);
	}
});
