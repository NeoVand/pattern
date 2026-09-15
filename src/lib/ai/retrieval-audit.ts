import { cosine, fieldNotes, keywordScore, type Passage } from './retrieval';

export interface RetrievalAuditCase {
	id: string;
	label: string;
	question: string;
	requiredSources: string[];
	expected: string;
	factPatterns: RegExp[];
}
export const RETRIEVAL_AUDIT_CASES: RetrievalAuditCase[] = [
	{
		id: 'doors',
		label: 'Opening time',
		question: 'What time do doors open at the Glasshouse botanical evening?',
		requiredSources: ['A'],
		expected: 'Doors open at 18:30.',
		factPatterns: [/\b18[.:]30\b|\b6[.:]30\s*p\.?m\.?/i]
	},
	{
		id: 'child',
		label: 'Child ticket',
		question: 'Do children under 12 enter free, and does every child need a reserved ticket?',
		requiredSources: ['B'],
		expected: 'Under-12s enter free with a paying adult, and still need a reserved ticket.',
		factPatterns: [
			/\bfree\b|\bno charge\b|\b(?:£|GBP)\s*0\b/i,
			/\b(?:paying|paid) adult\b/i,
			/\breserv(?:e|ed|ation)\b/i
		]
	},
	{
		id: 'member',
		label: 'Two-source answer',
		question:
			'Does annual membership include special evening events, and what is the adult botanical evening ticket price?',
		requiredSources: ['H', 'B'],
		expected: 'Members need a separate evening ticket. Adult tickets cost £12.',
		factPatterns: [
			/\bseparate\b|\bnot include\b|\bdoesn.t include\b/i,
			/(?:£\s*12\b|\b12\s*(?:pounds|GBP)\b)/i
		]
	},
	{
		id: 'missing',
		label: 'Missing evidence',
		question: 'How many visitors attended the Glasshouse last Saturday?',
		requiredSources: [],
		expected:
			'The field notes do not record attendance. The answer should acknowledge missing evidence.',
		factPatterns: []
	}
];
export type RetrievalAuditMode = 'keyword' | 'semantic';
export interface AuditHit {
	passage: Passage;
	score: number;
}
export interface AuditSearchResult {
	test: RetrievalAuditCase;
	hits: AuditHit[];
	requiredFound: number;
	recall: number | null;
	evidenceAvailable: boolean;
}
export function auditPassages(withheld: string): Passage[] {
	return fieldNotes.filter((passage) => passage.id !== withheld);
}
export function rankAuditPassages(
	question: string,
	passages: Passage[],
	topK: number,
	embeddings?: { passages: number[][]; query: number[] }
): AuditHit[] {
	if (embeddings && embeddings.passages.length !== passages.length)
		throw new Error('Every source needs a matching embedding.');
	return passages
		.map((passage, i) => ({
			passage,
			score: embeddings
				? cosine(embeddings.passages[i], embeddings.query)
				: keywordScore(question, `${passage.title} ${passage.body}`)
		}))
		.filter((hit) => embeddings || hit.score > 0)
		.sort((a, b) => b.score - a.score || a.passage.id.localeCompare(b.passage.id))
		.slice(0, topK);
}
export function scoreAuditRetrieval(
	test: RetrievalAuditCase,
	hits: AuditHit[],
	available: Passage[]
): AuditSearchResult {
	const requiredFound = test.requiredSources.filter((id) =>
		hits.some((hit) => hit.passage.id === id)
	).length;
	return {
		test,
		hits,
		requiredFound,
		recall: test.requiredSources.length ? requiredFound / test.requiredSources.length : null,
		evidenceAvailable:
			test.requiredSources.length > 0 &&
			test.requiredSources.every((id) => available.some((p) => p.id === id))
	};
}
export function runKeywordAudit(topK: number, withheld = '') {
	const passages = auditPassages(withheld);
	return RETRIEVAL_AUDIT_CASES.map((test) =>
		scoreAuditRetrieval(test, rankAuditPassages(test.question, passages, topK), passages)
	);
}
export function runEmbeddedAudit(topK: number, withheld: string, vectors: number[][]) {
	const passages = auditPassages(withheld);
	if (vectors.length !== passages.length + RETRIEVAL_AUDIT_CASES.length)
		throw new Error('The embedding response did not match the requested sources and questions.');
	return RETRIEVAL_AUDIT_CASES.map((test, i) =>
		scoreAuditRetrieval(
			test,
			rankAuditPassages(test.question, passages, topK, {
				passages: vectors.slice(0, passages.length),
				query: vectors[passages.length + i]
			}),
			passages
		)
	);
}
export function summarizeAudit(results: AuditSearchResult[]) {
	const found = results.reduce((n, result) => n + result.requiredFound, 0);
	const required = results.reduce((n, result) => n + result.test.requiredSources.length, 0);
	return { found, required, recall: required ? found / required : null };
}

export interface AuditAnswerGrade {
	expectation: 'facts' | 'abstention';
	factTokens: boolean | null;
	abstentionLanguage: boolean;
	citationIds: string[];
	requiredCitationIds: boolean | null;
	unknownCitationIds: string[];
}
/** Deliberately narrow text checks. These do not establish correctness, entailment, or full abstention. */
export function gradeAuditAnswer(result: AuditSearchResult, answer: string): AuditAnswerGrade {
	const enoughRetrieved =
		result.test.requiredSources.length > 0 &&
		result.requiredFound === result.test.requiredSources.length;
	const citationIds = [...new Set([...answer.matchAll(/\[([A-Z])\]/g)].map((match) => match[1]))];
	const abstentionLanguage =
		/\b(?:not (?:say|state|specify|provide|record|contain|include)|don.t (?:say|state|specify|provide|record|contain|include)|doesn.t (?:say|state|specify|provide|record|contain|include)|no (?:information|attendance|evidence|record)|(?:cannot|can.t|unable to) (?:determine|answer|confirm)|not (?:available|given|provided|specified|recorded)|unknown)\b/i.test(
			answer
		);
	return {
		expectation: enoughRetrieved ? 'facts' : 'abstention',
		factTokens: enoughRetrieved
			? result.test.factPatterns.every((pattern) => pattern.test(answer))
			: null,
		abstentionLanguage,
		citationIds,
		requiredCitationIds: enoughRetrieved
			? result.test.requiredSources.every((id) => citationIds.includes(id))
			: null,
		unknownCitationIds: citationIds.filter(
			(id) => !result.hits.some((hit) => hit.passage.id === id)
		)
	};
}
