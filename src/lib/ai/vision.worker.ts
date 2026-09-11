/// <reference lib="webworker" />
import {
	AutoProcessor,
	AutoModelForVision2Seq,
	TextStreamer,
	InterruptableStoppingCriteria,
	RawImage,
	env,
	type PreTrainedModel,
	type Processor,
	type Tensor
} from '@huggingface/transformers';
import type { ChatMessage } from './types';

env.allowLocalModels = false;
env.useBrowserCache = true;
let processor: Processor | null = null;
let model: PreTrainedModel | null = null;
const stopping = new InterruptableStoppingCriteria();
let chain = Promise.resolve();
type Message = {
	id: string;
	type: 'load' | 'generate' | 'stop';
	model?: string;
	messages?: ChatMessage[];
	maxTokens?: number;
};

async function run(message: Message) {
	try {
		if (message.type === 'load') {
			const progress_callback = (progress: unknown) =>
				postMessage({ type: 'progress', id: message.id, progress });
			processor ??= await AutoProcessor.from_pretrained(message.model!, { progress_callback });
			model ??= await AutoModelForVision2Seq.from_pretrained(message.model!, {
				dtype: 'fp32',
				device: 'webgpu',
				progress_callback
			});
			postMessage({ type: 'ready', id: message.id });
			return;
		}
		if (!model || !processor) throw new Error('Load the vision model first.');
		stopping.reset();
		const last = message.messages?.at(-1);
		if (!last?.images?.length) throw new Error('Choose an image to caption.');
		const images = await Promise.all(last.images.map((src) => RawImage.read(src)));
		const messages = [
			{
				role: 'user',
				content: [
					...last.images.map((image) => ({ type: 'image', image })),
					{ type: 'text', text: last.content }
				]
			}
		];
		const tokenizer = processor.tokenizer;
		if (!tokenizer) throw new Error('The vision model tokenizer could not be loaded.');
		const prompt = processor.apply_chat_template(messages, { add_generation_prompt: true });
		const inputs = await processor(prompt, images, { do_image_splitting: false });
		const inputTokens = inputs.input_ids.dims.at(-1)!;
		let outputTokens = 0;
		const streamer = new TextStreamer(tokenizer, {
			skip_prompt: true,
			skip_special_tokens: true,
			callback_function: (text) => postMessage({ type: 'text', id: message.id, text }),
			token_callback_function: (ids) => {
				outputTokens += ids.length;
			}
		});
		const output = (await model.generate({
			...inputs,
			max_new_tokens: message.maxTokens ?? 100,
			do_sample: false,
			repetition_penalty: 1.1,
			streamer,
			stopping_criteria: [stopping]
		})) as Tensor;
		const text = tokenizer
			.decode(Array.from(output.data as BigInt64Array).slice(inputTokens), {
				skip_special_tokens: true
			})
			.trim();
		postMessage({ type: 'done', id: message.id, text, inputTokens, outputTokens });
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
