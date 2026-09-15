import type { PatternIconName } from './icons';

const courseLessons = [
	{
		id: 'patterns',
		title: 'Why machine learning?',
		group: 'THE FOUNDATIONS',
		kicker: 'A different way to solve a problem',
		headline: 'Some rules we write.',
		accent: 'Others we learn.',
		description:
			'Sorting numbers, recognizing a shoe, describing a scene: when do we write a rule, and when do we learn from examples?',
		idea: 'Instead of telling a computer every rule, give it examples—and a way to learn from its mistakes.',
		prompt: 'Run a sorting algorithm, train an image classifier, and caption an image.',
		minutes: 3
	},
	{
		id: 'training',
		title: 'How learning happens',
		group: 'THE FOUNDATIONS',
		kicker: '01 / Make a prediction. Get a little better.',
		headline: 'Learning is a series of',
		accent: 'small corrections.',
		description:
			'A model is an adjustable relationship between inputs and an output. Training turns its adjustable numbers into useful predictions.',
		idea: 'Predict → measure the error → adjust the model → repeat. A loss is a number that tells us how wrong the predictions are.',
		prompt: 'Train a line to predict a number. Watch its errors shrink.',
		minutes: 5
	},
	{
		id: 'generalization',
		title: 'Learning, not memorizing',
		group: 'THE FOUNDATIONS',
		kicker: '02 / The examples you haven’t seen',
		headline: 'The real test is',
		accent: 'something new.',
		description:
			'A model can remember every example and still miss the point. We separate our data to find out whether it learned a useful pattern.',
		idea: 'Train to fit the model. Validate to choose the model. Test once at the end to estimate performance on unseen examples.',
		prompt: 'Compare three models. The smallest training error isn’t always the winner.',
		minutes: 4
	},
	{
		id: 'classification',
		title: 'Telling things apart',
		group: 'LEARNING BY DOING',
		kicker: '03 / Classification',
		headline: 'Where does one thing',
		accent: 'become another?',
		description:
			'A sneaker and an ankle boot look different to us. To a computer, each is a grid of brightness values. Can examples turn those pixels into a useful decision?',
		idea: 'A classifier estimates a probability. A decision threshold turns that probability into a label; changing the threshold changes the trade-off.',
		prompt: 'Teach a model to tell sneakers from ankle boots. Inspect the images it gets wrong.',
		minutes: 5
	},
	{
		id: 'forecasting',
		title: 'Looking ahead',
		group: 'LEARNING BY DOING',
		kicker: '04 / Forecasting',
		headline: 'The past leaves clues',
		accent: 'about the future.',
		description:
			'Demand rises and falls. Seasons repeat. A forecasting model learns patterns over time, then tries to extend them beyond what it has seen.',
		idea: 'In forecasting, order matters. Learn from the past and evaluate on the future—shuffling time would let tomorrow leak into today.',
		prompt: 'Train on the past. Compare its forecast with the visible, held-out future.',
		minutes: 4
	},
	{
		id: 'deep-learning',
		title: 'A network of small ideas',
		group: 'GOING DEEPER',
		kicker: '05 / Neural networks',
		headline: 'Simple pieces.',
		accent: 'Extraordinary patterns.',
		description:
			'From two simple clouds to intertwined spirals, different patterns demand different boundaries. A neural network combines small, adjustable transformations to learn them.',
		idea: 'Each neuron combines inputs and applies a nonlinear function. Hidden layers compose these functions; backpropagation tells their weights how to change.',
		prompt:
			'Choose a pattern, train a network, and inspect how its neurons combine to separate the classes.',
		minutes: 6
	},
	{
		id: 'representations',
		title: 'Why go deeper?',
		group: 'GOING DEEPER',
		kicker: '06 / Learning useful representations',
		headline: 'From little signals to',
		accent: 'larger meaning.',
		description:
			'A few pixels can belong to a sleeve, a sole, or a shoulder. A convolutional network combines local signals across layers to recognize the whole item.',
		idea: 'Each learned filter scans an image. Later layers combine earlier responses over larger regions. These features are learned together from the classification task; no one assigns each filter a fixed job.',
		prompt:
			'Follow a real Fashion-MNIST image through three convolutional layers. Inspect a feature, mute it, and see what changes.',
		minutes: 7
	},
	{
		id: 'modern-ai',
		title: 'The bigger picture',
		group: 'THE NEW FRONTIER',
		kicker: '07 / Making sense of modern AI',
		headline: 'A family of ideas.',
		accent: 'Not a single thing.',
		description:
			'Artificial intelligence is the broad ambition. Machine learning is one approach. Deep learning is one family of models. Generative AI describes what some models do.',
		idea: 'Modern AI often combines large pretrained models, task-specific adaptation, retrieval, and tools. “AI” is a broad label, not a guarantee of understanding or reliability.',
		prompt: 'Explore the map to see how the ideas fit together.',
		minutes: 4
	},
	{
		id: 'language',
		title: 'The next token',
		group: 'THE NEW FRONTIER',
		kicker: '08 / Language models & transformers',
		headline: 'One small prediction.',
		accent: 'A world of language.',
		description:
			'A language model turns context into probabilities for the next token. Repeating that process produces sentences, code, and conversations.',
		idea: 'Transformers mix information with attention, then transform it with neural layers. During generation, the context grows token by token; the learned weights usually stay fixed.',
		prompt: 'Run a real model, inspect its output, and explore how a transformer works.',
		minutes: 6
	},
	{
		id: 'agents',
		title: 'From answers to actions',
		group: 'THE NEW FRONTIER',
		kicker: '09 / AI agents',
		headline: 'When a model can',
		accent: 'take the next step.',
		description:
			'An agent connects a model to tools and a loop: decide what to do, act, inspect the result, and continue toward a goal.',
		idea: 'The model proposes an action. Software executes it. The result comes back as context. Permissions, stopping rules, and human oversight define its boundaries.',
		prompt: 'Step through an agent’s work. See the difference between saying and doing.',
		minutes: 4
	}
];

