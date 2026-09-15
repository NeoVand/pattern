export type PreferenceRubric = 'grounded' | 'confident';
export type PolicyWeights = [number, number, number];
export interface PolicyResponse {
	id: 'measured' | 'bold' | 'uncertain';
	text: string;
	features: PolicyWeights;
	appropriate: boolean;
}
export interface PolicyTask {
	id: string;
	prompt: string;
	record: string;
	hasEvidence: boolean;
	responses: PolicyResponse[];
	demonstration: number;
}

export const POLICY_FEATURES = [
	'Assertive wording',
	'Matches the visible record',
	'Admits a missing record'
] as const;
export const INITIAL_POLICY_WEIGHTS: PolicyWeights = [0.8, 0.1, -0.2];

/** A finite response selector, not a language model. Features explicitly encode
 * wording and evidence checks; the model learns only their three weights. */
function makeTasks(split: 'train' | 'heldout', count: number): PolicyTask[] {
	return Array.from({ length: count }, (_, index) => {
		const parcel = (split === 'train' ? 100 : 700) + index * 7;
		const shelf = `${String.fromCharCode(65 + (index % 6))}${index + 2}`;
		const wrongShelf = `${String.fromCharCode(65 + ((index + 2) % 6))}${index + 5}`;
		const hasEvidence = index % 2 === 0;
		return {
			id: `${split}-${parcel}`,
			prompt: `Where is parcel ${parcel}? Answer only from the record.`,
			record: hasEvidence
				? `Parcel ${parcel} is on shelf ${shelf}.`
				: `Parcel ${parcel} arrived today. Its shelf is not recorded.`,
			hasEvidence,
			demonstration: hasEvidence ? 0 : 2,
			responses: [
				{
					id: 'measured',
					text: hasEvidence ? `The record says shelf ${shelf}.` : `My guess is shelf ${shelf}.`,
					features: [0.35, hasEvidence ? 1 : 0, 0],
					appropriate: hasEvidence
				},
				{
					id: 'bold',
					text: `Definitely shelf ${wrongShelf}, without a doubt.`,
					features: [1, 0, 0],
					appropriate: false
				},
				{
					id: 'uncertain',
					text: 'There is not enough information in the record to name a shelf.',
					features: [0.05, 0, hasEvidence ? 0 : 1],
					appropriate: !hasEvidence
				}
			]
		};
	});
}

export const POLICY_TRAIN_TASKS = makeTasks('train', 8);
export const POLICY_HELDOUT_TASKS = makeTasks('heldout', 12);

export function policyScores(weights: PolicyWeights, task: PolicyTask) {
	return task.responses.map((response) =>
		response.features.reduce((sum, feature, index) => sum + feature * weights[index], 0)
	);
}

export function policyProbabilities(weights: PolicyWeights, task: PolicyTask) {
	const scores = policyScores(weights, task);
	const maximum = Math.max(...scores);
	const exponentials = scores.map((score) => Math.exp(score - maximum));
	const denominator = exponentials.reduce((sum, value) => sum + value, 0);
	return exponentials.map((value) => value / denominator);
}

export function supervisedObjective(weights: PolicyWeights, tasks = POLICY_TRAIN_TASKS) {
	const gradient: PolicyWeights = [0, 0, 0];
	let loss = 0;
	for (const task of tasks) {
		const probabilities = policyProbabilities(weights, task);
		const scores = policyScores(weights, task);
		const maximum = Math.max(...scores);
		loss +=
			maximum +
			Math.log(scores.reduce((sum, score) => sum + Math.exp(score - maximum), 0)) -
			scores[task.demonstration];
		for (let feature = 0; feature < gradient.length; feature++) {
			gradient[feature] +=
				task.responses.reduce(
					(sum, response, index) => sum + probabilities[index] * response.features[feature],
					0
				) - task.responses[task.demonstration].features[feature];
		}
	}
	return {
		loss: loss / tasks.length,
		gradient: gradient.map((value) => value / tasks.length) as PolicyWeights
	};
}

function reward(response: PolicyResponse, rubric: PreferenceRubric) {
	return rubric === 'grounded' ? Number(response.appropriate) : response.features[0];
}

export function preferencePairs(task: PolicyTask, rubric: PreferenceRubric) {
	const pairs: { preferred: number; rejected: number }[] = [];
	for (let a = 0; a < task.responses.length; a++) {
		for (let b = a + 1; b < task.responses.length; b++) {
			const first = reward(task.responses[a], rubric);
			const second = reward(task.responses[b], rubric);
			if (first !== second)
				pairs.push({ preferred: first > second ? a : b, rejected: first > second ? b : a });
		}
	}
	return pairs;
}

/** Pairwise logistic ranking loss, not PPO, a reward-model pipeline or DPO.
 * L = mean softplus(−w·(features(preferred)−features(rejected))). */
export function preferenceObjective(
	weights: PolicyWeights,
	rubric: PreferenceRubric,
	tasks = POLICY_TRAIN_TASKS
) {
	const gradient: PolicyWeights = [0, 0, 0];
	let loss = 0;
	let count = 0;
	for (const task of tasks) {
		for (const pair of preferencePairs(task, rubric)) {
			const difference = task.responses[pair.preferred].features.map(
				(value, index) => value - task.responses[pair.rejected].features[index]
			);
			const margin = difference.reduce((sum, value, index) => sum + value * weights[index], 0);
			loss += Math.max(0, -margin) + Math.log1p(Math.exp(-Math.abs(margin)));
			const scale = -1 / (1 + Math.exp(margin));
			for (let feature = 0; feature < gradient.length; feature++)
				gradient[feature] += scale * difference[feature];
			count++;
		}
	}
	return {
		loss: count ? loss / count : 0,
		gradient: gradient.map((value) => (count ? value / count : 0)) as PolicyWeights
	};
}

export function trainPolicy(
	weights: PolicyWeights,
	kind: 'supervised' | PreferenceRubric,
	steps = 20,
	rate = 0.35
): PolicyWeights {
	let next: PolicyWeights = [...weights];
	for (let step = 0; step < steps; step++) {
		const { gradient } =
			kind === 'supervised' ? supervisedObjective(next) : preferenceObjective(next, kind);
		next = next.map((value, index) => value - rate * gradient[index]) as PolicyWeights;
	}
	return next;
}

export function evaluatePolicy(weights: PolicyWeights, tasks = POLICY_HELDOUT_TASKS) {
	let appropriateProbability = 0;
	let assertiveness = 0;
	let correctTopChoice = 0;
	let unsupportedProbability = 0;
	for (const task of tasks) {
		const probabilities = policyProbabilities(weights, task);
		const topIndex = probabilities.indexOf(Math.max(...probabilities));
		correctTopChoice += Number(task.responses[topIndex].appropriate);
		task.responses.forEach((response, index) => {
			appropriateProbability += probabilities[index] * Number(response.appropriate);
			assertiveness += probabilities[index] * response.features[0];
			unsupportedProbability +=
				probabilities[index] *
				Number(response.id === 'bold' || (!task.hasEvidence && response.id === 'measured'));
		});
	}
	return {
		appropriateProbability: appropriateProbability / tasks.length,
		assertiveness: assertiveness / tasks.length,
		unsupportedProbability: unsupportedProbability / tasks.length,
		correctTopChoice,
		count: tasks.length
	};
}
