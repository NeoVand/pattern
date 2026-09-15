export type RepresentationTask = 'rings' | 'diagonal' | 'xor';
export type RepresentationKind = 'raw' | 'radius' | 'tree' | 'network';
export type PlaneExample = { x: number; y: number; label: number; id: number };
export type PlanePredictor = {
	kind: RepresentationKind;
	predict: (x: number, y: number) => number;
	parameters: number;
	effort: string;
	description: string;
};

function randomFrom(seed: number) {
	let state = seed >>> 0;
	return () => {
		state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
		return state / 4294967296;
	};
}
export function representationData(
	task: RepresentationTask,
	count: number,
	seed: number
): PlaneExample[] {
	const random = randomFrom(seed);
	return Array.from({ length: count }, (_, id) => {
		const x = random() * 2 - 1;
		const y = random() * 2 - 1;
		const label = +(task === 'rings'
			? x * x + y * y > 0.64
			: task === 'diagonal'
				? x + y > 0.1
				: x * y > 0);
		return { x, y, label, id };
	});
}

const sigmoid = (z: number) => 1 / (1 + Math.exp(-Math.max(-40, Math.min(40, z))));
export function scoreRepresentation(model: PlanePredictor, data: PlaneExample[]) {
	let correct = 0;
	let loss = 0;
	for (const item of data) {
		const probability = Math.max(1e-9, Math.min(1 - 1e-9, model.predict(item.x, item.y)));
		correct += +(+(probability >= 0.5) === item.label);
		loss -= item.label * Math.log(probability) + (1 - item.label) * Math.log(1 - probability);
	}
	return { accuracy: correct / data.length, loss: loss / data.length, correct, count: data.length };
}

function fitLogistic(data: PlaneExample[], radial: boolean, epochs: number): PlanePredictor {
	const inputs = (x: number, y: number) => (radial ? [x * x + y * y, 1] : [x, y, 1]);
	const weights = Array(radial ? 2 : 3).fill(0) as number[];
	for (let epoch = 0; epoch < epochs; epoch++) {
		const gradient = weights.map(() => 0);
		for (const item of data) {
			const features = inputs(item.x, item.y);
			const error =
				sigmoid(features.reduce((sum, value, index) => sum + value * weights[index], 0)) -
				item.label;
			for (let index = 0; index < weights.length; index++)
				gradient[index] += error * features[index];
		}
		for (let index = 0; index < weights.length; index++)
			weights[index] -=
				0.35 *
				(gradient[index] / data.length +
					(index === weights.length - 1 ? 0 : 0.001 * weights[index]));
	}
	return {
		kind: radial ? 'radius' : 'raw',
		predict: (x, y) =>
			sigmoid(inputs(x, y).reduce((sum, value, index) => sum + value * weights[index], 0)),
		parameters: weights.length,
		effort: `${epochs} full-batch gradient updates`,
		description: radial
			? `sigmoid(${weights[0].toFixed(2)} × (x² + y²) + ${weights[1].toFixed(2)})`
			: `sigmoid(${weights[0].toFixed(2)}x + ${weights[1].toFixed(2)}y + ${weights[2].toFixed(2)})`
	};
}

