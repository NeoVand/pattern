import { expect, test } from 'vitest';
import { fieldNotes, keywordScore } from './retrieval';
import {
	RETRIEVAL_AUDIT_CASES,
	auditPassages,
	gradeAuditAnswer,
	rankAuditPassages,
	runEmbeddedAudit,
	runKeywordAudit,
	summarizeAudit
} from './retrieval-audit';

test('keyword rankings use the actual shared score and top-k cutoff', () => {
	const testCase = RETRIEVAL_AUDIT_CASES[1];
	const hits = rankAuditPassages(testCase.question, fieldNotes, 2);
	const expected = fieldNotes
		.map((p) => ({ id: p.id, score: keywordScore(testCase.question, `${p.title} ${p.body}`) }))
		.filter((p) => p.score > 0)
		.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
		.slice(0, 2);
	expect(hits.map((hit) => ({ id: hit.passage.id, score: hit.score }))).toEqual(expected);
	expect(hits[0].passage.id).toBe('B');
});

test('withholding a required source lowers recall instead of removing it from the denominator', () => {
	const complete = runKeywordAudit(4);
	const missing = runKeywordAudit(4, 'B');
	expect(summarizeAudit(missing).required).toBe(summarizeAudit(complete).required);
	expect(summarizeAudit(missing).found).toBeLessThan(summarizeAudit(complete).found);
	expect(missing[1].evidenceAvailable).toBe(false);
	expect(missing[1].recall).toBe(0);
	expect(missing[1].hits.every((hit) => hit.passage.id !== 'B')).toBe(true);
	expect(missing[3].recall).toBeNull();
});

test('embedding ranking is determined by cosine values rather than required source labels', () => {
	const passages = auditPassages('');
	const vectors = [
		...passages.map((_, i) => [Number(i === 3), Number(i !== 3)]),
		...RETRIEVAL_AUDIT_CASES.map(() => [1, 0])
	];
	const results = runEmbeddedAudit(1, '', vectors);
	expect(results.every((result) => result.hits[0].passage.id === 'D')).toBe(true);
	expect(summarizeAudit(results).found).toBe(0);
});

test('fact tokens and citation presence are separate checks and unsupported source IDs are identified', () => {
	const result = runKeywordAudit(4)[0];
	const noCitation = gradeAuditAnswer(result, 'Doors open at 18:30.');
	expect(noCitation.factTokens).toBe(true);
	expect(noCitation.requiredCitationIds).toBe(false);
	const wrongFact = gradeAuditAnswer(result, 'Doors open at 15:00. [A]');
	expect(wrongFact.factTokens).toBe(false);
	expect(wrongFact.requiredCitationIds).toBe(true);
	expect(gradeAuditAnswer(result, 'Doors open at 18:30. [Z]').unknownCitationIds).toEqual(['Z']);
});

test('missing evidence requires explicit uncertainty but a matching phrase is not proof of safe abstention', () => {
	const result = runKeywordAudit(3)[3];
	expect(
		gradeAuditAnswer(result, 'The notes do not say how many people attended.').abstentionLanguage
	).toBe(true);
	expect(gradeAuditAnswer(result, 'Exactly 240 people attended.').abstentionLanguage).toBe(false);
	expect(
		gradeAuditAnswer(result, 'The notes do not say, but I guess 240.').abstentionLanguage
	).toBe(true);
	expect(gradeAuditAnswer(result, 'The notes do not say.').factTokens).toBeNull();
	const withheld = runKeywordAudit(4, 'B')[1];
	expect(
		gradeAuditAnswer(withheld, 'The supplied notes do not provide ticket rules.').expectation
	).toBe('abstention');
});
