/** Types shared by the TinyStories workbench and its WebGPU worker. */

export interface ModelConfig {
	nLayer: number;
	nEmbd: number;
	nHead: number;
	blockSize: number;
	vocab: number;
}

export interface TrainStepMetrics {
	step: number;
	loss: number;
	/** Wall-clock ms for this step (jit-compile time excluded after step 0). */
	stepMs: number;
	tokensPerSec: number;
}

export interface SampleResult {
	/** Token ids of the completion (prompt excluded). */
	tokens: number[];
	text: string;
	/** Per-token data for the token-stream inspector. */
	perToken?: PerTokenInfo[];
}

/** Measured next-token alternatives for the current prompt. */
export interface PerTokenInfo {
	id: number;
	text: string;
	/** Negative log-likelihood under the current model, when computed. */
	loss?: number;
	/** Distribution entropy at this position, when computed. */
	entropy?: number;
	/** Top-k alternatives (id, probability), when computed. */
	topk?: Array<[number, number]>;
}
