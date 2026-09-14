import type { Completion, GenerationOptions, ModelProgress, ToolCall } from './types';
export function parseLocalResult(text: string): Pick<Completion, 'text' | 'calls'> {
	const calls: ToolCall[] = [];
	const clean = text
		.replace(/<think>[\s\S]*?<\/think>/g, '')
		.replace(/<tool_call>([\s\S]*?)<\/tool_call>/g, (_, raw: string) => {
			const tool = JSON.parse(raw.trim());
			if (typeof tool.name !== 'string' || typeof tool.arguments !== 'object')
				throw new Error(
					'The local model returned a malformed tool request. Try a larger model or rephrase the task.'
				);
			calls.push({
				id: `local-${calls.length}-${Date.now()}`,
				name: tool.name,
				arguments: JSON.stringify(tool.arguments)
			});
			return '';
		})
		.trim();
	if (clean.includes('<tool_call>'))
		throw new Error(
			'The local model stopped before completing its tool request. Try a shorter task or a stronger model.'
		);
	return { text: clean, calls };
}
export class LocalModel {
	constructor(private kind: 'language' | 'vision' = 'language') {}
	private worker: Worker | null = null;
	private jobs = new Map<
		string,
		{
			resolve: (value: Completion) => void;
			reject: (error: Error) => void;
			onText?: (text: string) => void;
			onRequest?: GenerationOptions['onRequest'];
			onToken?: (id: number, text: string) => void;
			onProgress?: (progress: ModelProgress) => void;
			cleanup?: () => void;
		}
	>();
	private serial = 0;
	ready = false;
	private ensureWorker() {
		if (this.worker) return;
		this.worker =
			this.kind === 'vision'
				? new Worker(new URL('./vision.worker.ts', import.meta.url), { type: 'module' })
				: new Worker(new URL('./local.worker.ts', import.meta.url), { type: 'module' });
		this.worker.onmessage = (event) => {
			const m = event.data;
			const job = this.jobs.get(m.id);
			if (!job) return;
			if (m.type === 'progress') job.onProgress?.(m.progress);
			else if (m.type === 'request') job.onRequest?.(m.request);
			else if (m.type === 'text') job.onText?.(m.text);
			else if (m.type === 'token') job.onToken?.(m.tokenId, m.text);
			else if (m.type === 'ready' || m.type === 'done') {
				try {
					if (m.type === 'ready') this.ready = true;
					job.resolve(
						m.type === 'ready'
							? { text: '', calls: [] }
							: {
									...parseLocalResult(m.text),
									rawText: m.text,
									inputTokens: m.inputTokens,
									outputTokens: m.outputTokens
								}
					);
				} catch (e) {
					job.reject(e as Error);
				}
				job.cleanup?.();
				this.jobs.delete(m.id);
			} else if (m.type === 'error') {
				job.reject(new Error(m.message));
				job.cleanup?.();
				this.jobs.delete(m.id);
			}
		};
		this.worker.onerror = (event) =>
			this.dispose(new Error(event.message || 'The local model worker could not start.'));
	}
	load(model: string, onProgress: (progress: ModelProgress) => void) {
		this.ensureWorker();
		this.ready = false;
		return new Promise<void>((resolve, reject) => {
			const id = String(++this.serial);
			this.jobs.set(id, { resolve: () => resolve(), reject, onProgress });
			this.worker!.postMessage({ type: 'load', id, model });
		});
	}
	generate(options: GenerationOptions): Promise<Completion> {
		if (!this.ready)
			return Promise.reject(new Error('Load the local model in Model settings first.'));
		if (options.signal?.aborted) return Promise.reject(new DOMException('Stopped', 'AbortError'));
		return new Promise((resolve, reject) => {
			const id = String(++this.serial);
			const abort = () => {
				this.worker?.postMessage({ type: 'stop', id });
				this.jobs.delete(id);
				reject(new DOMException('Stopped', 'AbortError'));
			};
			this.jobs.set(id, {
				resolve,
				reject,
				onText: options.onText,
				onRequest: options.onRequest,
				onToken: options.onToken,
				cleanup: () => options.signal?.removeEventListener('abort', abort)
			});
			options.signal?.addEventListener('abort', abort, { once: true });
			this.worker!.postMessage({
				type: 'generate',
				id,
				messages: options.messages,
				tools: options.tools,
				temperature: options.temperature,
				maxTokens: options.maxTokens
			});
		});
	}
	dispose(reason = new Error('Model unloaded.')) {
		this.worker?.terminate();
		this.worker = null;
		this.ready = false;
		for (const job of this.jobs.values()) {
			job.cleanup?.();
			job.reject(reason);
		}
		this.jobs.clear();
	}
}
