import { expect, test } from 'vitest';
import { challenges, parseChallengeNotes } from './challenges';

test('all 25 course chapters have prediction, experiment, evidence, transfer, and explanation activities', () => {
	const ids = [
		'patterns',
		'data-origins',
		'training',
		'generalization',
		'classification',
		'decisions',
		'forecasting',
		'clustering',
		'reinforcement',
		'deep-learning',
		'representations',
		'self-supervised',
		'distribution-shift',
		'modern-ai',
		'tokens',
		'language',
		'adaptation',
		'assistant-training',
		'vision',
		'generative',
		'retrieval',
		'tool-calling',
		'agents',
		'evaluation',
		'system-choice'
	];
	for (const id of ids) {
		expect(challenges[id], id).toBeDefined();
		for (const key of ['prediction', 'experiment', 'evidence', 'transfer', 'explanation'] as const)
			expect(challenges[id][key].trim(), `${id}:${key}`).not.toBe('');
	}
	expect(Object.keys(challenges)).toHaveLength(25);
});

test('untrusted or malformed saved values preserve valid plain-text fields without breaking the notebook', () => {
	expect(parseChallengeNotes('{broken')).toEqual({ prediction: '', evidence: '', transfer: '' });
	expect(parseChallengeNotes('[]')).toEqual({ prediction: '', evidence: '', transfer: '' });
	expect(parseChallengeNotes('null')).toEqual({ prediction: '', evidence: '', transfer: '' });
	expect(
		parseChallengeNotes(
			JSON.stringify({
				prediction: '<script>example</script>',
				evidence: 42,
				transfer: 'A different task',
				extra: true
			})
		)
	).toEqual({ prediction: '<script>example</script>', evidence: '', transfer: 'A different task' });
});
