import { expect, test } from 'vitest';
import { render } from 'vitest-browser-svelte';
import TrainingLab from '$lib/components/TrainingLab.svelte';
import ImageClassifier from '$lib/components/ImageClassifier.svelte';
import { dataset, Network } from './models';

test('regression continues beyond its first run without losing weights or clipping history', async () => {
	const screen = await render(TrainingLab, { kind: 'regression' });
	await screen.getByRole('button', { name: 'Train the model', exact: true }).click();
	await expect
		.poll(() => document.querySelector('.training-status strong')?.textContent, { timeout: 10000 })
		.toBe('600');
	await screen.getByRole('button', { name: 'Continue training', exact: true }).click();
	await expect
		.poll(() => Number(document.querySelector('.training-status strong')?.textContent))
		.toBeGreaterThan(600);
	await screen.getByRole('button', { name: 'Pause', exact: true }).click();
	const epochs = Number(document.querySelector('.training-status strong')!.textContent);
	const reference = new Network([1, 1], false, 49);
	const train = dataset('regression').filter((p) => p.split === 'train');
	for (let i = 0; i < epochs; i++) reference.train(train, 0.015);
	expect(document.querySelector('.training-plot')!.getAttribute('aria-label')).toContain(
		`Training loss ${reference.loss(train).toFixed(4)}`
	);
	const curve = document.querySelector('.loss-chart path')!.getAttribute('d')!;
	expect(curve).toBeTruthy();
	{
		const xs = [...curve.matchAll(/[ML]([\d.]+),/g)].map((m) => Number(m[1]));
		expect(Math.max(...xs)).toBeLessThanOrEqual(212);
	}
}, 15000);

test('the image classifier can continue after 200 epochs and reset deliberately', async () => {
	const screen = await render(ImageClassifier);
	await screen.getByRole('button', { name: 'Train the classifier', exact: true }).click();
	await expect
		.poll(() => document.querySelector('.image-training-footer strong')?.textContent, {
			timeout: 10000
		})
		.toBe('200');
	await screen.getByRole('button', { name: 'Continue training', exact: true }).click();
	await expect
		.poll(() => Number(document.querySelector('.image-training-footer strong')?.textContent))
		.toBeGreaterThan(200);
	await screen.getByRole('button', { name: 'Reset the weights', exact: true }).click();
	await expect
		.poll(() => document.querySelector('.image-training-footer strong')?.textContent)
		.toBe('0');
}, 15000);