courseLessons.push(
	{
		id: 'clustering',
		title: 'Discovering groups',
		group: 'LEARNING BY DOING',
		kicker: 'Unsupervised learning',
		headline: 'No answer key.',
		accent: 'Still a pattern.',
		description:
			'Not every dataset arrives with labels. Unsupervised learning looks for structure: things that belong together, unusual examples, and simpler ways to describe the data.',
		idea: 'Clustering groups similar measurements. The groups depend on your features, distance measure, and number of clusters; they are not automatically meaningful categories.',
		prompt: 'Group café preferences without telling the model what each group means.',
		minutes: 5
	},
	{
		id: 'reinforcement',
		title: 'Learning from rewards',
		group: 'LEARNING BY DOING',
		kicker: 'Reinforcement learning',
		headline: 'Try a route.',
		accent: 'Learn from the result.',
		description:
			'Some problems are sequences of choices. A learner explores an environment, receives rewards, and improves a policy for what to do next.',
		idea: 'A reward describes what the system should pursue. Exploration gathers experience; exploitation uses what has been learned. A poorly chosen reward can teach the wrong behavior.',
		prompt: 'Compare exploration rates across toll bridges, competing deliveries, and dead ends.',
		minutes: 6
	},
	{
		id: 'adaptation',
		title: 'From pretraining to purpose',
		group: 'THE NEW FRONTIER',
		kicker: 'Pretraining and adaptation',
		headline: 'First, learn broadly.',
		accent: 'Then, specialize.',
		description:
			'Pretraining learns from broad examples. Adaptation changes the model for a narrower task. Inference uses the resulting model without updating its weights.',
		idea: 'Fine-tuning changes parameters. Prompting and retrieval change context. Specializing can improve one domain while hurting another, so evaluate both.',
		prompt: 'Pretrain a tiny next-word model, adapt it, and measure what changed.',
		minutes: 6
	},
	{
		id: 'vision',
		title: 'Beyond words',
		group: 'THE NEW FRONTIER',
		kicker: 'Multimodal AI',
		headline: 'A picture is also',
		accent: 'a kind of input.',
		description:
			'A multimodal model connects visual and linguistic information. Read a sign, compare scenes, or ask about a relationship—and inspect the actual evidence.',
		idea: 'Vision-language models process pixels and words together. Reading text, counting, and spatial reasoning can still fail; a plausible answer is not proof that the image supports it.',
		prompt: 'Read an invitation, ask a visual question, and compare two images.',
		minutes: 6
	},
	{
		id: 'retrieval',
		title: 'Finding the right context',
		group: 'THE NEW FRONTIER',
		kicker: 'Embeddings and retrieval',
		headline: 'Meaning has',
		accent: 'a neighborhood.',
		description:
			'Embeddings turn content into vectors that can be compared. Retrieval finds relevant passages and puts them into a language model’s context.',
		idea: 'Retrieval-augmented generation combines search with a language model. Similarity is not truth, and a citation still needs to support its claim.',
		prompt: 'Compare keyword and semantic search, then answer with the sources you found.',
		minutes: 7
	},
	{
		id: 'evaluation',
		title: 'Good answers need evidence',
		group: 'THE NEW FRONTIER',
		kicker: 'Evaluation and reliability',
		headline: 'Convincing is easy.',
		accent: 'Correct takes evidence.',
		description:
			'A polished answer can still be wrong. Evaluate against explicit expectations, look for missing information, and test the conditions you expect outside the demo.',
		idea: 'A small evaluation suite is a diagnostic, not a guarantee. Test representative cases, important subgroups, data gaps, and changing conditions; keep measuring after deployment.',
		prompt: 'Run a real model against six visible checks and compare its behavior.',
		minutes: 6
	}
);

