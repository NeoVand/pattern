import { beforeEach, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import TrainingLab from '$lib/components/TrainingLab.svelte';
import { Network } from './models';
import '../../routes/layout.css';
import '../../routes/refinements.css';
import '../../routes/image-led.css';
import '../../routes/elegance.css';

beforeEach(async () => {
	await page.viewport(1280, 1000);
	document.documentElement.dataset.theme = 'dark';
	document.body.style.padding = '24px';
});

test('twelve means twelve: every rendered neuron and weight follows the chosen architecture', async () => {
	const screen = await render(TrainingLab, { kind: 'neural-classifier' });
	expect(document.querySelectorAll('[data-neuron^="1-"]')).toHaveLength(12);
	expect(document.querySelectorAll('[data-neuron^="2-"]')).toHaveLength(12);
	expect(document.querySelectorAll('[data-neuron]')).toHaveLength(27);
	expect(document.querySelectorAll('[data-weight]')).toHaveLength(180);
	await screen.getByRole('button', { name: '8', exact: true }).click();
	expect(document.querySelectorAll('[data-neuron^="1-"]')).toHaveLength(8);
	expect(document.querySelectorAll('[data-neuron]')).toHaveLength(19);
	await screen.getByRole('button', { name: '1 layer', exact: true }).click();
	expect(document.querySelectorAll('[data-neuron]')).toHaveLength(11);
	await screen.getByRole('button', { name: 'None', exact: true }).click();
	expect(document.querySelectorAll('[data-neuron]')).toHaveLength(3);
	expect(document.querySelectorAll('[data-weight]')).toHaveLength(2);
});

test('input movement updates the exact selected-neuron arithmetic and trace exposes the full forward pass', async () => {
	const screen = await render(TrainingLab, { kind: 'neural-classifier' });
	const reference = new Network([2, 12, 12, 1], true, 49);
	await expect
		.element(screen.getByTestId('neuron-activation'))
		.toHaveTextContent(reference.activations([0.25, 0.2])[1][0].toFixed(4));
	const slider = screen.getByRole('slider', { name: 'Network input x1' });
	await slider.click();
	await slider.fill('0.8');
	await expect
		.element(screen.getByTestId('neuron-activation'))
		.toHaveTextContent(reference.activations([0.8, 0.2])[1][0].toFixed(4));
	await screen.getByRole('button', { name: /Hidden layer 2, neuron 12,/ }).click();
	expect(document.querySelectorAll('[data-contribution]')).toHaveLength(12);
	await expect
		.element(screen.getByTestId('neuron-activation'))
		.toHaveTextContent(reference.activations([0.8, 0.2])[2][11].toFixed(4));
	for (let step = 0; step < 4; step++)
		await screen.getByRole('button', { name: 'Advance one layer' }).click();
	await expect
		.element(screen.getByTestId('neuron-activation'))
		.toHaveTextContent(`sigmoid(z) = ${reference.predict([0.8, 0.2]).toFixed(4)}`);
	await page.viewport(390, 844);
	document.documentElement.dataset.theme = 'light';
	expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(390);
});

test('the second neural lab exposes a single input and a truly linear output', async () => {
	const screen = await render(TrainingLab, { kind: 'neural-regression' });
	const reference = new Network([1, 12, 12, 1], false, 49);
	expect(document.querySelectorAll('[data-neuron]')).toHaveLength(26);
	expect(document.querySelectorAll('[data-weight]')).toHaveLength(168);
	await screen.getByRole('button', { name: /Output neuron, activation/ }).click();
	await expect
		.element(screen.getByTestId('neuron-sum'))
		.toHaveTextContent(reference.predict([0.25]).toFixed(4));
	await expect
		.element(screen.getByTestId('neuron-activation'))
		.toHaveTextContent(`z = ${reference.predict([0.25]).toFixed(4)}`);
	await screen.getByRole('slider', { name: 'Network input x1' }).fill('-0.6');
	await expect
		.element(screen.getByTestId('neuron-activation'))
		.toHaveTextContent(`z = ${reference.predict([-0.6]).toFixed(4)}`);
});
