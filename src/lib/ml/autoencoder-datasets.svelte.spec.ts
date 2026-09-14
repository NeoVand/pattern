import { beforeEach, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import SelfSupervisedLab from '$lib/components/SelfSupervisedLab.svelte';
import { autoencoderDatasets, type AutoencoderData } from './autoencoder-datasets';
import { MnistAutoencoder } from './autoencoder';
import '../../routes/layout.css';
import '../../routes/refinements.css';
import '../../routes/image-led.css';
import '../../routes/elegance.css';
import '../../routes/theme.css';

beforeEach(async () => {
	await page.viewport(1280, 1100);
	document.documentElement.dataset.theme = 'dark';
	document.body.style.padding = '24px';
});

test('Fashion-MNIST keeps all ten classes and its official split, with its own learned checkpoint', async () => {
	const data = await autoencoderDatasets.fashion.load();
	expect(data.trainX.length).toBe(12000 * 784);
	expect(data.testX.length).toBe(2000 * 784);
	expect([...data.trainY.slice(0, 10)]).toEqual([9, 0, 0, 3, 0, 2, 7, 2, 5, 5]);
	expect([...data.testY.slice(0, 10)]).toEqual([9, 2, 1, 1, 6, 1, 4, 6, 5, 7]);
	expect(new Set(data.trainY).size).toBe(10);
	expect(new Set(data.testY).size).toBe(10);
	const model = new MnistAutoencoder();
	const unseen = Array.from({ length: 64 }, (_, i) => data.testX.subarray(i * 784, (i + 1) * 784));
	const initial = model.loss(unseen);
	const saved = new Float32Array(
		await (await fetch('/data/fashion-autoencoder.f32')).arrayBuffer()
	);
	model.load(saved);
	expect(model.loss(unseen)).toBeLessThan(initial * 0.5);
	expect(model.pack()).toEqual(saved);
	const digits = new Float32Array(await (await fetch('/data/mnist-autoencoder.f32')).arrayBuffer());
	expect(saved.some((value, index) => value !== digits[index])).toBe(true);
});

test('Fashion-MNIST trains, reconstructs real clothing, and switching while learning creates a fresh digit model', async () => {
	const screen = await render(SelfSupervisedLab);
	await expect.element(screen.getByTestId('mnist-test-loss')).toBeVisible();
	const score = () => Number(screen.getByTestId('mnist-test-loss').element().textContent);
	const originalMnistLoss = score();
	const originalWorkbench = screen
		.getByRole('region', { name: 'MNIST autoencoder workbench' })
		.element();
	await screen.getByRole('button', { name: 'Fashion-MNIST', exact: true }).click();
	await expect
		.element(screen.getByRole('region', { name: 'Fashion-MNIST autoencoder workbench' }))
		.toBeVisible();
	await expect.element(screen.getByTestId('mnist-test-loss')).toBeVisible();
	await expect
		.element(screen.getByRole('button', { name: 'Start learning', exact: true }))
		.toBeEnabled();
	await expect
		.element(screen.getByRole('button', { name: 'Random weights', exact: true }))
		.toHaveAttribute('aria-pressed', 'true');
	expect(document.contains(originalWorkbench)).toBe(false);
	const initialFashionLoss = score();
	expect(initialFashionLoss).not.toBe(originalMnistLoss);
	const data = await autoencoderDatasets.fashion.load();
	const selected = data.testY.findIndex((label) => label === 7);
	const raster = (document.querySelector('.ssl-roundtrip canvas') as HTMLCanvasElement)
		.getContext('2d')!
		.getImageData(0, 0, 28, 28).data;
	for (let pixel = 0; pixel < 784; pixel++)
		expect(raster[pixel * 4 + 3]).toBe(Math.round(data.testX[selected * 784 + pixel] * 255));
	await expect.element(screen.getByText('Sneaker', { exact: true }).first()).toBeVisible();
	await screen.getByRole('button', { name: 'Highlight Ankle boot', exact: true }).click();
	await expect
		.element(screen.getByRole('button', { name: 'Highlight Ankle boot', exact: true }))
		.toHaveAttribute('aria-pressed', 'true');
	await screen.getByRole('button', { name: 'Start learning', exact: true }).click();
	await expect.poll(score, { timeout: 60000 }).toBeLessThan(initialFashionLoss * 0.7);
	await screen.getByRole('button', { name: 'Pause learning', exact: true }).click();
	await expect.element(screen.getByText(/Paused ·/)).toBeVisible();
	const pausedLoss = score();
	await new Promise((resolve) => setTimeout(resolve, 150));
	expect(score()).toBe(pausedLoss);
	await screen.getByRole('button', { name: 'Reset the autoencoder', exact: true }).click();
	await expect
		.element(screen.getByRole('button', { name: 'Start learning', exact: true }))
		.toBeEnabled();
	expect(score()).toBe(initialFashionLoss);
	await screen.getByRole('button', { name: 'Saved example', exact: true }).click();
	await expect.element(screen.getByText('Saved weights · 0 live updates')).toBeVisible();
	expect(score()).toBeCloseTo(0.0319107518, 4);
	await screen.getByRole('button', { name: 'Select second morph item', exact: true }).click();
	await expect.element(screen.getByText('Between two items', { exact: true })).toBeVisible();
	await expect
		.element(screen.getByRole('slider', { name: 'Interpolate between the two item codes' }))
		.toHaveValue('1');
	await screen.getByRole('button', { name: 'Keep learning', exact: true }).click();
	await screen.getByRole('button', { name: 'MNIST', exact: true }).click();
	await expect
		.element(screen.getByRole('region', { name: 'MNIST autoencoder workbench' }))
		.toBeVisible();
	await expect.element(screen.getByTestId('mnist-test-loss')).toBeVisible();
	await expect.element(screen.getByText('Random weights · 0 live updates')).toBeVisible();
	expect(score()).toBe(originalMnistLoss);
	await expect
		.element(screen.getByRole('button', { name: 'Highlight digit 9', exact: true }))
		.toHaveAttribute('aria-pressed', 'false');
	await expect
		.element(screen.getByRole('button', { name: 'Highlight Ankle boot', exact: true }))
		.not.toBeInTheDocument();

	await screen.getByRole('button', { name: 'Fashion-MNIST', exact: true }).click();
	await expect.element(screen.getByTestId('mnist-test-loss')).toBeVisible();
	expect(score()).toBe(initialFashionLoss);
	await page.viewport(390, 844);
	document.body.style.padding = '16px';
	for (const theme of ['light', 'dark']) {
		document.documentElement.dataset.theme = theme;
		expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(390);
		await expect
			.element(screen.getByRole('button', { name: 'Fashion-MNIST', exact: true }))
			.toBeVisible();
	}
}, 90000);

test('a pending clothing load cannot replace the dataset selected afterward', async () => {
	const data = await autoencoderDatasets.fashion.load();
	let resolve!: (data: AutoencoderData) => void;
	const pending = new Promise<AutoencoderData>((done) => {
		resolve = done;
	});
	const load = vi.spyOn(autoencoderDatasets.fashion, 'load').mockReturnValueOnce(pending);
	const terminate = vi.spyOn(Worker.prototype, 'terminate');
	try {
		const screen = await render(SelfSupervisedLab);
		await expect.element(screen.getByTestId('mnist-test-loss')).toBeVisible();
		await screen.getByRole('button', { name: 'Fashion-MNIST', exact: true }).click();
		await expect
			.element(screen.getByText('Preparing Fashion-MNIST and the training backend…'))
			.toBeVisible();
		expect(terminate).toHaveBeenCalled();
		await screen.getByRole('button', { name: 'MNIST', exact: true }).click();
		resolve(data);
		await expect
			.element(screen.getByRole('region', { name: 'MNIST autoencoder workbench' }))
			.toBeVisible();
		await expect.element(screen.getByTestId('mnist-test-loss')).toBeVisible();
		await expect
			.element(screen.getByRole('region', { name: 'Fashion-MNIST autoencoder workbench' }))
			.not.toBeInTheDocument();
		await expect.element(screen.getByText('Random weights · 0 live updates')).toBeVisible();
	} finally {
		load.mockRestore();
		terminate.mockRestore();
	}
}, 30000);
