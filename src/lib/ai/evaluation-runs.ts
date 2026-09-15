import { evaluationCases, type EvaluationStyle } from './evaluation-suite';

export type EvaluationCaseResult = {
	id: string;
	output: string;
	status: 'waiting' | 'running' | 'passed' | 'failed' | 'error' | 'stopped';
	elapsedMs: number;
	error?: string;
	request?: Record<string, unknown>;
};
export type EvaluationRun = {
	id: number;
	batchId: number;
	trial: number;
	requestedTrials: number;
	style: EvaluationStyle;
	model: string;
	modelId: string;
	provider: string;
	startedAt: string | null;
	prompt: string;
	temperature: number;
	maxTokens: number;
	suiteSignature: string;
	status: 'queued' | 'running' | 'complete' | 'stopped' | 'error';
	elapsedMs: number;
	results: EvaluationCaseResult[];
	stopReason?: string;
};

export const evaluationSuiteSignature = JSON.stringify(evaluationCases);
export function countEvaluationPasses(run: EvaluationRun) {
	return run.results.filter((result) => result.status === 'passed').length;
}
export function isCompleteEvaluation(run: EvaluationRun) {
	return (
		run.status === 'complete' &&
		run.results.length === evaluationCases.length &&
		evaluationCases.every((item) => {
			const results = run.results.filter((result) => result.id === item.id);
			return results.length === 1 && ['passed', 'failed'].includes(results[0].status);
		})
	);
}

/** Actual transmitted sampling settings distinguish an omitted temperature from greedy local decoding. */
function effectiveSettings(run: EvaluationRun) {
	return JSON.stringify(
		[
			...new Set(
				run.results.map((result) =>
					result.request
						? JSON.stringify({
								temperature: result.request.temperature ?? null,
								doSample: result.request.do_sample ?? null,
								maxTokens: result.request.max_output_tokens ?? result.request.max_new_tokens ?? null
							})
						: 'unrecorded'
				)
			)
		].sort()
	);
}

export function evaluationCohort(runs: EvaluationRun[], reference: EvaluationRun) {
	const matching = runs.filter(
		(run) =>
			run.provider === reference.provider &&
			run.modelId === reference.modelId &&
			run.prompt === reference.prompt &&
			run.temperature === reference.temperature &&
			run.maxTokens === reference.maxTokens &&
			run.suiteSignature === reference.suiteSignature
	);
	const settingsReference = isCompleteEvaluation(reference)
		? reference
		: (matching.find(isCompleteEvaluation) ?? reference);
	const settings = effectiveSettings(settingsReference);
	const completed = matching
		.filter((run) => isCompleteEvaluation(run) && effectiveSettings(run) === settings)
		.sort((a, b) => a.id - b.id);
	const scores = completed.map((run) => ({
		id: run.id,
		batchId: run.batchId,
		trial: run.trial,
		passed: countEvaluationPasses(run)
	}));
	return {
		completed,
		excluded: matching.filter((run) => !isCompleteEvaluation(run)).length,
		differentSettings: matching.filter(
			(run) => isCompleteEvaluation(run) && effectiveSettings(run) !== settings
		).length,
		scores,
		mean: scores.length ? scores.reduce((sum, row) => sum + row.passed, 0) / scores.length : null,
		minimum: scores.length ? Math.min(...scores.map((row) => row.passed)) : null,
		maximum: scores.length ? Math.max(...scores.map((row) => row.passed)) : null,
		cases: evaluationCases.map((item) => ({
			id: item.id,
			title: item.title,
			passed: completed.filter(
				(run) => run.results.find((result) => result.id === item.id)?.status === 'passed'
			).length,
			total: completed.length
		}))
	};
}
