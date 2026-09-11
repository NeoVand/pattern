import type { Network } from './models';

export type NeuronTrace = {
	id: string;
	layer: number;
	index: number;
	activation: number;
	bias: number;
	sum: number;
	function: 'input' | 'tanh' | 'sigmoid' | 'linear';
	contributions: { id: string; input: number; weight: number; product: number }[];
};

/** Read the trained model, including every neuron and every incoming connection. */
export function inspectNetwork(network: Network, input: number[]): NeuronTrace[][] {
	const activations = network.activations(input);
	return network.sizes.map((size, layer) =>
		Array.from({ length: size }, (_, index) => {
			const contributions = layer
				? network.weights[layer - 1][index].map((weight, source) => ({
						id: `${layer - 1}-${source}`,
						input: activations[layer - 1][source],
						weight,
						product: weight * activations[layer - 1][source]
					}))
				: [];
			const bias = layer ? network.biases[layer - 1][index] : 0;
			return {
				id: `${layer}-${index}`,
				layer,
				index,
				activation: activations[layer][index],
				bias,
				sum: layer ? contributions.reduce((sum, term) => sum + term.product, bias) : input[index],
				function: !layer
					? 'input'
					: layer < network.sizes.length - 1
						? 'tanh'
						: network.classification
							? 'sigmoid'
							: 'linear',
				contributions
			};
		})
	);
}

export function neuronResponse(network: Network, layer: number, neuron: number, resolution = 21) {
	const twoDimensions = network.sizes[0] === 2;
	return Array.from({ length: twoDimensions ? resolution * resolution : resolution }, (_, i) => {
		const x = -1 + ((i % resolution) / (resolution - 1)) * 2;
		const y = twoDimensions ? 1 - (Math.floor(i / resolution) / (resolution - 1)) * 2 : 0;
		return { id: i, x, y, value: network.activations(twoDimensions ? [x, y] : [x])[layer][neuron] };
	});
}
