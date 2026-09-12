import { openAIRequest } from './openai';
export type ImageOptions = {
	prompt: string;
	quality: 'low' | 'medium' | 'high';
	size: '1024x1024' | '1536x1024' | '1024x1536';
	signal?: AbortSignal;
};
export async function generateImage(
	key: string,
	model: string,
	options: ImageOptions,
	local = false
) {
	if (!options.prompt.trim() || options.prompt.length > 4000)
		throw new Error('Write a prompt between 1 and 4,000 characters.');
	const response = await openAIRequest(
		'images/generations',
		{
			model,
			prompt: options.prompt.trim(),
			quality: options.quality,
			size: options.size,
			n: 1,
			output_format: 'png',
			background: 'opaque'
		},
		key,
		AbortSignal.any([...(options.signal ? [options.signal] : []), AbortSignal.timeout(240000)]),
		local
	);
	const data = await response.json();
	if (!response.ok)
		throw new Error(data.error?.message ?? `Image generation failed (${response.status}).`);
	const encoded = data.data?.[0]?.b64_json;
	if (typeof encoded !== 'string')
		throw new Error('The model did not return an image. Try a different prompt.');
	const bytes = Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0));
	return {
		blob: new Blob([bytes], { type: 'image/png' }),
		model,
		usage: data.usage as { input_tokens?: number; output_tokens?: number } | undefined
	};
}
