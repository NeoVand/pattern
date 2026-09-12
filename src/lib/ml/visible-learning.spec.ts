import { expect, test } from 'vitest';
import { clusterBoundaries, clusterDistance } from './cafe-clusters';
import { DeliveryLearner, deliveryWorld } from './delivery-learning';
import { TinyWordModel, everydayCorpus, adaptationCorpora } from './word-adaptation';
import { compatibleModels } from '../ai/catalog';
import { readFileSync } from 'node:fs';
import { lessons } from '../data/lessons';
import { notes } from '../data/notes';
test('dashed boundaries are unique interior equal-distance edges', () => {
	const centers = [
		{ sweetness: 2, intensity: 2 },
		{ sweetness: 8, intensity: 2 },
		{ sweetness: 5, intensity: 8 }
	];
	const edges = clusterBoundaries(centers);
	expect(edges).toHaveLength(3);
	for (const [a, b] of edges) {
		const p = { sweetness: (a[0] + b[0]) / 2, intensity: (a[1] + b[1]) / 2 };
		const d = centers.map((c) => clusterDistance(c, p)).sort((a, b) => a - b);
		expect(d[0]).toBeCloseTo(d[1], 7);
	}
});
test('one Q-learning move updates exactly one table entry with the displayed formula', () => {
	const learner = new DeliveryLearner(deliveryWorld());
	learner.q[29][0] = 4;
	const old = learner.q.flat();
	const update = learner.trainTransition(28, 0.25, 1);
	expect(update.next).toBe(29);
	expect(update.future).toBe(4);
	expect(update.target).toBeCloseTo(-0.15 + 0.95 * 4);
	expect(update.newValue).toBeCloseTo(0.25 * (-0.15 + 0.95 * 4));
	expect(update.forced).toBe(true);
	expect(update.explore).toBe(false);
	expect(learner.q.flat().filter((v, i) => v !== old[i])).toHaveLength(1);
});
test('a terminal transition never bootstraps the terminal state', () => {
	const learner = new DeliveryLearner(deliveryWorld());
	learner.q[6] = [99, 99, 99, 99];
	const update = learner.trainTransition(5, 0, 1);
	expect(update.done).toBe(true);
	expect(update.future).toBe(0);
	expect(update.target).toBe(10);
	expect(update.newValue).toBe(2.5);
});
test('continued softmax training matches an uninterrupted run', () => {
	const model = new TinyWordModel(),
		reference = new TinyWordModel();
	model.train(everydayCorpus, 120);
	const loss = model.loss(everydayCorpus);
	model.train(everydayCorpus, 120);
	reference.train(everydayCorpus, 240);
	expect(model.distance(reference)).toBe(0);
	expect(model.loss(everydayCorpus)).toBeLessThan(loss);
	const adapted = model.clone();
	adapted.train(adaptationCorpora.cafe, 80);
	adapted.train(adaptationCorpora.cafe, 80);
	reference.train(adaptationCorpora.cafe, 160);
	expect(adapted.distance(reference)).toBe(0);
});
test('image picker only offers account-accessible image models', () => {
	expect(
		compatibleModels(
			[
				'gpt-image-2.5-sunburst',
				'gpt-image-2.5-sunburst-2026-09-08',
				'gpt-4.1-mini',
				'gpt-image-1.5'
			],
			'image'
		).map((m) => m.value)
	).toEqual(['gpt-image-2.5-sunburst', 'gpt-image-1.5']);
});
test('every chapter has reflection material, including generation', () => {
	for (const lesson of lessons) {
		expect(notes[lesson.noteIndex]?.question).toBeTruthy();
		expect(lesson.icon).toBeTruthy();
	}
});
test('real TinyStories data preserves separate complete-story splits', () => {
	const meta = JSON.parse(readFileSync('static/data/tinystories/corpus.json', 'utf8'));
	const bytes = readFileSync('static/data/tinystories/tokens.bin');
	expect(bytes.length).toBe(meta.trainTokens + meta.validationTokens);
	expect(meta.trainStories).toBeGreaterThan(2000);
	expect(meta.validationStories).toBeGreaterThan(100);
	expect(meta.chars).toHaveLength(96);
	expect(meta.chars[bytes[meta.trainTokens - 1]]).toBe('\n');
	expect(meta.chars[bytes[meta.trainTokens - 2]]).toBe('\n');
	expect(meta.source).toContain('roneneldan/TinyStories');
});
