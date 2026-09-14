import type { ToolSpec } from './types';

/** Shared by the transports and the tool inspector so their definitions cannot diverge. */
export function functionTools(tools: ToolSpec[], provider: 'openai' | 'local') {
	return tools.map((tool) =>
		provider === 'openai'
			? { type: 'function', ...tool, strict: true }
			: { type: 'function', function: tool }
	);
}
