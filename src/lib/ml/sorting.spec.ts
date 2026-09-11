import { describe, it, expect } from 'vitest';
import { sortingFrames } from './sorting';
describe('The sorting lesson', () => {
	it('sorts unseen inputs, preserves all values, and leaves the original unchanged', () => {
		for (const input of [[4, 1, 6, 2, 5, 3], [8, -2, 8, 0, -5], [1], []]) {
			const original = [...input];
			const frames = sortingFrames(input);
			expect(frames.at(-1)?.values).toEqual([...input].sort((a, b) => a - b));
			expect(input).toEqual(original);
			expect(frames.at(-1)?.action).toBe('done');
			for (const frame of frames)
				expect([...frame.values].sort((a, b) => a - b)).toEqual([...input].sort((a, b) => a - b));
		}
	});
	it('finishes after a no-swap pass when the input is already ordered', () => {
		const frames = sortingFrames([1, 2, 3, 4, 5, 6]);
		expect(frames.at(-1)).toMatchObject({ comparisons: 5, swaps: 0, action: 'done' });
		expect(frames.some((f) => f.action === 'swap')).toBe(false);
	});
});
