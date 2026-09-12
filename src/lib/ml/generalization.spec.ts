import { expect, test } from 'vitest';
import { generalizationData, generalizationModels } from './generalization';
import { nearestGuestVote, labeledGuests } from './neighbors';
import { compatibleModels } from '../ai/catalog';
test('overfit passes every training dot, oscillates outside the observations, and loses on held-out data', () => {
	const data = generalizationData(),
		models = generalizationModels(data),
		overfit = models[2];
	for (const point of data.filter((p) => p.split === 'train'))
		expect(overfit.predict(point.x)).toBeCloseTo(point.y, 10);
	expect(overfit.train).toBeLessThan(1e-20);
	expect(overfit.test).toBeGreaterThan(models[1].test * 40);
	expect(models[1].validation).toBeLessThan(models[0].validation);
	const curve = Array.from({ length: 1001 }, (_, i) => overfit.predict(i / 500 - 1));
	expect(Math.max(...curve)).toBeGreaterThan(3);
});
test('fitted curves cannot see changes to held-out targets', () => {
	const original = generalizationData();
	const changed = original.map((p) => (p.split === 'train' ? p : { ...p, y: p.y + 100 }));
	const a = generalizationModels(original),
		b = generalizationModels(changed);
	for (let m = 0; m < 3; m++)
		for (let i = 0; i < 50; i++) expect(a[m].predict(i / 25 - 1)).toBe(b[m].predict(i / 25 - 1));
});
test('removing noise lets the interpolating polynomial recover the underlying quadratic', () => {
	const models = generalizationModels(generalizationData(0));
	expect(models[2].test).toBeLessThan(1e-20);
});
test('nearest-neighbor votes use the actual k smallest distances', () => {
	const query = { sweetness: 5.4, intensity: 5.3 },
		r = nearestGuestVote(query, 5);
	const distance = (p: (typeof labeledGuests)[number]) =>
		Math.hypot(p.sweetness - query.sweetness, p.intensity - query.intensity);
	expect(r.neighbors.map((n) => n.id)).toEqual(
		[...labeledGuests]
			.sort((a, b) => distance(a) - distance(b))
			.slice(0, 5)
			.map((p) => p.id)
	);
	expect(r.votes.reduce((a, b) => a + b, 0)).toBe(5);
	expect(r.votes[r.prediction]).toBe(Math.max(...r.votes));
});
test('Flare is preferred when both image models are available', () => {
	expect(
		compatibleModels(['gpt-image-2.5-sunburst', 'gpt-image-2.5-flare'], 'image')[0].value
	).toBe('gpt-image-2.5-flare');
});
