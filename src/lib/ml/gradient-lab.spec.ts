import { expect, test } from 'vitest';
import {
	finiteDifferenceTiny,
	INITIAL_TINY_WEIGHTS,
	TINY_EXAMPLES,
	tinyMeanLoss,
	traceTiny,
	updateTiny,
	WEIGHT_NAMES
} from './gradient-lab';

test('every chain-rule derivative matches an independent central finite difference', () => {
	for (const example of TINY_EXAMPLES) {
		for (const key of WEIGHT_NAMES) {
			expect(traceTiny(INITIAL_TINY_WEIGHTS, example).gradients[key]).toBeCloseTo(
				finiteDifferenceTiny(INITIAL_TINY_WEIGHTS, example, key),
				8
			);
		}
	}
});

test('SGD uses the old gradients simultaneously and learns the training curve', () => {
	let weights = { ...INITIAL_TINY_WEIGHTS };
	const first = updateTiny(weights, TINY_EXAMPLES[5], 0.1);
	for (const key of WEIGHT_NAMES)
		expect(first[key]).toBeCloseTo(
			weights[key] - 0.1 * traceTiny(weights, TINY_EXAMPLES[5]).gradients[key],
			12
		);
	for (let epoch = 0; epoch < 120; epoch++)
		for (const example of TINY_EXAMPLES) weights = updateTiny(weights, example, 0.1);
	expect(tinyMeanLoss(weights)).toBeLessThan(0.005);
	expect(tinyMeanLoss(weights)).toBeLessThan(tinyMeanLoss(INITIAL_TINY_WEIGHTS) / 20);
});