type TreeNode = {
	probability: number;
	feature?: 'x' | 'y';
	threshold?: number;
	left?: TreeNode;
	right?: TreeNode;
};
function fitTree(data: PlaneExample[]): PlanePredictor {
	let splitCount = 0;
	let leafCount = 0;
	const impurity = (items: PlaneExample[]) => {
		const positive = items.reduce((sum, item) => sum + item.label, 0);
		return items.length ? positive * (1 - positive / items.length) : 0;
	};
	function build(items: PlaneExample[], depth: number): TreeNode {
		const probability = items.reduce((sum, item) => sum + item.label, 0) / items.length;
		let best = impurity(items);
		let split:
			| { feature: 'x' | 'y'; threshold: number; left: PlaneExample[]; right: PlaneExample[] }
			| undefined;
		if (depth < 4 && items.length >= 8 && best > 0) {
			for (const feature of ['x', 'y'] as const) {
				const sorted = [...items].sort((a, b) => a[feature] - b[feature]);
				for (let index = 4; index <= sorted.length - 4; index++) {
					const threshold = (sorted[index - 1][feature] + sorted[index][feature]) / 2;
					if (sorted[index - 1][feature] === sorted[index][feature]) continue;
					const left = sorted.slice(0, index),
						right = sorted.slice(index);
					const candidate = impurity(left) + impurity(right);
					if (candidate < best - 1e-12) {
						best = candidate;
						split = { feature, threshold, left, right };
					}
				}
			}
		}
		if (!split) {
			leafCount++;
			return { probability };
		}
		splitCount++;
		return {
			probability,
			feature: split.feature,
			threshold: split.threshold,
			left: build(split.left, depth + 1),
			right: build(split.right, depth + 1)
		};
	}
	const root = build(data, 0);
	return {
		kind: 'tree',
		parameters: splitCount + leafCount,
		effort: `Greedy Gini splits · depth ≤ 4 · leaves ≥ 4 examples`,
		description: `${splitCount} learned thresholds, ${leafCount} leaf probabilities. ${root.feature ? `First split: ${root.feature} < ${root.threshold!.toFixed(2)}.` : 'No useful split found.'}`,
		predict: (x, y) => {
			let node = root;
			while (node.feature)
				node = (node.feature === 'x' ? x : y) < node.threshold! ? node.left! : node.right!;
			return node.probability;
		}
	};
}

function fitNetwork(data: PlaneExample[], epochs: number, seed: number): PlanePredictor {
	const random = randomFrom(seed);
	const width = 12;
	const hidden = Array.from({ length: width }, () => [
		random() * 2 - 1,
		random() * 2 - 1,
		(random() - 0.5) * 0.4
	]);
	const output = Array.from({ length: width }, () => (random() - 0.5) * 0.6);
	let bias = 0;
	for (let epoch = 0; epoch < epochs; epoch++) {
		const dh = hidden.map(() => [0, 0, 0]),
			dv = output.map(() => 0);
		let db = 0;
		for (const item of data) {
			const activations = hidden.map((weights) =>
				Math.tanh(weights[0] * item.x + weights[1] * item.y + weights[2])
			);
			const error =
				sigmoid(activations.reduce((sum, value, index) => sum + output[index] * value, bias)) -
				item.label;
			db += error;
			for (let index = 0; index < width; index++) {
				dv[index] += error * activations[index];
				const delta = error * output[index] * (1 - activations[index] ** 2);
				dh[index][0] += delta * item.x;
				dh[index][1] += delta * item.y;
				dh[index][2] += delta;
			}
		}
		for (let index = 0; index < width; index++) {
			output[index] -= 0.35 * (dv[index] / data.length + 0.001 * output[index]);
			for (let feature = 0; feature < 3; feature++)
				hidden[index][feature] -=
					0.35 *
					(dh[index][feature] / data.length + (feature < 2 ? 0.001 * hidden[index][feature] : 0));
		}
		bias -= (0.35 * db) / data.length;
	}
	return {
		kind: 'network',
		parameters: width * 4 + 1,
		effort: `${epochs} full-batch gradient updates · 12 tanh units`,
		description: '2 → 12 tanh units → 1 sigmoid output. Learns a representation from x and y.',
		predict: (x, y) =>
			sigmoid(
				hidden.reduce(
					(sum, weights, index) =>
						sum + output[index] * Math.tanh(weights[0] * x + weights[1] * y + weights[2]),
					bias
				)
			)
	};
}

/** Training accepts training examples only. Selection and held-out evaluation live outside this function. */
export function fitRepresentations(
	train: PlaneExample[],
	epochs = 600,
	seed = 73
): PlanePredictor[] {
	return [
		fitLogistic(train, false, epochs),
		fitLogistic(train, true, epochs),
		fitTree(train),
		fitNetwork(train, epochs, seed)
	];
}
