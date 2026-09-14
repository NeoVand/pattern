import { beforeEach, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import TrainingLab from '$lib/components/TrainingLab.svelte';
import { Network } from './models';
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

test('switching problems keeps the architecture and resets the experiment without replacing the explorer', async () => {
	const screen = await render(TrainingLab, { kind: 'neural-classifier' });
	const explorer = document.querySelector('.neural-observatory');
	await screen.getByRole('button', { name: '8', exact: true }).click();
	await screen.getByRole('button', { name: 'Start learning', exact: true }).click();
	await expect
		.poll(() => Number(screen.getByTestId('neural-epoch').element().textContent))
		.toBeGreaterThan(0);
	await screen.getByRole('button', { name: 'Spirals', exact: true }).click();
	await expect
		.element(screen.getByRole('button', { name: 'Spirals', exact: true }))
		.toHaveAttribute('aria-pressed', 'true');
	await expect.element(screen.getByText('P(amber class)', { exact: true })).toBeVisible();
	await expect.element(screen.getByText('Outer ring', { exact: true })).not.toBeInTheDocument();
	await expect.element(screen.getByTestId('neural-epoch')).toHaveTextContent('0');
	await expect
		.element(screen.getByRole('button', { name: 'Start learning', exact: true }))
		.toBeVisible();
	expect(document.querySelector('.neural-observatory')).toBe(explorer);
	expect(document.querySelectorAll('[data-neuron^="1-"]')).toHaveLength(8);
	expect(document.querySelectorAll('[data-sample-split="train"]')).toHaveLength(192);
	expect(document.querySelectorAll('[data-sample-split="validation"]')).toHaveLength(64);
	expect(document.querySelectorAll('[data-sample-split="test"]')).toHaveLength(64);
	const reference = new Network([2, 8, 8, 1], true, 49);
	await expect
		.element(screen.getByTestId('neuron-activation'))
		.toHaveTextContent(reference.activations([0.25, 0.2])[1][0].toFixed(4));
	const before = document.querySelector('[data-sample-split="train"]')!.outerHTML;
	await screen.getByRole('button', { name: 'Resample points', exact: true }).click();
	expect(document.querySelector('[data-sample-split="train"]')!.outerHTML).not.toBe(before);
	await page.viewport(390, 844);
	document.documentElement.dataset.theme = 'light';
	await screen.getByRole('button', { name: 'Checkerboard', exact: true }).click();
	await expect
		.element(screen.getByRole('button', { name: 'Checkerboard', exact: true }))
		.toHaveAttribute('aria-pressed', 'true');
	expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(390);
});

test('learning passes the old cutoff and pause / continue retains the trained weights', async () => {
	const screen = await render(TrainingLab, { kind: 'neural-classifier' });
	await screen.getByRole('button', { name: 'Start learning', exact: true }).click();
	const epochs = () =>
		Number(screen.getByTestId('neural-epoch').element().textContent?.replaceAll(',', ''));
	// Training speed depends on the CPU and frame scheduling of the CI browser.
	await expect.poll(epochs, { timeout: 60000 }).toBeGreaterThan(600);
	await screen.getByRole('button', { name: 'Pause learning', exact: true }).click();
	const paused = epochs();
	const activation = screen.getByTestId('neuron-activation').element().textContent;
	await new Promise((resolve) => setTimeout(resolve, 150));
	expect(epochs()).toBe(paused);
	expect(screen.getByTestId('neuron-activation').element().textContent).toBe(activation);
	await screen.getByRole('button', { name: 'Continue learning', exact: true }).click();
	await expect.poll(epochs).toBeGreaterThan(paused);
	await screen.getByRole('button', { name: 'Pause learning', exact: true }).click();
}, 75000);
