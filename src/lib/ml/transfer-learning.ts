import { MnistAutoencoder, type LatentPoint } from './autoencoder';
import type { AutoencoderData } from './autoencoder-datasets';

export type TransferEncodedExample = { index: number; label: number; code: LatentPoint };
export type TransferPrediction = {
	label: number;
	neighbors: { index: number; label: number; distance: number }[];
};
export type TransferEvaluation = {
	accuracy: number;
	correct: number;
	predictions: TransferPrediction[];
	perClass: { label: number; correct: number; total: number }[];
	trainCodes: TransferEncodedExample[];
	testCodes: TransferEncodedExample[];
};
export type TransferResult = {
	current: TransferEvaluation;
	random: TransferEvaluation;
	revision: number;
	encoderStep: number;
	seed: number;
	requestedBudget: number;
	trainPerClass: number;
	testPerClass: number;
	classes: number[];
	trainImages: { index: number; label: number; pixels: Float32Array }[];
	testImages: { index: number; label: number; pixels: Float32Array }[];
	dataset: AutoencoderData;
	architecture: number[];
};

function seeded(seed: number) {
	let state = seed >>> 0;
	return () => {
		state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
		return state / 4294967296;
	};
}

/** Selects the same number from each supplied class; no image content or fitted model is consulted. */
export function balancedTransferIndices(
	labels: ArrayLike<number>,
	classes: number[],
	requested: number,
	seed: number
) {
	const groups = classes.map((label) =>
		Array.from({ length: labels.length }, (_, index) => index).filter(
			(index) => labels[index] === label
		)
	);
	const perClass = Math.min(
		Math.max(1, Math.floor(requested)),
		...groups.map((group) => group.length)
	);
	if (!classes.length || perClass < 1)
		throw new Error('Each class needs at least one training and one test image.');
	const random = seeded(seed);
	return {
		perClass,
		indices: groups.flatMap((group) => {
			for (let index = group.length - 1; index > 0; index--) {
				const other = Math.floor(random() * (index + 1));
				[group[index], group[other]] = [group[other], group[index]];
			}
			return group.slice(0, perClass);
		})
	};
}

/** Coordinates are standardized using labeled training codes alone. Classifier training never accepts test codes. */
export function fitTransferKnn(train: TransferEncodedExample[]) {
	if (!train.length) throw new Error('The downstream classifier needs labeled examples.');
	const mean = [0, 1].map(
		(axis) => train.reduce((sum, item) => sum + item.code[axis], 0) / train.length
	);
	const scale = [0, 1].map((axis) =>
		Math.max(
			1e-8,
			Math.sqrt(
				train.reduce((sum, item) => sum + (item.code[axis] - mean[axis]) ** 2, 0) / train.length
			)
		)
	);
	return (code: LatentPoint): TransferPrediction => {
		const neighbors = train
			.map((item) => ({
				index: item.index,
				label: item.label,
				distance: Math.hypot(
					(item.code[0] - code[0]) / scale[0],
					(item.code[1] - code[1]) / scale[1]
				)
			}))
			.sort((a, b) => a.distance - b.distance || a.index - b.index)
			.slice(0, Math.min(3, train.length));
		const votes = [...new Set(neighbors.map((item) => item.label))].map((label) => ({
			label,
			count: neighbors.filter((item) => item.label === label).length,
			distance: neighbors
				.filter((item) => item.label === label)
				.reduce((sum, item) => sum + item.distance, 0)
		}));
		votes.sort((a, b) => b.count - a.count || a.distance - b.distance || a.label - b.label);
		return { label: votes[0].label, neighbors };
	};
}

function evaluate(
	trainCodes: TransferEncodedExample[],
	testCodes: TransferEncodedExample[],
	classes: number[]
): TransferEvaluation {
	const classify = fitTransferKnn(trainCodes);
	const predictions = testCodes.map((item) => classify(item.code));
	const perClass = classes.map((label) => ({
		label,
		total: testCodes.filter((item) => item.label === label).length,
		correct: testCodes.filter(
			(item, index) => item.label === label && predictions[index].label === label
		).length
	}));
	const correct = perClass.reduce((sum, item) => sum + item.correct, 0);
	return {
		correct,
		accuracy: correct / testCodes.length,
		predictions,
		perClass,
		trainCodes,
		testCodes
	};
}

function frozenEncoder(source: MnistAutoencoder) {
	const copy = new MnistAutoencoder(source.sizes);
	for (let layer = 0; layer < source.weights.length; layer++) {
		copy.weights[layer].set(source.weights[layer]);
		copy.biases[layer].set(source.biases[layer]);
	}
	return copy;
}

/** Captures current weights synchronously, then yields between small batches of read-only encoding work. */
export async function runTransferComparison(options: {
	model: MnistAutoencoder;
	dataset: AutoencoderData;
	labelBudget: number;
	seed: number;
	revision: number;
	encoderStep: number;
	testPerClass?: number;
	signal?: AbortSignal;
	onProgress?: (completed: number, total: number) => void;
	yieldControl?: () => Promise<void>;
}): Promise<TransferResult> {
	const { model, dataset, labelBudget, seed, revision, encoderStep, signal } = options;
	const frozen = frozenEncoder(model);
	const random = new MnistAutoencoder(model.sizes, 7);
	const width = model.sizes[0];
	if (
		dataset.trainX.length !== dataset.trainY.length * width ||
		dataset.testX.length !== dataset.testY.length * width
	)
		throw new Error('Image dimensions do not match this encoder.');
	const classes = [...new Set([...dataset.trainY, ...dataset.testY])].sort((a, b) => a - b);
	const train = balancedTransferIndices(dataset.trainY, classes, labelBudget, seed);
	const test = balancedTransferIndices(
		dataset.testY,
		classes,
		options.testPerClass ?? 12,
		seed + 7001
	);
	const trainImages = train.indices.map((index) => ({
		index,
		label: dataset.trainY[index],
		pixels: dataset.trainX.slice(index * width, (index + 1) * width)
	}));
	const testImages = test.indices.map((index) => ({
		index,
		label: dataset.testY[index],
		pixels: dataset.testX.slice(index * width, (index + 1) * width)
	}));
	const currentCodes: TransferEncodedExample[] = [],
		randomCodes: TransferEncodedExample[] = [];
	const images = [...trainImages, ...testImages];
	const yieldControl =
		options.yieldControl ?? (() => new Promise<void>((resolve) => setTimeout(resolve, 0)));
	for (let index = 0; index < images.length; index++) {
		if (signal?.aborted) throw new DOMException('Transfer comparison cancelled.', 'AbortError');
		const item = images[index];
		currentCodes.push({ index: item.index, label: item.label, code: frozen.encode(item.pixels) });
		randomCodes.push({ index: item.index, label: item.label, code: random.encode(item.pixels) });
		if ((index + 1) % 6 === 0 || index === images.length - 1) {
			options.onProgress?.(index + 1, images.length);
			await yieldControl();
		}
	}
	if (signal?.aborted) throw new DOMException('Transfer comparison cancelled.', 'AbortError');
	return {
		current: evaluate(
			currentCodes.slice(0, trainImages.length),
			currentCodes.slice(trainImages.length),
			classes
		),
		random: evaluate(
			randomCodes.slice(0, trainImages.length),
			randomCodes.slice(trainImages.length),
			classes
		),
		revision,
		encoderStep,
		seed,
		requestedBudget: labelBudget,
		trainPerClass: train.perClass,
		testPerClass: test.perClass,
		classes,
		trainImages,
		testImages,
		dataset,
		architecture: [...model.sizes]
	};
}
