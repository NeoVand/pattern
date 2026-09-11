import { describe, expect, test } from 'vitest';
import { Network, dataset, sigmoid } from './models';
import { inspectNetwork, neuronResponse } from './network-inspection';

describe('the visible forward pass', () => {
	test.each([4, 8, 12])('preserves every neuron and learned weight at width %i', (width) => {
		for (const depth of [0, 1, 2]) {
			const network = new Network([2, ...Array(depth).fill(width), 1], true);
			const layers = inspectNetwork(network, [0.4, -0.3]);
			expect(layers.map((layer) => layer.length)).toEqual(network.sizes);
			expect(layers.flat().flatMap((neuron) => neuron.contributions)).toHaveLength(
				network.weights.flat(2).length
			);
			for (const neuron of layers.flat().filter((node) => node.layer > 0)) {
				const sum =
					neuron.bias +
					neuron.contributions.reduce((total, term) => total + term.input * term.weight, 0);
				expect(neuron.sum).toBeCloseTo(sum, 12);
				expect(neuron.activation).toBeCloseTo(
					neuron.function === 'tanh' ? Math.tanh(sum) : sigmoid(sum),
					12
				);
			}
			expect(layers.at(-1)![0].activation).toBe(network.predict([0.4, -0.3]));
		}
	});

	test('shows a real response to input changes, updates after learning, and keeps inference read-only', () => {
		const network = new Network([2, 8, 8, 1], true);
		const weights = JSON.stringify(network.weights);
		const first = inspectNetwork(network, [0.4, -0.3]);
		const second = inspectNetwork(network, [-0.8, 0.6]);
		expect(first[1][0].activation).not.toBe(second[1][0].activation);
		expect(JSON.stringify(network.weights)).toBe(weights);
		network.train(dataset('neural-classifier').filter((sample) => sample.split === 'train'));
		expect(inspectNetwork(network, [0.4, -0.3])[1][0].activation).not.toBe(first[1][0].activation);
		expect(JSON.stringify(network.weights)).not.toBe(weights);
	});

	test('maps exact activations and preserves a linear regression output', () => {
		const network = new Network([1, 4, 1]);
		const view = inspectNetwork(network, [0.7]);
		const output = view.at(-1)![0];
		expect(output.function).toBe('linear');
		expect(output.activation).toBe(output.sum);
		const map = neuronResponse(network, 1, 2);
		for (const point of map) expect(point.value).toBe(network.activations([point.x])[1][2]);
	});
});
