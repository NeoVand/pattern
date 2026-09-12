// A bounded, attributed subset of the original TinyStories release; no generated substitute.
import { mkdirSync, writeFileSync } from 'node:fs';
const origin = 'https://huggingface.co/datasets/roneneldan/TinyStories/resolve/main/';
async function take(file, budget) {
	const response = await fetch(origin + file);
	if (!response.ok) throw Error(`TinyStories: ${response.status}`);
	const reader = response.body.getReader();
	let bytes = 0,
		parts = [];
	while (bytes < budget) {
		const { value, done } = await reader.read();
		if (done) break;
		parts.push(value);
		bytes += value.length;
	}
	await reader.cancel();
	const raw = Buffer.concat(parts).toString('utf8');
	return raw
		.split('<|endoftext|>')
		.slice(0, -1)
		.map((s) => s.trim())
		.filter(Boolean);
}
const normalize = (s) =>
	s
		.replace(/[‘’]/g, "'")
		.replace(/[“”]/g, '"')
		.replace(/[–—]/g, '-')
		.replace(/…/g, '...')
		.replace(/[^\n\x20-\x7e]/g, ' ')
		.replace(/[ \t]+/g, ' ')
		.trim();
const train = (await take('TinyStories-train.txt', 1800000)).map(normalize);
const validation = (await take('TinyStories-valid.txt', 120000)).map(normalize);
const textA = train.join('\n\n') + '\n\n',
	textB = validation.join('\n\n') + '\n\n';
const chars = ['\n', ...Array.from({ length: 95 }, (_, i) => String.fromCharCode(i + 32))];
const ids = new Map(chars.map((c, i) => [c, i]));
const root = 'static/data/tinystories';
mkdirSync(root, { recursive: true });
writeFileSync(
	root + '/tokens.bin',
	Uint8Array.from(textA + textB, (c) => ids.get(c))
);
const meta = {
	dataset: 'TinyStories',
	authors: 'Ronen Eldan and Yuanzhi Li',
	source: 'https://huggingface.co/datasets/roneneldan/TinyStories',
	license: 'CDLA-Sharing-1.0',
	licenseUrl: 'https://cdla.dev/sharing-1-0/',
	prepared: '2026-09-11',
	modifications:
		'First complete stories from original train and validation splits; punctuation normalized to printable ASCII. Blank lines separate stories.',
	trainStories: train.length,
	validationStories: validation.length,
	trainTokens: textA.length,
	validationTokens: textB.length,
	chars,
	examples: train.slice(0, 3)
};
writeFileSync(root + '/corpus.json', JSON.stringify(meta));
const lic = await fetch('https://cdla.dev/sharing-1-0/');
writeFileSync(root + '/LICENSE.html', await lic.text());
console.log({
	trainStories: train.length,
	validationStories: validation.length,
	trainTokens: textA.length,
	validationTokens: textB.length
});
