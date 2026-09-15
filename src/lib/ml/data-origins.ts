/** Synthetic café records. No personal data is collected or sent by this experiment. */
export type OriginTarget = 'return' | 'large-order';
export type OriginFeature = 'history' | 'identifier' | 'future';
export type OriginSplit = 'rows' | 'customers';
export type OriginCoverage = 'morning' | 'both';
export interface OriginSettings {
	target: OriginTarget;
	feature: OriginFeature;
	split: OriginSplit;
	coverage: OriginCoverage;
	labelNoise: number;
	seed: number;
}
export interface CustomerRecord {
	id: string;
	customer: string;
	group: 'morning' | 'evening';
	visits: number;
	spend: number;
	identifier: number;
	label: number;
	truth: number;
	future: number;
}
export const originDefaults: OriginSettings = {
	target: 'return',
	feature: 'identifier',
	split: 'rows',
	coverage: 'both',
	labelNoise: 0,
	seed: 17
};

function randomFrom(seed: number) {
	let value = seed >>> 0;
	return () => {
		value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
		return value / 4294967296;
	};
}

export function makeCustomers(settings: OriginSettings, fresh = false): CustomerRecord[] {
	const random = randomFrom(settings.seed + (fresh ? 80093 : 0));
	return Array.from({ length: fresh ? 240 : 72 }, (_, index) => {
		const group =
			!fresh && settings.coverage === 'morning' ? 'morning' : index % 2 ? 'evening' : 'morning';
		const visits = random();
		const spend = random();
		const identifier = random(); // Independent of preferences and the outcome.
		const uncertainty = (random() - 0.5) * 0.18;
		// A documented toy mechanism, not a claim about real café customers.
		const signal =
			settings.target === 'return'
				? (group === 'morning' ? visits : 1 - visits) + 0.2 * (spend - 0.5)
				: spend + 0.2 * (visits - 0.5);
		const truth = Number(signal + uncertainty > 0.5);
		const corrupted = random() < settings.labelNoise;
		const customer = `${fresh ? 'new' : 'source'}-${index + 1}`;
		return {
			id: customer,
			customer,
			group,
			visits,
			spend,
			identifier,
			truth,
			label: !fresh && corrupted ? 1 - truth : truth,
			future: truth
		};
	});
}

export function splitCustomerRecords(customers: CustomerRecord[], split: OriginSplit) {
	const train: CustomerRecord[] = [];
	const validation: CustomerRecord[] = [];
	for (let i = 0; i < customers.length; i++) {
		for (let copy = 0; copy < 3; copy++) {
			const row = { ...customers[i], id: `${customers[i].customer}-${copy}` };
			// Same training-row budget in both designs. All copies stay together in a customer split.
			const isTraining = split === 'rows' ? copy < 2 : i % 3 !== 2;
			(isTraining ? train : validation).push(row);
		}
	}
	return { train, validation };
}

function features(row: CustomerRecord, kind: OriginFeature, availableNow: boolean): number[] {
	if (kind === 'identifier') return [row.identifier];
	// The future outcome is unavailable before prediction. 0.5 is an explicit missing-value fill.
	if (kind === 'future') return [availableNow ? 0.5 : row.future];
	return [row.visits, row.spend * 0.6, row.group === 'evening' ? 1.5 : 0];
}

export function nearestCustomer(
	train: CustomerRecord[],
	row: CustomerRecord,
	feature: OriginFeature,
	availableNow = false
) {
	if (!train.length)
		throw new Error('A nearest-neighbor model needs at least one training record.');
	const query = features(row, feature, availableNow);
	let nearest = train[0];
	let best = Infinity;
	for (const candidate of train) {
		const distance = features(candidate, feature, false).reduce(
			(sum, v, i) => sum + (v - query[i]) ** 2,
			0
		);
		if (distance < best) {
			best = distance;
			nearest = candidate;
		}
	}
	return { prediction: nearest.label, neighbor: nearest, distance: Math.sqrt(best) };
}

export function runDataOrigins(settings: OriginSettings) {
	const customers = makeCustomers(settings);
	const fresh = makeCustomers(settings, true);
	const { train, validation } = splitCustomerRecords(customers, settings.split);
	const trainingIds = new Set(train.map((row) => row.customer));
	const overlapping = new Set(
		validation.filter((row) => trainingIds.has(row.customer)).map((row) => row.customer)
	);
	const results = fresh.map((row) => ({
		...row,
		...nearestCustomer(train, row, settings.feature, true)
	}));
	const correct = results.filter((row) => row.prediction === row.truth).length;
	const validationCorrect = validation.filter(
		(row) => nearestCustomer(train, row, settings.feature).prediction === row.label
	).length;
	const groups = (['morning', 'evening'] as const).map((group) => {
		const rows = results.filter((row) => row.group === group);
		const n = rows.filter((row) => row.prediction === row.truth).length;
		return {
			group,
			correct: n,
			total: rows.length,
			accuracy: n / rows.length,
			source: customers.filter((row) => row.group === group).length
		};
	});
	return {
		customers,
		train,
		validation,
		results,
		groups,
		overlap: overlapping.size,
		trainingCustomers: trainingIds.size,
		validationCorrect,
		validationAccuracy: validationCorrect / validation.length,
		correct,
		freshAccuracy: correct / fresh.length,
		corrupted: customers.filter((row) => row.truth !== row.label).length
	};
}
