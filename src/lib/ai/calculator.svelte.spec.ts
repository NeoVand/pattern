import { expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import ToolCallingLab from '$lib/components/ToolCallingLab.svelte';
import type { AiSession, Generate } from './session.svelte';
import type { Completion, GenerationOptions } from './types';
import '../../routes/layout.css';
import '../../routes/elegance.css';
import '../../routes/theme.css';

const expected = '3638444035444585948898224156135652407533';
const a = '73829461509382746159',
	b = '49281736058472916387';
const toolCall = {
	id: 'call_live_test',
	name: 'multiply_integers',
	arguments: JSON.stringify({ a, b })
};
function session(generate = vi.fn<(options: GenerationOptions) => Promise<Completion>>()) {
	return {
		ready: true,
		busy: false,
		label: 'Test model',
		provider: 'openai',
		generate,
		withParallelGeneration: (run: (generators: [Generate, Generate]) => Promise<void>) =>
			run([generate, generate])
	} as unknown as AiSession;
}

test('shows both genuine outputs, exact error, actual arguments, and clears stale results when edited', async () => {
	await page.viewport(1440, 1000);
	const generate = vi
		.fn<(options: GenerationOptions) => Promise<Completion>>()
		.mockResolvedValueOnce({ text: '12345', calls: [] })
		.mockResolvedValueOnce({ text: '', calls: [toolCall] })
		.mockResolvedValueOnce({ text: expected, calls: [] });
	const screen = await render(ToolCallingLab, { ai: session(generate) });
	await screen.getByRole('button', { name: 'Compare both runs' }).click();
	await expect.element(screen.getByText('Incorrect', { exact: true })).toBeVisible();
	await expect.element(screen.getByText('Exact match', { exact: true })).toBeVisible();
	expect(document.querySelector('.answer-card .model-answer')?.textContent).toContain('12345');
	expect(document.querySelector('.exact-product output')?.textContent).toBe(expected);
	expect(document.querySelector('.model-call')?.textContent).toContain(toolCall.id);
	expect(document.querySelector('.tool-return')?.textContent).toContain(expected);
	expect(generate).toHaveBeenCalledTimes(3);
	await screen.getByRole('textbox', { name: /First number/ }).fill('12');
	expect(document.querySelectorAll('.model-turn')).toHaveLength(0);
	expect(document.querySelector('.exact-product')).toBeNull();
	await screen.getByRole('button', { name: 'Try the calculator only' }).click();
	expect(document.querySelector('.exact-product output')?.textContent).toBe(
		'591380832701674996644'
	);
});

test('calculator works without a connection and large products fit mobile in both themes', async () => {
	await page.viewport(390, 844);
	const ai = { ...session(), ready: false } as unknown as AiSession;
	const screen = await render(ToolCallingLab, { ai });
	await screen.getByRole('button', { name: '40 × 40 digits' }).click();
	await screen.getByRole('button', { name: 'Try the calculator only' }).click();
	expect(document.querySelector('.exact-product output')?.textContent?.length).toBe(80);
	for (const theme of ['dark', 'light']) {
		document.documentElement.dataset.theme = theme;
		expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(390);
	}
	await screen.getByRole('textbox', { name: /First number/ }).fill('1e30');
	await expect
		.element(screen.getByRole('button', { name: 'Try the calculator only' }))
		.toBeDisabled();
	expect(ai.generate).not.toHaveBeenCalled();
});

test('does not label a tool run successful when no call occurs or the model copies the result incorrectly', async () => {
	const generate = vi
		.fn<(options: GenerationOptions) => Promise<Completion>>()
		.mockResolvedValueOnce({ text: expected, calls: [] })
		.mockResolvedValueOnce({ text: expected, calls: [] });
	const screen = await render(ToolCallingLab, { ai: session(generate) });
	await screen.getByRole('button', { name: 'Compare both runs' }).click();
	await expect.element(screen.getByText(/did not successfully call the calculator/)).toBeVisible();
	generate
		.mockResolvedValueOnce({ text: expected, calls: [] })
		.mockResolvedValueOnce({ text: '', calls: [toolCall] })
		.mockResolvedValueOnce({ text: '12345', calls: [] });
	await screen.getByRole('button', { name: 'Compare both runs' }).click();
	await expect.element(screen.getByText(/final answer did not pass the check/)).toBeVisible();
});

test('stops in-flight generation and can run again', async () => {
	const generate = vi.fn<(options: GenerationOptions) => Promise<Completion>>().mockImplementation(
		({ signal }) =>
			new Promise((_resolve, reject) => {
				signal?.addEventListener('abort', () => reject(new DOMException('Stopped', 'AbortError')), {
					once: true
				});
			})
	);
	const screen = await render(ToolCallingLab, { ai: session(generate) });
	await screen.getByRole('button', { name: 'Compare both runs' }).click();
	await screen.getByRole('button', { name: 'Stop comparison' }).click();
	await expect
		.element(screen.getByText('Comparison stopped. Run again to start fresh.'))
		.toBeVisible();
	expect(generate).toHaveBeenCalledTimes(2);
	generate.mockResolvedValue({ text: expected, calls: [] });
	await screen.getByRole('button', { name: 'Compare both runs' }).click();
	await expect.element(screen.getByText(/did not successfully call the calculator/)).toBeVisible();
	expect(generate).toHaveBeenCalledTimes(4);
});

test('starts both runs immediately and preserves intermediate model text, calls, replies, and final output', async () => {
	await page.viewport(1440, 1100);
	let finishBaseline!: (result: Completion) => void;
	const generate = vi
		.fn<(options: GenerationOptions) => Promise<Completion>>()
		.mockImplementation((options) => {
			options.onRequest?.({
				model: 'test-model',
				input: options.responseInput,
				tools: options.tools ?? []
			});
			if (!options.tools?.length)
				return new Promise((resolve) => {
					finishBaseline = resolve;
				});
			if (!options.messages.some((message) => message.role === 'tool'))
				return Promise.resolve({
					text: 'I will ask the calculator for the exact product.',
					calls: [toolCall]
				});
			return Promise.resolve({ text: expected, calls: [] });
		});
	const screen = await render(ToolCallingLab, { ai: session(generate) });
	await expect.element(screen.getByRole('heading', { name: 'The tool definition' })).toBeVisible();
	expect(document.querySelector('.schema-code')?.textContent).toContain('"strict": true');
	await screen.getByRole('button', { name: 'Compare both runs' }).click();
	await expect.element(screen.getByText('Exact match', { exact: true })).toBeVisible();
	expect(generate).toHaveBeenCalledTimes(3);
	expect(document.querySelector('.answer-card .verdict')?.textContent).toContain('Running');
	await expect
		.element(screen.getByText('I will ask the calculator for the exact product.', { exact: true }))
		.toBeVisible();
	expect(document.querySelector('.model-call')?.textContent).toContain(toolCall.id);
	expect(document.querySelector('.tool-return')?.textContent).toContain(expected);
	expect(document.querySelectorAll('.model-turn')).toHaveLength(3);
	finishBaseline({ text: '7', calls: [] });
	await expect.element(screen.getByText('Incorrect', { exact: true })).toBeVisible();
	const requestToggle = document.querySelector('.request-inspector summary') as HTMLElement;
	requestToggle.click();
	expect(document.querySelector('.request-inspector pre')?.textContent).toContain('test-model');
	await page.viewport(390, 844);
	for (const theme of ['dark', 'light']) {
		document.documentElement.dataset.theme = theme;
		expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(390);
	}
});
