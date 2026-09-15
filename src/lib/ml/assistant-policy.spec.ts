import { describe, expect, test } from 'vitest';
import {
	evaluatePolicy,
	INITIAL_POLICY_WEIGHTS,
	POLICY_HELDOUT_TASKS,
	POLICY_TRAIN_TASKS,
	policyProbabilities,
	preferenceObjective,
	supervisedObjective,
	trainPolicy,
	type PolicyWeights
} from './assistant-policy';

describe('inspectable assistant policy', () => {
	test('training and evaluation use different task records and normalized probabilities', () => {
		const trainingIds = new Set(POLICY_TRAIN_TASKS.map((task) => task.id));
		for (const task of POLICY_HELDOUT_TASKS) {
			expect(trainingIds.has(task.id)).toBe(false);
			const probabilities = policyProbabilities([1000, -1000, 200], task);
			expect(probabilities.reduce((sum, p) => sum + p, 0)).toBeCloseTo(1, 12);
			expect(probabilities.every(Number.isFinite)).toBe(true);
		}
	});
	test('supervised and preference gradients agree with finite differences', () => {
		const weights: PolicyWeights = [0.3, -0.2, 0.5];
		const epsilon = 1e-5;
		for (const objective of [
			supervisedObjective,
			(w: PolicyWeights) => preferenceObjective(w, 'grounded'),
			(w: PolicyWeights) => preferenceObjective(w, 'confident')
		]) {
			const { gradient } = objective(weights);
			for (let i = 0; i < weights.length; i++) {
				const plus: PolicyWeights = [...weights],
					minus: PolicyWeights = [...weights];
				plus[i] += epsilon;
				minus[i] -= epsilon;
				expect(gradient[i]).toBeCloseTo(
					(objective(plus).loss - objective(minus).loss) / (2 * epsilon),
					7
				);
			}
		}
	});
	test('demonstrations improve appropriate answers on separate cards', () => {
		const initial = [...INITIAL_POLICY_WEIGHTS] as PolicyWeights;
		const learned = trainPolicy(initial, 'supervised', 40);
		expect(initial).toEqual(INITIAL_POLICY_WEIGHTS);
		expect(supervisedObjective(learned).loss).toBeLessThan(supervisedObjective(initial).loss);
		expect(evaluatePolicy(learned).appropriateProbability).toBeGreaterThan(0.85);
		expect(evaluatePolicy(learned).correctTopChoice).toBe(12);
	});
	test('bad reward improves its loss while worsening factual behavior', () => {
		const supervised = trainPolicy(INITIAL_POLICY_WEIGHTS, 'supervised', 40);
		const confident = trainPolicy(supervised, 'confident', 40);
		const grounded = trainPolicy(supervised, 'grounded', 40);
		expect(preferenceObjective(confident, 'confident').loss).toBeLessThan(
			preferenceObjective(supervised, 'confident').loss
		);
		expect(evaluatePolicy(confident).assertiveness).toBeGreaterThan(
			evaluatePolicy(supervised).assertiveness
		);
		expect(evaluatePolicy(confident).unsupportedProbability).toBeGreaterThan(0.7);
		expect(evaluatePolicy(confident).correctTopChoice).toBe(0);
		expect(evaluatePolicy(grounded).appropriateProbability).toBeGreaterThan(
			evaluatePolicy(supervised).appropriateProbability
		);
	});
});
