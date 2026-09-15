import { expect, test } from 'vitest';
import { MnistAutoencoder } from './autoencoder';
import {
	balancedTransferIndices,
	fitTransferKnn,
	runTransferComparison
} from './transfer-learning';
import type { AutoencoderData } from './autoencoder-datasets';

function smallData(): AutoencoderData {
	const labels = Int32Array.from([0, 0, 0, 0, 1, 1, 1, 1]);
	const pixels = Float32Array.from(
		[...labels].flatMap((label, index) =>
			label ? [0.02 * index, 1, 0, 0] : [1, 0.02 * index, 0, 0]
		)
	);
	return { trainX: pixels, trainY: labels, testX: pixels.slice(), testY: labels.slice() };
}

test('balanced selections are repeatable, unique, and capped by available examples', () => {
	const labels = [0, 0, 0, 1, 1, 1];
	const picked = balancedTransferIndices(labels, [0, 1], 2, 9);
	expect(picked).toEqual(balancedTransferIndices(labels, [0, 1], 2, 9));
	expect(new Set(picked.indices).size).toBe(4);
	expect(picked.indices.filter((index) => labels[index] === 0)).toHaveLength(2);
	expect(balancedTransferIndices(labels, [0, 1], 8, 9).perClass).toBe(3);
});

test('the downstream classifier uses labeled neighbors and train-only coordinate scales', () => {
	const classifier = fitTransferKnn([
		{ index: 0, label: 0, code: [-10, -1] },
		{ index: 1, label: 0, code: [-9, -1] },
		{ index: 2, label: 0, code: [-8, -1] },
		{ index: 3, label: 1, code: [8, 1] },
		{ index: 4, label: 1, code: [9, 1] },
		{ index: 5, label: 1, code: [10, 1] }
	]);
	expect(classifier([-9, -0.9]).label).toBe(0);
	expect(classifier([9, 0.9]).label).toBe(1);
	expect(classifier([9, 0.9]).neighbors.map((item) => item.index)).toEqual([4, 3, 5]);
});

test('snapshot copies survive later training and random current weights get no fabricated advantage', async () => {
	const model = new MnistAutoencoder([4, 2, 4], 7);
	let yielded = false;
	const result = await runTransferComparison({
		model,
		dataset: smallData(),
		labelBudget: 3,
		seed: 91,
		revision: 5,
		encoderStep: 12,
		yieldControl: async () => {
			if (!yielded) {
				model.weights[0].fill(100);
				yielded = true;
			}
		}
	});
	expect(result.current.trainCodes).toEqual(result.random.trainCodes);
	expect(result.current.testCodes).toEqual(result.random.testCodes);
	expect(result.current.predictions).toEqual(result.random.predictions);
	expect(result.revision).toBe(5);
	expect(result.encoderStep).toBe(12);
	expect(result.current.perClass.reduce((sum, item) => sum + item.correct, 0)).toBe(
		result.current.correct
	);
	expect(yielded).toBe(true);
});

test('abort stops encoding without changing source weights', async () => {
	const model = new MnistAutoencoder([4, 2, 4]);
	const original = model.pack();
	const controller = new AbortController();
	controller.abort();
	await expect(
		runTransferComparison({
			model,
			dataset: smallData(),
			labelBudget: 2,
			seed: 1,
			revision: 0,
			encoderStep: 0,
			signal: controller.signal
		})
	).rejects.toThrow('cancelled');
	expect(model.pack()).toEqual(original);
});
