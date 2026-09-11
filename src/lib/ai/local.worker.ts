/// <reference lib="webworker" />
import {
	pipeline,
	env,
	TextStreamer,
	InterruptableStoppingCriteria,
	type TextGenerationPipeline
} from '@huggingface/transformers';
import type { ChatMessage, ToolSpec } from './types';
env.allowLocalModels = false;
env.useBrowserCache = true;
let generator: TextGenerationPipeline | null = null;
let modelId = '';
const stopping = new InterruptableStoppingCriteria();
let chain = Promise.resolve();
type Message = {
	id: string;
	type: 'load' | 'generate' | 'stop';
	model?: string;
	messages?: ChatMessage[];
	tools?: ToolSpec[];
	temperature?: number;
	maxTokens?: number;
};
async function run(message: Message) {
	try {
		if (message.type === 'load') {
			if (!generator || modelId !== message.model) {
				if (generator) await generator.dispose();
				generator = (await pipeline('text-generation', message.model!, {
					device: 'webgpu',
					dtype: 'q4f16',
					progress_callback: (progress) =>
						postMessage({ type: 'progress', id: message.id, progress })
				})) as TextGenerationPipeline;
				modelId = message.model!;
			}
			postMessage({ type: 'ready', id: message.id });
			return;
		}
		if (!generator) throw new Error('Load a local model first.');
		stopping.reset();
		const chat = (message.messages ?? []).map((m) => ({
			role: m.role,
			content: m.content,
			...(m.tool_calls?.length
				? {
						tool_calls: m.tool_calls.map((t) => ({
							type: 'function',
							function: { name: t.name, arguments: JSON.parse(t.arguments) }
						}))
					}
				: {}),
			...(m.role === 'tool' ? { name: m.name } : {})
		}));
		const prompt = generator.tokenizer.apply_chat_template(
			chat as never,
			{
				tokenize: false,
				add_generation_prompt: true,
				enable_thinking: false,
				...(message.tools?.length
					? { tools: message.tools.map((t) => ({ type: 'function', function: t })) }
					: {})
			} as never
		) as unknown as string;
		const inputTokens = generator.tokenizer.encode(prompt).length;
		let outputTokens = 0;
		const streamer = new TextStreamer(generator.tokenizer, {
			skip_prompt: true,
			skip_special_tokens: true,
			callback_function: (text) => postMessage({ type: 'text', id: message.id, text }),
			token_callback_function: (ids) => {
				outputTokens += ids.length;
				for (const id of ids)
					postMessage({
						type: 'token',
						id: message.id,
						tokenId: Number(id),
						text: generator!.tokenizer.decode([id], { skip_special_tokens: true })
					});
			}
		});
		const output = (await generator(prompt, {
			max_new_tokens: message.maxTokens ?? 384,
			temperature: Math.max(0.01, message.temperature ?? 0.7),
			do_sample: (message.temperature ?? 0.7) > 0,
			return_full_text: false,
			streamer,
			stopping_criteria: [stopping]
		} as never)) as unknown as { generated_text: string }[];
		postMessage({
			type: 'done',
			id: message.id,
			text: output[0]?.generated_text ?? '',
			inputTokens,
			outputTokens
		});
	} catch (error) {
		postMessage({
			type: 'error',
			id: message.id,
			message: error instanceof Error ? error.message : String(error)
		});
	}
}
self.addEventListener('message', (event: MessageEvent<Message>) => {
	if (event.data.type === 'stop') {
		stopping.interrupt();
		return;
	}
	chain = chain.then(() => run(event.data));
});
