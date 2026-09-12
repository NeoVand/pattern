import { expect, test } from 'vitest';
import { render } from 'vitest-browser-svelte';
import LessonNotes from '$lib/components/LessonNotes.svelte';
import '../../routes/layout.css';
import '../../routes/refinements.css';
import '../../routes/image-led.css';
import '../../routes/elegance.css';
import '../../routes/theme.css';

test('reflection disclosure can reverse an animation and retain its answer after closing', async () => {
	const screen = await render(LessonNotes, { chapter: 0 });
	const summary = screen.getByText('Reflection & vocabulary', { exact: true });
	const details = document.querySelector('.lesson-notes details') as HTMLDetailsElement;
	await summary.click();
	await expect.poll(() => details.style.height).toBe('');
	expect(details.open).toBe(true);
	await screen.getByRole('button', { name: /^A / }).click();
	await expect.element(screen.getByText('Exactly.', { exact: true })).toBeVisible();
	await summary.click();
	await summary.click();
	await expect.poll(() => details.style.height).toBe('');
	expect(details.open).toBe(true);
	await summary.click();
	await expect.poll(() => details.open).toBe(false);
	await summary.click();
	await expect.element(screen.getByText('Exactly.', { exact: true })).toBeVisible();
});
