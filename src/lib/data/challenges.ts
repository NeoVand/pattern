export interface LessonChallenge {
	prediction: string;
	experiment: string;
	evidence: string;
	transfer: string;
	explanation: string;
}

/** Activities refer to evidence learners can inspect, not a score for completion. */
export const challenges: Record<string, LessonChallenge> = {
	patterns: {
		prediction:
			'Which task needs examples: sorting numbers, recognizing footwear, or describing an unfamiliar scene? Explain what a written rule would need to know.',
		experiment:
			'Run the sorting algorithm, inspect the classifier, and compare an image description with the actual image. Identify the input, output, and source of correctness in each task.',
		evidence:
			'Name one result you can check exactly and one result that needs evidence beyond a plausible answer.',
		transfer:
			'A shop needs invoice totals and a way to recognize damaged boxes. Which parts would you implement with rules, which with learned models, and how would you check each?',
		explanation:
			'Sorting and invoice arithmetic have precise rules and exact checks. Visual recognition usually benefits from examples because a usable boundary is difficult to specify for every image. A generated description still needs comparison with the image. Learning is appropriate when its evidence and error costs justify it; it is not a requirement for every automated task.'
	},
	'data-origins': {
		prediction:
			'Would a model look better if the same customer appeared in both training and evaluation? Would that score describe performance on a new customer?',
		experiment:
			'Compare a split that mixes customer records with one that holds out customers. Inspect when each feature becomes available, then remove information recorded after the outcome.',
		evidence:
			'Record which data choice changed the score and explain what information the model could exploit.',
		transfer:
			'You are predicting tomorrow’s deliveries. An “actual arrival time” column improves the score. Decide whether it belongs in the inputs and describe a valid evaluation split.',
		explanation:
			'Repeated customers can make a model appear to generalize while it reuses customer-specific information. A feature created after delivery leaks the outcome and is unavailable at prediction time. Separate records according to the intended use: new customers require customer-level separation, and future predictions require chronological separation. A lower score after fixing leakage can be more useful evidence.'
	},
	training: {
		prediction:
			'If a model predicts below the target, should every weight increase? Explain how the sign of an input could change your answer.',
		experiment:
			'Inspect one prediction, its loss, and a weight’s gradient. Nudge that weight, observe the changed prediction, then take a learning step and compare it with your proposed direction.',
		evidence:
			'Write the input sign, the weight change, and the direction of the prediction or loss change for one example.',
		transfer:
			'A delivery model predicts too short a journey when an input represents “distance remaining.” What changes if the input instead represents “distance already traveled”?',
		explanation:
			'For a linear contribution w × x, increasing w raises the contribution when x is positive and lowers it when x is negative. A gradient connects the loss to that particular weight through the computation. Gradient descent subtracts a scaled gradient; it does not increase every number whenever the prediction is too low. A step that is too large can also overshoot.'
	},
	generalization: {
		prediction:
			'Will the model with the lowest training error win on new examples? Predict how more training data and stronger regularization might change the comparison.',
		experiment:
			'Compare complexity, sample size, and regularization using validation. Change one setting at a time. Choose a model, commit to it, and only then reveal the final evaluation.',
		evidence:
			'Record your chosen settings, the validation evidence behind them, and whether the final result agreed with your expectation.',
		transfer:
			'You inspect a test score after each of 30 architecture changes. What role has that set taken on, and what evidence do you still need?',
		explanation:
			'Training rewards fitting the examples used for updates. Flexible models can also fit their noise. More data or suitable regularization can improve generalization, but neither guarantees a particular result. A set used repeatedly to select settings functions as validation, even if its label says “test.” An independent final assessment must remain outside those choices.'
	},
	classification: {
		prediction:
			'If you lower the threshold for predicting the positive class, which type of mistake should become less common, and which can increase?',
		experiment:
			'Train the classifier and inspect several mistakes. Lower the decision threshold while keeping the learned weights fixed; compare labels on the same examples.',
		evidence:
			'Describe an example that changed label, its score, and whether the change corrected or introduced a mistake.',
		transfer:
			'A detector should catch damaged parcels, but every flag requires a manual inspection. Explain what additional information you need to choose its threshold.',
		explanation:
			'Lowering a threshold flags more examples. On a fixed set it cannot increase missed positives, but it can increase false positives. The probability scores need not change at all. A useful threshold depends on prevalence, the costs of both errors, and whether the scores are trustworthy. Accuracy alone does not determine the right decision.'
	},
	decisions: {
		prediction:
			'At a 50% decision threshold, what changes if scores move farther toward 0% and 100%: the confusion matrix, calibration, or both?',
		experiment:
			'Start with the 99% example, then apply the cost-based threshold. Set the threshold to 50% and stretch the scores. Compare the confusion matrix with the reliability diagram.',
		evidence:
			'Use one confusion-matrix count, one cost, and one probability group to distinguish prediction quality from decision quality.',
		transfer:
			'A model assigns 80% to ten cases and seven succeed. Does that establish miscalibration? Explain how sample size changes the strength of the conclusion.',
		explanation:
			'Stretching log odds preserves which side of 50% each score lies on, so the 50% decisions stay fixed while probability quality can change. A group with an 80% score is expected to succeed about 80% of the time over many comparable cases, not exactly eight times in every ten. Small samples vary; calibration needs grouped evidence and uncertainty, not a verdict from one prediction.'
	},
	forecasting: {
		prediction:
			'Will a model that fits an earlier seasonal pattern keep winning after demand suddenly changes? Predict which simple baseline might become competitive.',
		experiment:
			'Compare the fitted forecast with simple baselines over later observations and several forecast origins. Introduce a change in demand and inspect the errors after the change.',
		evidence:
			'Record the forecast horizon, a baseline result, and when the model’s errors started changing. Keep training fit separate from future accuracy.',
		transfer:
			'A café wins a new catering contract tomorrow. Its historical forecast cannot see the contract. What should change in the information, forecast, or review process?',
		explanation:
			'A forecasting model extrapolates patterns available in its inputs. A new regime can invalidate them. Simple baselines are useful comparisons, and several forecast origins show whether a result depends on one split. Known future events may require additional inputs or a human adjustment; retraining on more of the old regime does not reveal an unseen contract.'
	},
	clustering: {
		prediction:
			'If you increase the number of clusters, have you discovered more real categories, or asked for a different partition of the same measurements?',
		experiment:
			'Run clustering at two different cluster counts. Inspect nearby points that move between groups and identify which measured features make them appear similar.',
		evidence:
			'Describe one boundary that changed and explain why the algorithm’s grouping may differ from a useful human category.',
		transfer:
			'Customers are grouped using annual spending and age. Spending is measured first in dollars, then in cents. Why might that change distance-based groups without changing the people?',
		explanation:
			'Clustering optimizes a grouping in a chosen representation. Cluster count, feature scales, and the distance measure shape that grouping; they do not establish natural or meaningful categories. Converting dollars to cents can make spending dominate an unscaled distance. Choosing and scaling features is part of the modeling decision.'
	},
	reinforcement: {
		prediction:
			'Which learner will look better early: one that explores often or one that mostly reuses its current favorite route? Which might discover a better route later?',
		experiment:
			'Compare exploration settings across repeated runs. Inspect the routes, the rewards received, and whether the learner encounters an initially unattractive route with a better later outcome.',
		evidence:
			'Describe a choice whose immediate reward differed from its contribution to the whole route. Include an example of run-to-run variation.',
		transfer:
			'A delivery robot is rewarded only for moving quickly. What useful behavior could it neglect, and what outcome should your evaluation measure separately?',
		explanation:
			'Exploration can reduce short-term reward while gathering information needed for better later choices. Exploitation uses current knowledge, which can be incomplete. Rewards define what is optimized; speed alone may neglect reliable or correct delivery. Evaluate the actual task outcome separately from the training reward and compare multiple runs before declaring one setting better.'
	},
	'deep-learning': {
		prediction:
			'Can a single linear boundary solve the ring pattern? What extra computation would let the model distinguish the center from the outside?',
		experiment:
			'Compare a linear model with a small nonlinear network on a curved pattern. Inspect a hidden neuron’s weighted inputs, activation, and contribution before and after learning.',
		evidence:
			'Connect a visible boundary change to a specific intermediate computation. State which result depends on learned weights and which on the architecture.',
		transfer:
			'Two classes occupy alternate quadrants. Explain why adding more linear layers without nonlinear activations does not solve the representation problem.',
		explanation:
			'A composition of linear transformations is still linear. Nonlinear activations allow hidden layers to transform the space so later units can separate patterns that one straight boundary cannot. Architecture supplies a family of possible computations; training selects weights within it. A useful network must still be evaluated on data outside its updates.'
	},
	representations: {
		prediction:
			'For a ring-shaped boundary, could a simple classifier with distance-from-center compete with a larger network that receives only the raw coordinates?',
		experiment:
			'Compare raw-coordinate and supplied-feature models, then inspect image features in the convolutional network. Mute a feature and observe whether and how its prediction changes.',
		evidence:
			'Name a representation that simplified a task. Explain what a muted feature’s effect reveals, and what it does not prove about that feature’s meaning.',
		transfer:
			'Your image model works on centered products but struggles when they appear near the edge. What assumptions might its representation or training examples encode?',
		explanation:
			'A representation can turn a difficult boundary into a simple one; distance-from-center is particularly useful for rings. Learned features can supply useful transformations without hand-designing every one. A feature’s effect on an output establishes a computational contribution, not a unique human concept. Position, scale, and background assumptions need varied evaluation examples.'
	},
	'self-supervised': {
		prediction:
			'If an encoder reconstructs images well, must it also separate the categories you care about? Predict when pretraining might help with only a few labels.',
		experiment:
			'Inspect an autoencoder’s reconstructions and latent space. Compare a pretrained encoder with a random encoder using the same limited labels and held-out classification examples.',
		evidence:
			'Keep reconstruction quality and downstream classification results separate. Record a condition where transfer helps, fails, or needs more evidence.',
		transfer:
			'You pretrain on handwritten digits, then classify clothing with very few labels. What mismatch could limit the usefulness of the learned representation?',
		explanation:
			'Self-supervision learns features useful for its training target, such as reconstruction. Those features may help another task, but reconstruction is not classification. Transfer depends on how the pretraining data and objective relate to the downstream task. Compare against an appropriate baseline with the same label budget and independent downstream examples.'
	},
	'distribution-shift': {
		prediction:
			'If background color usually predicts the label during training, will a classifier necessarily learn the object feature we intended?',
		experiment:
			'Train with a reliable background shortcut, then evaluate where that relationship changes. Compare collecting more similar examples with collecting more varied examples.',
		evidence:
			'Record performance in the original and changed settings and identify the feature relationship that broke.',
		transfer:
			'Ice-cream sales predict swimming accidents. Would reducing ice-cream sales necessarily reduce accidents? Describe another variable and an intervention that would test your explanation.',
		explanation:
			'A model can learn a real correlation that is irrelevant to the intended mechanism. More examples from the same environment can reinforce a shortcut; varied environments may help expose it. Prediction does not identify the effect of an intervention. Weather could influence both ice-cream sales and swimming, so changing one associated variable need not change the other.'
	},
	'modern-ai': {
		prediction:
			'Does a system that generates text necessarily use tools, retrieve documents, or learn from your conversation? Treat these as separate claims.',
		experiment:
			'Use the concept map to locate machine learning, deep learning, and generation. Trace an example system through its model, context, retrieval, and tools where those components apply.',
		evidence:
			'Describe one system using its actual inputs, outputs, learned components, and external operations rather than only the label “AI.”',
		transfer:
			'A product is marketed as an “AI agent.” What behavior would you need to observe to distinguish a text generator from a system that actually acts?',
		explanation:
			'These terms describe different aspects of a system. Deep learning is a model family; generation describes an output behavior; retrieval supplies context; tools execute operations. An agent adds an action-and-observation loop around a model. None of those labels alone establishes that weights update during use, that an action occurred, or that a result is correct.'
	},
	tokens: {
		prediction:
			'Will adding one word always add one token? Predict how punctuation, spacing, or an unusual spelling might affect the sequence.',
		experiment:
			'Tokenize a short phrase, then vary its spaces, punctuation, and spelling one change at a time. Inspect the text pieces, their IDs, and how image patches represent a different input type.',
		evidence:
			'Record a change whose token boundary surprised you. Distinguish the displayed token ID from a word meaning or a position.',
		transfer:
			'Two documents have the same number of words but different token counts. Why might they use different amounts of a model’s context budget?',
		explanation:
			'A tokenizer maps text to vocabulary entries, which can include word fragments, punctuation, or spaces. Word count and token count are therefore different. IDs identify vocabulary entries; order or position is supplied separately. Image patches also represent input pieces, but they are not text vocabulary tokens. A model’s context capacity depends on the representation it actually processes.'
	},
	language: {
		prediction:
			'When a model generates the next token, what changes immediately: the context, the learned weights, or both?',
		experiment:
			'Inspect next-token probabilities and generate a continuation. Compare another continuation from the same opening, then change the opening and observe the resulting distribution.',
		evidence:
			'Describe which evidence shows a changed context or sampled choice. Explain why fluent continuation does not by itself establish factual correctness.',
		transfer:
			'You add the correct opening hours to a prompt and the model answers correctly. What would you need to show before claiming that the model permanently learned those hours?',
		explanation:
			'Ordinary generation appends sampled tokens to the context while keeping learned weights fixed. New context can change the next-token distribution without training. Sampling can also yield different continuations from the same distribution. A correct answer with supplied evidence demonstrates use of that context, not necessarily a durable parameter update or reliable performance without the evidence.'
	},
	adaptation: {
		prediction:
			'After specializing on café text, must a next-word model improve on both café and general text it has never seen?',
		experiment:
			'Pretrain the tiny model, then adapt it by different amounts. Compare its next-word distribution, parameter changes, and separate held-out domain and general-text losses.',
		evidence:
			'Record one domain gain or failure and one general-text result. Explain why a lower loss on the adaptation corpus alone is insufficient.',
		transfer:
			'A support model is fine-tuned on a new product. Design two evaluation sets that could expose both successful specialization and forgetting.',
		explanation:
			'Adaptation changes weights to improve the selected training objective. It may help related unseen examples while reducing performance elsewhere, and neither effect is guaranteed. Evaluate unseen examples from the new domain and from earlier capabilities. Improvement on the same sentences used for updates shows better fit, not downstream generalization.'
	},
	'assistant-training': {
		prediction:
			'If the rater prefers confident wording regardless of evidence, what should happen to preference loss and unsupported-answer probability?',
		experiment:
			'Learn from demonstrations, then compare honest and confident raters. Inspect a missing-record card, the three weights, and results on the separate diagnostic cards.',
		evidence:
			'Record a weight change and a behavior change. State whether decreasing preference loss improved the behavior you actually wanted.',
		transfer:
			'A writing assistant is rewarded for user approval. How could agreement with an incorrect premise improve that reward while undermining the task?',
		explanation:
			'A loss measures agreement with its training signal. Rewarding assertive wording can improve that objective while increasing unsupported claims. Demonstrations and preferences change model parameters, whereas an ordinary prompt changes context. The toy’s response probabilities are selection probabilities, not truth estimates. Real assistants need evaluations of the desired behavior separate from the preference proxy.'
	},
	vision: {
		prediction:
			'Would a plausible image description be equally strong evidence that a model can read small text, count objects, and understand spatial relationships?',
		experiment:
			'Inspect an image yourself, then ask a precise question about visible text, a count, or a relationship. Compare the answer with the actual pixels; try another image or question.',
		evidence:
			'Cite the image region that supports or contradicts one claim. If a model cannot run, describe the visual check you would apply to its answer.',
		transfer:
			'A model says a package label contains an address that is partly obscured. How would you distinguish a supported reading from a plausible guess?',
		explanation:
			'Different visual tasks can fail differently. A general description may rely on broad cues while exact reading or counting requires detail the model missed. Compare specific claims with visible evidence and allow an answer to remain unresolved when a region is unreadable. Plausibility is not a substitute for pixels that support the claim.'
	},
	generative: {
		prediction:
			'Can different samples come from the same learned weights? What should stay fixed if you repeat generation with the same model and prompt?',
		experiment:
			'Inspect the sampling mechanism, then compare generated variations. Track which inputs, latent samples, or random choices changed and whether any training occurred.',
		evidence:
			'Separate evidence of sampling from evidence of learning. Describe how a generated output can resemble training patterns without copying one chosen example.',
		transfer:
			'A denoising model improves an image over successive sampling steps. Are those steps necessarily gradient updates to its weights? Explain what else may be changing.',
		explanation:
			'A generative model can produce different outputs by sampling latent variables or token choices while weights remain fixed. In diffusion-style generation, successive steps update the sample using a learned denoiser; ordinary sampling is not retraining the denoiser. Generative behavior depends on the model family, training target, sampling procedure, and conditioning.'
	},
	retrieval: {
		prediction:
			'If search retrieves a related passage, is that enough to answer the question correctly? Predict what happens when the required fact is absent.',
		experiment:
			'Compare a direct keyword query with a paraphrase. Inspect the retrieved passage before reading the answer, then ask for a fact the supplied documents do not contain.',
		evidence:
			'Distinguish a retrieval miss, an answer that misuses a relevant source, and a citation that does not support its claim.',
		transfer:
			'A shop changes its returns policy from 14 to 30 days. Which part of a retrieval-based system must receive the update, and what should your evaluation check?',
		explanation:
			'Retrieval must first find evidence that contains the needed fact. The answer must then use that evidence correctly, and its citation must support the claim. Relatedness alone is insufficient. A changed policy requires an updated source and retrieval index or document collection; checking only answer fluency would miss a stale but well-written response.'
	},
	'tool-calling': {
		prediction:
			'If a model asks for an exact multiplication tool, does that guarantee its final answer is exact? Identify the remaining places an error could enter.',
		experiment:
			'Compare the same large multiplication with and without the calculator. Inspect the requested arguments, actual tool output, final answer, and exact digit check.',
		evidence:
			'Trace one number through all three stages and record whether the final answer matched the executed result.',
		transfer:
			'A model needs a temperature conversion. The tool is exact, but its argument uses the wrong unit. What validation belongs before and after execution?',
		explanation:
			'Tools can make a specific operation reliable, but the system must select the right operation, provide valid arguments, execute it, and faithfully use its result. A request to call a tool is not itself execution. Check units and arguments before execution, and check that the final answer preserves the returned result. Tool use ordinarily changes context, not model weights.'
	},
	agents: {
		prediction:
			'When an agent says it has completed an action, what evidence would distinguish an intention, a tool request, and a successfully executed operation?',
		experiment:
			'Step through an agent run. At each step identify the proposed action, what software actually executed, the returned observation, and the reason for continuing or stopping.',
		evidence:
			'Describe one point where execution results changed the next action, or where a stopping or permission boundary limited the loop.',
		transfer:
			'A shop agent repeatedly retries an unavailable inventory service. Specify a stopping condition, a fallback, and the evidence needed before reporting success.',
		explanation:
			'An agent wraps a model in a loop that can request actions and use observations. Success requires evidence from execution, not a confident statement. Explicit retry limits, permissions, and fallback paths define what the system may do when conditions fail. An unavailable service should lead to an unresolved status or escalation, not an invented successful operation.'
	},
	evaluation: {
		prediction:
			'If a prompt passes every visible teaching case once, what can you conclude about its reliability on new tasks or repeated runs?',
		experiment:
			'Compare prompts against explicit criteria and repeat a case where useful. Inspect failures separately: format, missing evidence, copying a provided fact, and actual retrieval or generation behavior.',
		evidence:
			'Name exactly what one test measures, what its outcome was, and a related capability that the same result does not establish.',
		transfer:
			'A new version passes 19 of 20 tests, but the one failure gives the wrong cancellation policy. What else matters beyond the overall pass rate?',
		explanation:
			'A small visible suite is a diagnostic. One run does not establish a stable success rate, and repeatedly choosing a prompt on the same cases uses them as validation. Test names should match the operations measured. Representative inputs, repeated trials where outputs vary, critical failure costs, and independent evaluation matter more than an attractive aggregate alone.'
	},
	'system-choice': {
		prediction:
			'Which shop tasks need exact rules, current evidence, learned patterns, or human handling? Predict one failure your initial design may hide.',
		experiment:
			'Choose components, run validation, and write a rationale and fallback plan. Commit before revealing final cases, then test changed policy and demand without altering the committed system.',
		evidence:
			'Use an invoice check, a source-backed answer or unresolved review, and a forecast error to defend or revise your design.',
		transfer:
			'The shop expands to a new city with different policies and buying patterns. Which data, checks, owners, and system components must you revisit before using the old results?',
		explanation:
			'Each task earns an appropriate component through evidence. Exact arithmetic benefits from a rule, policy answers need current sources and missing-evidence handling, and demand forecasts need comparison with baselines plus monitoring. A human-review queue is not a resolved answer. New locations can change both facts and distributions, so local operational responsibility and fresh evaluation remain necessary.'
	}
};

export interface ChallengeNotes {
	prediction: string;
	evidence: string;
	transfer: string;
}
export const CHALLENGE_STORAGE_PREFIX = 'pattern:learning-notebook:v1:';
export const emptyChallengeNotes = (): ChallengeNotes => ({
	prediction: '',
	evidence: '',
	transfer: ''
});

/** Saved content is plain text. A malformed or outdated value never blocks a lesson. */
export function parseChallengeNotes(value: string | null): ChallengeNotes {
	if (!value) return emptyChallengeNotes();
	try {
		const parsed: unknown = JSON.parse(value);
		if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
			return emptyChallengeNotes();
		const record = parsed as Record<string, unknown>;
		return {
			prediction: typeof record.prediction === 'string' ? record.prediction : '',
			evidence: typeof record.evidence === 'string' ? record.evidence : '',
			transfer: typeof record.transfer === 'string' ? record.transfer : ''
		};
	} catch {
		return emptyChallengeNotes();
	}
}
