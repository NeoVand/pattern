import { multiplyIntegers } from '$lib/ai/calculator';
import { keywordScore, type Passage } from '$lib/ai/retrieval';
import { LinearForecaster } from './forecast';
import { decisionRandom } from './decisions';

export type CapstoneStage = 'validation' | 'final' | 'changed';
export interface ShopSystem {
	invoices: 'exact' | 'rounded';
	policy: 'current' | 'snapshot';
	forecast: 'seasonal' | 'repeat' | 'mean';
	reviewUnknown: boolean;
	alertThreshold: number;
}
export const DEFAULT_SHOP_SYSTEM: ShopSystem = {
	invoices: 'rounded',
	policy: 'snapshot',
	forecast: 'mean',
	reviewUnknown: true,
	alertThreshold: 15
};
export interface ShopInvoice {
	id: string;
	quantity: number;
	unitCents: number;
}
export interface ShopQuestion {
	id: string;
	question: string;
	expectedSource: string | null;
}
export interface ShopData {
	round: number;
	demand: number[];
	invoices: Record<CapstoneStage, ShopInvoice[]>;
	questions: Record<CapstoneStage, ShopQuestion[]>;
}

export function shopDocuments(changed = false): Passage[] {
	return [
		{
			id: 'returns',
			title: 'Returns policy',
			topic: 'Policy',
			body: `Returns are accepted within ${changed ? 30 : 14} days with a receipt.`
		},
		{
			id: 'shipping',
			title: 'Shipping policy',
			topic: 'Policy',
			body: `Shipping is free on orders of $${changed ? 75 : 50} or more.`
		},
		{
			id: 'pickup',
			title: 'Pickup policy',
			topic: 'Policy',
			body: `Pickup orders can be collected before ${changed ? '15:00' : '16:00'} on weekdays.`
		}
	];
}

export function makeShopData(round = 1): ShopData {
	const random = decisionRandom(90210 + round * 101);
	const demand = Array.from({ length: 49 }, (_, day) =>
		Math.round(
			65 +
				0.65 * day +
				20 * Math.sin((2 * Math.PI * day) / 7) +
				(random() - 0.5) * 8 +
				(day >= 42 ? 45 : 0)
		)
	);
	const invoice = (stage: CapstoneStage, index: number) => ({
		id: `${round}-${stage}-invoice-${index}`,
		quantity: 2 + Math.floor(random() * 13),
		unitCents: 249 + Math.floor(random() * 1250)
	});
	return {
		round,
		demand,
		invoices: {
			validation: [0, 1].map((i) => invoice('validation', i)),
			final: [0, 1, 2].map((i) => invoice('final', i)),
			changed: [0, 1].map((i) => invoice('changed', i))
		},
		questions: {
			validation: [
				{
					id: `${round}-v-returns`,
					question: 'What is the returns policy?',
					expectedSource: 'returns'
				},
				{
					id: `${round}-v-shipping`,
					question: 'When is shipping free?',
					expectedSource: 'shipping'
				}
			],
			final: [
				{ id: `${round}-f-pickup`, question: 'What time is pickup?', expectedSource: 'pickup' },
				{
					id: `${round}-f-returns`,
					question: 'How long do I have to bring an item back?',
					expectedSource: 'returns'
				},
				{
					id: `${round}-f-refund`,
					question: 'How many days until a refund reaches my bank?',
					expectedSource: null
				}
			],
			changed: [
				{
					id: `${round}-c-returns`,
					question: 'What is the returns policy?',
					expectedSource: 'returns'
				},
				{
					id: `${round}-c-shipping`,
					question: 'When is shipping free?',
					expectedSource: 'shipping'
				},
				{ id: `${round}-c-pickup`, question: 'What time is pickup?', expectedSource: 'pickup' }
			]
		}
	};
}

export function centsText(cents: string | number) {
	const integer = BigInt(cents);
	const sign = integer < 0 ? '-' : '';
	const absolute = integer < 0 ? -integer : integer;
	return `${sign}$${absolute / 100n}.${(absolute % 100n).toString().padStart(2, '0')}`;
}

