import { expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import FeatureHierarchy from '$lib/components/FeatureHierarchy.svelte';
import { loadConvFashion } from './convnet-data';
import { inspectConvNeuron } from './conv-neuron';
import { CONV_SHAPES, convReceptiveField, traceConv, unpackConvWeights } from './convnet';
import { flattenFeaturePatch, featurePatch, type FeatureAtlas } from './feature-hierarchy';
import '../../routes/layout.css';
import '../../routes/refinements.css';
import '../../routes/image-led.css';
import '../../routes/elegance.css';
import '../../routes/theme.css';

async function fixture() {
	const [data, packed, atlas] = await Promise.all([
		loadConvFashion(),
		fetch('/data/fashion-convnet.f32').then((r) => r.arrayBuffer()),
		fetch('/data/fashion-feature-atlas.json').then((r) => r.json()) as Promise<FeatureAtlas>
	]);
	return { data, weights: unpackConvWeights(new Float32Array(packed)), atlas };
}

test('all 288 feature examples match the saved model at their actual, unpadded input locations', async () => {
	const { data, weights, atlas } = await fixture();
	for (const [layer, stage] of atlas.layers.entries())
		for (const definition of stage.channels) {
			const examples = atlas.layers[layer].channels[definition.channel].examples;
			expect(new Set(examples.map((e) => e.index)).size).toBe(6);
			for (const ex of examples) {
				expect(ex.index).toBeLessThan(2000);
				expect(ex.label).toBe(data.trainY[ex.index]);
				const pixels = data.trainX.subarray(ex.index * 784, (ex.index + 1) * 784);
				const side = CONV_SHAPES[layer].side,
					field = convReceptiveField(layer, ex.x, ex.y);
				expect(field.left).toBeGreaterThanOrEqual(0);
				expect(field.top).toBeGreaterThanOrEqual(0);
				expect(field.right).toBeLessThanOrEqual(28);
				expect(field.bottom).toBeLessThanOrEqual(28);
				const score = traceConv(weights, pixels).maps[layer][
					definition.channel * side * side + ex.y * side + ex.x
				];
				expect(score).toBeCloseTo(ex.score, 4);
			}
		}
});

test('smoothing changes only the receptive field, retains its mean, and reduces a learned edge response', async () => {
	const { data, weights, atlas } = await fixture();
	const ex = atlas.layers[0].channels[3].examples[0];
	const pixels = data.trainX.slice(ex.index * 784, (ex.index + 1) * 784),
		saved = pixels.slice();
	const flat = flattenFeaturePatch(pixels, 0, ex.x, ex.y, 1),
		field = convReceptiveField(0, ex.x, ex.y);
	const patch = featurePatch(pixels, 0, ex.x, ex.y),
		mean = patch.reduce((a, b) => a + b, 0) / patch.length;
	for (let y = 0; y < 28; y++)
		for (let x = 0; x < 28; x++) {
			if (x >= field.left && x < field.right && y >= field.top && y < field.bottom)
				expect(flat[y * 28 + x]).toBeCloseTo(mean, 6);
			else expect(flat[y * 28 + x]).toBe(pixels[y * 28 + x]);
		}
	expect(pixels).toEqual(saved);
	const actual = traceConv(weights, flat).maps[0][3 * 196 + ex.y * 14 + ex.x];
	const uniformResponse = Math.max(
		0,
		mean * weights.kernels[0].subarray(27, 36).reduce((sum, weight) => sum + weight, 0) +
			weights.biases[0][3]
	);
	expect(actual).toBeCloseTo(uniformResponse, 5);
	expect(actual).toBeLessThan(ex.score);
});

test('the interpretation tour selects real features, resets its probe, and supports both themes on a phone', async () => {
	await page.viewport(1440, 1100);
	const { data, weights, atlas } = await fixture();
	const screen = await render(FeatureHierarchy, {
		data,
		weights,
		checkpointHash: atlas.checkpointSha256
	});
	await expect
		.element(screen.getByRole('button', { name: 'Explore layer 3: Parts' }))
		.toBeVisible();
	await screen.getByRole('button', { name: 'Explore layer 3: Parts' }).click();
	await screen.getByRole('button', { name: 'Separated trouser legs', exact: true }).click();
	await expect.element(screen.getByTestId('feature-evidence')).toHaveAttribute('data-channel', '8');
	const input = screen
		.getByRole('slider', { name: 'Smooth away the selected feature' })
		.element() as HTMLInputElement;
	const before = Number(screen.getByTestId('feature-response').element().textContent);
	input.value = '100';
	input.dispatchEvent(new Event('input', { bubbles: true }));
	await expect
		.poll(() => Number(screen.getByTestId('feature-response').element().textContent))
		.not.toBe(before);
	await screen.getByRole('button', { name: 'Explore layer 1: Edges' }).click();
	expect(input.value).toBe('0');
	await page.viewport(390, 844);
	for (const theme of ['light', 'dark']) {
		document.documentElement.dataset.theme = theme;
		expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(390);
		await expect
			.element(screen.getByRole('slider', { name: 'Smooth away the selected feature' }))
			.toBeVisible();
	}
});

test('the neuron view includes every input map, padding, bias, and ReLU in its exact calculation', async () => {
	const { data, weights } = await fixture();
	const pixels = data.testX.subarray(0, 784),
		trace = traceConv(weights, pixels);
	for (let layer = 0; layer < 3; layer++) {
		const shape = CONV_SHAPES[layer];
		for (const channel of [0, Math.floor(shape.output / 2), shape.output - 1])
			for (const [x, y] of [
				[0, 0],
				[shape.side - 1, shape.side - 1],
				[1, 1]
			]) {
				const unit = inspectConvNeuron(weights, trace, pixels, layer, channel, x, y);
				expect(unit.sources).toHaveLength(shape.input);
				const sum = unit.sources.reduce((value, source) => value + source.contribution, unit.bias);
				expect(unit.total).toBeCloseTo(sum, 9);
				expect(unit.response).toBeCloseTo(
					trace.maps[layer][channel * shape.side ** 2 + y * shape.side + x],
					5
				);
				if (x === 0 && y === 0)
					for (const source of unit.sources)
						expect([...source.values.slice(0, 3)]).toEqual([0, 0, 0]);
			}
	}
});

test('the selected test image stays fixed across filters, views, and separate evidence probes', async () => {
	await page.viewport(1440, 1100);
	const { data, weights, atlas } = await fixture();
	const screen = await render(FeatureHierarchy, {
		data,
		weights,
		checkpointHash: atlas.checkpointSha256
	});
	await expect
		.element(
			screen.getByRole('button', { name: 'Network layer 3, feature 24, 16 neurons', exact: true })
		)
		.toBeVisible();
	expect(document.querySelectorAll('.network-map')).toHaveLength(48);
	expect(document.querySelectorAll('.output-neuron')).toHaveLength(10);
	await screen
		.getByRole('button', { name: 'Network layer 3, feature 24, 16 neurons', exact: true })
		.click();
	await expect
		.element(screen.getByTestId('feature-evidence'))
		.toHaveAttribute('data-channel', '23');
	await screen
		.getByRole('button', { name: 'Network layer 3, feature 9, 16 neurons', exact: true })
		.click();
	await expect
		.element(screen.getByRole('button', { name: 'Separated trouser legs', exact: true }))
		.toHaveAttribute('aria-pressed', 'true');
	await screen.getByRole('button', { name: 'Inside one neuron', exact: true }).click();
	const response = Number(screen.getByTestId('network-neuron-response').element().textContent);
	await screen.getByRole('button', { name: 'Next neuron input map', exact: true }).click();
	expect(Number(screen.getByTestId('network-neuron-response').element().textContent)).toBe(
		response
	);
	const originalTrace = traceConv(weights, data.testX.subarray(0, 784));
	const nodes = [...document.querySelectorAll<HTMLElement>('[data-testid="network-output"]')];
	for (let label = 0; label < 10; label++)
		expect(Number(nodes[label].dataset.score)).toBe(originalTrace.logits[label]);
	const input = screen
		.getByRole('slider', { name: 'Smooth away the selected feature' })
		.element() as HTMLInputElement;
	input.value = '100';
	input.dispatchEvent(new Event('input', { bubbles: true }));

	await expect
		.poll(() => Number(screen.getByTestId('network-neuron-response').element().textContent))
		.toBe(response);
	expect(Number(nodes[0].dataset.score)).toBe(originalTrace.logits[0]);
	await screen.getByRole('button', { name: 'Learned kernels', exact: true }).click();
	expect(document.querySelectorAll('.network-map .kernel-slice')).toHaveLength(
		8 + 16 * 8 + 24 * 16
	);
	await screen.getByRole('button', { name: 'Strongest inputs', exact: true }).click();
	expect(Number(nodes[0].dataset.score)).toBe(originalTrace.logits[0]);
	await screen.getByRole('button', { name: 'Choose an image', exact: true }).click();
	await screen.getByRole('button', { name: 'Trouser', exact: true }).click();
	const index = data.testY.findIndex((v) => v === 1),
		next = traceConv(weights, data.testX.subarray(index * 784, (index + 1) * 784));
	await expect.poll(() => Number(nodes[0].dataset.score)).toBe(next.logits[0]);
});
