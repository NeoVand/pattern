import { MnistJax } from './mnist-jax';
import { random } from './models';
export type MnistSnapshot = {
	type: 'snapshot';
	generation: number;
	step: number;
	running: boolean;
	trainLoss: number;
	testLoss: number;
	codes: Float32Array;
	weights: Float32Array;
	millisecondsPerStep: number;
	device: string;
	batchSize: number;
};
export type MnistCommand =
	| {
			type: 'init';
			generation: number;
			train: Float32Array;
			test: Float32Array;
			checkpoint?: Float32Array;
			backend?: 'wasm' | 'webgpu';
	  }
	| { type: 'reset'; generation: number; checkpoint?: Float32Array }
	| { type: 'start' | 'pause'; generation: number };
let model: MnistJax | undefined;
let train: Float32Array = new Float32Array(),
	test: Float32Array = new Float32Array();
let training = false,
	generation = 0,
	duration = 0,
	busy = false;
let pendingReset: Extract<MnistCommand, { type: 'reset' }> | undefined;
let rng = random(91);
const batchSize = 128,
	chunkSize = 8;
function gaussians() {
	const noise = new Float32Array(batchSize * 2);
	for (let i = 0; i < noise.length; i += 2) {
		const r = Math.sqrt(-2 * Math.log(Math.max(1e-7, rng()))),
			theta = 2 * Math.PI * rng();
		noise[i] = r * Math.cos(theta);
		noise[i + 1] = r * Math.sin(theta);
	}
	return noise;
}
async function snapshot() {
	if (!model) return;
	const inspection = await model.snapshot(train.subarray(0, 256 * 784), test);
	const result: MnistSnapshot = {
		type: 'snapshot',
		generation,
		step: model.step,
		running: training,
		...inspection,
		millisecondsPerStep: duration,
		device: model.device,
		batchSize
	};
	self.postMessage(result, { transfer: [result.codes.buffer, result.weights.buffer] });
}
function fail(error: unknown) {
	training = false;
	self.postMessage({
		type: 'error',
		generation,
		error: error instanceof Error ? error.message : String(error)
	});
}
async function run() {
	if (busy || !model) return;
	busy = true;
	try {
		while (training) {
			const start = performance.now();
			let completed = 0;
			for (let k = 0; k < chunkSize && training; k++) {
				const batch = new Float32Array(batchSize * 784);
				for (let b = 0; b < batchSize; b++) {
					const i = Math.floor(rng() * (train.length / 784));
					batch.set(train.subarray(i * 784, (i + 1) * 784), b * 784);
				}
				await model.train(batch, gaussians(), k === chunkSize - 1);
				completed++;
			}
			duration = (performance.now() - start) / Math.max(1, completed);
			// Show the early unfolding more frequently; keep full evaluation off the hot path.
			if (model.step % (model.step < 160 ? 8 : 40) === 0 || !training) await snapshot();
			await new Promise((resolve) => setTimeout(resolve, 0));
		}
		if (pendingReset) {
			const command = pendingReset;
			pendingReset = undefined;
			await reset(command);
		} else if (!training) await snapshot();
	} catch (error) {
		fail(error);
	} finally {
		busy = false;
	}
}
async function reset(command: Extract<MnistCommand, { type: 'reset' }>) {
	generation = command.generation;
	rng = random(91);
	model!.reset(command.checkpoint);
	duration = 0;
	await snapshot();
}
self.onmessage = async (event: MessageEvent<MnistCommand>) => {
	const command = event.data;
	try {
		if (command.type === 'init') {
			generation = command.generation;
			train = command.train;
			test = command.test;
			model = new MnistJax();
			try {
				await model.initialize(command.checkpoint, command.backend);
				await snapshot();
			} catch (cause) {
				if (command.backend) throw cause;
				// Unsupported/lost GPU devices must not strand an otherwise usable
				// browser. Rebuild the same model on compiled WebAssembly.
				try {
					model.dispose();
				} catch {
					/* a failed kernel may have consumed its leaves */
				}
				model = new MnistJax();
				await model.initialize(command.checkpoint, 'wasm');
				await snapshot();
			}
		} else if (command.type === 'reset') {
			training = false;
			if (busy) pendingReset = command;
			else await reset(command);
		} else if (command.generation === generation && model) {
			if (command.type === 'pause') {
				training = false;
				if (!busy) await snapshot();
			} else if (!training) {
				training = true;
				void run();
			}
		}
	} catch (error) {
		fail(error);
	}
};
