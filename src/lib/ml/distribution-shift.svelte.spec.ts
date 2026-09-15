import { expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import DistributionShiftLab from '$lib/components/DistributionShiftLab.svelte';
import '../../routes/layout.css';
import '../../routes/elegance.css';
import '../../routes/theme.css';

test('switching settings preserves the fitted model, diverse training changes it, and causal interventions stay distinct', async () => {
	await page.viewport(1280, 1000);
	const screen = await render(DistributionShiftLab);
	const score = () =>
		Number(screen.getByTestId('shift-target-score').element().textContent?.replace('%', ''));
	const originalScore = score();
	expect(originalScore).toBeLessThan(60);
	const weights = document.querySelector('.weights')?.textContent;
	await screen.getByRole('button', { name: 'Reversed background', exact: true }).click();
	expect(document.querySelector('.weights')?.textContent).toBe(weights);
	await expect.element(screen.getByRole('img', { name: /reversed-background/ })).toBeVisible();
	await screen.getByRole('button', { name: 'Varied backgrounds', exact: true }).click();
	expect(score()).toBeGreaterThan(originalScore + 20);
	await screen.getByText('Who gets the mistakes? Inspect all four groups', { exact: true }).click();
	await expect
		.element(screen.getByRole('table', { name: /Accuracy for each class/ }))
		.toBeVisible();
	const baselineVisits = screen.getByTestId('causal-intervention').element().textContent;
	const baselinePrediction = screen.getByTestId('causal-prediction').element().textContent;
	const slider = screen
		.getByRole('slider', { name: 'Extra drinks sold per day', exact: true })
		.element() as HTMLInputElement;
	slider.value = '0';
	slider.dispatchEvent(new Event('input', { bubbles: true }));
	await expect
		.element(screen.getByTestId('causal-intervention'))
		.toHaveTextContent(baselineVisits!);
	await expect
		.poll(() => screen.getByTestId('causal-prediction').element().textContent)
		.not.toBe(baselinePrediction);
	await page.viewport(390, 844);
	for (const theme of ['light', 'dark']) {
		document.documentElement.dataset.theme = theme;
		expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(390);
	}
});
