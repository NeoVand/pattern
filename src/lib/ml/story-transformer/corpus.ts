import { asset } from '$app/paths';
export type StoryCorpus = {
	tokens: Uint16Array;
	trainTokens: number;
	validationTokens: number;
	trainStories: number;
	validationStories: number;
	chars: string[];
	examples: string[];
	encode: (text: string) => number[];
	decode: (ids: number[]) => string;
};
export async function loadStories(): Promise<StoryCorpus> {
	const [data, meta] = await Promise.all([
		fetch(asset('/data/tinystories/tokens.bin')),
		fetch(asset('/data/tinystories/corpus.json'))
	]);
	if (!data.ok || !meta.ok) throw new Error('The story dataset could not be loaded.');
	const info = await meta.json();
	const ids = new Map<string, number>(info.chars.map((c: string, i: number) => [c, i]));
	return {
		...info,
		tokens: Uint16Array.from(new Uint8Array(await data.arrayBuffer())),
		encode: (text: string) => [...text].map((c) => ids.get(c) ?? ids.get(' ')!),
		decode: (tokens: number[]) => tokens.map((i) => info.chars[i] ?? '').join('')
	};
}
export const storyConfig = {
	name: 'Pattern stories',
	nLayer: 2,
	nEmbd: 32,
	nHead: 4,
	blockSize: 64,
	vocab: 96
};
export const storyParameterCount = 32768;
