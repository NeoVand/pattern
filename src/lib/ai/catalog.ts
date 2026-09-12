export type ModelOption = { value: string; label: string; detail?: string };
const families = [
	['gpt-4.1-mini', 'GPT-4.1 mini', 'Fast, economical default'],
	['gpt-5.4-mini', 'GPT-5.4 mini', 'Compact reasoning model'],
	['gpt-5.6-luna', 'GPT-5.6 Luna', 'Fast everyday reasoning'],
	['gpt-5.6-terra', 'GPT-5.6 Terra', 'Balanced reasoning'],
	['gpt-5.6-sol', 'GPT-5.6 Sol', 'General-purpose reasoning'],
	['gpt-6-astra', 'GPT-6 Astra', 'Advanced reasoning'],
	['gpt-5.5', 'GPT-5.5', 'General-purpose reasoning'],
	['gpt-5.4', 'GPT-5.4', 'General-purpose reasoning'],
	['gpt-5.2', 'GPT-5.2', 'General-purpose reasoning'],
	['gpt-5.1', 'GPT-5.1', 'General-purpose reasoning'],
	['gpt-5-mini', 'GPT-5 mini', 'Compact reasoning model'],
	['gpt-5-nano', 'GPT-5 nano', 'Small reasoning model'],
	['gpt-5', 'GPT-5', 'General-purpose reasoning'],
	['gpt-4.1', 'GPT-4.1', 'Text, images, and tools'],
	['gpt-4.1-nano', 'GPT-4.1 nano', 'Small, fast model'],
	['gpt-4o', 'GPT-4o', 'Text, images, and tools'],
	['gpt-4o-mini', 'GPT-4o mini', 'Small, fast model']
];
const speech = [
	['gpt-audio-1.5', 'GPT Audio 1.5', 'Expressive speech generation'],
	['gpt-audio-mini', 'GPT Audio mini', 'Compact audio model'],
	['gpt-audio', 'GPT Audio', 'Audio generation'],
	['gpt-4o-mini-tts', 'GPT-4o mini TTS', 'Dedicated text-to-speech']
];
const imageModels = [
	['gpt-image-2.5-flare', 'GPT Image 2.5 · Flare', 'Image generation'],
	['gpt-image-2.5-sunburst', 'GPT Image 2.5 · Sunburst', 'Image generation'],
	['gpt-image-2', 'GPT Image 2', 'Image generation'],
	['gpt-image-1.5', 'GPT Image 1.5', 'Image generation'],
	['gpt-image-1-mini', 'GPT Image 1 mini', 'Compact image model']
];
/** The models endpoint lists access, not capabilities. Filter against supported families. */
export function compatibleModels(
	ids: string[],
	kind: 'language' | 'speech' | 'image'
): ModelOption[] {
	return (kind === 'speech' ? speech : kind === 'image' ? imageModels : families).flatMap(
		([id, label, detail]) => {
			const value = ids.includes(id)
				? id
				: ids
						.filter(
							(x) => x.startsWith(id + '-') && /^\d{4}-\d{2}-\d{2}$/.test(x.slice(id.length + 1))
						)
						.sort()
						.at(-1);
			return value ? [{ value, label, detail }] : [];
		}
	);
}
export async function listOpenAIModels(key: string, local: boolean) {
	const response = await fetch(local ? '/.pattern/ai/models' : 'https://api.openai.com/v1/models', {
		signal: AbortSignal.timeout(20_000),
		headers: local ? { 'X-Pattern-Client': '1' } : { Authorization: `Bearer ${key.trim()}` }
	});
	const data = await response.json();
	if (!response.ok) throw new Error(data.error?.message ?? 'Could not load available models.');
	return (data.data as { id: string }[]).map((x) => x.id);
}
