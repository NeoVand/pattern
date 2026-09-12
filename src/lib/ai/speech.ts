import { openAIRequest } from './openai';
export type SpeechOptions = { text: string; voice: string; style: string; signal?: AbortSignal };
export async function generateSpeech(
	key: string,
	model: string,
	options: SpeechOptions,
	local: boolean
) {
	const { text, voice, style, signal } = options;
	if (!text.trim() || text.length > 600) throw new Error('Enter between 1 and 600 characters.');
	const tts = model.startsWith('gpt-4o-mini-tts');
	const response = await openAIRequest(
		tts ? 'audio/speech' : 'chat/completions',
		tts
			? {
					model,
					input: text,
					voice,
					instructions: style,
					response_format: 'wav'
				}
			: {
					model,
					modalities: ['text', 'audio'],
					audio: { voice, format: 'wav' },
					store: false,
					max_completion_tokens: 2048,
					messages: [
						{
							role: 'system',
							content: `Read the user's text aloud exactly, without introduction or extra words. Delivery: ${style}`
						},
						{ role: 'user', content: text }
					]
				},
		key,
		signal,
		local
	);
	if (!response.ok) {
		const data = await response.json().catch(() => ({}));
		throw new Error(data.error?.message ?? `Speech request failed (${response.status}).`);
	}
	if (tts) return { blob: await response.blob(), transcript: text };
	const data = await response.json();
	const audio = data.choices?.[0]?.message?.audio;
	if (!audio?.data) throw new Error('The model did not return audio. Please try again.');
	const bytes = Uint8Array.from(atob(audio.data), (c) => c.charCodeAt(0));
	return {
		blob: new Blob([bytes], { type: 'audio/wav' }),
		transcript: String(audio.transcript ?? text)
	};
}
