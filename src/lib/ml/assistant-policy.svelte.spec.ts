import { expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import AssistantTrainingLab from '$lib/components/AssistantTrainingLab.svelte';
import '../../routes/layout.css';
import '../../routes/elegance.css';
import '../../routes/theme.css';

test('demonstrations and proxy preferences visibly update weights, held-out results, and response probabilities', async () => {
	await page.viewport(1280, 1000);
	const screen = await render(AssistantTrainingLab);
	await expect
		.element(screen.getByRole('button', { name: 'Learn from preferences', exact: true }))
		.toBeDisabled();
	await screen.getByRole('button', { name: 'Learn from examples', exact: true }).click();
	await screen.getByRole('button', { name: 'Learn 20 more steps', exact: true }).click();
	await expect
		.poll(() => parseFloat(screen.getByTestId('policy-appropriate').element().textContent ?? ''))
		.toBeGreaterThan(85);
	await screen.getByRole('button', { name: 'Sounds most confident', exact: true }).click();
	await screen.getByRole('button', { name: 'Learn from preferences', exact: true }).click();
	await screen.getByRole('button', { name: 'Learn from preferences', exact: true }).click();
	await expect
		.poll(() => parseFloat(screen.getByTestId('policy-unsupported').element().textContent ?? ''))
		.toBeGreaterThan(70);
	await expect
		.poll(() => parseFloat(screen.getByTestId('policy-weight-0').element().textContent ?? ''))
		.toBeGreaterThan(2);
	await screen.getByRole('combobox', { name: 'Inspect held-out card' }).selectOptions('1');
	await expect.element(screen.getByText(/Parcel 707 arrived today/)).toBeVisible();
	await screen.getByRole('button', { name: 'Supported and honest', exact: true }).click();
	await expect.element(screen.getByText('0 preference updates', { exact: true })).toBeVisible();
	await expect
		.poll(() => parseFloat(screen.getByTestId('policy-appropriate').element().textContent ?? ''))
		.toBeGreaterThan(85);
	await page.viewport(390, 844);
	for (const theme of ['light', 'dark']) {
		document.documentElement.dataset.theme = theme;
		expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(390);
	}
});
