import { beforeEach, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import TokenLab from '$lib/components/TokenLab.svelte';
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

test('the text explorer tokenizes edits and lets users inspect split Unicode bytes', async () => {
	const screen = await render(TokenLab);
	await screen.getByRole('textbox', { name: 'Write something' }).fill('Hello, world!');
	await expect
		.element(screen.getByRole('button', { name: 'Token 3, ID 2375, " world"', exact: true }))
		.toBeVisible();
	await screen.getByRole('button', { name: 'Token 3, ID 2375, " world"', exact: true }).click();
	await expect.element(screen.getByText('Token 3', { exact: true })).toBeVisible();
	await screen.getByRole('button', { name: 'An emoji', exact: true }).click();
	await expect.element(screen.getByText(/Dotted pieces contain UTF-8 bytes/)).toBeVisible();
	await expect.element(screen.getByText('ZWJ', { exact: true })).toBeVisible();
});

test('image grids preserve all patches and remain usable on a narrow screen', async () => {
	const screen = await render(TokenLab);
	await screen.getByRole('button', { name: 'Image into patches' }).click();
	await screen.getByRole('button', { name: '12 × 12', exact: true }).click();
	await screen
		.getByRole('button', { name: 'Select patch 144, row 12, column 12', exact: true })
		.click();
	await expect.element(screen.getByText('Patch 144 of 144', { exact: true })).toBeVisible();
	await expect
		.element(screen.getByRole('button', { name: 'Next patch', exact: true }))
		.toBeDisabled();
	await screen.getByRole('button', { name: 'Separate patches', exact: true }).click();
	await expect
		.element(screen.getByRole('button', { name: 'Reassemble image', exact: true }))
		.toBeVisible();
	await screen.getByRole('button', { name: '4 × 4', exact: true }).click();
	await expect.element(screen.getByText('Patch 16 of 16', { exact: true })).toBeVisible();
	await page.viewport(390, 844);
	document.body.style.padding = '16px';
	document.documentElement.dataset.theme = 'light';
	expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(390);
});
