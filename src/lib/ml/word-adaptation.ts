export const everydayCorpus = [
	'the day begins with a warm cup of tea',
	'the sun rises over the quiet garden',
	'the train arrives at the old station',
	'the sky is clear and the air is cool',
	'the river flows through the green valley',
	'the book tells a story about a journey',
	'the market sells fresh bread and fruit',
	'the evening brings a soft light',
	'a good day begins with a walk',
	'a small bird rests by the window',
	'we share a meal with friends',
	'we enjoy the morning and the quiet',
	'the food tastes fresh and the tea tastes warm',
	'a quiet room is a place to read',
	'the garden is green and the sky is blue',
	'the morning is cool and the evening is warm'
];

export const adaptationCorpora = {
	cafe: [
		'the coffee tastes rich',
		'the coffee tastes smooth',
		'the coffee tastes balanced',
		'the espresso tastes bold',
		'the espresso is rich',
		'the latte is creamy',
		'the latte tastes smooth',
		'the coffee has chocolate notes',
		'the espresso has caramel notes',
		'the coffee is roasted slowly',
		'the latte is made with steamed milk',
		'the coffee is served with milk',
		'a coffee is a warm drink',
		'a latte is a warm drink',
		'the espresso is served with water',
		'the coffee tastes bright'
	],
	space: [
		'the planet is rocky',
		'the planet is distant',
		'the planet has a moon',
		'the star is bright',
		'the star is distant',
		'the galaxy is vast',
		'the galaxy has many stars',
		'the planet orbits the star',
		'the moon orbits the planet',
		'the telescope sees the galaxy',
		'the telescope sees a distant star',
		'the sky is filled with stars',
		'a star is a distant sun',
		'a planet is a rocky world',
		'the moon is a quiet world',
		'the planet is observed with a telescope'
	]
};

export function wordTokens(text: string): string[] {
	return text.toLowerCase().match(/[a-z]+/g) ?? [];
}

export function adaptationVocabulary() {
	return [
		'<start>',
		'<end>',
		'<unknown>',
		...Array.from(
			new Set(
				[...everydayCorpus, ...adaptationCorpora.cafe, ...adaptationCorpora.space].flatMap(
					wordTokens
				)
			)
		).sort()
	];
}

export type NextWord = { word: string; probability: number };

/** A trainable one-word-context softmax network. This is deliberately not a transformer. */
export class TinyWordModel {
	readonly weights: Float64Array;
	private readonly ids: Map<string, number>;
	constructor(
		readonly vocabulary = adaptationVocabulary(),
		weights?: Float64Array
	) {
		this.weights = weights ? new Float64Array(weights) : new Float64Array(vocabulary.length ** 2);
		this.ids = new Map(vocabulary.map((word, index) => [word, index]));
	}
	clone() {
		return new TinyWordModel(this.vocabulary, this.weights);
	}
	contextWord(text: string) {
		return wordTokens(text).at(-1) ?? '<start>';
	}
	knownContext(text: string) {
		return this.ids.has(this.contextWord(text));
	}
	private id(word: string) {
		return this.ids.get(word) ?? this.ids.get('<unknown>')!;
	}
	distribution(context: string): number[] {
		const offset = this.id(this.contextWord(context)) * this.vocabulary.length;
		const row = this.weights.slice(offset, offset + this.vocabulary.length);
		const maximum = Math.max(...row);
		const values = Array.from(row, (value) => Math.exp(value - maximum));
		const sum = values.reduce((a, b) => a + b, 0);
		return values.map((value) => value / sum);
	}
	predict(context: string): NextWord[] {
		return this.distribution(context)
			.map((probability, index) => ({ word: this.vocabulary[index], probability }))
			.sort((a, b) => b.probability - a.probability);
	}
	private counts(corpus: string[]) {
		const rows = new Map<number, Float64Array>();
		for (const sentence of corpus) {
			const words = ['<start>', ...wordTokens(sentence), '<end>'];
			for (let i = 0; i < words.length - 1; i++) {
				const id = this.id(words[i]);
				const counts = rows.get(id) ?? new Float64Array(this.vocabulary.length);
				counts[this.id(words[i + 1])]++;
				rows.set(id, counts);
			}
		}
		return rows;
	}
	train(corpus: string[], epochs = 1, rate = 0.5) {
		const counts = this.counts(corpus);
		for (let epoch = 0; epoch < epochs; epoch++) {
			for (const [context, row] of counts) {
				const offset = context * this.vocabulary.length;
				const logits = this.weights.slice(offset, offset + this.vocabulary.length);
				const maximum = Math.max(...logits);
				const probabilities = Array.from(logits, (weight) => Math.exp(weight - maximum));
				const normalizer = probabilities.reduce((a, b) => a + b, 0);
				const total = row.reduce((a, b) => a + b, 0);
				for (let target = 0; target < this.vocabulary.length; target++) {
					this.weights[offset + target] -=
						rate * (probabilities[target] / normalizer - row[target] / total);
				}
			}
		}
	}
	loss(corpus: string[]) {
		let loss = 0,
			count = 0;
		for (const [context, row] of this.counts(corpus)) {
			const logits = this.weights.slice(
				context * this.vocabulary.length,
				(context + 1) * this.vocabulary.length
			);
			const maximum = Math.max(...logits);
			const logNormalizer =
				maximum +
				Math.log(
					Array.from(logits, (value) => Math.exp(value - maximum)).reduce((a, b) => a + b, 0)
				);
			for (let target = 0; target < row.length; target++) {
				loss += row[target] * (logNormalizer - logits[target]);
				count += row[target];
			}
		}
		return count ? loss / count : 0;
	}
	distance(other: TinyWordModel) {
		return Math.sqrt(
			this.weights.reduce((sum, value, i) => sum + (value - other.weights[i]) ** 2, 0) /
				this.weights.length
		);
	}
	weight(context: string, target: string) {
		return this.weights[this.id(context) * this.vocabulary.length + this.id(target)];
	}
}
