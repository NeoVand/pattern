import { beforeEach, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import SelfSupervisedLab from '$lib/components/SelfSupervisedLab.svelte';
import { loadMnist } from './mnist-data';
import { MnistAutoencoder } from './autoencoder';
import '../../routes/layout.css';
import '../../routes/refinements.css';
import '../../routes/image-led.css';
import '../../routes/elegance.css';
import '../../routes/theme.css';

beforeEach(async () => {
	await page.viewport(1280, 1000);
	document.documentElement.dataset.theme = 'dark';
	document.body.style.padding = '24px';
});

test('real MNIST retains its official split and saved model reconstructs unseen pixels better than random weights', async () => {
	const data = await loadMnist();
	expect(data.trainX.length).toBe(8000 * 784);
	expect(data.testX.length).toBe(2000 * 784);
	expect([...data.trainY.slice(0, 10)]).toEqual([5, 0, 4, 1, 9, 2, 1, 3, 1, 4]);
	expect([...data.testY.slice(0, 10)]).toEqual([7, 2, 1, 0, 4, 1, 4, 9, 5, 9]);
	const model = new MnistAutoencoder();
	const unseen = Array.from({ length: 64 }, (_, i) => data.testX.subarray(i * 784, (i + 1) * 784));
	const initial = model.loss(unseen);
	model.load(new Float32Array(await (await fetch('/data/mnist-autoencoder.f32')).arrayBuffer()));
	expect(model.loss(unseen)).toBeLessThan(initial * 0.5);
	const original = model.pack();
	model.loss(unseen);
	expect(model.pack()).toEqual(original);
});

test('random-start worker training improves unseen error, pause holds the model, and reset restores its initial state', async () => {
	const screen = await render(SelfSupervisedLab);
	await expect.element(screen.getByTestId('mnist-test-loss')).toBeVisible();
	await expect
		.element(screen.getByRole('button', { name: 'Random weights', exact: true }))
		.toHaveAttribute('aria-pressed', 'true');
	await expect
		.element(screen.getByRole('button', { name: 'Start learning', exact: true }))
		.toBeEnabled();
	const score = () =>
		Number(document.querySelector('[data-testid="mnist-test-loss"]')!.textContent);
	const initial = score();
	expect(initial).toBeGreaterThan(0.09);
	await screen.getByRole('button', { name: 'Start learning', exact: true }).click();
	await expect.poll(score, { timeout: 20000 }).toBeLessThan(initial * 0.7);
	await expect
		.poll(
			() =>
				Number(
					document.querySelector('.ssl-status')?.textContent?.match(/(\d+) live updates/)?.[1] ?? 0
				),
			{ timeout: 60000 }
		)
		.toBeGreaterThan(200);
	await screen.getByRole('button', { name: 'Pause learning', exact: true }).click();
	await expect.element(screen.getByText(/Paused ·/)).toBeVisible();
	const held = score();
	await new Promise((resolve) => setTimeout(resolve, 150));
	expect(score()).toBe(held);
	await screen.getByRole('button', { name: 'Reset the autoencoder', exact: true }).click();
	await expect
		.element(screen.getByRole('button', { name: 'Start learning', exact: true }))
		.toBeEnabled();
	expect(score()).toBe(initial);
}, 70000);

test('probe and morph controls decode their displayed actual coordinates and remain beside the map on a phone', async () => {
	const screen = await render(SelfSupervisedLab);
	await expect.element(screen.getByTestId('mnist-test-loss')).toBeVisible();
	const slider = screen.getByRole('slider', { name: 'Latent coordinate 1' });
	const input = slider.element() as HTMLInputElement;
	input.value = '0.73';
	input.dispatchEvent(new Event('input', { bubbles: true }));
	await expect.element(screen.getByText(/^Near handwritten/)).toBeVisible();
	await expect.element(screen.getByTestId('mnist-code-0')).toHaveTextContent('0.730');
	const model = new MnistAutoencoder();
	const code: [number, number] = [
		0.73,
		Number(document.querySelector('[data-testid="mnist-code-1"]')!.textContent)
	];
	const canvas = document.querySelector(
		'.ssl-roundtrip>div:last-child canvas'
	) as HTMLCanvasElement;
	const raster = canvas.getContext('2d')!.getImageData(0, 0, 28, 28).data;
	const output = model.decode(code);
	for (const i of [200, 300, 400])
		expect(raster[i * 4 + 3] / 255).toBeCloseTo(Math.max(0, Math.min(1, output[i])), 2);
	await screen.getByRole('button', { name: 'Select second morph digit', exact: true }).click();
	await expect.element(screen.getByText('Between two digits', { exact: true })).toBeVisible();
	expect(
		(
			screen
				.getByRole('slider', { name: 'Interpolate between the two digit codes' })
				.element() as HTMLInputElement
		).value
	).toBe('1');
	await page.viewport(390, 844);
	document.body.style.padding = '16px';
	document.documentElement.dataset.theme = 'light';
	expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(390);
	await expect.element(screen.getByRole('slider', { name: 'Latent coordinate 1' })).toBeVisible();
});

test('JaxJS compiled variational update and held-out coordinates agree with the independent CPU equations', async () => {
	const { MnistJax } = await import('./mnist-jax');
	const data = await loadMnist();
	const backend = new MnistJax();
	await backend.initialize(undefined, 'wasm');
	const reference = new MnistAutoencoder();
	const batch = data.trainX.slice(0, 2 * 784),
		noise = new Float32Array([-0.4, 0.7, 0.2, -0.8]);
	const rows = [batch.subarray(0, 784), batch.subarray(784)];
	const objective = await backend.train(batch, noise, true);
	expect(objective).toBeCloseTo(
		reference.objective(rows, [
			[-0.4, 0.7],
			[0.2, -0.8]
		]),
		5
	);
	reference.train(rows, 0.003, [
		[-0.4, 0.7],
		[0.2, -0.8]
	]);
	const measured = await backend.snapshot(batch, data.testX.slice(0, 3 * 784));
	const expected = reference.pack();
	let maxDifference = 0;
	for (let i = 0; i < expected.length; i++)
		maxDifference = Math.max(maxDifference, Math.abs(expected[i] - measured.weights[i]));
	expect(maxDifference).toBeLessThan(0.00005);
	const testRows = Array.from({ length: 3 }, (_, i) => data.testX.subarray(i * 784, (i + 1) * 784));
	expect(measured.testLoss).toBeCloseTo(reference.loss(testRows), 5);
	for (let i = 0; i < 3; i++)
		for (let axis = 0; axis < 2; axis++)
			expect(measured.codes[i * 2 + axis]).toBeCloseTo(reference.encode(testRows[i])[axis], 4);
	backend.dispose();
}, 20000);
