import { expect, test } from 'vitest';
import { FORECAST_SCENARIOS, forecastData, LinearForecaster } from './forecast';
test('growth, decay and seasonal data have distinctly different behavior', () => {
	const growth = forecastData(0, 0, 1, 1),
		decay = forecastData(1, 0, 1, 1),
		season = forecastData(2, 0, 1, 1);
	expect(growth.at(-1)! / growth[0]).toBeGreaterThan(40);
	expect(decay.at(-1)! / decay[0]).toBeLessThan(0.02);
	for (let i = 1; i < 72; i++) {
		expect(growth[i]).toBeGreaterThan(growth[i - 1]);
		expect(decay[i]).toBeLessThan(decay[i - 1]);
	}
	expect(season.filter((y, i) => i && y < season[i - 1]).length).toBeGreaterThan(25);
	expect(season[24] - season[12]).toBeCloseTo(18);
});
test('appropriate models learn each noiseless behavior using training observations alone', () => {
	for (let scenario = 0; scenario < 3; scenario++) {
		const s = FORECAST_SCENARIOS[scenario],
			data = forecastData(scenario, 0, 1, 1);
		const model = new LinearForecaster(s.family, data.slice(0, s.train), s.period);
		const before = model.mae(data, s.train + s.validation, s.count);
		model.train(1200);
		expect(model.mae(data, s.train + s.validation, s.count)).toBeLessThan(before * 0.001);
		const changed = data.map((v, i) => (i >= s.train ? v + 10000 : v));
		const independent = new LinearForecaster(s.family, changed.slice(0, s.train), s.period);
		independent.train(1200);
		expect(independent.weights).toEqual(model.weights);
		const at = s.count + 5,
			parts = model.contributions(at);
		expect(parts.level + parts.trend + parts.season).toBeCloseTo(model.predict(at), 8);
		if (s.family === 'exponential') {
			const terms = model.exponentialTerms(at);
			expect(terms.base * terms.factor).toBeCloseTo(model.predict(at), 8);
			expect(terms.rate).toBeCloseTo(s.rate, 7);
		}
	}
});
test('mismatched straight lines miss accelerating growth and seasonal cycles', () => {
	for (const scenario of [0, 2]) {
		const s = FORECAST_SCENARIOS[scenario],
			data = forecastData(scenario, 0, 1, 1);
		const straight = new LinearForecaster('trend', data.slice(0, s.train), s.period);
		const matched = new LinearForecaster(s.family, data.slice(0, s.train), s.period);
		straight.train(1200);
		matched.train(1200);
		expect(straight.mae(data, 57, 72)).toBeGreaterThan(20);
		expect(matched.mae(data, 57, 72)).toBeLessThan(0.01);
	}
});
