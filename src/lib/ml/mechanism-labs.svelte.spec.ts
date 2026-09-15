import { beforeEach, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import GradientLab from '$lib/components/GradientLab.svelte';
import RepresentationComparison from '$lib/components/RepresentationComparison.svelte';
import SamplingLab from '$lib/components/SamplingLab.svelte';
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

test('gradient updates and parameter nudges compute live results on a narrow screen', async () => {
	const screen = await render(GradientLab);
	await screen.getByRole('button', { name: 'Apply one SGD update', exact: true }).click();
	await expect
		.element(screen.getByRole('status', { name: 'Gradient result' }))
		.toHaveTextContent('Updated all four parameters');
	await screen.getByRole('button', { name: 'Increase w', exact: true }).click();
	await expect
		.element(screen.getByRole('status', { name: 'Gradient result' }))
		.toHaveTextContent('Other parameters stayed fixed');
	await screen.getByRole('button', { name: 'Reset weights', exact: true }).click();
	await expect
		.element(screen.getByRole('status', { name: 'Gradient result' }))
		.toHaveTextContent('Weights reset');
	expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(390);
});

test('representation choice is frozen after revealing test data and a fresh sample reseals it', async () => {
	const screen = await render(RepresentationComparison);
	await screen.getByRole('button', { name: 'Train all four', exact: true }).click();
	await screen
		.getByRole('button', { name: 'Commit Radius-squared logistic & reveal test', exact: true })
		.click();
	await expect
		.element(screen.getByRole('status', { name: 'Final test result' }))
		.toHaveTextContent('test accuracy');
	await expect
		.element(screen.getByRole('combobox', { name: 'Pattern', exact: true }))
		.toBeDisabled();
	await expect
		.element(screen.getByRole('button', { name: /Raw logistic regression Train/ }))
		.toBeDisabled();
	await screen.getByRole('button', { name: 'Start a fresh sample', exact: true }).click();
	await expect
		.element(screen.getByRole('combobox', { name: 'Pattern', exact: true }))
		.toBeEnabled();
	await expect
		.element(screen.getByRole('button', { name: 'Train all four', exact: true }))
		.toBeVisible();
	expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(390);
});

test('sampling requires fitted weights, replays deterministically, and resets when corruption changes', async () => {
	const screen = await render(SamplingLab);
	await expect
		.element(screen.getByRole('button', { name: 'Take one sampling step', exact: true }))
		.toBeDisabled();
	await screen.getByRole('button', { name: 'Fit the denoiser', exact: true }).click();
	await screen.getByRole('button', { name: 'Take one sampling step', exact: true }).click();
	const oneStep = screen.getByRole('status', { name: 'Sampling result' }).element().textContent;
	await screen.getByRole('button', { name: 'Rewind', exact: true }).click();
	await screen.getByRole('button', { name: 'Take one sampling step', exact: true }).click();
	expect(screen.getByRole('status', { name: 'Sampling result' }).element().textContent).toBe(
		oneStep
	);
	await screen.getByRole('slider', { name: /Corruption strength/ }).fill('0.8');
	await expect
		.element(screen.getByRole('button', { name: 'Take one sampling step', exact: true }))
		.toBeDisabled();
	expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(390);
});
