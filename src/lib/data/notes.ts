export const notes = [
	{
		terms: [
			[
				'Algorithm',
				'A sequence of explicit steps, such as comparing and swapping neighboring numbers.'
			],
			[
				'Features',
				'The numbers a model receives as inputs, such as the brightness of image pixels.'
			],
			['Labels', 'The desired answers in supervised learning, such as “sneaker” or “ankle boot.”'],
			['Prediction', 'A model’s output for an input. It is an estimate, not a fact.']
		],
		question: 'Why learn an image classifier when we can write an algorithm for sorting?',
		answers: [
			'The visual rule is hard to specify, so we fit a relationship from labeled examples.',
			'Computers cannot follow explicit rules.'
		],
		correct: 0,
		explanation:
			'Learning fits a relationship between measurements and labels. Useful predictions do not require human-like understanding.'
	},
	{
		terms: [
			[
				'Parameters',
				'Numbers learned during training, such as a line’s slope and intercept or a network’s weights.'
			],
			[
				'Gradient descent',
				'Adjusting parameters in a direction that reduces loss. The gradient describes how the loss changes.'
			],
			[
				'Hyperparameters',
				'Choices such as learning rate and layer count that guide training but are not the learned weights.'
			]
		],
		question: 'What does a smaller training loss tell you?',
		answers: [
			'The model will always work well in the real world.',
			'Its predictions fit the training examples more closely.'
		],
		correct: 1,
		explanation:
			'Lower training loss describes the training fit. Validation, test data, and real-world monitoring provide different evidence.'
	},
	{
		terms: [
			[
				'Underfitting',
				'A model is too constrained, or insufficiently trained, to capture the useful pattern.'
			],
			['Overfitting', 'A model fits idiosyncrasies in training data that do not generalize well.'],
			[
				'Data leakage',
				'Information from outside the legitimate training context influences learning or model selection.'
			]
		],
		question: 'Which set should guide your choice between a simple and a flexible model?',
		answers: ['The validation set.', 'The final test set, after each adjustment.'],
		correct: 0,
		explanation:
			'Use validation data for model choices. Reserve the final test set for an independent check after those choices are made.'
	},
	{
		terms: [
			[
				'Probability',
				'The model’s estimate for a category. A score can be poorly calibrated even if accuracy looks good.'
			],
			['False positive', 'Predicting the positive class when the actual label is negative.'],
			['False negative', 'Predicting the negative class when the actual label is positive.']
		],
		question: 'What happens when you lower the threshold for “ankle boot”?',
		answers: [
			'The model predicts “ankle boot” less often.',
			'The model predicts “ankle boot” more often.'
		],
		correct: 1,
		explanation:
			'More probabilities now exceed the threshold. This can find more true positives while also creating more false positives.'
	},
	{
		terms: [
			['Trend', 'A longer-term increase or decrease in the series.'],
			['Seasonality', 'A pattern that repeats at a regular interval.'],
			[
				'Distribution shift',
				'The conditions producing the data change, so learned patterns may become less useful.'
			]
		],
		question: 'Why shouldn’t we randomly shuffle this time series before splitting it?',
		answers: [
			'The model could learn from the future it is meant to predict.',
			'Forecasting models cannot handle shuffled arrays.'
		],
		correct: 0,
		explanation:
			'The issue is the evaluation design. Chronological splits better reflect predicting future outcomes using only past information.'
	},
	{
		terms: [
			[
				'Activation',
				'A nonlinear function that lets composed layers represent more than a single linear transformation.'
			],
			[
				'Backpropagation',
				'An efficient way to compute how each weight affects the loss, using the chain rule.'
			],
			['Architecture', 'How a network’s layers and connections are arranged.']
		],
		question: 'Why can hidden layers help separate the inner circle?',
		answers: [
			'Adding any layers guarantees better predictions.',
			'Nonlinear layers can compose into a curved decision boundary.'
		],
		correct: 1,
		explanation:
			'Nonlinearity adds expressive power. Stacking only linear transformations still gives a linear transformation.'
	},
	{
		terms: [
			[
				'Representation',
				'An internal numerical description that makes useful information accessible to later processing.'
			],
			[
				'Convolution',
				'A learned filter is reused across an image, producing a map of responses at different locations.'
			],
			[
				'Receptive field',
				'The region of the original image that can affect a particular activation. It grows as layers combine local responses.'
			],
			[
				'Capacity',
				'The variety of relationships a model can represent. More capacity also creates more ways to overfit.'
			]
		],
		question: 'What helped deep learning succeed on complex images and language?',
		answers: [
			'Learned representations, more data, more compute, and improved methods.',
			'Every neuron has a clear human-interpretable meaning.'
		],
		correct: 0,
		explanation:
			'Deep learning reduced the need to design all features by hand. Its internal representations can still be hard to interpret.'
	},
	{
		terms: [
			[
				'Supervised learning',
				'Learn from examples paired with target answers. Our classifiers and regressors use this setup.'
			],
			[
				'Unsupervised learning',
				'Find structure without supplied target labels, such as clusters of similar examples.'
			],
			[
				'Self-supervised learning',
				'Create prediction targets from the data itself, as in predicting hidden or next tokens.'
			],
			[
				'Reinforcement learning',
				'Learn a policy for actions from rewards and interaction with an environment.'
			]
		],
		question: 'Is every machine-learning system a deep-learning system?',
		answers: [
			'Yes. Machine learning always uses a deep neural network.',
			'No. Linear models and decision trees are also machine learning.'
		],
		correct: 1,
		explanation:
			'Deep learning is one family within machine learning. Other families can be better suited to some problems.'
	},
	{
		terms: [
			[
				'Token',
				'A discrete piece of the model’s vocabulary: often a word, word fragment, or punctuation.'
			],
			[
				'Transformer',
				'A neural architecture built around attention and feed-forward transformations. Many LLMs are causal, decoder-style transformers.'
			],
			[
				'Context window',
				'The amount of token context the model can process at once. Context is different from learned weights.'
			],
			[
				'Hallucination',
				'A plausible but false or unsupported output. Fluency does not establish truth.'
			]
		],
		question: 'During ordinary next-token generation, what is changing?',
		answers: [
			'The context grows; the trained weights usually stay fixed.',
			'All network weights are retrained after every generated word.'
		],
		correct: 0,
		explanation:
			'Generation is inference through learned parameters. Appending tokens changes the input, not usually the parameters.'
	},
	{
		terms: [
			[
				'Tool',
				'A function exposed by software, such as a calculator, search service, or document reader.'
			],
			[
				'Agent loop',
				'A repeated sequence of decisions, allowed actions, and observations toward a goal.'
			],
			[
				'Human oversight',
				'Review, approval, intervention, or escalation when actions or uncertainty call for it.'
			]
		],
		question: 'What makes this system an agent rather than just a text response?',
		answers: [
			'It uses more confident language.',
			'It can use tools, observe their results, and decide subsequent actions.'
		],
		correct: 1,
		explanation:
			'The execution loop connects model decisions to actions and observations. Confidence alone says nothing about capability or correctness.'
	}
];
type Reading = { title: string; url: string; chapters: number[] };
export const sources: Reading[] = [
	{
		title: 'Google Machine Learning Crash Course',
		url: 'https://developers.google.com/machine-learning/crash-course',
		chapters: [0, 1, 2, 3, 4, 5, 6, 7]
	},
	{
		title: 'Training, validation, and test sets',
		url: 'https://developers.google.com/machine-learning/crash-course/overfitting/dividing-datasets',
		chapters: [1, 2, 15]
	},
	{
		title: 'Attention Is All You Need · original paper',
		url: 'https://arxiv.org/abs/1706.03762',
		chapters: [8]
	},
	{
		title: 'Introduction to large language models',
		url: 'https://developers.google.com/machine-learning/crash-course/llm',
		chapters: [7, 8, 12]
	},
	{
		title: 'Clustering · Google Machine Learning',
		url: 'https://developers.google.com/machine-learning/clustering/overview',
		chapters: [10]
	},
	{
		title: 'Reinforcement learning · OpenAI Spinning Up',
		url: 'https://spinningup.openai.com/en/latest/spinningup/rl_intro.html',
		chapters: [11]
	},
	{
		title: 'Model optimization · OpenAI',
		url: 'https://developers.openai.com/api/docs/guides/model-optimization',
		chapters: [12]
	},
	{
		title: 'Images and vision · OpenAI',
		url: 'https://developers.openai.com/api/docs/guides/images-vision',
		chapters: [0, 13]
	},
	{
		title: 'Retrieval-Augmented Generation · original paper',
		url: 'https://arxiv.org/abs/2005.11401',
		chapters: [14]
	},
	{
		title: 'Embeddings · OpenAI',
		url: 'https://developers.openai.com/api/docs/guides/embeddings',
		chapters: [14]
	},
	{
		title: 'Function calling · OpenAI',
		url: 'https://developers.openai.com/api/docs/guides/function-calling',
		chapters: [9]
	},
	{
		title: 'Working with evaluations · OpenAI',
		url: 'https://developers.openai.com/api/docs/guides/evals',
		chapters: [15]
	}
];

