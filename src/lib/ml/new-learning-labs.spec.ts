import { describe, expect, it } from 'vitest';
import { advanceClusters, cafePreferences, clusterDistance, startClusters } from './cafe-clusters';
import { DeliveryLearner, deliveryMove, deliveryWorld } from './delivery-learning';
import { TinyWordModel, adaptationCorpora, everydayCorpus } from './word-adaptation';

describe('café preference clustering', () => {
	it('uses repeatable unlabeled observations and monotonically reduces the k-means objective', () => {
		const points = cafePreferences();
		expect(points).toEqual(cafePreferences());
		expect(points[0]).not.toHaveProperty('label');
		let state = startClusters(points, 3),
			previous = Infinity;
		for (let i = 0; i < 100 && state.phase !== 'done'; i++) {
			state = advanceClusters(points, state);
			expect(state.inertia!).toBeLessThanOrEqual(previous + 1e-9);
			previous = state.inertia!;
		}
		expect(state.phase).toBe('done');
		expect(state.inertia!).toBeLessThan(160);
		state.centers.forEach((center, group) => {
			const members = points.filter((_, i) => state.assignments[i] === group);
			expect(center.sweetness).toBeCloseTo(
				members.reduce((sum, p) => sum + p.sweetness, 0) / members.length,
				10
			);
		});
		points.forEach((point, i) =>
			expect(clusterDistance(point, state.centers[state.assignments[i]])).toBe(
				Math.min(...state.centers.map((center) => clusterDistance(point, center)))
			)
		);
	});
	it('remains finite for all exposed group counts and seeds', () => {
		for (const seed of [19, 20, 21])
			for (const k of [2, 3, 4, 5]) {
				const points = cafePreferences(seed);
				let state = startClusters(points, k, seed);
				for (let i = 0; i < 100; i++) state = advanceClusters(points, state);
				expect(state.phase).toBe('done');
				expect(Number.isFinite(state.inertia)).toBe(true);
			}
	});
});

describe('delivery Q-learning', () => {
	it('learns a successful route in both environments using only reward feedback', () => {
		for (const roadworks of [false, true]) {
			const learner = new DeliveryLearner(deliveryWorld(roadworks));
			for (let i = 0; i < 300; i++) learner.trainEpisode(0.25);
			const route = learner.policyRoute();
			expect(route.success).toBe(true);
			expect(route.path.at(-1)).toBe(learner.world.goal);
			expect(route.steps).toBeLessThan(20);
			expect(route.reward).toBeGreaterThan(5);
			expect(route.path.some((cell) => learner.world.blocked.includes(cell))).toBe(false);
		}
	});
	it('stops blocked movements and resets all learned values for a new world', () => {
		const world = deliveryWorld();
		expect(deliveryMove(world, 8, 1)).toEqual({ next: 8, reward: -0.8, done: false });
		const learner = new DeliveryLearner(deliveryWorld(true));
		expect(learner.q.flat().every((value) => value === 0)).toBe(true);
		expect(learner.visits.every((value) => value === 0)).toBe(true);
	});
});

describe('tiny word-model pretraining and adaptation', () => {
	it('learns next-word probabilities and adapts the same weights to a new domain', () => {
		const base = new TinyWordModel();
		const initial = base.loss(everydayCorpus);
		base.train(everydayCorpus, 120);
		expect(base.loss(everydayCorpus)).toBeLessThan(initial / 2);
		const adapted = base.clone();
		const before = adapted.loss(adaptationCorpora.cafe);
		adapted.train(adaptationCorpora.cafe, 80);
		expect(adapted.loss(adaptationCorpora.cafe)).toBeLessThan(before / 2);
		expect(adapted.predict('the')[0].word).toBe('coffee');
		expect(adapted.distance(base)).toBeGreaterThan(0);
		expect(adapted.loss(everydayCorpus)).toBeGreaterThan(base.loss(everydayCorpus));
		expect(adapted.distribution('the').reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
	});
	it('changes predictions with context without modifying parameters', () => {
		const model = new TinyWordModel();
		model.train(everydayCorpus, 120);
		const before = model.clone();
		expect(model.predict('the')).not.toEqual(model.predict('is'));
		expect(model.predict('anything before the')).toEqual(model.predict('the'));
		expect(model.knownContext('gobbledygook')).toBe(false);
		expect(model.distance(before)).toBe(0);
	});
});
