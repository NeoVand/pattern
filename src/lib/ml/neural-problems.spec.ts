import { describe, expect, it } from 'vitest';
import { Network } from './models';
import { neuralDataset, neuralProblems, type NeuralProblem } from './neural-problems';

function learn(problem: NeuralProblem, sizes: number[], steps = 600) {
	const samples = neuralDataset(problem);
	const training = samples.filter((sample) => sample.split === 'train');
	const test = samples.filter((sample) => sample.split === 'test');
	const network = new Network(sizes, true, 49);
	for (let i = 0; i < steps; i++) network.train(training);
	return { accuracy: network.accuracy(test), loss: network.loss(test) };
}

describe('the neural problem gallery', () => {
	it.each(neuralProblems)(
		'$label has reproducible, balanced, distinct held-out samples',
		({ id }) => {
			const samples = neuralDataset(id);
			expect(neuralDataset(id)).toEqual(samples);
			expect(neuralDataset(id, 43)).not.toEqual(samples);
			expect(new Set(samples.map((sample) => sample.x.join(','))).size).toBe(samples.length);
			for (const split of ['train', 'validation', 'test'] as const) {
				const part = samples.filter((sample) => sample.split === split);
				expect(part.filter((sample) => sample.y === 1)).toHaveLength(part.length / 2);
			}
			expect(
				samples.every((sample) => sample.x.every((x) => Number.isFinite(x) && Math.abs(x) < 1))
			).toBe(true);
		}
	);
	it('a line is enough for clouds but nonlinear hidden neurons are needed for XOR', () => {
		expect(learn('clouds', [2, 1]).accuracy).toBe(1);
		expect(learn('xor', [2, 1]).accuracy).toBeLessThan(0.6);
		expect(learn('xor', [2, 4, 1]).accuracy).toBeGreaterThan(0.95);
	});
	it.each(neuralProblems)(
		'a real network learns $label using only its training split',
		({ id }) => {
			const result = learn(id, [2, 12, 12, 1]);
			expect(result.accuracy).toBeGreaterThanOrEqual(0.95);
			expect(result.loss).toBeLessThan(0.08);
		}
	);
	it.each(['checkerboard', 'spirals'] as const)(
		'%s exposes the limits of a small network',
		(id) => {
			const small = learn(id, [2, 4, 1]);
			const larger = learn(id, [2, 12, 12, 1]);
			expect(larger.accuracy - small.accuracy).toBeGreaterThan(0.15);
		}
	);
});
