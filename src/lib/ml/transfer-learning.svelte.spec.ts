import { beforeEach, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import TransferLab from '$lib/components/TransferLab.svelte';
import { MnistAutoencoder } from './autoencoder';
import '../../routes/layout.css';
import '../../routes/refinements.css';
import '../../routes/image-led.css';
import '../../routes/elegance.css';
import '../../routes/theme.css';

beforeEach(async () => {
	await page.viewport(390, 844);
	document.documentElement.dataset.theme = 'light';
	document.body.style.padding = '16px';
});

test('transfer reports equal random weights honestly, exposes neighbors, and preserves the recorded budget', async () => {
	const labels = Int32Array.from([0, 0, 0, 1, 1, 1]);
	const pixels = Float32Array.from({ length: 6 * 784 }, (_, index) =>
		index % 784 === Math.floor(index / 784) ? 1 : 0
	);
	const screen = await render(TransferLab, {
		model: new MnistAutoencoder([784, 2, 784]),
		dataset: { trainX: pixels, trainY: labels, testX: pixels.slice(), testY: labels.slice() },
		revision: 2,
		encoderStep: 40,
		training: false,
		classLabels: ['Zero', 'One']
	});
	await screen
		.getByRole('button', { name: 'Freeze current encoder & compare', exact: true })
		.click();
	await expect
		.element(screen.getByRole('status', { name: 'Transfer result' }))
		.toHaveTextContent('0.0 percentage points different from');
	await expect
		.element(screen.getByText('Recorded encoder · revision 2 · live update 40', { exact: true }))
		.toBeVisible();
	await expect.element(screen.getByRole('img', { name: /Test image with label/ })).toBeVisible();
	await screen.getByRole('button', { name: 'Random encoder', exact: true }).click();
	await expect
		.element(screen.getByRole('button', { name: 'Random encoder', exact: true }))
		.toHaveAttribute('aria-pressed', 'true');
	await screen.getByRole('slider', { name: /Labels per class/ }).fill('10');
	await expect
		.element(screen.getByText(/Your label budget or sample seed has changed/))
		.toBeVisible();
	await screen.rerender({ revision: 3, classLabels: ['Changed class', 'Changed class'] });
	await expect.element(screen.getByText(/The encoder or dataset above has changed/)).toBeVisible();
	await expect
		.element(screen.getByRole('img', { name: /Test image with label (Zero|One)/ }))
		.toBeVisible();
	expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(390);
});
