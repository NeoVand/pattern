import { expect, test } from 'vitest';
import { evaluationCases, evaluationPrompts } from './evaluation-suite';
import {
	evaluationCohort,
	evaluationSuiteSignature,
	isCompleteEvaluation,
	type EvaluationRun
} from './evaluation-runs';

function run(id: number, passed = 6): EvaluationRun {
	return {
		id,
		batchId: 1,
		trial: id,
		requestedTrials: 3,
		style: 'brief',
		model: 'Model label',
		modelId: 'actual-model',
		provider: 'openai',
		startedAt: '2030-01-01T00:00:00.000Z',
		prompt: evaluationPrompts.brief,
		temperature: 0,
		maxTokens: 140,
		suiteSignature: evaluationSuiteSignature,
		status: 'complete',
		elapsedMs: 10,
		results: evaluationCases.map((item, index) => ({
			id: item.id,
			status: index < passed ? 'passed' : 'failed',
			output: 'retained output',
			elapsedMs: 1,
			request: { model: 'actual-model', temperature: 0, max_output_tokens: 140 }
		}))
	};
}

test('aggregates matching complete trials and preserves per-case denominators and score variation', () => {
	const trials = [run(1), run(2, 4), run(3, 5)];
	const summary = evaluationCohort(trials, trials[0]);
	expect(summary.scores.map((item) => item.passed)).toEqual([6, 4, 5]);
	expect(summary.mean).toBe(5);
	expect(summary.minimum).toBe(4);
	expect(summary.maximum).toBe(6);
	expect(summary.cases[5]).toMatchObject({ passed: 1, total: 3 });
});

test('cancelled, failed requests, and falsely marked complete trials never enter an aggregate', () => {
	const complete = run(1);
	const stopped = { ...run(2), status: 'stopped' as const };
	const missing = run(3);
	missing.results.pop();
	const requestError = run(4);
	requestError.results[0].status = 'error';
	const duplicate = run(5);
	duplicate.results[5].id = duplicate.results[0].id;
	const summary = evaluationCohort([complete, stopped, missing, requestError, duplicate], stopped);
	expect(summary.completed).toHaveLength(1);
	expect(summary.excluded).toBe(4);
	expect(summary.cases.every((item) => item.total === 1)).toBe(true);
	expect(isCompleteEvaluation(duplicate)).toBe(false);
});

test('same display name cannot merge different providers, model IDs, prompts, or transmitted settings', () => {
	const reference = run(1);
	const provider = { ...run(2), provider: 'local' };
	const model = { ...run(3), modelId: 'other-model' };
	const prompt = { ...run(4), prompt: evaluationPrompts.careful };
	const omitted = run(5);
	for (const result of omitted.results) delete result.request!.temperature;
	const summary = evaluationCohort([reference, provider, model, prompt, omitted], reference);
	expect(summary.completed.map((item) => item.id)).toEqual([1]);
	expect(summary.differentSettings).toBe(1);
});
