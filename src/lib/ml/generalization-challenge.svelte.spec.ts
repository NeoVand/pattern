import { expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import GeneralizationChallenge from '$lib/components/GeneralizationChallenge.svelte';
import '../../routes/layout.css';
import '../../routes/theme.css';

test('final evidence stays sealed until commitment and settings unlock only on a fresh sample', async () => {
	await page.viewport(390, 844);
	const screen = await render(GeneralizationChallenge);
	await expect.element(screen.getByTestId('independent-test')).toHaveTextContent('Sealed');
	await screen.getByRole('combobox', { name: 'Training examples' }).selectOptions('60');
	await expect.element(screen.getByTestId('independent-test')).toHaveTextContent('Sealed');
	await screen.getByRole('button', { name: 'Commit & reveal test' }).click();
	await expect.element(screen.getByTestId('independent-test')).not.toHaveTextContent('Sealed');
	await expect.element(screen.getByRole('combobox', { name: 'Polynomial degree' })).toBeDisabled();
	await screen.getByRole('button', { name: 'Repeat this fixed choice on 20 samples' }).click();
	await expect.element(screen.getByText(/Mean test MSE/)).toBeVisible();
	await screen.getByRole('button', { name: 'Fresh experiment' }).click();
	await expect.element(screen.getByTestId('independent-test')).toHaveTextContent('Sealed');
	await expect.element(screen.getByRole('combobox', { name: 'Polynomial degree' })).toBeEnabled();
	expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(390);
});
