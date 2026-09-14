import { afterEach, expect, test, vi } from 'vitest';
import { AiSession } from './session.svelte';
import { LocalModel } from './local';
import type { Completion } from './types';

afterEach(() => {
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

function deferred<T>() {
	let resolve!: (value: T) => void;
	let reject!: (error: Error) => void;
	const promise = new Promise<T>((yes, no) => {
		resolve = yes;
		reject = no;
	});
	return { promise, resolve, reject };
}

function response(text: string) {
	return new Response(
		`data: ${JSON.stringify({ type: 'response.completed', response: { output: [{ type: 'message', content: [{ type: 'output_text', text }] }] } })}\n\n`
	);
}

test('OpenAI requests overlap, use a fixed model, and keep the session busy until both settle', async () => {
	const ai = new AiSession();
	ai.provider = 'openai';
	ai.apiKey = 'test-key';
	ai.models = [{ value: 'gpt-4.1-mini', label: 'Mini' }];
	const first = deferred<Response>(),
		second = deferred<Response>();
	const fetch = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
	vi.stubGlobal('fetch', fetch);
	const requests: Record<string, unknown>[] = [];
	let firstDone = false;
	const run = ai.withParallelGeneration(async ([without, withTool]) => {
		const left = without({
			messages: [{ role: 'user', content: '2 × 3' }],
			onRequest: (request) => requests.push(request)
		}).then((result) => {
			firstDone = true;
			return result;
		});
		ai.openaiModel = 'a-different-model';
		const right = withTool({
			messages: [{ role: 'user', content: '2 × 3' }],
			onRequest: (request) => requests.push(request)
		});
		return await Promise.all([left, right]);
	});
	expect(fetch).toHaveBeenCalledTimes(2);
	expect(requests.map((request) => request.model)).toEqual(['gpt-4.1-mini', 'gpt-4.1-mini']);
	expect(JSON.stringify(requests)).not.toContain('test-key');
	first.resolve(response('6'));
	await expect.poll(() => firstDone).toBe(true);
	expect(ai.busy).toBe(true);
	await expect(ai.generate({ messages: [] })).rejects.toThrow('still running');
	second.resolve(response('6'));
	expect((await run).map((result) => result.text)).toEqual(['6', '6']);
	expect(ai.busy).toBe(false);
	ai.dispose();
});

test('cancelling a comparison aborts both active OpenAI requests and releases the session', async () => {
	const ai = new AiSession();
	ai.provider = 'openai';
	ai.apiKey = 'test-key';
	ai.models = [{ value: 'gpt-4.1-mini', label: 'Mini' }];
	const signals: AbortSignal[] = [];
	vi.stubGlobal(
		'fetch',
		vi.fn(
			(_url, init) =>
				new Promise((_resolve, reject) => {
					signals.push(init.signal);
					init.signal.addEventListener(
						'abort',
						() => reject(new DOMException('Stopped', 'AbortError')),
						{ once: true }
					);
				})
		)
	);
	const abort = new AbortController();
	const run = ai.withParallelGeneration(
		([a, b]) => Promise.allSettled([a({ messages: [] }), b({ messages: [] })]),
		abort.signal
	);
	expect(signals).toHaveLength(2);
	abort.abort();
	expect((await run).every((result) => result.status === 'rejected')).toBe(true);
	expect(signals.every((signal) => signal.aborted)).toBe(true);
	expect(ai.busy).toBe(false);
	ai.dispose();
});

test('local comparisons load a separate worker and start both generations before either completes', async () => {
	const ai = new AiSession();
	vi.spyOn(ai, 'ready', 'get').mockReturnValue(true);
	const load = vi.spyOn(LocalModel.prototype, 'load').mockResolvedValue();
	const first = deferred<Completion>(),
		second = deferred<Completion>();
	const generate = vi
		.spyOn(LocalModel.prototype, 'generate')
		.mockReturnValueOnce(first.promise)
		.mockReturnValueOnce(second.promise);
	const dispose = vi.spyOn(LocalModel.prototype, 'dispose');
	const run = ai.withParallelGeneration(([a, b]) =>
		Promise.all([a({ messages: [] }), b({ messages: [] })])
	);
	await expect.poll(() => generate.mock.calls.length).toBe(2);
	expect(load).toHaveBeenCalledWith(ai.localModel, expect.any(Function));
	expect(generate.mock.contexts[0]).not.toBe(generate.mock.contexts[1]);
	expect(generate.mock.contexts[1]).toBe(load.mock.contexts[0]);
	first.resolve({ text: '6', calls: [] });
	second.resolve({ text: '6', calls: [] });
	expect(await run).toHaveLength(2);
	expect(dispose.mock.contexts).toContain(generate.mock.contexts[1]);
	expect(ai.busy).toBe(false);
	ai.dispose();
});

test('a failed local peer load leaves the session usable and runs no conversations', async () => {
	const ai = new AiSession();
	vi.spyOn(ai, 'ready', 'get').mockReturnValue(true);
	vi.spyOn(LocalModel.prototype, 'load').mockRejectedValue(new Error('Insufficient GPU memory'));
	const run = vi.fn();
	await expect(ai.withParallelGeneration(run)).rejects.toThrow('Insufficient GPU memory');
	expect(run).not.toHaveBeenCalled();
	expect(ai.busy).toBe(false);
	ai.dispose();
});
