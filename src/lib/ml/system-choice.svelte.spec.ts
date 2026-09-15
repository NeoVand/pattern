import { expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import SystemChoiceLab from '$lib/components/SystemChoiceLab.svelte';
import '../../routes/layout.css';
import '../../routes/elegance.css';
import '../../routes/theme.css';

test('capstone validates choices, freezes a reasoned plan, reveals independent cases, and detects changed conditions', async () => {
	await page.viewport(1280, 1000);
	const screen = await render(SystemChoiceLab);
	await expect
		.element(screen.getByRole('button', { name: 'Commit this system', exact: true }))
		.toBeDisabled();
	await expect
		.element(screen.getByText('28 observed days revealed', { exact: true }))
		.toBeVisible();
	await screen.getByRole('button', { name: 'Run validation', exact: true }).click();
	await expect
		.element(screen.getByText('35 observed days revealed', { exact: true }))
		.toBeVisible();
	await screen.getByRole('radio', { name: /Multiply integer cents/ }).click();
	await screen.getByRole('radio', { name: /Search current policy documents/ }).click();
	await screen.getByRole('radio', { name: /Fit trend and a weekly cycle/ }).click();
	await expect
		.element(screen.getByText(/These results belong to your previous choices/))
		.toBeVisible();
	await screen
		.getByRole('textbox', { name: 'System rationale' })
		.fill(
			'Exact arithmetic matches cents; current retrieval supplies evidence; a weekly forecast fits validation. Measure real workload latency and keep records local.'
		);
	await screen
		.getByRole('textbox', { name: 'Monitoring and fallback plan' })
		.fill(
			'The shop manager reviews unanswered questions, refreshes policy documents, and investigates a three-day error alert before using more forecasts.'
		);
	await expect
		.element(screen.getByRole('button', { name: 'Commit this system', exact: true }))
		.toBeDisabled();
	await screen.getByRole('button', { name: 'Run validation again', exact: true }).click();
	await expect.element(screen.getByTestId('shop-invoice-score')).toHaveTextContent('2 / 2');
	await screen.getByRole('button', { name: 'Commit this system', exact: true }).click();
	await expect
		.element(screen.getByRole('radio', { name: /Multiply integer cents/ }))
		.toBeDisabled();
	await screen.getByRole('button', { name: 'Reveal final cases', exact: true }).click();
	await expect
		.element(screen.getByText('42 observed days revealed', { exact: true }))
		.toBeVisible();
	await expect.element(screen.getByTestId('shop-policy-score')).toHaveTextContent('1 / 2');
	await screen.getByRole('button', { name: 'Change the conditions', exact: true }).click();
	await expect.element(screen.getByTestId('shop-policy-score')).toHaveTextContent('3 / 3');
	await expect.element(screen.getByTestId('shop-monitor')).toHaveTextContent(/Alert on day 45/);
	await expect
		.poll(() => parseFloat(screen.getByTestId('shop-forecast-error').element().textContent ?? ''))
		.toBeGreaterThan(35);
	await expect
		.element(screen.getByRole('button', { name: 'Export plan and evidence', exact: true }))
		.toBeEnabled();
	await page.viewport(390, 844);
	for (const theme of ['light', 'dark']) {
		document.documentElement.dataset.theme = theme;
		expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(390);
	}
	await screen
		.getByRole('button', { name: 'Start another development round', exact: true })
		.click();
	await expect
		.element(screen.getByText('28 observed days revealed', { exact: true }))
		.toBeVisible();
	await expect.element(screen.getByRole('radio', { name: /Multiply integer cents/ })).toBeEnabled();
});