courseLessons.push({
	id: 'tokens',
	title: 'The pieces a model sees',
	group: 'THE NEW FRONTIER',
	kicker: 'Tokens and image patches',
	headline: 'Before a model understands,',
	accent: 'it needs a representation.',
	description:
		'Text becomes a sequence of vocabulary tokens. Many vision models turn image patches into vectors. These representations let neural networks work with language and pictures.',
	idea: 'A text token is a vocabulary entry, not necessarily a word. A vision patch is a region of pixels mapped into a vector. Position helps the model use their order and arrangement.',
	prompt: 'Inspect real text tokens and IDs, then take an image apart into patches.',
	minutes: 6
});

courseLessons.push({
	id: 'self-supervised',
	title: 'Learning without labels',
	group: 'GOING DEEPER',
	kicker: 'Self-supervised learning',
	headline: 'Let the data',
	accent: 'be the teacher.',
	description:
		'A model can learn useful patterns before anyone gives it a category. Give it a puzzle: compress an image, then rebuild it.',
	idea: 'Self-supervision creates a learning target from the data itself. Reconstruction, missing patches, and next-token prediction can teach representations that are reused for other tasks.',
	prompt:
		'Choose MNIST digits or Fashion-MNIST clothing, train an autoencoder, and reconstruct images from two numbers.',
	minutes: 7
});

courseLessons.push({
	id: 'generative',
	title: 'Creating something new',
	group: 'THE NEW FRONTIER',
	kicker: 'Generative AI',
	headline: 'Learn the possibilities.',
	accent: 'Create another one.',
	description:
		'A classifier chooses a label. A generative model creates a new image, passage, or sound. A prompt steers which possibilities it explores.',
	idea: 'Generation samples from learned patterns. The same prompt can produce different results without changing the model’s weights.',
	prompt: 'Create images, compare variations, and see exactly what stays fixed and what changes.',
	minutes: 6
});

courseLessons.push({
	id: 'tool-calling',
	title: 'Give the model a calculator',
	group: 'THE NEW FRONTIER',
	kicker: 'Tool calling',
	headline: 'Some answers need',
	accent: 'more than words.',
	description:
		'Ask a language model to multiply two very large numbers. Then give the same model a calculator, follow the tool call, and check every digit of its answer.',
	idea: 'A tool call is a request from the model to a function in the app. The app calculates an exact result and sends it back as context; the model’s weights stay the same.',
	prompt: 'Compare large multiplications with and without a real calculator tool.',
	minutes: 5
});

