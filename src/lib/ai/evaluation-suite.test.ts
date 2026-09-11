import { describe, expect, it } from 'vitest';
import { evaluationCases, scoreEvaluation } from './evaluation-suite';

describe('transparent evaluation scoring', () => {
	it('accepts only an exact textual answer with documented normalization', () => {
		const criterion = { kind: 'exact' as const, answer: 'UNKNOWN' };
		expect(scoreEvaluation(criterion, '  unknown\n')).toBe(true);
		expect(scoreEvaluation(criterion, 'UNKNOWN, but probably 40')).toBe(false);
		expect(scoreEvaluation(criterion, 'The answer is UNKNOWN')).toBe(false);
		expect(scoreEvaluation(criterion, 'UNKNOWN.')).toBe(false);
	});
	it('checks JSON semantics without accepting extra keys, wrong types, or Markdown', () => {
		const criterion = { kind: 'json' as const, answer: { speaker: 'Iris', date: '2031-04-08' } };
		expect(scoreEvaluation(criterion, '{"date":"2031-04-08", "speaker":"Iris"}')).toBe(true);
		expect(scoreEvaluation(criterion, '{"speaker":"Iris","date":"2031-04-08","note":"ok"}')).toBe(
			false
		);
		expect(scoreEvaluation(criterion, '{"speaker":"Iris","date":20310408}')).toBe(false);
		expect(scoreEvaluation(criterion, '```json\n{"speaker":"Iris","date":"2031-04-08"}\n```')).toBe(
			false
		);
		expect(scoreEvaluation(criterion, 'null')).toBe(false);
		expect(scoreEvaluation(criterion, '[]')).toBe(false);
	});
	it('does not award a substring match for a wrong calculation', () => {
		const criterion = evaluationCases.find((item) => item.id === 'calculate')!.criterion;
		expect(scoreEvaluation(criterion, '46')).toBe(true);
		expect(scoreEvaluation(criterion, '146')).toBe(false);
	});
});
