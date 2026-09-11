/** A sampled probability field and interpolated decision contour, in plot coordinates. */
export function decisionSurface(predict: (x: number[]) => number, threshold: number) {
	const columns = 40;
	const rows = 28;
	const dx = 570 / columns;
	const dy = 264 / rows;
	const values = Array.from({ length: rows + 1 }, (_, row) =>
		Array.from({ length: columns + 1 }, (_, col) =>
			predict([(col / columns) * 2 - 1, 1 - (row / rows) * 2])
		)
	);
	const cells: { id: number; x: number; y: number; p: number }[] = [];
	const segments: string[] = [];
	for (let row = 0; row < rows; row++)
		for (let col = 0; col < columns; col++) {
			const x = 52 + col * dx;
			const y = 50 + row * dy;
			const corners = [
				{ x, y, p: values[row][col] },
				{ x: x + dx, y, p: values[row][col + 1] },
				{ x: x + dx, y: y + dy, p: values[row + 1][col + 1] },
				{ x, y: y + dy, p: values[row + 1][col] }
			];
			const mean = corners.reduce((sum, p) => sum + p.p, 0) / 4;
			cells.push({ id: row * columns + col, x, y, p: mean });
			const crossings: { x: number; y: number }[] = [];
			for (let edge = 0; edge < 4; edge++) {
				const a = corners[edge];
				const b = corners[(edge + 1) % 4];
				if (a.p >= threshold !== b.p >= threshold) {
					const t = (threshold - a.p) / (b.p - a.p);
					crossings.push({ x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) });
				}
			}
			if (crossings.length === 4 && mean >= threshold === corners[0].p >= threshold)
				crossings.push(crossings.shift()!);
			for (let i = 0; i + 1 < crossings.length; i += 2)
				segments.push(
					`M${crossings[i].x},${crossings[i].y}L${crossings[i + 1].x},${crossings[i + 1].y}`
				);
		}
	return { cells, boundary: segments.join(' '), dx, dy };
}
