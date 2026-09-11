export type SortFrame = {
	values: number[];
	pair: number[];
	action: 'ready' | 'compare' | 'swap' | 'pass' | 'done';
	message: string;
	comparisons: number;
	swaps: number;
};
/** One observable action per frame, including the final no-swap pass. */
export function sortingFrames(input: number[]): SortFrame[] {
	const values = [...input];
	let comparisons = 0,
		swaps = 0;
	const frames: SortFrame[] = [];
	function frame(action: SortFrame['action'], message: string, pair: number[] = []) {
		frames.push({ values: [...values], pair, action, message, comparisons, swaps });
	}
	frame('ready', 'Put the numbers in order, from smallest to largest.');
	let changed: boolean;
	do {
		changed = false;
		for (let i = 0; i < values.length - 1; i++) {
			comparisons++;
			frame(
				'compare',
				`Compare ${values[i]} and ${values[i + 1]}. ${values[i] > values[i + 1] ? 'The left number is bigger.' : 'They are already in the right order.'}`,
				[i, i + 1]
			);
			if (values[i] > values[i + 1]) {
				[values[i], values[i + 1]] = [values[i + 1], values[i]];
				swaps++;
				changed = true;
				frame('swap', 'Swap them. The smaller number moves left.', [i, i + 1]);
			}
		}
		if (changed) frame('pass', 'Go back to the beginning and check again.');
	} while (changed);
	frame('done', 'A whole pass without a swap. Every number is in order.');
	return frames;
}
