import { expect, test } from 'vitest';
import {
	originDefaults,
	runDataOrigins,
	nearestCustomer,
	makeCustomers,
	splitCustomerRecords
} from './data-origins';

test('row splits leak all customer identities, while group splits are disjoint with the same row budget', () => {
	const rows = runDataOrigins(originDefaults);
	const groups = runDataOrigins({ ...originDefaults, split: 'customers' });
	expect(rows.train).toHaveLength(144);
	expect(groups.train).toHaveLength(144);
	expect(rows.overlap).toBe(72);
	expect(groups.overlap).toBe(0);
	expect(rows.validationAccuracy).toBe(1);
	expect(rows.freshAccuracy).toBeLessThan(0.65);
	expect(groups.validationAccuracy).toBeLessThan(0.75);
});

test('a target-derived feature gives misleading retrospective accuracy and is missing at prediction', () => {
	const experiment = runDataOrigins({ ...originDefaults, split: 'customers', feature: 'future' });
	expect(experiment.validationAccuracy).toBe(1);
	expect(experiment.freshAccuracy).toBeLessThan(0.65);
	const first = experiment.results[0];
	expect(
		nearestCustomer(experiment.train, { ...first, future: 1 }, 'future', true).prediction
	).toBe(nearestCustomer(experiment.train, { ...first, future: 0 }, 'future', true).prediction);
});

test('more representative histories improve the previously absent evening group over several samples', () => {
	let narrow = 0,
		broad = 0;
	for (const seed of [7, 17, 29, 43, 51]) {
		const settings = {
			...originDefaults,
			seed,
			feature: 'history' as const,
			split: 'customers' as const
		};
		narrow += runDataOrigins({ ...settings, coverage: 'morning' }).groups[1].accuracy;
		broad += runDataOrigins({ ...settings, coverage: 'both' }).groups[1].accuracy;
	}
	expect(broad / 5).toBeGreaterThan(0.8);
	expect(broad - narrow).toBeGreaterThan(2);
});

test('noise corrupts source labels consistently across duplicates, without changing measured features or fresh truth', () => {
	const clean = makeCustomers(originDefaults);
	const noisy = makeCustomers({ ...originDefaults, labelNoise: 1 });
	for (let i = 0; i < clean.length; i++) {
		expect(noisy[i].label).toBe(1 - clean[i].label);
		expect(noisy[i].visits).toBe(clean[i].visits);
	}
	expect(makeCustomers(originDefaults, true)).toEqual(
		makeCustomers({ ...originDefaults, labelNoise: 1 }, true)
	);
	const rows = splitCustomerRecords(noisy, 'rows');
	expect(rows.train[0].label).toBe(rows.validation[0].label);
});

test('target choice changes labels while keeping the same customers and inputs', () => {
	const a = makeCustomers(originDefaults);
	const b = makeCustomers({ ...originDefaults, target: 'large-order' });
	expect(a.map((p) => p.visits)).toEqual(b.map((p) => p.visits));
	expect(a.filter((p, i) => p.truth !== b[i].truth).length).toBeGreaterThan(10);
});
