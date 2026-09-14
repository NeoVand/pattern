import type { ToolSpec } from './types';

export const MAX_INTEGER_DIGITS = 80;

export const multiplicationExamples = [
	{ label: '8 × 9 digits', a: '76756854', b: '446657557' },
	{ label: '20 × 20 digits', a: '73829461509382746159', b: '49281736058472916387' },
	{
		label: '40 × 40 digits',
		a: '7382946150938274615928471639506284716395',
		b: '4928173605847291638716253847091826354719'
	}
] as const;

export function normalizeInteger(value: unknown): string {
	if (
		typeof value !== 'string' ||
		!new RegExp(`^[+-]?\\d{1,${MAX_INTEGER_DIGITS}}$`).test(value.trim())
	)
		throw new Error(
			`Use a whole number with 1–${MAX_INTEGER_DIGITS} digits, with an optional + or − sign. No commas, decimals, or exponents.`
		);
	return BigInt(value.trim()).toString();
}

/** Keep inputs and outputs as strings: converting through Number would lose digits. */
export function multiplyIntegers(a: string, b: string): string {
	return (BigInt(normalizeInteger(a)) * BigInt(normalizeInteger(b))).toString();
}

export const calculatorTool: ToolSpec = {
	name: 'multiply_integers',
	description:
		'Multiply two integers exactly, including very large integers. Pass each operand as a decimal STRING, never a JSON number. Returns the exact product as a decimal string. Copy the returned product without rounding.',
	parameters: {
		type: 'object',
		properties: {
			a: {
				type: 'string',
				description: `First integer, up to ${MAX_INTEGER_DIGITS} digits with optional sign.`
			},
			b: {
				type: 'string',
				description: `Second integer, up to ${MAX_INTEGER_DIGITS} digits with optional sign.`
			}
		},
		required: ['a', 'b'],
		additionalProperties: false
	}
};

export type CalculatorOutput = { a: string; b: string; product: string } | { error: string };

export function executeCalculator(name: string, raw: string): CalculatorOutput {
	if (name !== calculatorTool.name)
		return { error: 'The only available tool is multiply_integers.' };
	if (raw.length > 2000) return { error: 'Tool arguments are too long.' };
	try {
		const args = JSON.parse(raw);
		if (
			!args ||
			typeof args !== 'object' ||
			Array.isArray(args) ||
			Object.keys(args).some((key) => key !== 'a' && key !== 'b')
		)
			return { error: 'Provide only a and b as decimal strings in a JSON object.' };
		const a = normalizeInteger(args.a);
		const b = normalizeInteger(args.b);
		return { a, b, product: multiplyIntegers(a, b) };
	} catch (error) {
		return {
			error:
				error instanceof SyntaxError
					? 'Arguments must be valid JSON.'
					: error instanceof Error
						? error.message
						: 'Invalid tool arguments.'
		};
	}
}

export type AnswerCheck = {
	status: 'exact' | 'incorrect' | 'unverified';
	value?: string;
	difference?: string;
};

/** Check the entire answer; finding the expected digits inside prose is not proof. */
export function checkIntegerAnswer(answer: string, expected: string): AnswerCheck {
	const text = answer.trim();
	if (
		text.length > 1000 ||
		!/^[+-]?(?:\d+|\d{1,3}(?:,\d{3})+|\d{1,3}(?:[ \u00a0\u202f]\d{3})+)$/.test(text)
	)
		return { status: 'unverified' };
	const value = BigInt(text.replace(/[, \u00a0\u202f]/g, ''));
	const delta = value - BigInt(expected);
	return {
		status: delta === 0n ? 'exact' : 'incorrect',
		value: value.toString(),
		difference: (delta < 0n ? -delta : delta).toString()
	};
}
