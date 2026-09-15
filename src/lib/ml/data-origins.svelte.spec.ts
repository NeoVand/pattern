import { expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import DataOriginsLab from '$lib/components/DataOriginsLab.svelte';
import '../../routes/layout.css';
import '../../routes/elegance.css';
import '../../routes/theme.css';

test('customer splitting removes overlap, and future fields cannot be used on new customers', async () => {
	await page.viewport(1280, 900);
	const screen = await render(DataOriginsLab);
	await expect.element(screen.getByTestId('origins-validation')).toHaveTextContent('100%');
	await expect.element(screen.getByTestId('customer-overlap')).toHaveTextContent('72 customers');
	await screen.getByRole('button', { name: 'Customer', exact: true }).click();
	await expect.element(screen.getByTestId('customer-overlap')).toHaveTextContent('0 customers');
	await screen.getByRole('combobox', { name: 'Model input', exact: true }).selectOptions('future');
	await expect.element(screen.getByTestId('origins-validation')).toHaveTextContent('100%');
	await expect
		.element(screen.getByText('The input arrives too late.', { exact: true }))
		.toBeVisible();
	expect(
		Number(screen.getByTestId('origins-fresh').element().textContent?.replace('%', ''))
	).toBeLessThan(65);
	await screen.getByRole('combobox', { name: 'Model input', exact: true }).selectOptions('history');
	await screen.getByText('Change collection & labels', { exact: true }).click();
	await screen.getByRole('button', { name: 'Morning only', exact: true }).click();
	await expect.element(screen.getByText('0 source customers', { exact: true })).toBeVisible();
	await page.viewport(390, 844);
	for (const theme of ['light', 'dark']) {
		document.documentElement.dataset.theme = theme;
		expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(390);
	}
});
