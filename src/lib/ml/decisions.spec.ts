import { describe, expect, test } from 'vitest';
import {
	costThreshold,
	decisionCalibration,
	decisionMetrics,
	decisionPopulation,
	wilsonInterval
} from './decisions';

describe('probabilities and decisions', () => {
	test('the always-negative 99% example misses every damaged parcel', () => {
		const sample = decisionPopulation();
		expect(sample).toEqual(decisionPopulation());
		expect(decisionMetrics(sample, 1)).toEqual({
			tp: 0,
			tn: 990,
			fp: 0,
			fn: 10,
			accuracy: 0.99,
			precision: null,
			recall: 0,
			cost: 100
		});
		const flags = decisionMetrics(sample, 0);
		expect(flags.tp).toBe(10);
		expect(flags.fp).toBe(990);
	});
	test('all four counts cover every example and lowering the threshold cannot lose positives', () => {
		const sample = decisionPopulation(1000, 0.2);
		const low = decisionMetrics(sample, 0.1, 3, 7);
		const high = decisionMetrics(sample, 0.8, 3, 7);
		expect(low.tp + low.tn + low.fp + low.fn).toBe(1000);
		expect(low.tp).toBeGreaterThanOrEqual(high.tp);
		expect(low.fp).toBeGreaterThanOrEqual(high.fp);
		expect(low.cost).toBe(low.fp * 3 + low.fn * 7);
	});
	test('confidence stretching preserves decisions at half but degrades a calibrated population', () => {
		const sample = decisionPopulation(50000, 0.3, 1, 1);
		const stretched = decisionPopulation(50000, 0.3, 1, 3);
		expect(decisionMetrics(sample, 0.5)).toEqual(decisionMetrics(stretched, 0.5));
		expect(decisionCalibration(sample).ece).toBeLessThan(0.01);
		expect(decisionCalibration(stretched).ece).toBeGreaterThan(0.07);
		expect(decisionCalibration(stretched).brier).toBeGreaterThan(decisionCalibration(sample).brier);
	});
	test('cost threshold minimizes the expected cost for known probabilities', () => {
		const sample = decisionPopulation(1000, 0.2);
		const cutoff = costThreshold(2, 8);
		const cost = (threshold: number) =>
			sample.reduce(
				(total, example) =>
					total +
					(example.probability >= threshold
						? 2 * (1 - example.probability)
						: 8 * example.probability),
				0
			);
		expect(cutoff).toBe(0.2);
		for (const alternative of [0, 0.1, 0.3, 0.5, 1])
			expect(cost(cutoff)).toBeLessThanOrEqual(cost(alternative));
	});
	test('finite sample intervals contract with evidence and handle empty and zero-success bins', () => {
		const small = wilsonInterval(5, 10);
		const large = wilsonInterval(500, 1000);
		expect(large[1] - large[0]).toBeLessThan(small[1] - small[0]);
		expect(wilsonInterval(0, 10)[1]).toBeGreaterThan(0);
		expect(wilsonInterval(0, 0)).toEqual([0, 1]);
		expect(decisionCalibration([])).toEqual({ bins: [], ece: 0, brier: 0 });
	});
});
