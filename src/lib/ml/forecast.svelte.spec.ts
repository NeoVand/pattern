import { expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import ForecastLab from '$lib/components/ForecastLab.svelte';
import '../../routes/layout.css';
import '../../routes/elegance.css';
import '../../routes/theme.css';
test('forecast scenarios expose later observations, editable training data, and real model terms', async () => {
	await page.viewport(1440, 1000);
	const screen = await render(ForecastLab);
	expect(document.querySelectorAll('.data-handle')).toHaveLength(42);
	await screen.getByRole('button', { name: 'Train forecast', exact: true }).click();
	await expect
		.poll(() => Number(document.querySelector('.forecast-scores strong')?.textContent))
		.toBeLessThan(10);
	await screen.getByRole('button', { name: 'Pause learning', exact: true }).click();
	const observed = screen
		.getByRole('slider', { name: /Edit month 31/ })
		.element() as HTMLInputElement;
	observed.value = '300';
	observed.dispatchEvent(new Event('input', { bubbles: true }));
	await expect.element(screen.getByText('0 gradient updates', { exact: true })).toBeVisible();
	await screen.getByRole('button', { name: 'Asset depreciation', exact: true }).click();
	expect(document.querySelectorAll('.data-handle')).toHaveLength(42);
	await screen.getByRole('button', { name: '+ Trend', exact: true }).click();
	await expect
		.element(screen.getByText('2 learned coefficients · linear regression', { exact: true }))
		.toBeVisible();
	await page.viewport(390, 844);
	for (const theme of ['light', 'dark']) {
		document.documentElement.dataset.theme = theme;
		expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(390);
	}
});
