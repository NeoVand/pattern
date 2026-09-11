import { beforeEach, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import ClusteringLab from '$lib/components/ClusteringLab.svelte';
import ReinforcementLab from '$lib/components/ReinforcementLab.svelte';
import AdaptationLab from '$lib/components/AdaptationLab.svelte';
import '../../routes/layout.css';
import '../../routes/refinements.css';
import '../../routes/image-led.css';
import '../../routes/elegance.css';

beforeEach(async () => {
	await page.viewport(1100, 1000);
	document.documentElement.dataset.theme = 'dark';
	document.body.style.padding = '24px';
});

test('clustering exposes assignment, center updates, and a clean reset when k changes', async () => {
	const screen = await render(ClusteringLab);
	await screen.getByRole('button', { name: 'Assign nearest', exact: true }).click();
	await expect
		.element(screen.getByRole('button', { name: 'Move centers', exact: true }))
		.toBeEnabled();
	await screen.getByRole('button', { name: 'Move centers', exact: true }).click();
	await expect.element(screen.getByText('ROUND 02', { exact: true })).toBeVisible();
	await screen.getByRole('button', { name: '4', exact: true }).click();
	await expect.element(screen.getByText('Unassigned', { exact: true })).toBeVisible();
	await expect.element(screen.getByText('ROUND 01', { exact: true })).toBeVisible();
});

test('delivery training produces a policy and changing the map removes previous learning', async () => {
	const screen = await render(ReinforcementLab);
	await screen.getByRole('button', { name: 'Train 300 episodes' }).click();
	await expect.element(screen.getByRole('button', { name: 'Train 300 more' })).toBeVisible();
	await expect.element(screen.getByText(/Current policy: delivery in/)).toBeVisible();
	await screen.getByRole('button', { name: 'Roadworks', exact: true }).click();
	await expect.element(screen.getByRole('button', { name: 'Run the policy' })).toBeDisabled();
	await expect.element(screen.getByText('0 episodes', { exact: true })).toBeVisible();
});

test('pretraining enables adaptation and context edits preserve trained parameters', async () => {
	const screen = await render(AdaptationLab);
	await expect.element(screen.getByRole('button', { name: 'Adapt the model' })).toBeDisabled();
	await screen.getByRole('button', { name: 'Pretrain the model' }).click();
	await expect.element(screen.getByRole('button', { name: 'Adapt the model' })).toBeEnabled();
	await screen.getByRole('button', { name: 'Adapt the model' }).click();
	await expect
		.element(screen.getByText('Adaptation complete. Change the context to compare predictions.'))
		.toBeVisible();
	const parameters = screen
		.getByRole('img', { name: /Parameter changes for/ })
		.element()
		.getAttribute('aria-label');
	await screen.getByRole('button', { name: 'tastes …', exact: true }).click();
	expect(
		screen
			.getByRole('img', { name: /Parameter changes for/ })
			.element()
			.getAttribute('aria-label')
	).toBe(parameters);
	await page.viewport(390, 844);
	document.body.style.padding = '16px';
	document.documentElement.dataset.theme = 'light';
	expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(390);
});
