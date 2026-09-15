import { expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import ForecastBenchmark from '$lib/components/ForecastBenchmark.svelte';
import '../../routes/layout.css';
import '../../routes/elegance.css';
import '../../routes/theme.css';

test('baselines, horizons and regime changes recompute chronological errors and reveal honest interval coverage', async () => {
	await page.viewport(1280, 1000);
	const screen = await render(ForecastBenchmark);
	await expect
		.element(screen.getByTestId('forecast-origin'))
		.toHaveTextContent('Known through month 59');
	await expect
		.element(screen.getByRole('button', { name: 'Inspect Fitted season + trend', exact: true }))
		.toHaveAttribute('aria-pressed', 'true');
	const stableCoverage = Number(
		screen.getByTestId('forecast-coverage').element().textContent?.replace('%', '')
	);
	await screen.getByRole('button', { name: 'Level jumps', exact: true }).click();
	const changedCoverage = Number(
		screen.getByTestId('forecast-coverage').element().textContent?.replace('%', '')
	);
	expect(changedCoverage).toBeLessThan(stableCoverage);
	await screen.getByRole('button', { name: '12 months', exact: true }).click();
	await expect
		.element(screen.getByTestId('forecast-origin'))
		.toHaveTextContent('Known through month 53');
	await screen.getByRole('button', { name: 'Inspect Same month last year', exact: true }).click();
	await expect
		.element(screen.getByRole('button', { name: 'Inspect Same month last year', exact: true }))
		.toHaveAttribute('aria-pressed', 'true');
	await screen.getByRole('button', { name: 'Seasons reverse', exact: true }).click();
	await expect
		.element(screen.getByRole('slider', { name: 'Strength of season reversal', exact: true }))
		.toBeVisible();
	await page.viewport(390, 844);
	for (const theme of ['light', 'dark']) {
		document.documentElement.dataset.theme = theme;
		expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(390);
	}
});
