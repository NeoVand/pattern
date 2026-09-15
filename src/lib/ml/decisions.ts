export interface DecisionExample {
	id: number;
	signal: number;
	label: 0 | 1;
	probability: number;
	score: number;
}

export function decisionRandom(seed: number) {
	let state = seed >>> 0;
	return () => {
		state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
		return (state + 0.5) / 4294967296;
	};
}

const sigmoid = (value: number) => 1 / (1 + Math.exp(-value));

/** Stratified Gaussian population: x|y ~ N(2y−1, noise²). The supplied
 * Bayes probability uses the known generating parameters, not fitted weights.
 * confidence changes the log odds, leaving class ranking unchanged. */
export function decisionPopulation(
	count = 1000,
	prevalence = 0.01,
	noise = 1,
	confidence = 1,
	seed = 42
): DecisionExample[] {
	if (
		!Number.isInteger(count) ||
		count < 1 ||
		prevalence <= 0 ||
		prevalence >= 1 ||
		noise <= 0 ||
		confidence <= 0
	) {
		throw new RangeError(
			'Use a positive count, noise and confidence; prevalence must be between 0 and 1.'
		);
	}
	const random = decisionRandom(seed);
	const positives = Math.round(count * prevalence);
	const examples = Array.from({ length: count }, (_, id) => {
		const label = (id < positives ? 1 : 0) as 0 | 1;
		const normal = Math.sqrt(-2 * Math.log(random())) * Math.cos(2 * Math.PI * random());
		const signal = 2 * label - 1 + noise * normal;
		const logOdds = Math.log(prevalence / (1 - prevalence)) + (2 * signal) / (noise * noise);
		return {
			id,
			label,
			signal,
			probability: sigmoid(logOdds),
			score: sigmoid(logOdds * confidence)
		};
	});
	for (let i = examples.length - 1; i > 0; i--) {
		const j = Math.floor(random() * (i + 1));
		[examples[i], examples[j]] = [examples[j], examples[i]];
	}
	return examples;
}

export function decisionMetrics(
	examples: DecisionExample[],
	threshold: number,
	falsePositiveCost = 1,
	falseNegativeCost = 10
) {
	let tp = 0,
		tn = 0,
		fp = 0,
		fn = 0;
	for (const example of examples) {
		// A threshold of one deliberately implements the always-negative baseline.
		const positive = threshold < 1 && example.score >= threshold;
		if (positive && example.label) tp++;
		else if (positive) fp++;
		else if (example.label) fn++;
		else tn++;
	}
	return {
		tp,
		tn,
		fp,
		fn,
		accuracy: examples.length ? (tp + tn) / examples.length : 0,
		precision: tp + fp ? tp / (tp + fp) : null,
		recall: tp + fn ? tp / (tp + fn) : null,
		cost: fp * falsePositiveCost + fn * falseNegativeCost
	};
}

/** Wilson 95% binomial interval; useful even when a small bin contains zero positives. */
export function wilsonInterval(positives: number, count: number): [number, number] {
	if (!count) return [0, 1];
	const z = 1.959963984540054;
	const p = positives / count;
	const denominator = 1 + (z * z) / count;
	const center = (p + (z * z) / (2 * count)) / denominator;
	const radius =
		(z * Math.sqrt((p * (1 - p)) / count + (z * z) / (4 * count * count))) / denominator;
	return [Math.max(0, center - radius), Math.min(1, center + radius)];
}

export function decisionCalibration(examples: DecisionExample[], binCount = 10) {
	const groups = Array.from({ length: binCount }, (_, index) => ({
		index,
		count: 0,
		positives: 0,
		totalScore: 0
	}));
	let brier = 0;
	for (const example of examples) {
		const bin = groups[Math.min(binCount - 1, Math.floor(example.score * binCount))];
		bin.count++;
		bin.positives += example.label;
		bin.totalScore += example.score;
		brier += (example.score - example.label) ** 2;
	}
	const bins = groups
		.filter((bin) => bin.count)
		.map((bin) => ({
			...bin,
			meanScore: bin.totalScore / bin.count,
			observedRate: bin.positives / bin.count,
			interval: wilsonInterval(bin.positives, bin.count)
		}));
	return {
		bins,
		ece: examples.length
			? bins.reduce((sum, bin) => sum + bin.count * Math.abs(bin.meanScore - bin.observedRate), 0) /
				examples.length
			: 0,
		brier: examples.length ? brier / examples.length : 0
	};
}

/** Bayes decision threshold for zero cost on correct classifications. */
export function costThreshold(falsePositiveCost: number, falseNegativeCost: number) {
	return falsePositiveCost / (falsePositiveCost + falseNegativeCost);
}
