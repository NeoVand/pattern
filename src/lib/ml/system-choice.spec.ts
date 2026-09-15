import { describe, expect, test } from 'vitest';
import {
	centsText,
	DEFAULT_SHOP_SYSTEM,
	evaluateShop,
	makeShopData,
	shopForecast,
	shopPlanExport,
	type ShopSystem
} from './system-choice';

const system: ShopSystem = {
	invoices: 'exact',
	policy: 'current',
	forecast: 'seasonal',
	reviewUnknown: true,
	alertThreshold: 15
};

describe('system design capstone', () => {
	test('integer-cent invoices are exact and rounded estimates expose their errors', () => {
		const data = makeShopData();
		const good = evaluateShop(system, 'validation', data);
		const rough = evaluateShop(DEFAULT_SHOP_SYSTEM, 'validation', data);
		expect(good.summary.exactInvoices).toBe(good.summary.invoiceCount);
		expect(rough.summary.exactInvoices).toBeLessThan(rough.summary.invoiceCount);
		expect(centsText('123456789123456789')).toBe('$1234567891234567.89');
		expect(centsText(-7)).toBe('-$0.07');
	});
	test('current retrieval follows document changes while a snapshot keeps stale facts', () => {
		const data = makeShopData();
		const updated = evaluateShop(system, 'changed', data);
		const snapshot = evaluateShop({ ...system, policy: 'snapshot' }, 'changed', data);
		expect(updated.summary.supportedAnswers).toBe(3);
		expect(snapshot.summary.unsupportedAnswers).toBe(3);
		expect(updated.policy[0].answer).toContain('30 days');
		expect(snapshot.policy[0].answer).toContain('14 days');
	});
	test('a missed paraphrase and missing evidence remain unresolved, even with review enabled', () => {
		const report = evaluateShop(system, 'final', makeShopData());
		expect(report.summary.supportedAnswers).toBe(1);
		expect(report.summary.answerableQuestions).toBe(2);
		expect(report.summary.reviewCount).toBe(2);
		expect(
			report.policy
				.filter((answer) => answer.status === 'review')
				.every((answer) => !answer.source && !answer.supported)
		).toBe(true);
		const noReview = evaluateShop({ ...system, reviewUnknown: false }, 'final', makeShopData());
		expect(noReview.policy.filter((answer) => answer.status === 'unanswered')).toHaveLength(2);
	});
	test('the fitted forecast uses only training days and monitoring detects a later shift', () => {
		const data = makeShopData();
		const changedFuture = {
			...data,
			demand: data.demand.map((value, day) => (day < 28 ? value : value + 10000))
		};
		expect(shopForecast(data, 'seasonal').predictions).toEqual(
			shopForecast(changedFuture, 'seasonal').predictions
		);
		const final = evaluateShop(system, 'final', data);
		const shift = evaluateShop(system, 'changed', data);
		expect(final.forecast.mae).toBeLessThan(8);
		expect(shift.forecast.mae).toBeGreaterThan(35);
		expect(shift.forecast.alert?.day).toBe(45);
		expect(final.forecast.alert).toBeNull();
	});
	test('case IDs are distinct across stages and exported evidence excludes unrevealed observations', () => {
		const data = makeShopData();
		const ids = Object.values(data.invoices)
			.flat()
			.map((invoice) => invoice.id);
		expect(new Set(ids).size).toBe(ids.length);
		expect(makeShopData(2).invoices.final).not.toEqual(data.invoices.final);
		const validation = evaluateShop(system, 'validation', data);
		const artifact = shopPlanExport(
			{
				system,
				rationale: 'Use exact rules and source evidence.',
				monitoring: 'Review missing sources and demand alerts.',
				round: 1
			},
			validation,
			null,
			null
		);
		expect(artifact.evidence.final).toBeUndefined();
		expect(artifact.evidence.changed).toBeUndefined();
		expect(artifact.evidence.validation.forecast.days.map((day) => day.day)).toEqual([
			29, 30, 31, 32, 33, 34, 35
		]);
		expect(() => JSON.stringify(artifact)).not.toThrow();
	});
});