export function inspectShopPolicy(question: ShopQuestion, system: ShopSystem, changed: boolean) {
	const current = shopDocuments(changed);
	const documents = shopDocuments(system.policy === 'current' && changed);
	const ranked = documents
		.map((document) => ({
			document,
			score: keywordScore(question.question, `${document.title} ${document.body}`)
		}))
		.sort((a, b) => b.score - a.score);
	// Low lexical evidence must not be converted into an invented answer.
	const hit = ranked[0].score >= 0.2 ? ranked[0] : null;
	const expected = current.find((document) => document.id === question.expectedSource);
	const supported = Boolean(
		hit && expected && hit.document.id === expected.id && hit.document.body === expected.body
	);
	return {
		...question,
		answer: hit
			? `${hit.document.body} [${hit.document.id}]`
			: system.reviewUnknown
				? 'Queued for human review. No answer has been supplied.'
				: 'No sufficiently matching source was found. No answer supplied.',
		source: hit?.document ?? null,
		matchScore: ranked[0].score,
		expectedAnswer: expected?.body ?? 'The current documents do not specify refund timing.',
		status: hit
			? supported
				? ('supported' as const)
				: ('incorrect' as const)
			: system.reviewUnknown
				? ('review' as const)
				: ('unanswered' as const),
		supported
	};
}

export function shopForecast(data: ShopData, choice: ShopSystem['forecast']) {
	const training = data.demand.slice(0, 28);
	if (choice === 'seasonal') {
		const model = new LinearForecaster('seasonal', training, 7);
		model.train(600);
		return {
			predictions: data.demand.map((_, day) => model.predict(day)),
			weights: Array.from(model.weights),
			training: 28,
			updates: model.step
		};
	}
	const mean = training.reduce((sum, value) => sum + value, 0) / training.length;
	return {
		predictions: data.demand.map((_, day) => (choice === 'mean' ? mean : training[21 + (day % 7)])),
		weights: choice === 'mean' ? [mean] : training.slice(21),
		training: 28,
		updates: 0
	};
}

export function evaluateShop(system: ShopSystem, stage: CapstoneStage, data: ShopData) {
	const invoices = data.invoices[stage].map((invoice) => {
		const expected = multiplyIntegers(invoice.quantity.toString(), invoice.unitCents.toString());
		const unitCents =
			system.invoices === 'exact' ? invoice.unitCents : Math.round(invoice.unitCents / 100) * 100;
		const result = multiplyIntegers(invoice.quantity.toString(), unitCents.toString());
		return {
			...invoice,
			expected,
			result,
			correct: result === expected,
			absoluteErrorCents: (BigInt(result) > BigInt(expected)
				? BigInt(result) - BigInt(expected)
				: BigInt(expected) - BigInt(result)
			).toString()
		};
	});
	const policy = data.questions[stage].map((question) =>
		inspectShopPolicy(question, system, stage === 'changed')
	);
	const forecast = shopForecast(data, system.forecast);
	const start = stage === 'validation' ? 28 : stage === 'final' ? 35 : 42;
	const days = data.demand
		.slice(start, start + 7)
		.map((actual, index) => ({
			day: start + index + 1,
			actual,
			prediction: forecast.predictions[start + index],
			error: Math.abs(actual - forecast.predictions[start + index])
		}));
	const mae = days.reduce((sum, day) => sum + day.error, 0) / days.length;
	const alert =
		days
			.map((day, index) => ({
				day: day.day,
				rollingError:
					index < 2
						? null
						: days
								.slice(index - 2, index + 1)
								.reduce((sum, observation) => sum + observation.error, 0) / 3
			}))
			.find((entry) => entry.rollingError !== null && entry.rollingError > system.alertThreshold) ??
		null;
	return {
		stage,
		round: data.round,
		system: { ...system },
		fingerprint: JSON.stringify(system),
		invoices,
		policy,
		forecast: { ...forecast, days, mae, alert, alertThreshold: system.alertThreshold },
		summary: {
			exactInvoices: invoices.filter((invoice) => invoice.correct).length,
			invoiceCount: invoices.length,
			supportedAnswers: policy.filter((answer) => answer.supported).length,
			answerableQuestions: policy.filter((answer) => answer.expectedSource !== null).length,
			reviewCount: policy.filter((answer) => answer.status === 'review').length,
			unsupportedAnswers: policy.filter((answer) => answer.status === 'incorrect').length
		}
	};
}

export type ShopReport = ReturnType<typeof evaluateShop>;
export interface ShopCommitment {
	system: ShopSystem;
	rationale: string;
	monitoring: string;
	round: number;
}

export function shopPlanExport(
	commitment: ShopCommitment,
	validation: ShopReport,
	final: ShopReport | null,
	changed: ShopReport | null
) {
	return {
		course: 'Pattern',
		exercise: 'Which system should we build?',
		commitment,
		evidence: { validation, ...(final ? { final } : {}), ...(changed ? { changed } : {}) },
		limits:
			'Synthetic local exercise. A fixed rule performs invoice arithmetic, keyword overlap retrieves authored policy passages, and a linear seasonal model or simple baseline forecasts demand. No language model or human response is simulated. No external service is contacted. Unrevealed cases are excluded from this export. Repeated rounds test a familiar synthetic generator, not broad deployment readiness.'
	};
}
