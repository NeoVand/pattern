export type ChapterArt = {
	asset: string;
	title: string;
	alt: string;
	caption: string;
	note: string;
	action: string;
	tone: 'dark' | 'light';
	width?: number;
	height?: number;
};

export const chapterArt: Record<string, ChapterArt> = {
	'self-supervised': {
		asset: 'edition-3/self-supervised',
		title: 'The next word is already in the book',
		alt: 'An open book holds the context Once upon a on ivory tiles. A lavender continuation tile reveals time, the target supplied by the text itself.',
		caption: 'The data contains the question and its answer.',
		note: 'A next-token objective uses earlier text as context and the following token as its training target. Token boundaries depend on the tokenizer. The MNIST lab below explores another self-supervised objective: reconstructing an image through a two-dimensional code, with a regularizer on that code.',
		action: 'Explore self-supervision',
		tone: 'light',
		width: 1942,
		height: 809
	},
	clustering: {
		asset: 'edition-2/clustering-islands',
		title: 'Structure without an answer key',
		alt: 'Three groups of ice-blue, lavender, and apricot mineral pebbles, each with a ring marking its center.',
		caption: 'Similarity brings examples together. You decide what the groups mean.',
		note: 'The stones are a visual analogy for clustering by measured features. The café experiment below actually assigns examples to their nearest center and updates the centers from those assignments.',
		action: 'Discover the groups',
		tone: 'dark',
		width: 1672,
		height: 941
	},
	reinforcement: {
		asset: 'edition-3/reward-garden',
		title: 'A route learned through experience',
		alt: 'Two matching ivory mazes: lavender paths wander through early attempts on the left, while a blue route reaches the apricot goal on the right.',
		caption: 'A good action can lead to a reward several steps later.',
		note: 'The two mazes illustrate exploration and an improved policy. They are not traces from the lab. The live delivery world below has its own layout, learned action values, and policy. A language-model agent does not necessarily learn a new policy while it runs.',
		action: 'Train a policy',
		tone: 'dark',
		width: 1841,
		height: 700
	},
	adaptation: {
		asset: 'edition-2/adaptation-library',
		title: 'Learn broadly, then specialize',
		alt: 'Pretrain: broad botanical examples feed a blue model stack. Adapt: specialized flower examples change its weights. Use: a locked model produces an iris card.',
		caption: 'Training changes the model. Inference uses what was learned.',
		note: 'The three stations show different uses of data. The tiny model below actually updates softmax weights during pretraining and adaptation. It is not a transformer or a full language model at modern scale.',
		action: 'Adapt a small model',
		tone: 'light',
		width: 1942,
		height: 725
	},
	retrieval: {
		asset: 'edition-3/retrieval-constellation',
		title: 'A question finds its sources',
		alt: 'A botanical library answers a question about shade-loving plants. One blue line connects the Fern card to the Fern answer; a separate line connects Moss to Moss.',
		caption: 'Bring the right evidence into the conversation.',
		note: 'The two connections show which source supports each part of an answer. Source 1 and Source 2 are illustrative tabs. Below, real embeddings retrieve passages and the language model receives the selected sources as context.',
		action: 'Search by meaning',
		tone: 'dark',
		width: 1923,
		height: 752
	},
	vision: {
		asset: 'edition-2/vision-lens',
		title: 'Different inputs, shared context',
		alt: 'A flower image and the question “What color?” meet at a lens labeled “Image + words”, producing the answer “An orange flower.”',
		caption: 'Pixels and words can become part of the same question.',
		note: 'The glass bridge is an analogy for combining modalities. A vision-language model works with learned numerical representations. The lab sends the selected image pixels along with your question.',
		action: 'Ask an image',
		tone: 'dark',
		width: 1942,
		height: 599
	},
	evaluation: {
		asset: 'edition-3/evaluation-balance',
		title: 'A fluent answer still needs evidence',
		alt: 'A lavender ribbon says Sounds convincing. A magnifying glass over reference cards reveals two conflicting summit elevation claims: 8,848 m and 8,844 m.',
		caption: 'Judge what the answer supports, not just how it sounds.',
		note: 'The two elevations are illustrative conflicting claims, not verified measurements of a named mountain. Checking an answer requires examining sources and resolving disagreements. The live evaluation runs real questions with visible grading rules; a small suite cannot establish reliability for every use.',
		action: 'Evaluate a model',
		tone: 'light',
		width: 1882,
		height: 820
	},
	training: {
		asset: 'edition-2/learning-landscape',
		title: 'A landscape of error',
		alt: 'Seven brass spheres trace a downhill route over layered ice-blue and lavender glass terrain into a low basin.',
		caption: 'Each correction is a step toward a better prediction.',
		note: 'The landscape is an analogy: a position represents model settings, and height represents loss. Gradient descent follows the local slope. Its path need not reach the lowest point in every landscape.',
		action: 'Train a line',
		tone: 'dark',
		width: 1672,
		height: 941
	},
	forecasting: {
		asset: 'edition-3/forecast-seasons',
		title: 'Patterns cross the boundary of time',
		alt: 'A repeating blue wave labeled Observed crosses a time boundary into a dashed lavender Forecast, surrounded by widening translucent uncertainty bands.',
		caption: 'Past patterns are clues. The future still carries uncertainty.',
		note: 'Seasonality is a pattern that repeats over time. A forecast extends what was learned from the past. The widening bands illustrate uncertainty, not calculated prediction intervals or outputs from the model below.',
		action: 'Forecast demand',
		tone: 'dark',
		width: 1938,
		height: 536
	},
	'deep-learning': {
		asset: 'edition-3/neuron-anatomy',
		title: 'Inside one neuron',
		alt: 'A labeled neuron: three Inputs pass through adjustable Weights, meet in a Sum with a Bias, then pass through an Activation to one Output.',
		caption: 'Multiply the inputs by weights. Add a bias. Apply an activation.',
		note: 'This is a visual analogy for one neuron: multiply inputs by weights, add a bias, then apply a nonlinear activation. The live network below exposes the actual values. Its hidden neurons use tanh, with a sigmoid classifier output or a linear regression output.',
		action: 'Look inside the network',
		tone: 'dark',
		width: 1927,
		height: 787
	},
	tokens: {
		asset: 'edition-3/tokens-fieldguide',
		title: 'Pieces become numerical representations',
		alt: 'The sentence The cat sleeps. is split into four illustrative text pieces. A butterfly image becomes four patches. Each piece points to a small capsule representing a numerical vector.',
		caption: 'Words and image patches become pieces a model can work with.',
		note: 'The bead capsules stand for vectors; their colors are not actual embedding values. Text boundaries depend on the tokenizer. Image encoders may resize, project, combine, or add tokens. The explorer below shows actual text IDs and exact image regions.',
		action: 'Explore tokens and patches',
		tone: 'dark',
		width: 1738,
		height: 801
	},
	representations: {
		asset: 'edition-2/seeing-in-layers',
		title: 'Seeing in layers',
		alt: 'Four labeled representations of a blue sneaker: Pixels, Edges, Parts, and Object.',
		caption: 'A useful representation makes the next step easier.',
		note: 'Pixels, edges, parts, and objects are a visual analogy for increasingly useful representations. Real learned layers can mix many features; they do not each have one fixed, human-readable job.',
		action: 'Inspect a vision network',
		tone: 'light',
		width: 1942,
		height: 624
	},
	language: {
		asset: 'edition-3/transformer-atelier',
		title: 'From context to the next token',
		alt: 'Five context tokens, The key is on the, enter a transformer block. A five-by-five grid permits attention only to current and earlier positions. Next-token alternatives table, shelf, and desk have different illustrative bar lengths.',
		caption: 'Read the context. Predict a token. Add it, and repeat.',
		note: 'The grid shows allowed attention positions, not measured attention weights: each row can use itself and earlier columns. Attention and neural transformations repeat across blocks. The bar lengths are illustrative, not live probabilities. Generation selects one token, appends it to the context, and repeats.',
		action: 'Run a language model',
		tone: 'light',
		width: 1935,
		height: 598
	},
	agents: {
		asset: 'edition-3/agent-circuit',
		title: 'A model that can use tools',
		alt: 'A goal reaches a model. The model calls a tool, the tool returns a result to the model, and the model can either continue the loop or finish at Done.',
		caption: 'An action produces a result. That result informs the next step.',
		note: 'The model requests a tool; the application runs it and returns the result as context. The loop continues until the task is done or a stopping rule is reached. The lab below records real tool calls and their results.',
		action: 'Run an agent',
		tone: 'light',
		width: 1948,
		height: 799
	}
};
