import { LocalModel } from './local';
import { generateOpenAI, embedOpenAI } from './openai';
import type { GenerationOptions, ModelProgress } from './types';
export class AiSession {
	provider = $state<'local' | 'openai'>('local');
	apiKey = $state('');
	devKeyAvailable = $state(false);
	useDevKey = $state(false);
	async discoverDevelopmentKey() {
		if (!['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)) return;
		try {
			const response = await fetch('/.pattern/ai/status', { headers: { 'X-Pattern-Client': '1' } });
			if (!response.ok || !response.headers.get('content-type')?.includes('application/json'))
				return;
			const status = await response.json();
			this.devKeyAvailable = status.available === true;
			if (this.devKeyAvailable && !this.apiKey && !this.loadedModel) {
				this.useDevKey = true;
				this.provider = 'openai';
				this.openaiModel = status.model;
			}
		} catch {
			/* Static deployments have no development connection. */
		}
	}
	async embed(input: string[], signal?: AbortSignal) {
		if (this.provider !== 'openai' || !this.ready) {
			this.settingsOpen = true;
			throw new Error(
				'Connect OpenAI to compute semantic embeddings. Keyword search works without a model.'
			);
		}
		if (this.busy) throw new Error('Wait for the current model request to finish.');
		this.busy = true;
		try {
			return await embedOpenAI(this.apiKey, input, signal, this.useDevKey && this.devKeyAvailable);
		} finally {
			this.busy = false;
		}
	}
	openaiModel = $state('gpt-4.1-mini');
	localModel = $state('onnx-community/Qwen3-0.6B-ONNX');
	loadedModel = $state('');
	settingsOpen = $state(false);
	loading = $state(false);
	busy = $state(false);
	error = $state('');
	progress = $state<ModelProgress>({});
	private local = new LocalModel();
	private vision = new LocalModel('vision');
	visionReady = $state(false);
	visionLoading = $state(false);
	visionProgress = $state<ModelProgress>({});
	visionError = $state('');
	private visionRevision = 0;
	async loadVision() {
		const revision = ++this.visionRevision;
		this.visionLoading = true;
		this.visionError = '';
		try {
			if (!('gpu' in navigator))
				throw new Error(
					'This browser does not support WebGPU. Use OpenAI or a current desktop Chrome or Edge.'
				);
			await this.vision.load('HuggingFaceTB/SmolVLM-256M-Instruct', (p) => {
				this.visionProgress = p;
			});
			if (revision === this.visionRevision) this.visionReady = true;
		} catch (error) {
			if (revision !== this.visionRevision) return;
			this.visionError = error instanceof Error ? error.message : String(error);
			this.vision.dispose();
		} finally {
			if (revision === this.visionRevision) this.visionLoading = false;
		}
	}
	unloadVision() {
		this.visionRevision++;
		this.vision.dispose();
		this.visionReady = false;
		this.visionLoading = false;
		this.visionError = '';
	}
	async caption(options: GenerationOptions) {
		if (this.busy) throw new Error('Another model request is running. Stop it first.');
		if (this.provider === 'openai' && !this.ready) {
			this.settingsOpen = true;
			throw new Error('Connect your OpenAI model first.');
		}
		if (this.provider === 'local' && !this.visionReady)
			throw new Error('Load the vision model first.');
		this.busy = true;
		try {
			return this.provider === 'openai'
				? await generateOpenAI(
						this.apiKey,
						this.openaiModel,
						options,
						this.useDevKey && this.devKeyAvailable
					)
				: await this.vision.generate(options);
		} finally {
			this.busy = false;
		}
	}
	private loadRevision = 0;
	get ready() {
		return this.provider === 'openai'
			? (!!this.apiKey.trim() || (this.useDevKey && this.devKeyAvailable)) &&
					!!this.openaiModel.trim()
			: this.loadedModel === this.localModel && this.local.ready;
	}
	get label() {
		return this.provider === 'openai'
			? this.openaiModel
			: this.localModel.includes('0.6B')
				? 'Qwen3 · 0.6B'
				: 'Qwen3 · 1.7B';
	}
	async loadLocal() {
		const revision = ++this.loadRevision;
		this.error = '';
		this.loading = true;
		this.progress = { status: 'Checking WebGPU' };
		try {
			if (!('gpu' in navigator))
				throw new Error(
					'WebGPU is unavailable in this browser. Try a current desktop Chrome or Edge, or use an OpenAI key.'
				);
			await this.local.load(this.localModel, (p) => (this.progress = p));
			if (revision === this.loadRevision) this.loadedModel = this.localModel;
		} catch (e) {
			if (revision !== this.loadRevision) return;
			this.error = e instanceof Error ? e.message : String(e);
			this.loadedModel = '';
			this.local.dispose();
		} finally {
			if (revision === this.loadRevision) this.loading = false;
		}
	}
	unload() {
		this.loadRevision++;
		this.error = '';
		this.local.dispose();
		this.loadedModel = '';
		this.loading = false;
	}
	async generate(options: GenerationOptions) {
		if (this.busy)
			throw new Error('Another model request is still running. Stop it before starting a new one.');
		if (!this.ready) {
			this.settingsOpen = true;
			throw new Error('Connect a model to run this experiment.');
		}
		this.busy = true;
		try {
			return this.provider === 'openai'
				? await generateOpenAI(
						this.apiKey,
						this.openaiModel,
						options,
						this.useDevKey && this.devKeyAvailable
					)
				: await this.local.generate(options);
		} finally {
			this.busy = false;
		}
	}
	dispose() {
		this.unloadVision();
		this.loadRevision++;
		this.local.dispose();
		this.apiKey = '';
	}
}
