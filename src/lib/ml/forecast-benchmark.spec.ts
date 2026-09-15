import { expect, test } from 'vitest';
import {
	BENCHMARK_MODELS,
	benchmarkData,
	benchmarkDefaults,
	fitBenchmarkForecast,
	residualRadius,
	rollingForecasts,
	runForecastBenchmark
} from './forecast-benchmark';

test('naive baselines use the same available history, including the correct seasonal month at every horizon', () => {
	const values = Array.from({ length: 72 }, (_, i) => i + 1);
	for (const horizon of [1, 6, 12]) {
		const origin = 48,
			target = origin + horizon - 1;
		expect(fitBenchmarkForecast('mean', values, origin)(target)).toBe(24.5);
		expect(fitBenchmarkForecast('last', values, origin)(target)).toBe(48);
		expect(fitBenchmarkForecast('seasonal-naive', values, origin)(target)).toBe(
			values[target - 12]
		);
	}
});

test('every candidate prediction is unchanged when its unavailable future is replaced', () => {
	const values = benchmarkData(benchmarkDefaults);
	const origin = 46;
	const altered = values.map((value, i) => (i >= origin ? value + 10000 : value));
	for (const candidate of BENCHMARK_MODELS) {
		const a = fitBenchmarkForecast(candidate.id, values, origin);
		const b = fitBenchmarkForecast(candidate.id, altered, origin);
		for (const horizon of [1, 6, 12]) expect(a(origin + horizon - 1)).toBe(b(origin + horizon - 1));
	}
});

test('held-out changes do not change earlier calibration or its residual radius', () => {
	const stable = runForecastBenchmark(benchmarkDefaults);
	const changed = runForecastBenchmark({ ...benchmarkDefaults, regime: 'level' });
	for (let i = 0; i < stable.candidates.length; i++) {
		expect(changed.candidates[i].calibration).toEqual(stable.candidates[i].calibration);
		expect(changed.candidates[i].radius).toBe(stable.candidates[i].radius);
	}
	expect(changed.values.slice(0, 57)).toEqual(stable.values.slice(0, 57));
	expect(changed.values[57] - stable.values[57]).toBeCloseTo(90);
});

test('rolling origins preserve the requested horizon and score every later month once', () => {
	const values = benchmarkData(benchmarkDefaults);
	const points = rollingForecasts('last', values, 12, 57, 72);
	expect(points).toHaveLength(15);
	for (const point of points) {
		expect(point.target - point.origin + 1).toBe(12);
		expect(point.prediction).toBe(values[point.origin - 1]);
		expect(point.error).toBe(Math.abs(point.prediction - point.actual));
	}
});

test('interval width is the empirical residual quantile and coverage counts actual outcomes', () => {
	expect(residualRadius([9, 1, 3, 2, 4, 6, 5, 8, 7, 10])).toBe(9);
	const result = runForecastBenchmark({ ...benchmarkDefaults, horizon: 12, regime: 'seasonality' });
	for (const candidate of result.candidates) {
		expect(candidate.radius).toBe(residualRadius(candidate.calibration.map((p) => p.error)));
		expect(candidate.covered).toBe(
			candidate.evaluation.filter(
				(p) =>
					p.actual >= p.prediction - candidate.radius && p.actual <= p.prediction + candidate.radius
			).length
		);
		expect(candidate.coverage).toBe(candidate.covered / 15);
		expect(Number.isFinite(candidate.mae)).toBe(true);
	}
});
