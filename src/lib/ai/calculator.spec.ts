import { describe, expect, it, vi } from 'vitest';
import {
	calculatorTool,
	checkIntegerAnswer,
	executeCalculator,
	multiplicationExamples,
	multiplyIntegers
} from './calculator';
import { runCalculatorTrial, type CalculatorEvent } from './calculator-experiment';
import type { Completion, GenerationOptions } from './types';
import { lessons } from '$lib/data/lessons';
import { notes, sources } from '$lib/data/notes';

const a = '73829461509382746159';
const b = '49281736058472916387';
const expected = '3638444035444585948898224156135652407533';
const call = { id: 'call_exact', name: calculatorTool.name, arguments: JSON.stringify({ a, b }) };
const answer = (text: string): Completion => ({ text, calls: [] });

describe('exact integer calculator', () => {
	it('keeps all digits beyond Number precision, including 80-digit inputs', () => {
		expect(multiplyIntegers('76756854', '446657557')).toBe('34284028890645678');
		expect(multiplyIntegers(a, b)).toBe(expected);
		expect(multiplyIntegers(multiplicationExamples[2].a, multiplicationExamples[2].b)).toBe(
			'36384440354445859489242556021511134082555124250806539938106058315962495584918005'
		);
		expect(multiplyIntegers('9'.repeat(80), '9'.repeat(80))).toBe(
			'9'.repeat(79) + '8' + '0'.repeat(79) + '1'
		);
		expect(multiplyIntegers('-00012', '+3')).toBe('-36');
		expect(multiplyIntegers('-0', a)).toBe('0');
	});
	it('rejects JSON numbers, invalid syntax, unknown tools, and excess arguments', () => {
		for (const raw of [
			'null',
			'[]',
			'{',
			'{"a":9007199254740993,"b":"2"}',
			'{"a":"1e20","b":"2"}',
			'{"a":"1.5","b":"2"}',
			'{"a":"","b":"2"}',
			'{"a":"2","b":"3","code":"run()"}',
			JSON.stringify({ a: '9'.repeat(81), b: '2' })
		])
			expect(executeCalculator(calculatorTool.name, raw)).toHaveProperty('error');
		expect(executeCalculator('eval', '{}')).toHaveProperty('error');
		expect(executeCalculator(calculatorTool.name, JSON.stringify({ a, b }))).toEqual({
			a,
			b,
			product: expected
		});
	});
	it('verifies full integer answers without accepting embedded, rounded, or ambiguous numbers', () => {
		expect(checkIntegerAnswer(expected, expected).status).toBe('exact');
		expect(checkIntegerAnswer('34,284,028,890,645,678', '34284028890645678').status).toBe('exact');
		expect(checkIntegerAnswer('34 284 028 890 645 678', '34284028890645678').status).toBe('exact');
		expect(checkIntegerAnswer('34284028890645679', '34284028890645678')).toMatchObject({
			status: 'incorrect',
			difference: '1'
		});
		for (const text of [
			`The answer may be ${expected} or 0`,
			'3.428402889064568e16',
			'34,28',
			'34\n284',
			'',
			'- 5'
		])
			expect(checkIntegerAnswer(text, expected).status).toBe('unverified');
	});
});

