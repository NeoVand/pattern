import { random } from './models';
export type ForecastModel = 'level' | 'trend' | 'seasonal' | 'exponential';
export const FORECAST_SCENARIOS = [
	{
		id: 'growth',
		label: 'Compounding revenue',
		unit: '$k',
		time: 'month',
		count: 72,
		train: 42,
		validation: 15,
		period: 12,
		baseline: 80,
		slope: 0,
		rate: 0.055,
		amplitude: 0,
		noise: 0.055,
		family: 'exponential' as ForecastModel,
		description:
			'A subscription business grows by a percentage, not a fixed amount. Exponential growth accelerates.'
	},
	{
		id: 'decay',
		label: 'Asset depreciation',
		unit: '$k',
		time: 'month',
		count: 72,
		train: 42,
		validation: 15,
		period: 12,
		baseline: 1200,
		slope: 0,
		rate: -0.065,
		amplitude: 0,
		noise: 0.075,
		family: 'exponential' as ForecastModel,
		description:
			'An asset loses a fraction of its value each month. A declining exponential approaches zero without crossing it.'
	},
	{
		id: 'seasonal',
		label: 'Seasonal retail sales',
		unit: '$k',
		time: 'month',
		count: 72,
		train: 42,
		validation: 15,
		period: 12,
		baseline: 300,
		slope: 1.5,
		rate: 0,
		amplitude: 115,
		noise: 20,
		family: 'seasonal' as ForecastModel,
		description:
			'Sales cycle through a strong and a quiet season every year, on top of a modest long-term trend.'
	}
] as const;
export function forecastData(
	scenario: number,
	noise: number,
	trend: number,
	seasonality: number
): number[] {
	const s = FORECAST_SCENARIOS[scenario],
		rng = random(81 + scenario);
	return Array.from({ length: s.count }, (_, i) => {
		const jitter = rng() + rng() + rng() - 1.5;
		return s.family === 'exponential'
			? s.baseline * Math.exp(s.rate * trend * i + jitter * s.noise * noise)
			: Math.max(
					0.01,
					s.baseline +
						s.slope * trend * i +
						s.amplitude * seasonality * Math.sin((2 * Math.PI * i) / s.period - 0.6) +
						jitter * s.noise * noise
				);
	});
}
export class LinearForecaster {
	readonly weights: Float64Array;
	readonly center: number;
	readonly scale: number;
	readonly targets: number[];
	step = 0;
	constructor(
		readonly kind: ForecastModel,
		readonly training: readonly number[],
		readonly period: number
	) {
		this.targets = training.map((y) => (kind === 'exponential' ? Math.log(Math.max(0.01, y)) : y));
		this.center = this.targets.reduce((a, b) => a + b, 0) / training.length;
		this.scale = Math.max(
			0.001,
			Math.sqrt(this.targets.reduce((s, y) => s + (y - this.center) ** 2, 0) / training.length)
		);
		this.weights = new Float64Array(kind === 'level' ? 1 : kind === 'seasonal' ? 4 : 2);
	}
	features(i: number) {
		const t = (i - this.training.length / 2) / this.training.length;
		return this.kind === 'level'
			? [1]
			: this.kind !== 'seasonal'
				? [1, t]
				: [
						1,
						t,
						Math.sin((2 * Math.PI * i) / this.period),
						Math.cos((2 * Math.PI * i) / this.period)
					];
	}
	linearPrediction(i: number) {
		return (
			this.center +
			this.scale * this.features(i).reduce((sum, x, j) => sum + x * this.weights[j], 0)
		);
	}
	predict(i: number) {
		const value = this.linearPrediction(i);
		return this.kind === 'exponential' ? Math.exp(value) : value;
	}
	exponentialTerms(i: number) {
		const rate = (this.scale * (this.weights[1] ?? 0)) / this.training.length;
		return {
			base: Math.exp(this.center + this.scale * (this.weights[0] - 0.5 * (this.weights[1] ?? 0))),
			rate,
			factor: Math.exp(rate * i)
		};
	}

	contributions(i: number) {
		const x = this.features(i);
		if (this.kind === 'exponential') {
			const { base } = this.exponentialTerms(i);
			return { level: base, trend: this.predict(i) - base, season: 0 };
		}
		return {
			level: this.center + this.scale * this.weights[0],
			trend: this.kind === 'level' ? 0 : this.scale * x[1] * this.weights[1],
			season:
				this.kind === 'seasonal'
					? this.scale * (x[2] * this.weights[2] + x[3] * this.weights[3])
					: 0
		};
	}
	train(steps = 1, rate = 0.15) {
		for (let k = 0; k < steps; k++) {
			const gradient = new Float64Array(this.weights.length);
			for (let i = 0; i < this.training.length; i++) {
				const x = this.features(i),
					error = (this.linearPrediction(i) - this.targets[i]) / this.scale;
				for (let j = 0; j < x.length; j++) gradient[j] += (2 * error * x[j]) / this.training.length;
			}
			for (let j = 0; j < this.weights.length; j++) this.weights[j] -= rate * gradient[j];
			this.step++;
		}
	}
	mae(values: readonly number[], start: number, end: number) {
		let sum = 0;
		for (let i = start; i < end; i++) sum += Math.abs(this.predict(i) - values[i]);
		return sum / Math.max(1, end - start);
	}
}
