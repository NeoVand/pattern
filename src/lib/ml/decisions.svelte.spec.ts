import { expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import DecisionLab from '$lib/components/DecisionLab.svelte';
import '../../routes/layout.css';
import '../../routes/elegance.css';
import '../../routes/theme.css';

test('decision lab starts with the real rare-event failure and responds to threshold and confidence changes', async () => {
	await page.viewport(1280, 1000);
	const screen = await render(DecisionLab);
	await expect.element(screen.getByTestId('decision-accuracy')).toHaveTextContent('99.0%');
	await expect.element(screen.getByTestId('decision-fn')).toHaveTextContent('10');
	await expect.element(screen.getByTestId('decision-recall')).toHaveTextContent('0.0%');
	await screen.getByRole('button', { name: /Use cost-based threshold/ }).click();
	await expect
		.poll(() => Number(screen.getByTestId('decision-tp').element().textContent))
		.toBeGreaterThan(0);
	const threshold = screen
		.getByRole('slider', { name: 'Decision threshold', exact: true })
		.element() as HTMLInputElement;
	threshold.value = '0.5';
	threshold.dispatchEvent(new Event('input', { bubbles: true }));
	await expect.poll(() => threshold.value).toBe('0.5');
	const before = screen.getByTestId('calibration-gap').element().textContent;
	await screen.getByRole('combobox', { name: 'Score confidence' }).selectOptions('3');
	await expect
		.poll(() => screen.getByTestId('calibration-gap').element().textContent)
		.not.toBe(before);
	await screen.getByRole('button', { name: 'The 99% example' }).click();
	await expect.element(screen.getByTestId('decision-fn')).toHaveTextContent('10');
	await page.viewport(390, 844);
	for (const theme of ['light', 'dark']) {
		document.documentElement.dataset.theme = theme;
		expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(390);
	}
});
