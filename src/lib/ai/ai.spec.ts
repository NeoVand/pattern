import { describe, it, expect, vi, afterEach } from 'vitest';
import { readEventStream, generateOpenAI, responseInput } from './openai';
import { parseLocalResult } from './local';
import { executeTool, initialSales } from './agent-tools';
const bytes = new TextEncoder();
function stream(text: string, step = 1) {
	const data = bytes.encode(text);
	return new ReadableStream<Uint8Array>({
		start(controller) {
			for (let i = 0; i < data.length; i += step) controller.enqueue(data.slice(i, i + step));
			controller.close();
		}
	});
}
afterEach(() => vi.unstubAllGlobals());
describe('Real inference transports', () => {
	it('reads fragmented SSE frames and Unicode without confusing network chunks with tokens', async () => {
		const events: Record<string, unknown>[] = [];
		await readEventStream(
			stream(
				'event: response.output_text.delta\r\ndata: {"type":"delta","delta":"café 🌙"}\r\n\r\ndata: {"type":"done"}\n\ndata: [DONE]\n\n'
			),
			(e) => events.push(e)
		);
		expect(events).toEqual([{ type: 'delta', delta: 'café 🌙' }, { type: 'done' }]);
	});
	it('streams text, returns actual function calls, and sends a stateless OpenAI request', async () => {
		const native = {
			output: [
				{ type: 'message', content: [{ type: 'output_text', text: 'Checking.' }] },
				{ type: 'function_call', call_id: 'call_1', name: 'read_sales', arguments: '{}' }
			],
			usage: { input_tokens: 80, output_tokens: 12 }
		};
		const fetchMock = vi
			.fn()
			.mockResolvedValue(
				new Response(
					stream(
						`data: ${JSON.stringify({ type: 'response.output_text.delta', delta: 'Checking.' })}\n\ndata: ${JSON.stringify({ type: 'response.completed', response: native })}\n\n`,
						3
					)
				)
			);
		vi.stubGlobal('fetch', fetchMock);
		let output = '';
		const result = await generateOpenAI('test-key', 'gpt-4.1-mini', {
			messages: [{ role: 'user', content: 'Analyze the sales' }],
			tools: [
				{
					name: 'read_sales',
					description: 'Read',
					parameters: { type: 'object', properties: {}, required: [], additionalProperties: false }
				}
			],
			onText: (chunk) => (output += chunk)
		});
		const body = JSON.parse(fetchMock.mock.calls[0][1].body);
		expect(output).toBe('Checking.');
		expect(result.calls).toEqual([{ id: 'call_1', name: 'read_sales', arguments: '{}' }]);
		expect(result.outputTokens).toBe(12);
		expect(body.store).toBe(false);
		expect(body.tools[0].strict).toBe(true);
		expect(body).not.toHaveProperty('apiKey');
		expect(
			responseInput([{ role: 'tool', tool_call_id: 'call_1', content: '{"value":140}' }])
		).toEqual([{ type: 'function_call_output', call_id: 'call_1', output: '{"value":140}' }]);
	});
	it('sends image pixels as multimodal input alongside the user question', async () => {
		const image = 'data:image/png;base64,cGl4ZWxz';
		const fetchMock = vi
			.fn()
			.mockResolvedValue(
				new Response(
					stream(
						`data: ${JSON.stringify({ type: 'response.completed', response: { output: [{ type: 'message', content: [{ type: 'output_text', text: 'A boat on the water.' }] }] } })}\n\n`
					)
				)
			);
		vi.stubGlobal('fetch', fetchMock);
		const result = await generateOpenAI('test-key', 'gpt-4.1-mini', {
			messages: [{ role: 'user', content: 'Describe this image.', images: [image] }]
		});
		const body = JSON.parse(fetchMock.mock.calls[0][1].body);
		expect(body.input[0]).toEqual({
			role: 'user',
			content: [
				{ type: 'input_text', text: 'Describe this image.' },
				{ type: 'input_image', image_url: image, detail: 'auto' }
			]
		});
		expect(body.store).toBe(false);
		expect(result.text).toBe('A boat on the water.');
	});
	it('surfaces authentication errors instead of showing a fabricated answer', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 401 })));
		await expect(generateOpenAI('bad-key', 'gpt-4.1-mini', { messages: [] })).rejects.toThrow(
			'OpenAI rejected this key'
		);
	});
	it('parses Qwen tool output and rejects malformed tool calls', () => {
		expect(
			parseLocalResult(
				'<think>private reasoning</think><tool_call>{"name":"calculate","arguments":{"operation":"add","a":2,"b":3}}</tool_call>'
			).calls[0]
		).toMatchObject({ name: 'calculate', arguments: '{"operation":"add","a":2,"b":3}' });
		expect(parseLocalResult('Hello.')).toEqual({ text: 'Hello.', calls: [] });
		expect(() =>
			parseLocalResult('<tool_call>{"name":"read_sales","arguments":"bad"}</tool_call>')
		).toThrow('malformed');
	});
});
describe('The agent executes only explicit allowed tools', () => {
	it('uses actual editable data and correctly compares unequal group sizes', () => {
		expect(
			executeTool('summarize_sales', '{"period":"weekday","metric":"average"}', initialSales)
		).toMatchObject({ value: 140, days: 5 });
		expect(
			executeTool('summarize_sales', '{"period":"weekend","metric":"average"}', initialSales)
		).toMatchObject({ value: 245, days: 2 });
		const edited = initialSales.map((r) => ({ ...r, sales: r.day === 'Sunday' ? 330 : r.sales }));
		expect(
			executeTool('summarize_sales', '{"period":"weekend","metric":"average"}', edited)
		).toMatchObject({ value: 295 });
		expect(
			executeTool('calculate', '{"operation":"subtract","a":245,"b":140}', edited)
		).toMatchObject({ value: 105 });
	});
	it('returns recoverable errors for unsafe or invalid requests', () => {
		expect(executeTool('shell', '{"command":"anything"}', initialSales)).toHaveProperty('error');
		expect(
			executeTool('calculate', '{"operation":"divide","a":7,"b":0}', initialSales)
		).toHaveProperty('error');
		expect(
			executeTool('summarize_sales', '{"period":"today","metric":"average"}', initialSales)
		).toHaveProperty('error');
		expect(executeTool('read_sales', 'not JSON', initialSales)).toHaveProperty('error');
	});
});
