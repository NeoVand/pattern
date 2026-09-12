import type { ChatMessage, Completion, GenerationOptions } from './types';

export async function openAIRequest(
	endpoint: 'responses' | 'embeddings' | 'chat/completions' | 'audio/speech' | 'images/generations',
	payload: Record<string, unknown>,
	key: string,
	signal?: AbortSignal,
	local = false
) {
	if (!local && !key.trim()) throw new Error('Add your OpenAI API key in Model settings.');
	return fetch(local ? `/.pattern/ai/${endpoint}` : `https://api.openai.com/v1/${endpoint}`, {
		method: 'POST',
		headers: local
			? { 'Content-Type': 'application/json', 'X-Pattern-Client': '1' }
			: { 'Content-Type': 'application/json', Authorization: `Bearer ${key.trim()}` },
		body: JSON.stringify(payload),
		signal
	});
}

export async function embedOpenAI(
	key: string,
	input: string[],
	signal?: AbortSignal,
	local = false
) {
	const response = await openAIRequest(
		'embeddings',
		{
			model: 'text-embedding-3-small',
			input,
			dimensions: 256,
			encoding_format: 'float'
		},
		key,
		signal,
		local
	);
	const data = await response.json();
	if (!response.ok)
		throw new Error(data.error?.message ?? `Embedding request failed (${response.status}).`);
	return (data.data as { index: number; embedding: number[] }[])
		.sort((a, b) => a.index - b.index)
		.map((item) => item.embedding);
}

export function responseInput(messages: ChatMessage[]): Record<string, unknown>[] {
	return messages.flatMap((message) => {
		if (message.role === 'tool')
			return [
				{ type: 'function_call_output', call_id: message.tool_call_id, output: message.content }
			];
		const items: Record<string, unknown>[] =
			message.content || message.images?.length
				? [
						{
							role: message.role,
							content: message.images?.length
								? [
										{ type: 'input_text', text: message.content },
										...message.images.map((image_url) => ({
											type: 'input_image',
											image_url,
											detail: 'auto'
										}))
									]
								: message.content
						}
					]
				: [];
		for (const call of message.tool_calls ?? [])
			items.push({
				type: 'function_call',
				call_id: call.id,
				name: call.name,
				arguments: call.arguments
			});
		return items;
	});
}
export function responseResult(response: Record<string, unknown>): Completion {
	const output = (response.output ?? []) as Record<string, unknown>[];
	const text = output
		.filter((item) => item.type === 'message')
		.flatMap((item) => (item.content ?? []) as { type: string; text?: string; refusal?: string }[])
		.map((item) => item.text ?? item.refusal ?? '')
		.join('');
	const calls = output
		.filter((item) => item.type === 'function_call')
		.map((item) => ({
			id: String(item.call_id),
			name: String(item.name),
			arguments: String(item.arguments)
		}));
	const usage = response.usage as { input_tokens?: number; output_tokens?: number } | undefined;
	return {
		text,
		calls,
		inputTokens: usage?.input_tokens,
		outputTokens: usage?.output_tokens,
		nativeItems: output
	};
}
/** Handles split network chunks, CRLF, and multi-line SSE frames. */
export async function readEventStream(
	body: ReadableStream<Uint8Array>,
	receive: (event: Record<string, unknown>) => void
) {
	const reader = body.getReader();
	const decoder = new TextDecoder();
	let buffer = '';
	function process(final = false) {
		buffer = buffer.replace(/\r\n/g, '\n');
		const frames = buffer.split('\n\n');
		buffer = final ? '' : (frames.pop() ?? '');
		for (const frame of frames) {
			const payload = frame
				.split('\n')
				.filter((line) => line.startsWith('data:'))
				.map((line) => line.slice(5).trimStart())
				.join('\n');
			if (!payload || payload === '[DONE]') continue;
			receive(JSON.parse(payload));
		}
	}
	try {
		while (true) {
			const { value, done } = await reader.read();
			if (done) break;
			buffer += decoder.decode(value, { stream: true });
			process();
		}
		buffer += decoder.decode();
		if (buffer.trim()) {
			buffer += '\n\n';
			process(true);
		}
	} finally {
		reader.releaseLock();
	}
}
export async function generateOpenAI(
	key: string,
	model: string,
	options: GenerationOptions,
	local = false
): Promise<Completion> {
	const reasoning = /^(gpt-[56]|o[134])/.test(model);
	const request: Record<string, unknown> = {
		model,
		input: options.responseInput ?? responseInput(options.messages),
		store: false,
		max_output_tokens: reasoning
			? Math.max(2048, options.maxTokens ?? 384)
			: (options.maxTokens ?? 384),
		stream: true
	};
	if (!reasoning) request.temperature = options.temperature ?? 0.7;
	if (options.tools?.length) {
		request.tools = options.tools.map((tool) => ({ type: 'function', ...tool, strict: true }));
		request.parallel_tool_calls = false;
	}
	const response = await openAIRequest('responses', request, key, options.signal, local);
	if (!response.ok) {
		const data = await response.json().catch(() => ({}));
		const message = data?.error?.message;
		throw new Error(
			response.status === 401
				? 'OpenAI rejected this key. Check the key and its project access.'
				: response.status === 429
					? 'OpenAI rate limit or quota reached. Check your API billing or try again later.'
					: `OpenAI ${response.status}: ${typeof message === 'string' ? message : response.statusText}`
		);
	}
	if (!response.body) throw new Error('OpenAI returned an empty response stream.');
	let result: Completion | undefined;
	await readEventStream(response.body, (event) => {
		if (event.type === 'response.output_text.delta') options.onText?.(String(event.delta ?? ''));
		else if (event.type === 'response.completed')
			result = responseResult(event.response as Record<string, unknown>);
		else if (event.type === 'response.failed' || event.type === 'error') {
			const responseError = event.response as { error?: { message?: string } } | undefined;
			throw new Error(
				responseError?.error?.message ?? String(event.message ?? 'OpenAI generation failed.')
			);
		} else if (event.type === 'response.incomplete') {
			const partial = responseResult(event.response as Record<string, unknown>);
			if (partial.text) result = partial;
			else
				throw new Error(
					'The model reached its output limit before producing an answer. Try a shorter prompt or another model.'
				);
		}
	});
	if (!result)
		throw new Error('The connection ended before OpenAI completed the response. Please retry.');
	return result;
}
