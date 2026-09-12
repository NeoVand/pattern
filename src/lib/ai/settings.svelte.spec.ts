import { expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import SelectMenu from '$lib/components/SelectMenu.svelte';
import '../../routes/theme.css';
test('the model selector works with keyboard navigation and closes after choosing', async () => {
	await page.viewport(500, 600);
	let chosen = '';
	const screen = await render(SelectMenu, {
		label: 'Language model',
		value: 'mini',
		options: [
			{ value: 'mini', label: 'Small model' },
			{ value: 'large', label: 'Larger model' }
		],
		onchange: (v) => (chosen = v)
	});
	await screen.getByRole('button', { name: 'Language model Small model' }).click();
	await expect.element(screen.getByRole('option', { name: 'Small model' })).toHaveFocus();
	await userEvent.keyboard('{ArrowDown}');
	await userEvent.keyboard('{Enter}');
	expect(chosen).toBe('large');
	await expect
		.element(screen.getByRole('button', { name: 'Language model Small model' }))
		.toHaveAttribute('aria-expanded', 'false');
});
