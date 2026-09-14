export type ToolCall = { id: string; name: string; arguments: string };
export type ChatMessage = {
	role: 'system' | 'user' | 'assistant' | 'tool';
	content: string;
	/** Actual image data URLs, never image descriptions substituted for pixels. */
	images?: string[];
	tool_calls?: ToolCall[];
	tool_call_id?: string;
	name?: string;
};
export type ToolSpec = { name: string; description: string; parameters: Record<string, unknown> };
export type Completion = {
	text: string;
	/** Unparsed text emitted by a local model, including tool-call markup. */
	rawText?: string;
	calls: ToolCall[];
	inputTokens?: number;
	outputTokens?: number;
	nativeItems?: Record<string, unknown>[];
};
export type GenerationOptions = {
	messages: ChatMessage[];
	temperature?: number;
	maxTokens?: number;
	tools?: ToolSpec[];
	responseInput?: Record<string, unknown>[];
	onText?: (text: string) => void;
	/** The actual request body or local prompt; never includes authentication headers. */
	onRequest?: (request: Record<string, unknown>) => void;
	onToken?: (id: number, text: string) => void;
	signal?: AbortSignal;
};
export type ModelProgress = { status?: string; progress?: number; file?: string };
