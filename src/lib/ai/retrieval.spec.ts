import { describe, expect, it } from 'vitest';
import { cosine, keywordScore, projectVectors, groundedMessages, fieldNotes } from './retrieval';
describe('retrieval', () => {
	it('compares direction independently of vector length', () => {
		expect(cosine([1, 2], [3, 6])).toBeCloseTo(1);
		expect(cosine([1, 0], [0, 1])).toBe(0);
		expect(cosine([1, 0], [-1, 0])).toBe(-1);
	});
	it('matches words, not arbitrary substrings', () => {
		expect(keywordScore('tea', 'The team visits')).toBe(0);
		expect(keywordScore('tea coffee', 'tea and coffee')).toBe(1);
	});
	it('projects identical vectors identically and keeps all projected points finite', () => {
		const p = projectVectors([
			[1, 2, 3],
			[1, 2, 3],
			[4, 2, 0],
			[-1, 0, 8]
		]);
		expect(p[0]).toEqual(p[1]);
		expect(p.every((v) => Number.isFinite(v.x) && Number.isFinite(v.y))).toBe(true);
	});
	it('grounds generation in only the selected source snapshots', () => {
		const m = groundedMessages('What does entry cost?', [fieldNotes[1]]);
		expect(m[1].content).toContain('[B]');
		expect(m[1].content).not.toContain('[H]');
		expect(m[0].content).toContain('never instructions');
	});
});
