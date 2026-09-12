/// <reference lib="webworker" />
import { init, defaultDevice } from '@jax-js/jax';
import { ConvJaxTrainer } from './convnet-jax';
import { CONV_TRAIN_COUNT, evaluateConv, unpackConvWeights, type ConvMetric } from './convnet';

export type ConvCommand =
	| {
			type: 'init';
			generation: number;
			trainX: Float32Array;
			trainY: Int32Array;
			testX: Float32Array;
			testY: Int32Array;
			weights: Float32Array;
			forceCpu?: boolean;
	  }
	| { type: 'reset'; generation: number; weights: Float32Array; reportMetrics?: boolean }
	| { type: 'train'; generation: number; steps: number }
	| { type: 'pause'; generation: number };
export type ConvSnapshot = {
	type: 'snapshot';
	generation: number;
	step: number;
	weights: Float32Array;
	train: ConvMetric;
	validation: ConvMetric;
	test: ConvMetric;
	running: boolean;
	device: string;
	milliseconds: number;
};
export type ConvReply =
	| ConvSnapshot
	| { type: 'status'; message: string; device?: string; generation: number }
	| { type: 'error'; message: string; generation: number };

let generation = 0,
	step = 0,
	running = false,
	target = 0,
	device = 'CPU',
	milliseconds = 0;
let trainer: ConvJaxTrainer | null = null;
let trainX: Float32Array = new Float32Array();
let trainY: Int32Array = new Int32Array();
let testX: Float32Array = new Float32Array();
let testY: Int32Array = new Int32Array();
let state = 73;
let timer: ReturnType<typeof setTimeout> | undefined;
let queue = Promise.resolve();
let devicesReady: Promise<void> | null = null;
const post = (message: ConvReply, transfer: Transferable[] = []) =>
	self.postMessage(message, { transfer });
const rand = () => {
	state = (Math.imul(1664525, state) + 1013904223) >>> 0;
	return state / 4294967296;
};

async function snapshot() {
	if (!trainer) return;
	const weights = await trainer.packed();
	const unpacked = unpackConvWeights(weights);
	post(
		{
			type: 'snapshot',
			generation,
			step,
			weights,
			train: evaluateConv(unpacked, trainX, trainY, 0, 160),
			validation: evaluateConv(
				unpacked,
				trainX,
				trainY,
				CONV_TRAIN_COUNT,
				trainY.length - CONV_TRAIN_COUNT
			),
			test: evaluateConv(unpacked, testX, testY, 0, testY.length),
			running,
			device,
			milliseconds
		},
		[weights.buffer]
	);
}
async function advance() {
	if (!running || !trainer) return;
	try {
		const batch = device === 'WebGPU' ? 32 : 16;
		const x = new Float32Array(batch * 784),
			y = new Float32Array(batch * 10);
		for (let n = 0; n < batch; n++) {
			const i = Math.floor(rand() * CONV_TRAIN_COUNT);
			x.set(trainX.subarray(i * 784, (i + 1) * 784), n * 784);
			y[n * 10 + trainY[i]] = 1;
		}
		const start = performance.now();
		const loss = await trainer.step(x, y);
		milliseconds = performance.now() - start;
		if (!Number.isFinite(loss))
			throw new Error(
				'The training update became non-finite. Restore the trained model and try again.'
			);
		step++;
		if (step >= target) running = false;
		if (step % 20 === 0 || !running) await snapshot();
		if (running)
			timer = setTimeout(() => {
				queue = queue.then(advance);
			}, 0);
	} catch (error) {
		running = false;
		post({
			type: 'error',
			generation,
			message: error instanceof Error ? error.message : 'The convolutional training update failed.'
		});
	}
}
async function handle(command: ConvCommand) {
	if (command.type === 'init' || command.type === 'reset') {
		running = false;
		clearTimeout(timer);
		generation = command.generation;
		step = 0;
		state = 73;
		if (command.type === 'init') {
			trainX = command.trainX;
			trainY = command.trainY;
			testX = command.testX;
			testY = command.testY;
			post({ type: 'status', message: 'Preparing the training engine…', generation });
			devicesReady ??= (async () => {
				const requested = command.forceCpu
					? (['wasm', 'cpu'] as const)
					: (['webgpu', 'wasm', 'cpu'] as const);
				const supported = await Promise.race([
					init(...requested),
					new Promise<null>((resolve) => setTimeout(() => resolve(null), 8000))
				]);
				const available = supported ?? (await init('wasm', 'cpu'));
				const selected =
					!command.forceCpu && available.includes('webgpu')
						? 'webgpu'
						: available.includes('wasm')
							? 'wasm'
							: 'cpu';
				defaultDevice(selected);
				device =
					selected === 'webgpu' ? 'WebGPU' : selected === 'wasm' ? 'CPU · WebAssembly' : 'CPU';
			})();
			await devicesReady;
		}
		trainer?.dispose();
		trainer = new ConvJaxTrainer(command.weights);
		post({ type: 'status', message: 'Ready to train', device, generation });
		if (command.type === 'reset' && command.reportMetrics) await snapshot();
	} else if (command.generation === generation) {
		if (command.type === 'pause') {
			running = false;
			clearTimeout(timer);
			await snapshot();
		}
		if (command.type === 'train' && !running) {
			running = true;
			target = step + Math.min(200, Math.max(1, command.steps));
			await advance();
		}
	}
}
self.onmessage = (event: MessageEvent<ConvCommand>) => {
	if (event.data.type === 'pause') running = false;
	queue = queue
		.then(() => handle(event.data))
		.catch((error) =>
			post({
				type: 'error',
				generation,
				message: error instanceof Error ? error.message : 'The convolutional model could not start.'
			})
		);
};
