/** A fully specified synthetic classification problem; no pretrained or remote model. */
export interface ShiftPoint {
	id: string;
	core: number;
	background: number;
	label: 0 | 1;
	backgroundClass: 0 | 1;
}
export interface ShiftModel {
	weights: [number, number];
	bias: number;
	loss: number;
}
export interface ShiftSettings {
	seed: number;
	size: number;
	diverse: boolean;
	useBackground: boolean;
}
export const shiftDefaults: ShiftSettings = {
	seed: 23,
	size: 120,
	diverse: false,
	useBackground: true
};
function randomFrom(seed: number) {
	let value = seed >>> 0;
	return () => {
		value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
		return value / 4294967296;
	};
}
export function makeShiftPoints(
	n: number,
	agreement: number,
	seed: number,
	prefix = 'sample'
): ShiftPoint[] {
	const random = randomFrom(seed);
	return Array.from({ length: n }, (_, index) => {
		const label = (index % 2) as 0 | 1;
		const noise = Array.from({ length: 6 }, () => random()).reduce((sum, v) => sum + v, 0) - 3;
		const core = (label * 2 - 1) * 0.8 + noise;
		const backgroundClass = (random() < agreement ? label : 1 - label) as 0 | 1;
		const background = backgroundClass * 2 - 1 + (random() - 0.5) * 0.24;
		return { id: `${prefix}-${index}`, core, background, label, backgroundClass };
	});
}
const sigmoid = (value: number) => 1 / (1 + Math.exp(-Math.max(-40, Math.min(40, value))));
export function shiftProbability(model: ShiftModel, row: Pick<ShiftPoint, 'core' | 'background'>) {
	return sigmoid(model.bias + model.weights[0] * row.core + model.weights[1] * row.background);
}
export function fitShiftModel(rows: ShiftPoint[], useBackground = true): ShiftModel {
	if (!rows.length) throw new Error('Training needs at least one example.');
	const model: ShiftModel = { weights: [0, 0], bias: 0, loss: 0 };
	const penalty = 0.015;
	for (let step = 0; step < 500; step++) {
		let coreGradient = 0,
			backgroundGradient = 0,
			biasGradient = 0;
		for (const row of rows) {
			const error = shiftProbability(model, row) - row.label;
			coreGradient += error * row.core;
			backgroundGradient += error * row.background;
			biasGradient += error;
		}
		model.weights[0] -= 0.3 * (coreGradient / rows.length + penalty * model.weights[0]);
		if (useBackground)
			model.weights[1] -= 0.3 * (backgroundGradient / rows.length + penalty * model.weights[1]);
		model.bias -= (0.3 * biasGradient) / rows.length;
	}
	model.loss =
		rows.reduce((sum, row) => {
			const p = Math.max(1e-12, Math.min(1 - 1e-12, shiftProbability(model, row)));
			return sum - row.label * Math.log(p) - (1 - row.label) * Math.log(1 - p);
		}, 0) / rows.length;
	return model;
}
export function evaluateShift(model: ShiftModel, rows: ShiftPoint[]) {
	const predictions = rows.map((row) => ({
		...row,
		probability: shiftProbability(model, row),
		prediction: Number(shiftProbability(model, row) >= 0.5)
	}));
	const correct = predictions.filter((row) => row.label === row.prediction).length;
	return {
		predictions,
		correct,
		total: rows.length,
		accuracy: rows.length ? correct / rows.length : null
	};
}
export function runDistributionShift(settings: ShiftSettings) {
	const training = makeShiftPoints(
		settings.size,
		settings.diverse ? 0.5 : 0.95,
		settings.seed,
		'train'
	);
	const source = makeShiftPoints(400, 0.95, settings.seed + 9167, 'source');
	const shifted = makeShiftPoints(400, 0.05, settings.seed + 32401, 'shift');
	const model = fitShiftModel(training, settings.useBackground);
	const sourceScore = evaluateShift(model, source);
	const shiftScore = evaluateShift(model, shifted);
	const groups = ([0, 1] as const).flatMap((label) =>
		([0, 1] as const).map((backgroundClass) => {
			const belongs = (row: ShiftPoint) =>
				row.label === label && row.backgroundClass === backgroundClass;
			return {
				id: `${label}-${backgroundClass}`,
				label,
				backgroundClass,
				source: training.filter(belongs).length,
				...evaluateShift(model, shifted.filter(belongs))
			};
		})
	);
	return { training, model, sourceScore, shiftScore, groups };
}

export interface CausalDay {
	temperature: number;
	drinks: number;
	visits: number;
}
export function makeCausalDays(seed = 61): CausalDay[] {
	const random = randomFrom(seed);
	return Array.from({ length: 160 }, () => {
		const temperature = 10 + random() * 20;
		const drinks = 30 + 2 * (temperature - 20) + (random() - 0.5) * 8;
		const visits = 45 + 3 * (temperature - 20) + (random() - 0.5) * 10;
		return { temperature, drinks, visits };
	});
}
/** Observational regression and an intervention under the explicitly supplied causal mechanism. */
export function causalIntervention(extraDrinks: number, seed = 61) {
	const days = makeCausalDays(seed);
	const meanDrinks = days.reduce((n, day) => n + day.drinks, 0) / days.length;
	const meanVisits = days.reduce((n, day) => n + day.visits, 0) / days.length;
	const slope =
		days.reduce((n, day) => n + (day.drinks - meanDrinks) * (day.visits - meanVisits), 0) /
		days.reduce((n, day) => n + (day.drinks - meanDrinks) ** 2, 0);
	const intervention = days.map((day) => ({ ...day, drinks: day.drinks + extraDrinks }));
	return {
		days,
		intervention,
		slope,
		meanDrinks,
		meanVisits,
		predictedVisits: meanVisits + slope * extraDrinks,
		intervenedVisits: intervention.reduce((n, day) => n + day.visits, 0) / intervention.length
	};
}
