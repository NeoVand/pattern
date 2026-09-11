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
	clustering: {
		asset: 'clustering-islands',
		title: 'Structure without an answer key',
		alt: 'Three groups of green, lavender, and amber stones on an oval dark tray, with a brass ring marking the center of each group.',
		caption: 'Similarity brings examples together. You decide what the groups mean.',
		note: 'The stones are a visual analogy for clustering by measured features. The café experiment below actually assigns examples to their nearest center and updates the centers from those assignments.',
		action: 'Discover the groups',
		tone: 'dark',
		width: 1660
	},
	reinforcement: {
		asset: 'reward-garden',
		title: 'A route learned through experience',
		alt: 'A brass sphere follows a winding path through a tiled garden toward an arch labeled Reward; dotted branches explore dead ends.',
		caption: 'A good action can lead to a reward several steps later.',
		note: 'This garden is an illustration of exploration and delayed reward. The live delivery world below has its own layout, learned action values, and policy. A language-model agent does not necessarily learn a new policy while it runs.',
		action: 'Train a policy',
		tone: 'dark'
	},
	adaptation: {
		asset: 'adaptation-library',
		title: 'Learn broadly, then specialize',
		alt: 'A wide library of examples feeds a pretraining station, a smaller lavender stack feeds adaptation, and a locked model at inference produces a paper answer.',
		caption: 'Training changes the model. Inference uses what was learned.',
		note: 'The three stations show different uses of data. The tiny model below actually updates softmax weights during pretraining and adaptation. It is not a transformer or a full language model at modern scale.',
		action: 'Adapt a small model',
		tone: 'light'
	},
	retrieval: {
		asset: 'retrieval-constellation',
		title: 'A question finds its sources',
		alt: 'A lavender question card connects to three botanical source cards and an answer card among a larger suspended library.',
		caption: 'Bring the right evidence into the conversation.',
		note: 'The illustrated library is a metaphor, not a record of a model request. Below, OpenAI computes real embeddings and a language model receives only the passages shown as selected sources.',
		action: 'Search by meaning',
		tone: 'dark'
	},
	vision: {
		asset: 'vision-lens',
		title: 'Different inputs, shared context',
		alt: 'A photograph, a handwritten botanical notebook, and a chart feed through a glass lens into an answer sheet.',
		caption: 'Pixels and words can become part of the same question.',
		note: 'The optical lens is an analogy for combining modalities. The actual vision model uses learned numerical representations. The lab passes the selected image pixels along with your question.',
		action: 'Ask an image',
		tone: 'dark'
	},
	evaluation: {
		asset: 'evaluation-balance',
		title: 'Fluency on one side, evidence on the other',
		alt: 'A brass balance weighs a smooth lavender orb labeled A convincing answer against evidence cards, with clear, distorted, and obscured glass panels in front.',
		caption: 'Judge what the answer supports, not just how it sounds.',
		note: 'The scale illustrates the difference between confidence of presentation and evidence of correctness. The evaluation below runs real questions with visible grading rules; a small suite cannot establish reliability for every use.',
		action: 'Evaluate a model',
		tone: 'light',
		width: 1660
	},
	training: {
		asset: 'learning-landscape',
		title: 'A landscape of error',
		alt: 'A layered green landscape with brass spheres tracing a downhill path from higher error to lower error. Three cards read Predict, Measure error, and Adjust.',
		caption: 'Each correction is a step toward a better prediction.',
		note: 'The landscape is an analogy: a position represents model settings, and height represents loss. Gradient descent follows the local slope. Its path need not reach the lowest point in every landscape.',
		action: 'Train a line',
		tone: 'dark'
	},
	generalization: {
		asset: 'fit-triptych',
		title: 'Three ways to fit the same examples',
		alt: 'Three glass panels hold the same arch of data points. A straight line is too simple; a smooth curve captures a useful pattern; a twisting curve memorizes individual examples.',
		caption: 'Fitting every example is not the same as learning a useful pattern.',
		note: 'Underfitting misses the structure. Overfitting captures quirks of the training examples. Held-out data helps us tell the difference; the live comparison below shows the actual errors.',
		action: 'Compare the fits',
		tone: 'light'
	},
	forecasting: {
		asset: 'forecast-seasons',
		title: 'Patterns cross the boundary of time',
		alt: 'Coffee cups follow a brass timeline. Repeating green waves represent the past; beyond a glass divider, an amber wave extends into the future inside a widening translucent fan of uncertainty.',
		caption: 'Past patterns are clues. The future still carries uncertainty.',
		note: 'Seasonality is a pattern that repeats over time. A forecast extends what was learned from the past. The widening fan is an illustration of uncertainty, not a calculated prediction interval for the model below.',
		action: 'Forecast demand',
		tone: 'dark'
	},
	'deep-learning': {
		asset: 'neuron-anatomy',
		title: 'Inside one neuron',
		alt: 'A tanh neuron: 0.60 times 0.80 contributes 0.48; negative 0.40 times negative 0.50 contributes 0.20. Adding bias negative 0.10 gives 0.58. Applying tanh gives approximately 0.523.',
		caption: 'Multiply the inputs by weights. Add a bias. Apply an activation.',
		note: 'This worked example depicts one hidden tanh neuron. Its inputs, weights, and bias are chosen for explanation. The live network below shows its own actual values for every neuron, with a sigmoid classifier output or a linear regression output.',
		action: 'Look inside the network',
		tone: 'dark',
		width: 1672,
		height: 941
	},
	tokens: {
		asset: 'tokens-fieldguide',
		title: 'Different inputs, a sequence of vectors',
		alt: 'Text is separated into four vocabulary pieces and mapped to embeddings. A fern image is divided into a four-by-four patch grid, sixteen regions, and sixteen visual vectors. Position identifies where each piece belongs.',
		caption: 'Text pieces and image patches enter through different representations.',
		note: 'The bead columns illustrate vectors; they are not measured embeddings. Text uses vocabulary tokens, while a vision encoder can project image patches into vectors. Position information is included in model-specific ways, and a system may add special tokens, resize images, or combine patches. The explorer below shows actual text IDs and exact image regions.',
		action: 'Explore tokens and patches',
		tone: 'dark',
		width: 1672,
		height: 941
	},
	representations: {
		asset: 'seeing-in-layers',
		title: 'Seeing in layers',
		alt: 'Four specimen panels show one sneaker as a mosaic of pixels, a contour drawing of edges, a collection of colored parts, and a complete recognizable object.',
		caption: 'A useful representation makes the next step easier.',
		note: 'Pixels, edges, parts, and objects are a visual analogy for increasingly useful representations. Real learned layers can mix many features; they do not each have one fixed, human-readable job.',
		action: 'Train a deeper model',
		tone: 'light'
	},
	'modern-ai': {
		asset: 'ai-atlas',
		title: 'An atlas of related ideas',
		alt: 'Nested architectural terraces place deep learning inside machine learning, and machine learning inside artificial intelligence. A neural lattice sits at the center, with cards suggesting text, images, and audio behind it.',
		caption: 'AI is the broad field. Learning is one way into it.',
		note: 'The nested terraces show a family relationship, not a timeline or a ranking of intelligence. Generative describes what a model does—producing content—and can apply across model families.',
		action: 'Explore the map',
		tone: 'dark'
	},
	language: {
		asset: 'transformer-atelier',
		title: 'From context to the next token',
		alt: 'Word tiles reading The cat sat on the feed a woven attention panel and stacked neural layers. Three output bars suggest mat, chair, and floor as possible next tokens.',
		caption: 'Read the context. Predict a token. Add it, and repeat.',
		note: 'This is an illustrated token choice, not a trace from the live model. Attention and neural transformations are repeated across transformer blocks. Tokens can be words, pieces of words, or punctuation.',
		action: 'Run a language model',
		tone: 'light'
	},
	agents: {
		asset: 'agent-circuit',
		title: 'The loop between thought and action',
		alt: 'A circular brass track links a model, a tool, its result, and a next-step decision around a central goal. A branch exits the loop at Done.',
		caption: 'An action produces a result. That result informs the next step.',
		note: 'The model requests a tool; the application runs it and returns the result as context. The loop continues until the task is done or a stopping rule is reached. The lab below records real tool calls and their results.',
		action: 'Run an agent',
		tone: 'light'
	}
};
