import { beforeEach, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import EvaluationLab from '$lib/components/EvaluationLab.svelte';
import { evaluationCases, expectedAnswer } from './evaluation-suite';
import type { AiSession } from './session.svelte';
import type { Completion, GenerationOptions } from './types';
import '../../routes/layout.css';
import '../../routes/elegance.css';
import '../../routes/theme.css';

function session(generate: (options: GenerationOptions) => Promise<Completion>) {
	return {
		ready: true,
		busy: false,
		label: 'Mock model',
		openaiModel: 'mock-model-id',
		localModel: '',
		provider: 'openai',
		settingsOpen: false,
		generate
	} as unknown as AiSession;
}
function answer(options: GenerationOptions, text?: string) {
	const item = evaluationCases.find(
		(candidate) => candidate.prompt === options.messages[1].content
	)!;
	options.onRequest?.({
		model: 'mock-model-id',
		temperature: options.temperature,
		max_output_tokens: options.maxTokens,
		input: options.messages
	});
	return { text: text ?? expectedAnswer(item.criterion), calls: [] };
}
beforeEach(async () => {
	await page.viewport(390, 844);
	document.body.style.padding = '16px';
	document.documentElement.dataset.theme = 'light';
});

test('default evaluation makes six real calls with requested temperature zero', async () => {
	const generate = vi.fn(async (options: GenerationOptions) => answer(options));
	const screen = await render(EvaluationLab, { ai: session(generate) });
	await screen.getByRole('button', { name: 'Run six checks', exact: true }).click();
	await expect
		.element(screen.getByRole('status', { name: 'Evaluation progress' }))
		.toHaveTextContent('6 of 6 checks completed');
	expect(generate).toHaveBeenCalledTimes(6);
	expect(generate.mock.calls.every(([options]) => options.temperature === 0)).toBe(true);
	await expect
		.element(screen.getByRole('region', { name: 'Matching trial summary' }))
		.toHaveTextContent('1 complete · 0 incomplete excluded');
});

test('three trials make eighteen calls, show variability, retain individual outputs, and export every trial', async () => {
	let count = 0;
	const generate = vi.fn(async (options: GenerationOptions) =>
		answer(options, ++count === 7 ? 'wrong-on-trial-two' : undefined)
	);
	const screen = await render(EvaluationLab, { ai: session(generate) });
	await screen.getByRole('combobox', { name: 'Repeated trials', exact: true }).selectOptions('3');
	await screen.getByRole('button', { name: 'Run three trials', exact: true }).click();
	await expect
		.element(screen.getByRole('region', { name: 'Matching trial summary' }))
		.toHaveTextContent('3 complete · 0 incomplete excluded');
	expect(generate).toHaveBeenCalledTimes(18);
	await expect
		.element(screen.getByRole('region', { name: 'Matching trial summary' }))
		.toHaveTextContent('observed range 5–6 / 6');
	await screen.getByRole('button', { name: 'Inspect completed trial 2', exact: true }).click();
	await expect.element(screen.getByText('wrong-on-trial-two', { exact: true })).toBeVisible();
	let artifact: Blob | undefined;
	const create = vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
		artifact = blob as Blob;
		return 'blob:mock-export';
	});
	const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
	try {
		await screen.getByRole('button', { name: 'Save all trials as JSON', exact: true }).click();
		const exported = JSON.parse(await artifact!.text());
		expect(exported.runs).toHaveLength(3);
		expect(exported.runs.find((run: { id: number }) => run.id === 2).results[0].output).toBe(
			'wrong-on-trial-two'
		);
		expect(
			exported.runs.every(
				(run: { modelId: string; temperature: number; requestedTrials: number }) =>
					run.modelId === 'mock-model-id' && run.temperature === 0 && run.requestedTrials === 3
			)
		).toBe(true);
	} finally {
		create.mockRestore();
		click.mockRestore();
	}
	for (const theme of ['dark', 'light']) {
		document.documentElement.dataset.theme = theme;
		expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(390);
	}
});

test('cancelling trial two prevents future calls and excludes incomplete trials from counts', async () => {
	let count = 0;
	const generate = vi.fn((options: GenerationOptions): Promise<Completion> => {
		if (++count <= 6) return Promise.resolve(answer(options));
		options.onText?.('partial retained output');
		return new Promise((_resolve, reject) =>
			options.signal?.addEventListener(
				'abort',
				() => reject(new DOMException('Stopped', 'AbortError')),
				{ once: true }
			)
		);
	});
	const screen = await render(EvaluationLab, { ai: session(generate) });
	await screen.getByRole('combobox', { name: 'Repeated trials', exact: true }).selectOptions('3');
	await screen.getByRole('button', { name: 'Run three trials', exact: true }).click();
	await expect.poll(() => generate.mock.calls.length).toBe(7);
	await screen.getByRole('button', { name: 'Stop evaluation', exact: true }).click();
	await expect
		.element(screen.getByRole('region', { name: 'Matching trial summary' }))
		.toHaveTextContent('1 complete · 2 incomplete excluded');
	await expect.element(screen.getByText('partial retained output', { exact: true })).toBeVisible();
	expect(generate).toHaveBeenCalledTimes(7);
	expect(
		generate.mock.calls.every(([options]) => options.signal === generate.mock.calls[0][0].signal)
	).toBe(true);
	expect(generate.mock.calls[6][0].signal?.aborted).toBe(true);
});