notes.push(
	...[
		{
			terms: [
				[
					'Unsupervised learning',
					'Learning structure from inputs without an answer label for every example.'
				],
				['Cluster', 'A group of examples close under a chosen distance measure.'],
				['Centroid', 'The mean position of the examples assigned to a group.']
			],
			question: 'If k-means finds three groups, did it discover three natural kinds of customer?',
			answers: [
				'Not necessarily. The result depends on the features, distance, and chosen K.',
				'Yes. Every cluster is a true category.'
			],
			correct: 0,
			explanation:
				'Clustering is a way to summarize measurements. Meaning and usefulness need evaluation in the actual setting.'
		},
		{
			terms: [
				['Policy', 'A rule for choosing an action in a state.'],
				['Reward', 'A signal used to prefer some outcomes over others.'],
				['Exploration', 'Trying uncertain actions to learn about their consequences.']
			],
			question: 'Why might a learner take an action that looks worse right now?',
			answers: [
				'Rewards never affect learning.',
				'Exploring may reveal a better route to future rewards.'
			],
			correct: 1,
			explanation:
				'A sequence can pay off later. The learner balances information from exploration with rewards from its current policy.'
		},
		{
			terms: [
				['Pretraining', 'Learning general patterns from a broad training distribution.'],
				['Fine-tuning', 'Continuing training on examples chosen for a narrower purpose.'],
				['Catastrophic forgetting', 'Adaptation can weaken capabilities learned earlier.'],
				[
					'Inference',
					'Computing a prediction using the current model, usually without changing weights.'
				]
			],
			question: 'Which operation changes the model parameters?',
			answers: ['Fine-tuning on new examples.', 'Adding a new instruction to the prompt.'],
			correct: 0,
			explanation:
				'Training updates parameters; a prompt changes the information supplied for this prediction. Evaluate both the new task and capabilities you want to retain.'
		},
		{
			terms: [
				['Multimodal', 'Using more than one kind of input or output, such as images and text.'],
				[
					'Vision encoder',
					'A learned transformation from image measurements into representations.'
				],
				['OCR', 'Recognizing written characters in an image.']
			],
			question: 'A vision model confidently reads a price. What should you check?',
			answers: [
				'Whether its tone sounds certain.',
				'Whether the actual image supports that reading.'
			],
			correct: 1,
			explanation:
				'Confidence of presentation is not visual evidence. Small text, ambiguous layouts, and occlusion can cause errors.'
		},
		{
			terms: [
				['Embedding', 'A learned vector representation useful for comparing content.'],
				['Cosine similarity', 'A comparison of the directions of two vectors.'],
				['RAG', 'Retrieval-augmented generation: find passages, then provide them as context.']
			],
			question:
				'Why can an answer change after editing a source without retraining the language model?',
			answers: ['The retrieved context changed.', 'Retrieval secretly updated every weight.'],
			correct: 0,
			explanation:
				'The model receives a different source passage. Its parameters are unchanged; the evidence available in context is different.'
		},
		{
			terms: [
				['Evaluation', 'Comparing model behavior against explicit expectations.'],
				[
					'Distribution shift',
					'The data or conditions differ from those represented during development.'
				],
				['Abstention', 'Declining to answer when available evidence is insufficient.'],
				['Monitoring', 'Checking behavior and failures after a model is put into use.']
			],
			question: 'What does passing all six checks in this lab establish?',
			answers: [
				'The model is safe and correct for every real task.',
				'It passed these particular checks under this particular setup.'
			],
			correct: 1,
			explanation:
				'Coverage matters. Include realistic cases, important subgroups, harmful failure modes, changing conditions, and independent checks beyond this teaching suite.'
		}
	]
);

