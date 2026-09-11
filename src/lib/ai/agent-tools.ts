import type { ToolSpec } from './types';
export type SalesRow = { day: string; weekend: boolean; sales: number };
export const initialSales: SalesRow[] = [
	{ day: 'Monday', weekend: false, sales: 120 },
	{ day: 'Tuesday', weekend: false, sales: 135 },
	{ day: 'Wednesday', weekend: false, sales: 128 },
	{ day: 'Thursday', weekend: false, sales: 142 },
	{ day: 'Friday', weekend: false, sales: 175 },
	{ day: 'Saturday', weekend: true, sales: 260 },
	{ day: 'Sunday', weekend: true, sales: 230 }
];
export const agentTools: ToolSpec[] = [
	{
		name: 'read_sales',
		description:
			'Read the seven daily sales figures and whether each day is a weekend. Sales are units sold. This is the available dataset.',
		parameters: { type: 'object', properties: {}, required: [], additionalProperties: false }
	},
	{
		name: 'summarize_sales',
		description:
			'Calculate the exact total or daily average units sold for weekdays, weekends, or all days.',
		parameters: {
			type: 'object',
			properties: {
				period: { type: 'string', enum: ['weekday', 'weekend', 'all'] },
				metric: { type: 'string', enum: ['total', 'average'] }
			},
			required: ['period', 'metric'],
			additionalProperties: false
		}
	},
	{
		name: 'calculate',
		description:
			'Perform arithmetic on two numbers. To compare daily averages as a ratio, divide one average by the other.',
		parameters: {
			type: 'object',
			properties: {
				operation: { type: 'string', enum: ['add', 'subtract', 'multiply', 'divide'] },
				a: { type: 'number' },
				b: { type: 'number' }
			},
			required: ['operation', 'a', 'b'],
			additionalProperties: false
		}
	}
];
/** Only these read-only functions can run. Model text is never evaluated as code. */
export function executeTool(name: string, raw: string, rows: SalesRow[]): Record<string, unknown> {
	let args: Record<string, unknown>;
	try {
		args = JSON.parse(raw);
	} catch {
		return { error: 'Arguments must be valid JSON.' };
	}
	if (!args || typeof args !== 'object' || Array.isArray(args))
		return { error: 'Arguments must be an object.' };
	if (name === 'read_sales') {
		if (Object.keys(args).length) return { error: 'read_sales takes no arguments.' };
		return { unit: 'items sold', rows: rows.map((row) => ({ ...row })) };
	}
	if (name === 'summarize_sales') {
		if (
			Object.keys(args).some((k) => !['period', 'metric'].includes(k)) ||
			!['weekday', 'weekend', 'all'].includes(String(args.period)) ||
			!['total', 'average'].includes(String(args.metric))
		)
			return { error: 'Choose period weekday, weekend, or all; metric total or average.' };
		const selected = rows.filter(
			(r) => args.period === 'all' || r.weekend === (args.period === 'weekend')
		);
		const total = selected.reduce((sum, r) => sum + r.sales, 0);
		return {
			period: args.period,
			metric: args.metric,
			days: selected.length,
			value: args.metric === 'average' ? total / selected.length : total,
			unit: args.metric === 'average' ? 'items per day' : 'items'
		};
	}
	if (name === 'calculate') {
		const { a, b, operation } = args;
		if (
			Object.keys(args).some((k) => !['a', 'b', 'operation'].includes(k)) ||
			typeof a !== 'number' ||
			typeof b !== 'number' ||
			!Number.isFinite(a) ||
			!Number.isFinite(b)
		)
			return { error: 'Provide two finite numbers a and b.' };
		if (operation === 'divide' && b === 0) return { error: 'Cannot divide by zero.' };
		const value =
			operation === 'add'
				? a + b
				: operation === 'subtract'
					? a - b
					: operation === 'multiply'
						? a * b
						: operation === 'divide'
							? a / b
							: NaN;
		return Number.isFinite(value)
			? { operation, a, b, value }
			: { error: 'Unsupported operation or non-finite result.' };
	}
	return { error: `Unknown tool: ${name}. Use read_sales, summarize_sales, or calculate.` };
}
