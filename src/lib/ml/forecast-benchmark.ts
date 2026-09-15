import { FORECAST_SCENARIOS, forecastData, LinearForecaster } from './forecast';

export type BenchmarkModel = 'mean' | 'last' | 'seasonal-naive' | 'trend' | 'seasonal';
export type ForecastRegime = 'stable' | 'level' | 'seasonality';
export interface ForecastBenchmarkSettings {
	horizon: 1 | 6 | 12;
	regime: ForecastRegime;
	shift: number;
	noise: number;
}
export const benchmarkDefaults: ForecastBenchmarkSettings = {
	horizon: 6,
	regime: 'stable',
	shift: 90,
	noise: 1
};
export const BENCHMARK_MODELS: { id: BenchmarkModel; label: string; description: string }[] = [
	{
		id: 'mean',
		label: 'Historical mean',
		description: 'Repeat the average of every value known at the forecast origin.'
	},
	{
		id: 'last',
		label: 'Last value',
		description: 'Repeat the most recent observation available at the forecast origin.'
	},
	{
		id: 'seasonal-naive',
		label: 'Same month last year',
		description:
			'Repeat the most recent known value for that calendar month. The 12-month period is supplied.'
	},
	{
		id: 'trend',
		label: 'Fitted trend',
		description:
			'Learn a level and straight-line trend from all values known at the forecast origin.'
	},
	{
		id: 'seasonal',
		label: 'Fitted season + trend',
		description:
			'Learn a level, trend, and sine/cosine cycle from known values. The 12-month period is supplied.'
	}
];
export const BENCHMARK_CALIBRATION_START = 42;
export const BENCHMARK_EVALUATION_START = 57;
export const BENCHMARK_PERIOD = FORECAST_SCENARIOS[2].period;

export function benchmarkData(settings: ForecastBenchmarkSettings): number[] {
	const values = forecastData(2, settings.noise, 1, 1);
	return values.map((value, index) => {
		if (index < BENCHMARK_EVALUATION_START || settings.regime === 'stable') return value;
		if (settings.regime === 'level') return value + settings.shift;
		// Move the yearly peak six months, smoothly scaled from no change at shift=0.
		const season =
			FORECAST_SCENARIOS[2].amplitude * Math.sin((2 * Math.PI * index) / BENCHMARK_PERIOD - 0.6);
		return value - 2 * season * (settings.shift / 90);
	});
}

export function fitBenchmarkForecast(
	kind: BenchmarkModel,
	values: readonly number[],
	origin: number
) {
	if (!Number.isInteger(origin) || origin < BENCHMARK_PERIOD || origin > values.length) {
		throw new Error('Forecast origin must follow at least one full observed year.');
	}
	const history = values.slice(0, origin);
	if (kind === 'mean') {
		const mean = history.reduce((sum, value) => sum + value, 0) / history.length;
		return () => mean;
	}
	if (kind === 'last') return () => history[history.length - 1];
	if (kind === 'seasonal-naive')
		return (target: number) => {
			const knownMonth =
				target - Math.ceil((target - origin + 1) / BENCHMARK_PERIOD) * BENCHMARK_PERIOD;
			return history[knownMonth];
		};
	const model = new LinearForecaster(kind, history, BENCHMARK_PERIOD);
	model.train(600);
	return (target: number) => model.predict(target);
}

export interface OriginForecast {
	target: number;
	origin: number;
	prediction: number;
	actual: number;
	error: number;
}
export function rollingForecasts(
	kind: BenchmarkModel,
	values: readonly number[],
	horizon: number,
	start: number,
	end: number
): OriginForecast[] {
	return Array.from({ length: end - start }, (_, index) => {
		const target = start + index;
		const origin = target - horizon + 1;
		const prediction = fitBenchmarkForecast(kind, values, origin)(target);
		return {
			target,
			origin,
			prediction,
			actual: values[target],
			error: Math.abs(values[target] - prediction)
		};
	});
}

/** Nearest-rank empirical quantile; time-series intervals need stability assumptions, not exchangeability by fiat. */
export function residualRadius(errors: readonly number[], fraction = 0.9) {
	if (!errors.length) throw new Error('Interval calibration needs earlier residuals.');
	const sorted = [...errors].sort((a, b) => a - b);
	return sorted[Math.max(0, Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1))];
}

export function runForecastBenchmark(settings: ForecastBenchmarkSettings) {
	const values = benchmarkData(settings);
	const candidates = BENCHMARK_MODELS.map((candidate) => {
		const calibration = rollingForecasts(
			candidate.id,
			values,
			settings.horizon,
			BENCHMARK_CALIBRATION_START,
			BENCHMARK_EVALUATION_START
		);
		const evaluation = rollingForecasts(
			candidate.id,
			values,
			settings.horizon,
			BENCHMARK_EVALUATION_START,
			values.length
		);
		const radius = residualRadius(calibration.map((point) => point.error));
		const covered = evaluation.filter((point) => point.error <= radius).length;
		return {
			...candidate,
			calibration,
			evaluation,
			radius,
			covered,
			mae: evaluation.reduce((sum, point) => sum + point.error, 0) / evaluation.length,
			calibrationMae: calibration.reduce((sum, point) => sum + point.error, 0) / calibration.length,
			coverage: covered / evaluation.length
		};
	});
	return { values, candidates };
}
