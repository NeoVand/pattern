import { describe, expect, test } from 'vitest';
import {
	DeliveryLearner,
	deliveryScenario,
	deliveryDestinations,
	deliveryMove,
	deliveryScenarios,
	compareDeliveryExploration
} from './delivery-learning';

describe('delivery exploration and competing routes', () => {
	test('every scenario has reachable deliveries, several passages, and zero learned values', () => {
		for (const scenario of deliveryScenarios) {
			const world = deliveryScenario(scenario.id),
				learner = new DeliveryLearner(world);
			expect(world.width * world.height).toBeGreaterThan(35);
			expect(world.traffic.length).toBeGreaterThan(1);
			expect(learner.q.flat().every((v) => v === 0)).toBe(true);
			const seen = new Set([world.start]),
				queue = [world.start];
			while (queue.length) {
				const state = queue.shift()!;
				for (let a = 0; a < 4; a++) {
					const move = deliveryMove(world, state, a);
					if (!seen.has(move.next)) {
						seen.add(move.next);
						if (!move.done) queue.push(move.next);
					}
				}
			}
			for (const destination of deliveryDestinations(world))
				expect(seen.has(destination.cell)).toBe(true);
		}
	});
	test('equal-budget fresh agents discover different real policies on the bridge map', () => {
		const world = deliveryScenario('bridges');
		for (const seed of [41, 42, 43]) {
			const runs = compareDeliveryExploration(world, seed, 200);
			expect(new Set(runs.map((r) => r.route.path.join(','))).size).toBeGreaterThanOrEqual(2);
			expect(runs.at(-1)!.route.discountedReward).toBeGreaterThan(runs[0].route.discountedReward);
			for (const run of runs) {
				expect(run.episodes).toHaveLength(200);
				expect(run.route.success).toBe(true);
				expect(run.route.path.some((cell) => world.blocked.includes(cell))).toBe(false);
				const independent = new DeliveryLearner(world, seed);
				for (let i = 0; i < 200; i++) independent.trainEpisode(run.epsilon);
				expect(run.learner.q).toEqual(independent.q);
			}
		}
	});
	test('epsilon changes actual training choices, not greedy policy evaluation', () => {
		const learner = new DeliveryLearner(deliveryScenario('bridges'));
		const exploit = learner.trainEpisode(0),
			explore = learner.trainEpisode(1);
		expect(exploit.exploration).toBe(0);
		expect(exploit.explored.every((v) => !v)).toBe(true);
		expect(explore.exploration).toBe(explore.steps);
		expect(explore.explored.every(Boolean)).toBe(true);
		const before = learner.q.map((row) => [...row]);
		expect(learner.policyRoute().exploration).toBe(0);
		expect(learner.q).toEqual(before);
	});
	test('nearby delivery is terminal and never bootstraps its stored value', () => {
		const world = deliveryScenario('discovery'),
			learner = new DeliveryLearner(world);
		const near = deliveryDestinations(world).find((d) => d.label === 'A')!;
		learner.q[near.cell] = [100, 100, 100, 100];
		const update = learner.trainTransition(near.cell - 1, 0, 1);
		expect(update.done).toBe(true);
		expect(update.reward).toBe(4);
		expect(update.future).toBe(0);
		expect(update.newValue).toBe(1);
		expect(() => learner.trainTransition(near.cell)).toThrow('non-terminal');
	});
	test('changing tolls changes the best learned crossing', () => {
		const routes = [0, 4].map((toll) => {
			const learner = new DeliveryLearner(deliveryScenario('bridges', toll));
			for (let i = 0; i < 2000; i++) learner.trainEpisode(0.8);
			return learner.policyRoute();
		});
		expect(routes.every((r) => r.success)).toBe(true);
		expect(routes[0].steps).toBeLessThan(routes[1].steps);
		expect(routes[0].path).not.toEqual(routes[1].path);
	});
	test('recorded discounted reward equals the sum of actual discounted transition rewards', () => {
		const world = deliveryScenario('bridges'),
			learner = new DeliveryLearner(world);
		const episode = learner.trainEpisode(0.8);
		let reward = 0,
			discounted = 0;
		for (let i = 0; i < episode.steps; i++) {
			const transitions = [0, 1, 2, 3].map((a) => deliveryMove(world, episode.path[i], a));
			const move = transitions.find((t) => t.next === episode.path[i + 1])!;
			reward += move.reward;
			discounted += learner.discount ** i * move.reward;
		}
		expect(episode.reward).toBeCloseTo(reward, 10);
		expect(episode.discountedReward).toBeCloseTo(discounted, 10);
		expect(learner.actionVisits.flat().reduce((n, v) => n + v, 0)).toBe(episode.steps);
	});
	test('cloned comparison snapshots preserve RNG and cannot be mutated by continuing training', () => {
		const learner = new DeliveryLearner(deliveryScenario('bridges'));
		for (let i = 0; i < 200; i++) learner.trainEpisode(0.4);
		const copy = learner.clone(),
			before = learner.q.map((row) => [...row]);
		const next = copy.trainEpisode(0.4);
		expect(learner.q).toEqual(before);
		expect(next).toEqual(learner.trainEpisode(0.4));
		expect(copy.q).toEqual(learner.q);
	});
});
