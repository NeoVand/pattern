// A small RPC seam: UI stays responsive; the worker owns weights and Adam state.
import type { ModelConfig, TrainStepMetrics, SampleResult } from './engine';
export interface WorkerEngineOptions {
	tokenData: Uint16Array;
	splitAt?: number;
	seed?: number;
	lr?: number;
	decode: (ids: number[]) => string;
	decodeOne: (id: number) => string;
}
type Pending = {
	resolve: (value: unknown) => void;
	reject: (error: Error) => void;
	onMetrics?: (metric: TrainStepMetrics) => void;
};
export class WorkerEngine {
	private worker: Worker;
	private pending = new Map<number, Pending>();
	private nextId = 1;
	constructor(private opts: WorkerEngineOptions) {
		this.worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
		this.worker.onmessage = (e) => {
			const m = e.data,
				p = this.pending.get(m.id);
			if (!p) return;
			if (m.event === 'metrics') {
				p.onMetrics?.(m.m);
				return;
			}
			this.pending.delete(m.id);
			if (m.ok) p.resolve(m.result);
			else p.reject(new Error(m.error));
		};
		this.worker.onerror = (e) => {
			for (const p of this.pending.values())
				p.reject(new Error(e.message || 'Transformer worker failed.'));
			this.pending.clear();
		};
	}
	private call<T>(
		op: string,
		payload: Record<string, unknown> = {},
		transfer: Transferable[] = [],
		onMetrics?: (m: TrainStepMetrics) => void
	): Promise<T> {
		const id = this.nextId++;
		return new Promise((resolve, reject) => {
			this.pending.set(id, { resolve: resolve as (v: unknown) => void, reject, onMetrics });
			this.worker.postMessage({ id, op, ...payload }, transfer);
		});
	}
	async init(config: ModelConfig, checkpoint?: ArrayBuffer) {
		const copy = this.opts.tokenData.slice();
		await this.call(
			'init',
			{
				config,
				tokenData: copy.buffer,
				splitAt: this.opts.splitAt ?? Math.floor(copy.length * 0.95),
				seed: this.opts.seed ?? 42,
				lr: this.opts.lr ?? 0.001,
				checkpoint
			},
			checkpoint ? [copy.buffer, checkpoint] : [copy.buffer]
		);
	}
	async train(steps: number, onMetrics: (m: TrainStepMetrics) => void) {
		await this.call('train', { steps }, [], onMetrics);
	}
	async stop() {
		await this.call('stop');
	}
	async sample(
		promptTokens: number[],
		opts?: { temperature?: number; topK?: number; maxTokens?: number }
	): Promise<SampleResult> {
		const r = await this.call<{ tokens: number[] }>('sample', {
			promptTokens: [...promptTokens],
			...opts
		});
		return { ...r, text: this.opts.decode(r.tokens) };
	}
	async nextDistribution(tokens: number[]) {
		const r = await this.call<{ row: ArrayBuffer }>('nextdist', { tokens: [...tokens] });
		return new Float32Array(r.row);
	}
	async attention(tokens: number[]) {
		const r = await this.call<{
			seqLen: number;
			nHead: number;
			blockSize: number;
			layers: ArrayBuffer[];
		}>('attention', { tokens: [...tokens] });
		return { ...r, layers: r.layers.map((b) => new Float32Array(b)) };
	}
	async valLoss() {
		return (await this.call<{ valLoss: number }>('valloss')).valLoss;
	}
	async exportCheckpoint() {
		return (await this.call<{ checkpoint: ArrayBuffer }>('export')).checkpoint;
	}
	async dispose() {
		try {
			await Promise.race([this.call('dispose'), new Promise((r) => setTimeout(r, 400))]);
		} finally {
			this.worker.terminate();
			for (const p of this.pending.values()) p.reject(new Error('The transformer was closed.'));
			this.pending.clear();
		}
	}
}