courseLessons.push(
	{
		id: 'data-origins',
		title: 'Before the model',
		group: 'THE FOUNDATIONS',
		kicker: 'Data and the question we ask',
		headline: 'Every dataset has',
		accent: 'a history.',
		description:
			'Choose what to predict, examine where records came from, and discover how duplicate customers or future information can create a misleading score.',
		idea: 'Define the target and the moment of prediction. Keep related examples together, check who is represented, and use only information available when the prediction is made.',
		prompt: 'Build a café dataset, expose leakage, and test on genuinely new customers.',
		minutes: 8
	},
	{
		id: 'decisions',
		title: 'What does 90% mean?',
		group: 'LEARNING BY DOING',
		kicker: 'Uncertainty and decisions',
		headline: 'A probability.',
		accent: 'Then a decision.',
		description:
			'An impressive accuracy can hide every missed rare event. Explore probabilities, changing prevalence, and the cost of different mistakes.',
		idea: 'Check probabilities across many outcomes. A decision threshold depends on the task, the costs of mistakes, and how reliable the scores are.',
		prompt:
			'Inspect a confusion matrix and calibration, then choose a threshold using mistake costs.',
		minutes: 9
	}
);

courseLessons.push(
	{
		id: 'distribution-shift',
		title: 'When the world changes',
		group: 'GOING DEEPER',
		kicker: 'Distribution shift and causal questions',
		headline: 'A pattern can work.',
		accent: 'Until the world changes.',
		description:
			'A useful shortcut in one setting can become a mistake in another. Change the background, inspect hidden subgroups, and ask what a prediction can tell us about an intervention.',
		idea: 'Performance depends on the conditions under which examples were collected. More of the same data may preserve a shortcut. Predicting an outcome does not establish what will happen if we intervene.',
		prompt:
			'Reverse a background shortcut, compare remedies, and separate observation from intervention.',
		minutes: 9
	},
	{
		id: 'assistant-training',
		title: 'From predictor to assistant',
		group: 'THE NEW FRONTIER',
		kicker: 'Instructions, preferences, and the objective',
		headline: 'Learning what comes next.',
		accent: 'Then what helps.',
		description:
			'A next-token objective does not specify helpful behavior. Demonstrations and preferences supply new training signals—and a flawed preference can reward the wrong response.',
		idea: 'Demonstrations teach a desired response. Preferences compare alternatives. Both change weights; the chosen objective and the quality of feedback determine what is rewarded.',
		prompt:
			'Train a small response selector, inspect its weight updates, and test a misleading reward.',
		minutes: 9
	},
	{
		id: 'system-choice',
		title: 'Choose the whole system',
		group: 'PUTTING IT TOGETHER',
		kicker: 'A field project',
		headline: 'A useful system starts',
		accent: 'with the right question.',
		description:
			'A small shop needs exact invoices, current policy answers, and a demand forecast. Choose the tools for each job, commit your plan, and see what survives new cases and changing conditions.',
		idea: 'Define success, compare a simple baseline, keep a final check independent, and plan what happens when evidence is missing or the world changes.',
		prompt:
			'Build and evaluate a shop system, explain the trade-offs, then export the evidence and monitoring plan.',
		minutes: 12
	}
);

const order = [
	'patterns',
	'data-origins',
	'training',
	'generalization',
	'classification',
	'decisions',
	'forecasting',
	'clustering',
	'reinforcement',
	'deep-learning',
	'representations',
	'distribution-shift',
	'self-supervised',
	'modern-ai',
	'tokens',
	'language',
	'adaptation',
	'assistant-training',
	'vision',
	'generative',
	'retrieval',
	'tool-calling',
	'agents',
	'evaluation',
	'system-choice'
];
const chapterIcons: Record<string, PatternIconName> = {
	'data-origins': 'database',
	decisions: 'evaluation',
	'distribution-shift': 'generalization',
	'assistant-training': 'adaptation',
	'system-choice': 'tool',
	patterns: 'patterns',
	training: 'training',
	generalization: 'generalization',
	classification: 'classification',
	forecasting: 'forecasting',
	clustering: 'clustering',
	reinforcement: 'reinforcement',
	'deep-learning': 'neural',
	representations: 'representations',
	'self-supervised': 'selfSupervised',
	adaptation: 'adaptation',
	'modern-ai': 'ai',
	tokens: 'embeddings',
	language: 'language',
	vision: 'vision',
	generative: 'sparkles',
	retrieval: 'retrieval',
	'tool-calling': 'tool',
	agents: 'agent',
	evaluation: 'evaluation'
};
export const lessons = courseLessons
	.map((lesson, noteIndex) => ({ ...lesson, noteIndex, icon: chapterIcons[lesson.id] }))
	.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
