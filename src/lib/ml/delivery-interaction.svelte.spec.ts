import { expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import ReinforcementLab from '$lib/components/ReinforcementLab.svelte';
import '../../routes/layout.css';
import '../../routes/refinements.css';
import '../../routes/image-led.css';
import '../../routes/elegance.css';
import '../../routes/theme.css';

test('comparison cards render trained snapshots and can select or continue distinct policies', async () => {
	await page.viewport(1400, 1000);
	const screen = render(ReinforcementLab);
	await screen.getByRole('button', { name: 'Compare', exact: true }).click();
	const low = screen.getByRole('button', { name: 'Inspect 0% exploration result' });
	const high = screen.getByRole('button', { name: 'Inspect 80% exploration result' });
	await expect.element(low).toBeEnabled();
	await expect.element(low).toHaveTextContent('20 moves');
	await expect.element(high).toHaveTextContent('8 moves');
	for (const card of document.querySelectorAll('.comparison-cards>button'))
		expect(card.textContent).toContain('200 episodes');
	await low.click();
	const first = document.querySelector('.route-overlay polyline')!.getAttribute('points');
	await high.click();
	expect(document.querySelector('.route-overlay polyline')!.getAttribute('points')).not.toBe(first);
	const saved = low.element().textContent;
	await screen.getByRole('button', { name: 'Train 200 more' }).click();
	await expect.element(screen.getByText('400 episodes', { exact: true })).toBeVisible();
	expect(low.element().textContent).toBe(saved);
	await screen.getByRole('slider', { name: 'Toll cost' }).fill('4');
	await expect.element(screen.getByText('0 episodes', { exact: true })).toBeVisible();
	expect(document.querySelectorAll('.comparison-cards>button')).toHaveLength(0);
	expect(
		[...document.querySelectorAll('.action-trials strong')].every((el) => el.textContent === '0.00')
	).toBe(true);
});

test('watched trips use the chosen epsilon, pause without further Q updates, and resume', async () => {
	await page.viewport(390, 844);
	document.documentElement.dataset.theme = 'light';
	const screen = render(ReinforcementLab);
	await screen.getByRole('slider', { name: 'Exploration' }).fill('1');
	await screen.getByText('Inside the latest Q-learning update', { exact: true }).click();
	await screen.getByRole('button', { name: 'Watch one trip', exact: true }).click();
	await expect
		.element(screen.getByText('Explore · a random action', { exact: true }))
		.toBeVisible();
	await screen.getByRole('button', { name: 'Pause trip', exact: true }).click();
	const values = document.querySelector('.q-detail')!.textContent;
	await new Promise((resolve) => setTimeout(resolve, 450));
	expect(document.querySelector('.q-detail')!.textContent).toBe(values);
	await screen.getByRole('button', { name: 'Resume trip', exact: true }).click();
	await expect.poll(() => document.querySelector('.q-detail')!.textContent).not.toBe(values);
	await screen.getByRole('button', { name: 'Pause trip', exact: true }).click();
	expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(390);
});
