import { expect, test } from 'vitest';
import { compatibleModels } from './catalog';
test('model picker only presents available compatible families and collapses dated versions', () => {
	const ids = [
		'gpt-4.1-mini',
		'gpt-4.1-mini-2025-04-14',
		'text-embedding-3-small',
		'gpt-audio-1.5',
		'gpt-4.1-2025-04-14',
		'gpt-4o-mini-tts'
	];
	expect(compatibleModels(ids, 'language').map((m) => m.value)).toEqual([
		'gpt-4.1-mini',
		'gpt-4.1-2025-04-14'
	]);
	expect(compatibleModels(ids, 'speech').map((m) => m.value)).toEqual([
		'gpt-audio-1.5',
		'gpt-4o-mini-tts'
	]);
	expect(compatibleModels([], 'language')).toEqual([]);
});
