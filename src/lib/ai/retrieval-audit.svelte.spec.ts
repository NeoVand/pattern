import { expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import RetrievalAudit from '$lib/components/RetrievalAudit.svelte';
import type { AiSession } from './session.svelte';
import type { Completion, GenerationOptions } from './types';
import '../../routes/layout.css';
import '../../routes/elegance.css';
import '../../routes/theme.css';

function session(ready = false) {
	return {
		ready,
		provider: 'openai',
		busy: false,
		label: 'Test model',
		settingsOpen: false,
		embed: vi.fn<(input: string[], signal?: AbortSignal) => Promise<number[][]>>(),
		generate: vi.fn<(options: GenerationOptions) => Promise<Completion>>()
	};
}

test('keyword audit works offline without model calls and setting changes clear stale results', async () => {
	await page.viewport(1280, 900);
	const ai = session();
	const screen = await render(RetrievalAudit, { ai: ai as unknown as AiSession });
	expect(ai.embed).not.toHaveBeenCalled();
	expect(ai.generate).not.toHaveBeenCalled();
	await screen.getByRole('button', { name: 'Run search checks', exact: true }).click();
	await expect.element(screen.getByTestId('retrieval-recall')).toBeVisible();
	await screen.getByRole('combobox', { name: 'Withheld source', exact: true }).selectOptions('B');
	expect(document.querySelector('[data-testid="retrieval-recall"]')).toBeNull();
	await screen.getByRole('button', { name: 'Run search checks', exact: true }).click();
	await screen.getByRole('button', { name: /Child ticket/ }).click();
	await expect
		.element(
			screen.getByText('At least one required source was removed from the collection.', {
				exact: true
			})
		)
		.toBeVisible();
	expect(ai.embed).not.toHaveBeenCalled();
	expect(ai.generate).not.toHaveBeenCalled();
	await page.viewport(390, 844);
	for (const theme of ['light', 'dark']) {
		document.documentElement.dataset.theme = theme;
		expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(390);
	}
});

test('semantic search batches actual inputs and keeps answer generation explicitly separate', async () => {
	const ai = session(true);
	ai.embed.mockImplementation(async (input) =>
		input.map((_, i) => (i === 0 || i >= 8 ? [1, 0] : [0, 1]))
	);
	const screen = await render(RetrievalAudit, { ai: ai as unknown as AiSession });
	await screen.getByRole('button', { name: 'Real embeddings', exact: true }).click();
	expect(ai.embed).not.toHaveBeenCalled();
	await screen.getByRole('button', { name: 'Run search checks', exact: true }).click();
	await expect
		.element(
			screen.getByText('Four searches complete. No answers have been generated.', { exact: true })
		)
		.toBeVisible();
	expect(ai.embed).toHaveBeenCalledTimes(1);
	expect(ai.embed.mock.calls[0][0]).toHaveLength(12);
	expect(ai.embed.mock.calls[0][0][0]).toContain('Doors open at 18:30');
	expect(ai.generate).not.toHaveBeenCalled();
});

test('answers use only retrieved notes, with text checks separate from source recall', async () => {
	const ai = session(true);
	ai.generate.mockResolvedValue({
		text: 'The supplied notes do not provide the answer.',
		calls: []
	});
	const screen = await render(RetrievalAudit, { ai: ai as unknown as AiSession });
	await screen.getByRole('combobox', { name: 'Withheld source', exact: true }).selectOptions('B');
	await screen.getByRole('button', { name: 'Run search checks', exact: true }).click();
	await screen.getByRole('button', { name: 'Generate 4 answers', exact: true }).click();
	await expect.poll(() => ai.generate.mock.calls.length).toBe(4);
	await expect
		.element(
			screen.getByText('Four answers generated. Inspect the wording against each source.', {
				exact: true
			})
		)
		.toBeVisible();
	await screen.getByRole('button', { name: /Child ticket/ }).click();
	await expect
		.element(screen.getByText('Missing-evidence language', { exact: true }))
		.toBeVisible();
	expect(ai.generate.mock.calls[1][0].messages[1].content).not.toContain('Tickets for every age');
	expect(ai.generate.mock.calls[1][0].messages[0].content).toContain(
		'ONLY the supplied field notes'
	);
	await expect.element(screen.getByText(/These are narrow text checks/)).toBeVisible();
});

test('cancellation stops a pending answer batch without fabricating an output or a grade', async () => {
	const ai = session(true);
	ai.generate.mockImplementation(
		({ signal }) =>
			new Promise((_resolve, reject) =>
				signal?.addEventListener('abort', () => reject(new DOMException('Stopped', 'AbortError')), {
					once: true
				})
			)
	);
	const screen = await render(RetrievalAudit, { ai: ai as unknown as AiSession });
	await screen.getByRole('button', { name: 'Run search checks', exact: true }).click();
	await screen.getByRole('button', { name: 'Generate 4 answers', exact: true }).click();
	await screen.getByRole('button', { name: 'Stop audit', exact: true }).click();
	await expect
		.element(
			screen.getByText('Generation stopped. Completed answers remain available.', { exact: true })
		)
		.toBeVisible();
	expect(ai.generate).toHaveBeenCalledTimes(1);
	expect(document.querySelector('.grade-list')).toBeNull();
});
