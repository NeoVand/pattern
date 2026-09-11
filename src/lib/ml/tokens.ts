export type TextToken = {
	id: number;
	position: number;
	bytes: number[];
	text: string | null;
	display: string;
	annotation: string | null;
};
export type Tokenization = {
	tokens: TextToken[];
	decoded: string;
	characters: number;
	byteCount: number;
};

let tokenizerPromise:
	| Promise<{
			api: typeof import('gpt-tokenizer/encoding/o200k_base');
			ranks: (string | number[])[];
	  }>
	| undefined;

/** Load the encoding and its published byte vocabulary only when this chapter is opened. */
async function loadTokenizer() {
	if (!tokenizerPromise) {
		tokenizerPromise = Promise.all([
			import('gpt-tokenizer/encoding/o200k_base'),
			import('gpt-tokenizer/bpeRanks/o200k_base')
		])
			.then(([api, vocabulary]) => ({ api, ranks: vocabulary.default }))
			.catch((error: unknown) => {
				tokenizerPromise = undefined;
				throw error;
			});
	}
	return tokenizerPromise;
}

const invisibleNames: Record<string, string> = {
	'\u200D': 'ZWJ',
	'\u200C': 'ZWNJ',
	'\u200B': 'ZWSP',
	'\uFE0E': 'VS15',
	'\uFE0F': 'VS16'
};

function visibleTokenText(text: string) {
	return text
		.replaceAll(' ', '·')
		.replaceAll('\n', '↵')
		.replaceAll('\t', '⇥')
		.replaceAll('\r', '␍')
		.replace(
			/[\p{Cf}\p{Cc}\uFE0E\uFE0F]/gu,
			(character) =>
				invisibleNames[character] ??
				`U+${character.codePointAt(0)!.toString(16).padStart(4, '0').toUpperCase()}`
		);
}

export async function tokenizeText(input: string): Promise<Tokenization> {
	const { api, ranks } = await loadTokenizer();
	// User-entered strings that resemble special tokens remain ordinary literal text.
	const ids = api.encode(input, { disallowedSpecial: new Set() });
	const encoder = new TextEncoder();
	const strictDecoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });
	const tokens = ids.map((id, position) => {
		const value = ranks[id];
		const bytes = typeof value === 'string' ? [...encoder.encode(value)] : [...value];
		let text: string | null = null;
		try {
			text = strictDecoder.decode(new Uint8Array(bytes));
		} catch {
			// A byte-level token can contain only part of one Unicode character.
		}
		const annotation =
			text === '\u200D'
				? 'ZWJ is a zero-width joiner. It connects neighboring emoji into one visible symbol.'
				: text !== null && /[\p{Cf}\p{Cc}\uFE0E\uFE0F]/u.test(text.replace(/[\n\r\t]/g, ''))
					? 'This token contains an invisible formatting character, shown here with a named marker.'
					: null;
		return {
			id,
			position,
			bytes,
			text,
			annotation,
			display:
				text === null
					? bytes.map((byte) => byte.toString(16).padStart(2, '0').toUpperCase()).join(' ')
					: visibleTokenText(text)
		};
	});
	return {
		tokens,
		decoded: new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(
			new Uint8Array(tokens.flatMap((token) => token.bytes))
		),
		characters: [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(input)]
			.length,
		byteCount: encoder.encode(input).length
	};
}

export type ImagePatch = {
	index: number;
	row: number;
	column: number;
	x: number;
	y: number;
	width: number;
	height: number;
};

/** Partition every source pixel once, in row-major order, without crop or overlap. */
export function imagePatches(width: number, height: number, grid: number): ImagePatch[] {
	if (![width, height, grid].every(Number.isInteger) || grid < 1 || width < grid || height < grid) {
		throw new RangeError('The source dimensions and grid must be positive whole numbers.');
	}
	return Array.from({ length: grid * grid }, (_, index) => {
		const column = index % grid;
		const row = Math.floor(index / grid);
		const x = Math.floor((column * width) / grid);
		const y = Math.floor((row * height) / grid);
		return {
			index,
			row,
			column,
			x,
			y,
			width: Math.floor(((column + 1) * width) / grid) - x,
			height: Math.floor(((row + 1) * height) / grid) - y
		};
	});
}
