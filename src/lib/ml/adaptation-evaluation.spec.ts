import { expect, test } from 'vitest';
import {
	TinyWordModel,
	adaptationEvaluation,
	adaptationCorpora,
	everydayCorpus
} from './word-adaptation';
test('evaluation uses separate sentences and cannot change model weights', () => {
	const training = new Set([
		...everydayCorpus,
		...adaptationCorpora.cafe,
		...adaptationCorpora.space
	]);
	for (const corpus of Object.values(adaptationEvaluation))
		for (const text of corpus) expect(training.has(text)).toBe(false);
	const model = new TinyWordModel();
	model.train(everydayCorpus, 20);
	const weights = model.weights.slice();
	for (const corpus of Object.values(adaptationEvaluation))
		expect(Number.isFinite(model.loss(corpus))).toBe(true);
	expect(model.weights).toEqual(weights);
});
