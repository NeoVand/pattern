// Jaxverse's causal transformer, with asynchronous readback and fused Adam.
// Synchronous GPU readback uses an OffscreenCanvas; it fails on some browsers.
// Nothing here depends on a canvas. Weights AND optimizer moments survive train calls.
import {
	init,
	defaultDevice,
	numpy as np,
	nn,
	jit,
	valueAndGrad,
	tree,
	blockUntilReady
} from '@jax-js/jax';
import {
	initParams,
	lossFn,
	forwardLogprobs,
	forwardWithAttention,
	loadParams,
	disposeTree
} from './model';
import type { ModelConfig, TrainStepMetrics } from './engine';
/* eslint-disable @typescript-eslint/no-explicit-any */
type Request = { id: number; op: string; [key: string]: unknown };
let cfg: ModelConfig,
	params: any,
	first: any,
	second: any,
	update: any,
	forward: any,
	loss: any,
	attend: any,
	mask: any;
let data: Uint16Array,
	split = 0,
	step = 0,
	stop = false;
const BATCH = 8;
function randomStream(seed: number) {
	return () => {
		seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
		return seed / 4294967296;
	};
}
let trainingRandom = randomStream(42),
	samplingRandom = randomStream(71);
function batch(random: () => number, lo: number, hi: number) {
	const size = cfg.blockSize;
	const span = hi - lo - size;
	if (span <= 0) throw new Error('Each data split must contain a complete context and target.');
	const x = new Int32Array(BATCH * size),
		y = new Int32Array(x.length);
	for (let b = 0; b < BATCH; b++) {
		const start = lo + Math.floor(random() * span);
		for (let t = 0; t < size; t++) {
			x[b * size + t] = data[start + t];
			y[b * size + t] = data[start + t + 1];
		}
	}
	return [
		nn.oneHot(np.array(x).reshape([BATCH, size]), cfg.vocab),
		nn.oneHot(np.tile(np.arange(size).astype(np.int32), [BATCH, 1]), size),
		nn.oneHot(np.array(y).reshape([BATCH, size]), cfg.vocab)
	];
}
function sequence(tokens: number[]) {
	const size = cfg.blockSize,
		x = new Int32Array(size);
	x.set(tokens.slice(-size));
	return [
		nn.oneHot(np.array(x).reshape([1, size]), cfg.vocab),
		nn.oneHot(np.arange(size).astype(np.int32).reshape([1, size]), size)
	];
}
async function nextDistribution(tokens: number[]) {
	const [x, p] = sequence(tokens);
	const full = await forward(tree.ref(params), x, p).data();
	const pos = Math.min(tokens.length, cfg.blockSize) - 1;
	return (full as Float32Array).slice(pos * cfg.vocab, (pos + 1) * cfg.vocab);
}
function sampleToken(row: Float32Array, temp: number, k: number) {
	const ranked = Array.from(row, (value, id) => ({ value, id }))
		.sort((a, b) => b.value - a.value)
		.slice(0, k);
	const max = ranked[0].value;
	const probabilities = ranked.map((x) => Math.exp((x.value - max) / Math.max(0.05, temp)));
	let r = samplingRandom() * probabilities.reduce((a, b) => a + b, 0);
	for (let i = 0; i < ranked.length; i++) {
		r -= probabilities[i];
		if (r <= 0) return ranked[i].id;
	}
	return ranked.at(-1)!.id;
}
async function initialize(req: Request) {
	const devices = await init();
	if (!devices.includes('webgpu'))
		throw new Error(
			'WebGPU is unavailable. Use a browser with WebGPU enabled to train this transformer.'
		);
	defaultDevice('webgpu');
	cfg = req.config as ModelConfig;
	data = new Uint16Array(req.tokenData as ArrayBuffer);
	split = Number(req.splitAt);
	step = 0;
	trainingRandom = randomStream(Number(req.seed) || 42);
	samplingRandom = randomStream(71);
	params = req.checkpoint
		? loadParams(cfg, new Float32Array(req.checkpoint as ArrayBuffer))
		: initParams(cfg, Number(req.seed) || 42);
	await blockUntilReady(params);
	first = tree.map((p: any) => np.zerosLike(p), tree.ref(params));
	second = tree.map((p: any) => np.zerosLike(p), tree.ref(params));
	const c = cfg,
		lr = Number(req.lr) || 0.001;
	update = jit((p: any, m: any, v: any, x: any, pos: any, y: any, c1: any, c2: any) => {
		const [error, grads] = valueAndGrad((weights: any) => lossFn(weights, c, x, pos, y))(
			tree.ref(p)
		);
		const mu = tree.map((g: any, a: any) => g.mul(0.1).add(a.mul(0.9)), tree.ref(grads), m);
		const nu = tree.map((g: any, a: any) => np.square(g).mul(0.01).add(a.mul(0.99)), grads, v);
		const weights = tree.map(
			(w: any, a: any, b: any) =>
				w.sub(
					a
						.div(c1.ref)
						.mul(lr)
						.div(np.sqrt(b.div(c2.ref)).add(1e-8))
				),
			p,
			tree.ref(mu),
			tree.ref(nu)
		);
		c1.dispose();
		c2.dispose();
		return { params: weights, first: mu, second: nu, error };
	});
	forward = jit((p: any, x: any, pos: any) => forwardLogprobs(p, c, c.blockSize, x, pos));
	loss = jit((p: any, x: any, pos: any, y: any) => lossFn(p, c, x, pos, y));
	const values = new Float32Array(c.blockSize * c.blockSize);
	for (let i = 0; i < c.blockSize; i++)
		for (let j = i + 1; j < c.blockSize; j++) values[i * c.blockSize + j] = -1e9;
	mask = np.array(values).reshape([c.blockSize, c.blockSize]);
	attend = jit((p: any, x: any, pos: any, m: any) => forwardWithAttention(p, c, x, pos, m));
	// Reject a broken backend before displaying any fabricated-looking zero loss.
	const [x, pos, y] = batch(randomStream(999), split, data.length);
	const initial = Number((await loss(tree.ref(params), x, pos, y).data())[0]);
	if (!Number.isFinite(initial) || initial <= 0)
		throw new Error(
			'The GPU returned invalid model values. Please reload or try another WebGPU browser.'
		);
	return { loss: initial };
}
async function train(req: Request) {
	stop = false;
	for (let i = 0; i < Number(req.steps); i++) {
		if (stop) break;
		const t0 = performance.now();
		const [x, pos, y] = batch(trainingRandom, 0, split);
		const r = update(
			params,
			first,
			second,
			x,
			pos,
			y,
			np.array(1 - 0.9 ** (step + 1)),
			np.array(1 - 0.99 ** (step + 1))
		);
		params = r.params;
		first = r.first;
		second = r.second;
		const value = Number((await r.error.data())[0]);
		if (!Number.isFinite(value) || value <= 0)
			throw new Error('Training returned an invalid loss. Reset the model.');
		step++;
		const ms = performance.now() - t0;
		postMessage({
			id: req.id,
			event: 'metrics',
			m: {
				step,
				loss: value,
				stepMs: ms,
				tokensPerSec: Math.round((BATCH * cfg.blockSize * 1000) / ms)
			} satisfies TrainStepMetrics
		});
		await new Promise((resolve) => setTimeout(resolve, 0));
	}
	return { step };
}
async function validate() {
	const rng = randomStream(9999);
	let total = 0;
	for (let i = 0; i < 4; i++) {
		const [x, pos, y] = batch(rng, split, data.length);
		total += Number((await loss(tree.ref(params), x, pos, y).data())[0]);
	}
	return { valLoss: total / 4 };
}
async function sample(req: Request) {
	let tokens = (req.promptTokens as number[]).slice(-cfg.blockSize);
	if (!tokens.length) tokens = [1];
	const generated: number[] = [];
	for (let i = 0; i < Math.min(Number(req.maxTokens) || 120, 256); i++) {
		const row = await nextDistribution(tokens);
		const id = sampleToken(row, Number(req.temperature) || 0.8, Number(req.topK) || 20);
		generated.push(id);
		tokens = [...tokens, id].slice(-cfg.blockSize);
	}
	return { tokens: generated };
}
async function attention(req: Request) {
	const tokens = (req.tokens as number[]).slice(-cfg.blockSize);
	const [x, pos] = sequence(tokens);
	const [lp, layers] = attend(tree.ref(params), x, pos, mask.ref);
	lp.dispose();
	const buffers = [];
	for (const a of layers) buffers.push((await a.data()).buffer);
	return { seqLen: tokens.length, blockSize: cfg.blockSize, nHead: cfg.nHead, layers: buffers };
}
async function exportWeights() {
	const arrays = [];
	for (const leaf of tree.leaves(tree.ref(params)) as any[]) arrays.push(await leaf.data());
	const flat = new Float32Array(arrays.reduce((n, a) => n + a.length, 0));
	let offset = 0;
	for (const a of arrays) {
		flat.set(a, offset);
		offset += a.length;
	}
	return { checkpoint: flat.buffer };
}
const handlers: Record<string, (req: Request) => unknown> = {
	init: initialize,
	train,
	stop: () => {
		stop = true;
		return {};
	},
	sample,
	valloss: validate,
	attention,
	nextdist: async (r) => ({ row: (await nextDistribution(r.tokens as number[])).buffer }),
	export: exportWeights,
	dispose: () => {
		stop = true;
		for (const p of [params, first, second, mask]) if (p) disposeTree(p);
		return {};
	}
};
self.onmessage = async (e: MessageEvent<Request>) => {
	const req = e.data;
	try {
		if (!handlers[req.op]) throw new Error('Unknown transformer operation.');
		const result = await handlers[req.op](req);
		postMessage({ id: req.id, ok: true, result });
	} catch (e) {
		postMessage({ id: req.id, ok: false, error: e instanceof Error ? e.message : String(e) });
	}
};
