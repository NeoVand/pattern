import { beforeEach, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import ClusteringLab from '$lib/components/ClusteringLab.svelte';
import ReinforcementLab from '$lib/components/ReinforcementLab.svelte';
import AdaptationLab from '$lib/components/AdaptationLab.svelte';
import SortingLab from '$lib/components/SortingLab.svelte';
import '../../routes/layout.css';
import '../../routes/refinements.css';
import '../../routes/image-led.css';
import '../../routes/elegance.css';
import '../../routes/theme.css';

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
	await screen.getByRole('button', { name: 'Train 200 episodes' }).click();
	await expect.element(screen.getByRole('button', { name: 'Train 200 more' })).toBeVisible();
	await expect.element(screen.getByText('Delivery B', { exact: true })).toBeVisible();

	const overlay = document.querySelector<SVGSVGElement>('.route-overlay')!;
	const firstPoint = overlay
		.querySelector('polyline')!
		.getAttribute('points')!
		.split(' ')[0]
		.split(',')
		.map(Number);
	const screenPoint = new DOMPoint(firstPoint[0], firstPoint[1]).matrixTransform(
		overlay.getScreenCTM()!
	);
	const startCell = screen
		.getByRole('button', { name: /^Start, row/ })
		.element()
		.getBoundingClientRect();
	expect(screenPoint.x).toBeCloseTo(startCell.x + startCell.width / 2, 0);
	expect(screenPoint.y).toBeCloseTo(startCell.y + startCell.height / 2, 0);
	await screen.getByRole('button', { name: 'Replay route', exact: true }).click();
	await expect
		.poll(() => overlay.querySelector('polyline')!.getAttribute('points')!.split(' ').length)
		.toBeGreaterThan(1);
	await screen.getByRole('button', { name: 'Pause route', exact: true }).click();
	const pausedRoute = overlay.querySelector('polyline')!.getAttribute('points');
	await new Promise((resolve) => setTimeout(resolve, 450));
	expect(overlay.querySelector('polyline')!.getAttribute('points')).toBe(pausedRoute);
	await screen.getByRole('button', { name: 'Resume route', exact: true }).click();
	await expect
		.element(screen.getByRole('button', { name: 'Pause route', exact: true }))
		.toBeVisible();
	await screen.getByRole('button', { name: 'Dead ends', exact: true }).click();
	await expect.element(screen.getByRole('button', { name: 'Replay route' })).toBeDisabled();
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

test('sorting can scrub forward and back without losing any phone controls', async () => {
	await page.viewport(390, 844);
	document.body.style.padding = '16px';
	const screen = await render(SortingLab);
	const slider = screen.getByRole('slider', { name: 'Algorithm step' });
	await slider.fill(slider.element().getAttribute('max')!);
	await expect
		.element(screen.getByRole('button', { name: 'Run again', exact: true }))
		.toBeVisible();
	expect(document.querySelector('.sort-bars')!.getAttribute('aria-label')).toBe(
		'Numbers in current order: 1, 2, 3, 4, 5, 6'
	);
	await slider.fill('0');
	expect(document.querySelector('.sort-bars')!.getAttribute('aria-label')).toBe(
		'Numbers in current order: 4, 1, 6, 2, 5, 3'
	);
	await screen.getByRole('button', { name: 'Run the algorithm', exact: true }).click();
	await slider.fill('4');
	await expect
		.element(screen.getByRole('button', { name: 'Run the algorithm', exact: true }))
		.toBeVisible();
	const stage = document.querySelector('.sort-stage')!.getBoundingClientRect();
	for (const element of document.querySelectorAll('.sort-controls button, .sort-bar-slot')) {
		const box = element.getBoundingClientRect();
		expect(box.left).toBeGreaterThanOrEqual(stage.left);
		expect(box.right).toBeLessThanOrEqual(stage.right);
	}
});