describe('calculator tool loop', () => {
	it('offers a real schema, executes returned arguments, and sends the result with the matching call ID', async () => {
		const reasoning = { type: 'reasoning', id: 'reasoning_1', summary: [] };
		const generate = vi
			.fn<(options: GenerationOptions) => Promise<Completion>>()
			.mockResolvedValueOnce({
				text: '',
				calls: [call],
				nativeItems: [
					reasoning,
					{ type: 'function_call', call_id: call.id, name: call.name, arguments: call.arguments }
				]
			})
			.mockResolvedValueOnce(answer(expected));
		const events: CalculatorEvent[] = [];
		const result = await runCalculatorTrial({
			a,
			b,
			withTool: true,
			generate,
			onEvent: (event) => events.push(event)
		});
		expect(generate.mock.calls[0][0].tools).toEqual([calculatorTool]);
		expect(JSON.stringify(generate.mock.calls[0][0].messages)).not.toContain(expected);
		expect(generate.mock.calls[1][0].responseInput).toContainEqual(reasoning);
		expect(generate.mock.calls[1][0].responseInput).toContainEqual({
			type: 'function_call_output',
			call_id: call.id,
			output: JSON.stringify({ a, b, product: expected })
		});
		expect(generate.mock.calls[1][0].messages.at(-1)).toMatchObject({
			role: 'tool',
			tool_call_id: call.id
		});
		expect(events).toContainEqual({ kind: 'tool', call, output: { a, b, product: expected } });
		expect(result).toMatchObject({ answer: expected, calls: 1, usedCorrectOperands: true });
	});
	it('keeps prompts identical and preserves both unaided success and failure without inventing a tool call', async () => {
		const generate = vi
			.fn<(options: GenerationOptions) => Promise<Completion>>()
			.mockResolvedValue(answer(expected));
		const baseline = await runCalculatorTrial({ a, b, withTool: false, generate });
		const assisted = await runCalculatorTrial({ a, b, withTool: true, generate });
		expect(generate.mock.calls[0][0].tools).toBeUndefined();
		expect(generate.mock.calls[0][0].messages).toEqual(generate.mock.calls[1][0].messages);
		expect(baseline.answer).toBe(expected);
		expect(assisted).toMatchObject({ answer: expected, calls: 0, usedCorrectOperands: false });
		generate.mockResolvedValue(answer('12345'));
		expect((await runCalculatorTrial({ a, b, withTool: false, generate })).answer).toBe('12345');
	});
	it('returns tool errors to the model and permits a corrected request', async () => {
		const invalidCall = { ...call, arguments: '{"a":12,"b":"3"}' };
		const generate = vi
			.fn<(options: GenerationOptions) => Promise<Completion>>()
			.mockResolvedValueOnce({ text: '', calls: [invalidCall] })
			.mockResolvedValueOnce({ text: '', calls: [call] })
			.mockResolvedValueOnce(answer(expected));
		const result = await runCalculatorTrial({ a, b, withTool: true, generate });
		expect(generate.mock.calls[1][0].messages.at(-1)?.content).toContain('error');
		expect(result).toMatchObject({ calls: 2, usedCorrectOperands: true, answer: expected });
	});
	it('does not treat a calculation with the wrong operands as evidence for this question', async () => {
		const generate = vi
			.fn<(options: GenerationOptions) => Promise<Completion>>()
			.mockResolvedValueOnce({ text: '', calls: [{ ...call, arguments: '{"a":"2","b":"3"}' }] })
			.mockResolvedValueOnce(answer('6'));
		expect(await runCalculatorTrial({ a, b, withTool: true, generate })).toMatchObject({
			answer: '6',
			usedCorrectOperands: false
		});
	});
	it('bounds repeated calls and never executes a pending call after cancellation', async () => {
		const generate = vi
			.fn<(options: GenerationOptions) => Promise<Completion>>()
			.mockResolvedValue({ text: '', calls: [call] });
		await expect(runCalculatorTrial({ a, b, withTool: true, generate })).rejects.toThrow(
			'four model turns'
		);
		expect(generate).toHaveBeenCalledTimes(4);
		const controller = new AbortController();
		const onEvent = vi.fn();
		generate.mockImplementation(async () => {
			controller.abort();
			return { text: '', calls: [call] };
		});
		await expect(
			runCalculatorTrial({ a, b, withTool: true, generate, signal: controller.signal, onEvent })
		).rejects.toThrow();
		expect(onEvent.mock.calls.some(([event]) => event.kind === 'tool')).toBe(false);
	});
	it('links the chapter to its own reflection and the agents chapter', () => {
		const index = lessons.findIndex((lesson) => lesson.id === 'tool-calling');
		expect(lessons[index + 1].id).toBe('agents');
		expect(notes[lessons[index].noteIndex].question).toContain('calculator');
		expect(sources.some((source) => source.chapters.includes(lessons[index].noteIndex))).toBe(true);
	});
});
