import { describe, expect, it } from 'vitest';
import { imagePatches, tokenizeText } from './tokens';

describe('real o200k_base tokenization', () => {
	it('uses known vocabulary IDs and keeps whitespace', async () => {
		const result = await tokenizeText('Hello, world!');
		expect(result.tokens.map((token) => token.id)).toEqual([13225, 11, 2375, 0]);
		expect(result.tokens[2].text).toBe(' world');
		expect(result.decoded).toBe('Hello, world!');
	});
	it('reconstructs Unicode exactly even when individual tokens contain incomplete characters', async () => {
		const text = '🧑🏽‍🚀 café 世界 नमस्ते\n';
		const result = await tokenizeText(text);
		const bytes = new Uint8Array(result.tokens.flatMap((token) => token.bytes));
		expect(new TextDecoder('utf-8', { fatal: true }).decode(bytes)).toBe(text);
		expect(result.decoded).toBe(text);
		expect(result.tokens.some((token) => token.text === null)).toBe(true);
		expect(result.byteCount).toBe(bytes.length);
		expect(result.tokens.find((token) => token.text === '\u200D')?.display).toBe('ZWJ');
	});
	it('treats special-looking input as literal text and handles empty input', async () => {
		expect((await tokenizeText('<|endoftext|>')).decoded).toBe('<|endoftext|>');
		expect((await tokenizeText('')).tokens).toEqual([]);
		const mark = await tokenizeText('\uFEFF');
		expect(mark.decoded).toBe('\uFEFF');
		expect(mark.tokens.every((token) => token.display.length > 0)).toBe(true);
	});
});

describe('image patches', () => {
	it('covers an uneven image exactly with no missing edges or overlapping pixels', () => {
		for (const grid of [4, 8, 12]) {
			const patches = imagePatches(1660, 948, grid);
			expect(patches).toHaveLength(grid * grid);
			expect(patches.reduce((area, patch) => area + patch.width * patch.height, 0)).toBe(
				1660 * 948
			);
			for (let row = 0; row < grid; row++) {
				const strip = patches.slice(row * grid, (row + 1) * grid);
				expect(strip[0].x).toBe(0);
				expect(strip.at(-1)!.x + strip.at(-1)!.width).toBe(1660);
				for (let column = 1; column < grid; column++) {
					expect(strip[column].x).toBe(strip[column - 1].x + strip[column - 1].width);
				}
			}
			expect(patches.at(-1)!.y + patches.at(-1)!.height).toBe(948);
		}
	});
	it('keeps positions ordered and rejects impossible geometry', () => {
		expect(imagePatches(800, 600, 4)[6]).toEqual({
			index: 6,
			row: 1,
			column: 2,
			x: 400,
			y: 150,
			width: 200,
			height: 150
		});
		expect(() => imagePatches(2, 2, 4)).toThrow(RangeError);
	});
});