notes.push({
	terms: [
		[
			'Token',
			'One entry in a tokenizer’s vocabulary. It can represent a word, part of a word, punctuation, whitespace, or bytes within a character.'
		],
		[
			'Token ID',
			'An integer that identifies a vocabulary entry. The ID itself is not a meaning or a probability.'
		],
		[
			'Patch embedding',
			'A learned vector computed from a region of image pixels; it is not a text vocabulary ID.'
		],
		[
			'Position',
			'Information about where a piece occurs, such as its place in a sentence or location in a picture.'
		]
	],
	question: 'Does dividing a picture into sixteen patches turn it into sixteen words?',
	answers: [
		'No. Each region can be projected into a learned visual vector.',
		'Yes. Each patch becomes a word describing its contents.'
	],
	correct: 0,
	explanation:
		'Visual patches contain pixels. A learned projection or encoder turns them into numerical representations. Text vocabulary tokens and visual patch embeddings reach a model through different processing steps.'
});
sources.push(
	{
		title: 'An Image is Worth 16x16 Words · Vision Transformer paper',
		url: 'https://arxiv.org/abs/2010.11929',
		chapters: [16, 13]
	},
	{
		title: 'tiktoken · OpenAI tokenizer',
		url: 'https://github.com/openai/tiktoken',
		chapters: [16]
	},
	{
		title: 'gpt-tokenizer · browser implementation used here',
		url: 'https://github.com/niieani/gpt-tokenizer',
		chapters: [16]
	}
);

