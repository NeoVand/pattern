import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import LessonChallenge from '$lib/components/LessonChallenge.svelte';
import { challenges, CHALLENGE_STORAGE_PREFIX } from '$lib/data/challenges';
import '../../routes/layout.css';
import '../../routes/refinements.css';
import '../../routes/image-led.css';
import '../../routes/elegance.css';
import '../../routes/theme.css';

beforeEach(async () => {
	await page.viewport(1200, 900);
	for (const id of Object.keys(challenges))
		localStorage.removeItem(`${CHALLENGE_STORAGE_PREFIX}${id}`);
});
afterEach(() => vi.restoreAllMocks());

test('notebook saves independent chapter notes, restores them after remount, and keeps the explanation optional', async () => {
	localStorage.setItem(
		`${CHALLENGE_STORAGE_PREFIX}training`,
		JSON.stringify({
			prediction: 'Increasing a positive-input weight should raise the output.',
			evidence: '',
			transfer: ''
		})
	);
	const screen = await render(LessonChallenge, { lessonId: 'training' });
	(document.querySelector('.lesson-challenge > summary') as HTMLElement).focus();
	await userEvent.keyboard('{Enter}');
	await expect
		.element(screen.getByRole('textbox', { name: 'Prediction before experimenting' }))
		.toHaveValue('Increasing a positive-input weight should raise the output.');
	await screen
		.getByRole('textbox', { name: 'Observations and explanation' })
		.fill('The loss fell after subtracting the gradient.');
	await screen
		.getByRole('textbox', { name: 'Apply the idea to a new situation' })
		.fill('I would check the sign of the distance input.');
	await expect
		.element(screen.getByText(challenges.training.explanation, { exact: true }))
		.not.toBeVisible();
	await screen.getByText('Compare your reasoning with an explanation', { exact: true }).click();
	await expect
		.element(screen.getByText(challenges.training.explanation, { exact: true }))
		.toBeVisible();
	await screen.rerender({ lessonId: 'generalization' });
	await screen.getByText('Predict. Investigate. Explain.', { exact: true }).click();
	await expect
		.element(screen.getByRole('textbox', { name: 'Prediction before experimenting' }))
		.toHaveValue('');
	await screen
		.getByRole('textbox', { name: 'Prediction before experimenting' })
		.fill('The smallest training error may not win.');
	await screen.rerender({ lessonId: 'training' });
	await screen.getByText('Predict. Investigate. Explain.', { exact: true }).click();
	await expect
		.element(screen.getByRole('textbox', { name: 'Observations and explanation' }))
		.toHaveValue('The loss fell after subtracting the gradient.');
	await screen.unmount();
	const restored = await render(LessonChallenge, { lessonId: 'training' });
	await restored.getByText('Predict. Investigate. Explain.', { exact: true }).click();
	await expect
		.element(restored.getByRole('textbox', { name: 'Apply the idea to a new situation' }))
		.toHaveValue('I would check the sign of the distance input.');
	await page.viewport(390, 844);
	for (const theme of ['light', 'dark']) {
		document.documentElement.dataset.theme = theme;
		expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(390);
	}
});

test('denied browser storage keeps the notebook editable and reports that saving is unavailable', async () => {
	vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
		throw new DOMException('Blocked', 'SecurityError');
	});
	vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
		throw new DOMException('Full', 'QuotaExceededError');
	});
	const screen = await render(LessonChallenge, { lessonId: 'decisions' });
	await screen.getByText('Predict. Investigate. Explain.', { exact: true }).click();
	await screen
		.getByRole('textbox', { name: 'Prediction before experimenting' })
		.fill('The decisions stay the same at a 50% threshold.');
	await expect
		.element(screen.getByRole('textbox', { name: 'Prediction before experimenting' }))
		.toHaveValue('The decisions stay the same at a 50% threshold.');
	await expect
		.element(screen.getByRole('status'))
		.toHaveTextContent('Notes remain in this open page. Browser saving is unavailable.');
	await screen.rerender({ lessonId: 'tokens' });
	await screen.getByText('Predict. Investigate. Explain.', { exact: true }).click();
	await screen.rerender({ lessonId: 'decisions' });
	await screen.getByText('Predict. Investigate. Explain.', { exact: true }).click();
	await expect
		.element(screen.getByRole('textbox', { name: 'Prediction before experimenting' }))
		.toHaveValue('The decisions stay the same at a 50% threshold.');
});
