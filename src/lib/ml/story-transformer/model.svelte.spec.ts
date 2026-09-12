import { beforeAll, expect, test } from 'vitest';
import { init, defaultDevice, jit, nn, numpy as np, tree } from '@jax-js/jax';
import { forwardLogprobs, forwardWithAttention, initParams } from './model';
import { storyConfig } from './corpus';

beforeAll(async () => {
	await init('wasm');
	defaultDevice('wasm');
});

test('the displayed attention is causal and gives the same prediction as the training forward pass', async () => {
	const cfg = { ...storyConfig, blockSize: 8 };
	const params = initParams(cfg, 42);
	const tokens = nn.oneHot(np.array([1, 2, 3, 4, 5, 6, 7, 8], { dtype: np.int32 }), cfg.vocab);
	const positions = nn.oneHot(np.arange(8), 8);
	const prediction = jit((p, t, pos) => forwardLogprobs(p, cfg, 8, t, pos))(
		tree.ref(params),
		tokens.ref,
		positions.ref
	);
	const mask = np.array(
		Array.from({ length: 8 }, (_, row) =>
			Array.from({ length: 8 }, (_, col) => (col > row ? -1e9 : 0))
		)
	);
	const [inspected, attention] = jit((p, t, pos, causal) =>
		forwardWithAttention(p, cfg, t, pos, causal)
	)(params, tokens, positions, mask);
	const expected = await prediction.data();
	const actual: Float32Array = await inspected.data();
	expect(Math.max(...actual.map((v, i) => Math.abs(v - expected[i])))).toBeLessThan(0.0001);
	for (const layer of attention) {
		const values: Float32Array = await layer.data();
		for (let head = 0; head < cfg.nHead; head++)
			for (let row = 0; row < 8; row++) {
				const weights = values.slice((head * 8 + row) * 8, (head * 8 + row + 1) * 8);
				expect(weights.reduce((sum, v) => sum + v, 0)).toBeCloseTo(1, 5);
				expect(weights.slice(row + 1).every((v) => v === 0)).toBe(true);
			}
	}
});