notes.push({
	terms: [
		[
			'Self-supervision',
			'Creating a training target from the data itself, rather than requiring a person to label each example.'
		],
		[
			'Autoencoder',
			'An encoder compresses an input; a decoder tries to reconstruct it. Their weights learn from reconstruction error.'
		],
		[
			'Latent representation',
			'The intermediate numbers produced by an encoder. Nearby codes need not have meanings we can name.'
		],
		[
			'Variational autoencoder',
			'The encoder learns a distribution of codes. Training balances reconstruction with a penalty that keeps these distributions near a shared Gaussian prior, encouraging a more continuous latent space.'
		],
		[
			'Pretraining',
			'Learning reusable model parameters before adapting or applying them to a later task.'
		]
	],
	question: 'Where does this autoencoder get the answer it learns to predict?',
	answers: ['From the original image pixels.', 'From a person assigning a category to each image.'],
	correct: 0,
	explanation:
		'The original MNIST image supplies the reconstruction target. Digit labels color the map, but never enter training. Other self-supervised puzzles predict hidden patches or the next token.'
});
sources.push(
	{
		title: 'Fashion-MNIST · Zalando Research',
		url: 'https://github.com/zalandoresearch/fashion-mnist',
		chapters: [3, 6]
	},
	{
		title: 'Auto-Encoding Variational Bayes · Kingma and Welling',
		url: 'https://arxiv.org/abs/1312.6114',
		chapters: [17]
	},
	{
		title: 'MNIST handwritten digits · CVDF dataset mirror',
		url: 'https://github.com/cvdfoundation/mnist',
		chapters: [17]
	},
	{
		title: 'Masked Autoencoders Are Scalable Vision Learners · He et al.',
		url: 'https://arxiv.org/abs/2111.06377',
		chapters: [17, 13]
	}
);

notes.push({
	terms: [
		['Generative model', 'A model that learns patterns in data and can create new examples.'],
		['Conditioning', 'Information, such as a prompt, that steers what the model generates.'],
		[
			'Sampling',
			'Choosing an output from learned possibilities. The same prompt can yield different outputs.'
		],
		['Inference', 'Using a trained model. Generating these images does not update its weights.']
	],
	question: 'Two images differ even though the prompt and model are the same. What changed?',
	answers: [
		'The generated sample; the learned weights stayed fixed.',
		'The model retrained itself on your prompt.'
	],
	correct: 0,
	explanation:
		'A prompt conditions generation. It does not by itself retrain the model; variation is possible during inference.'
});
sources.push(
	{
		title: 'Image generation · OpenAI',
		url: 'https://developers.openai.com/api/docs/guides/image-generation',
		chapters: [18]
	},
	{
		title: 'TinyStories · Eldan and Li',
		url: 'https://huggingface.co/datasets/roneneldan/TinyStories',
		chapters: [8]
	}
);

notes.push({
	terms: [
		[
			'Tool calling',
			'A model requests a named function with structured arguments; the app executes it and returns its result.'
		],
		[
			'Tool schema',
			'A description of a tool and the inputs it accepts. It tells the model how to ask for a calculation.'
		],
		[
			'Tool result',
			'The actual output of the function, added to the model’s context before it answers.'
		],
		[
			'Exact integer arithmetic',
			'Arithmetic that preserves every integer digit. This calculator uses BigInt and transports numbers as strings.'
		]
	],
	question:
		'The same model gets a large multiplication right after calling a calculator. What changed?',
	answers: [
		'The app computed the product and returned it as context.',
		'The model retrained its weights to become better at arithmetic.'
	],
	correct: 0,
	explanation:
		'The model requested a function. The app executed exact integer multiplication and sent the result back. That is tool use during inference. The model can still supply wrong arguments or copy the result incorrectly, so we verify the final answer.'
});
sources.push(
	{
		title: 'Function calling · OpenAI',
		url: 'https://developers.openai.com/api/docs/guides/function-calling',
		chapters: [19]
	},
	{
		title: 'BigInt and exact integers · MDN',
		url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/BigInt',
		chapters: [19]
	}
);
