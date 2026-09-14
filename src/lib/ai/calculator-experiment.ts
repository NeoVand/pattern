import {
	calculatorTool,
	executeCalculator,
	normalizeInteger,
	type CalculatorOutput
} from './calculator';
import { responseInput } from './openai';
import type { ChatMessage, Completion, GenerationOptions, ToolCall } from './types';

export type CalculatorEvent =
	| { kind: 'turn'; turn: number }
	| { kind: 'request'; turn: number; request: Record<string, unknown> }
	| { kind: 'text'; text: string }
	| { kind: 'model'; turn: number; response: Completion }
	| { kind: 'tool'; call: ToolCall; output: CalculatorOutput };

export type CalculatorTurn = {
	number: number;
	request: Record<string, unknown> | null;
	response: Completion | null;
	draft: string;
	tools: Extract<CalculatorEvent, { kind: 'tool' }>[];
};

export const calculatorInstructions =
	'Answer the multiplication question accurately. If a calculator tool is available, call it with the exact operands and use its result. Do not invent tool results. Return only the final product as a full decimal integer, with no explanation, rounding, or scientific notation.';

/** Both modes start fresh with the same prompt. Only the offered tool differs. */
export async function runCalculatorTrial({
	a,
	b,
	withTool,
	generate,
	signal,
	onEvent = () => {}
}: {
	a: string;
	b: string;
	withTool: boolean;
	generate: (options: GenerationOptions) => Promise<Completion>;
	signal?: AbortSignal;
	onEvent?: (event: CalculatorEvent) => void;
}) {
	const left = normalizeInteger(a),
		right = normalizeInteger(b);
	const messages: ChatMessage[] = [
		{ role: 'system', content: calculatorInstructions },
		{ role: 'user', content: `What is ${left} × ${right}?` }
	];
	const native = responseInput(messages);
	let calls = 0;
	let usedCorrectOperands = false;
	const maxTurns = withTool ? 4 : 1;
	for (let turn = 1; turn <= maxTurns; turn++) {
		signal?.throwIfAborted();
		onEvent({ kind: 'turn', turn });
		const result = await generate({
			messages: [...messages],
			responseInput: [...native],
			...(withTool ? { tools: [calculatorTool] } : {}),
			temperature: 0,
			maxTokens: 768,
			signal,
			onRequest: (request) => onEvent({ kind: 'request', turn, request }),
			onText: (text) => {
				if (!signal?.aborted) onEvent({ kind: 'text', text });
			}
		});
		signal?.throwIfAborted();
		onEvent({ kind: 'model', turn, response: result });
		if (!result.calls.length)
			return { answer: result.text, calls, usedCorrectOperands, turns: turn };
		if (!withTool)
			throw new Error('The model requested a tool in the run without tools. No tool was executed.');
		if (calls + result.calls.length > 8)
			throw new Error('Stopped at the tool-call limit. Try another model or smaller numbers.');
		const assistant: ChatMessage = {
			role: 'assistant',
			content: result.text,
			tool_calls: result.calls
		};
		messages.push(assistant);
		// Preserve native output items (including reasoning items) for the Responses API.
		native.push(...(result.nativeItems ?? responseInput([assistant])));
		for (const call of result.calls) {
			signal?.throwIfAborted();
			const output = executeCalculator(call.name, call.arguments);
			calls++;
			if (
				'product' in output &&
				((output.a === left && output.b === right) || (output.a === right && output.b === left))
			)
				usedCorrectOperands = true;
			onEvent({ kind: 'tool', call, output });
			const content = JSON.stringify(output);
			messages.push({ role: 'tool', content, name: call.name, tool_call_id: call.id });
			native.push({ type: 'function_call_output', call_id: call.id, output: content });
		}
	}
	throw new Error(
		'Stopped after four model turns without a final answer. The actual tool results are preserved below.'
	);
}
