import { dataset, random, type Sample } from './models';

export const neuralProblems = [
	{
		id: 'clouds',
		label: 'Clouds',
		level: 'Linear',
		question: 'Can one straight boundary separate two clouds?',
		hint: 'Try no hidden layers. Extra depth adds little when a straight line already works.'
	},
	{
		id: 'xor',
		label: 'XOR',
		level: 'Nonlinear',
		question: 'Opposite corners belong together. One line cannot separate them.',
		hint: 'Start with no hidden layers, then add one. Several neuron responses can combine into separate regions.'
	},
	{
		id: 'rings',
		label: 'Rings',
		level: 'Enclosure',
		question: 'Learn to separate the inner circle from the outer ring.',
		hint: 'A straight boundary cannot enclose a class. Hidden neurons can combine to wrap around it.'
	},
	{
		id: 'moons',
		label: 'Moons',
		level: 'Curved',
		question: 'Two crescent-shaped classes curve around one another.',
		hint: 'Compare four neurons with twelve. The boundary needs to bend between the two crescents.'
	},
	{
		id: 'checkerboard',
		label: 'Checkerboard',
		level: 'Many regions',
		question: 'The class changes again each time you cross a square.',
		hint: 'Try two layers of twelve. Many separate regions need more capacity; watch the held-out accuracy too.'
	},
	{
		id: 'spirals',
		label: 'Spirals',
		level: 'Challenge',
		question: 'Two intertwined spirals need a boundary that winds between them.',
		hint: 'Give two layers of twelve time to learn. Hundreds of updates may only uncover part of the pattern.'
	}
] as const;

export type NeuralProblem = (typeof neuralProblems)[number]['id'];

/** Synthetic two-input problems. Labels alternate within each disjoint split. */
export function neuralDataset(problem: NeuralProblem, seed = 42, noise = 0.12): Sample[] {
	// Retain the original ring experiment as the default, including its 96/32/32 split.
	if (problem === 'rings') return dataset('neural-classifier', seed, noise);
	const r = random(seed);
	const cells = [
		[
			[0, 0],
			[0, 2],
			[1, 1],
			[2, 0],
			[2, 2]
		],
		[
			[0, 1],
			[1, 0],
			[1, 2],
			[2, 1]
		]
	];
	return Array.from({ length: 320 }, (_, i) => {
		const label = i % 2;
		const split: Sample['split'] = i % 5 < 3 ? 'train' : i % 5 === 3 ? 'validation' : 'test';
		const jitter = () => (r() - 0.5) * noise;
		let x: number, y: number;
		if (problem === 'clouds') {
			x = (label ? 0.45 : -0.45) + (r() + r() - 1) * 0.32 + jitter();
			y = (label ? 0.12 : -0.12) + (r() + r() - 1) * 0.65;
		} else if (problem === 'xor') {
			const sign = r() < 0.5 ? -1 : 1;
			x = sign * (0.17 + r() * 0.64) + jitter();
			y = sign * (label ? -1 : 1) * (0.17 + r() * 0.64) + jitter();
		} else if (problem === 'moons') {
			const angle = r() * Math.PI;
			x = (Math.cos(angle) + label - 0.5) * 0.55 + jitter() * 0.6;
			y = ((label ? 0.5 - Math.sin(angle) : Math.sin(angle)) - 0.25) * 0.8 + jitter() * 0.6;
		} else if (problem === 'checkerboard') {
			const cell = cells[label][Math.floor(r() * cells[label].length)];
			x = -0.9 + (cell[0] + 0.09 + r() * 0.82) * 0.6 + jitter() * 0.3;
			y = -0.9 + (cell[1] + 0.09 + r() * 0.82) * 0.6 + jitter() * 0.3;
		} else {
			const t = r();
			const angle = 0.35 + t * Math.PI * 2.5 + label * Math.PI;
			const radius = 0.12 + t * 0.72;
			x = radius * Math.cos(angle) + jitter() * 0.3;
			y = radius * Math.sin(angle) + jitter() * 0.3;
		}
		return { x: [x, y], y: label, split };
	});
}
