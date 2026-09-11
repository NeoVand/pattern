export type CafePoint = { id: number; sweetness: number; intensity: number };
export type CafeCenter = { sweetness: number; intensity: number };
export type ClusterState = {
	centers: CafeCenter[];
	assignments: number[];
	phase: 'assign' | 'move' | 'done';
	iteration: number;
	inertia: number | null;
};

function randomStream(seed: number) {
	let value = seed >>> 0;
	return () => {
		value += 0x6d2b79f5;
		let t = value;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/** Synthetic preference observations; no group labels are supplied to the algorithm. */
export function cafePreferences(seed = 19): CafePoint[] {
	const random = randomStream(seed);
	const modes = [
		[2.1, 7.5],
		[6.9, 6.2],
		[4.6, 2.4]
	];
	return Array.from({ length: 72 }, (_, id) => {
		const mode = modes[id % modes.length];
		const normal = () =>
			Math.sqrt(-2 * Math.log(Math.max(0.00001, random()))) * Math.cos(2 * Math.PI * random());
		return {
			id,
			sweetness: Math.max(0.4, Math.min(9.6, mode[0] + normal() * 0.9)),
			intensity: Math.max(0.4, Math.min(9.6, mode[1] + normal() * 0.85))
		};
	});
}

export function clusterDistance(a: CafeCenter, b: CafeCenter) {
	return (a.sweetness - b.sweetness) ** 2 + (a.intensity - b.intensity) ** 2;
}

export function startClusters(points: CafePoint[], k: number, seed = 5): ClusterState {
	if (!Number.isInteger(k) || k < 1 || k > points.length)
		throw new Error('Choose between one and the number of observations.');
	const random = randomStream(seed);
	const shuffled = [...points];
	for (let i = shuffled.length - 1; i > 0; i--) {
		const j = Math.floor(random() * (i + 1));
		[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
	}
	return {
		centers: shuffled.slice(0, k).map(({ sweetness, intensity }) => ({ sweetness, intensity })),
		assignments: points.map(() => -1),
		phase: 'assign',
		iteration: 0,
		inertia: null
	};
}

export function advanceClusters(points: CafePoint[], state: ClusterState): ClusterState {
	if (state.phase === 'done') return state;
	let centers = state.centers.map((center) => ({ ...center }));
	let assignments = [...state.assignments];
	let phase: ClusterState['phase'] = 'move';
	let iteration = state.iteration;
	if (state.phase === 'assign') {
		assignments = points.map((point) =>
			centers.reduce(
				(best, center, index) =>
					clusterDistance(point, center) < clusterDistance(point, centers[best]) ? index : best,
				0
			)
		);
	} else {
		centers = centers.map((center, group) => {
			const members = points.filter((_, index) => assignments[index] === group);
			return members.length
				? {
						sweetness: members.reduce((sum, point) => sum + point.sweetness, 0) / members.length,
						intensity: members.reduce((sum, point) => sum + point.intensity, 0) / members.length
					}
				: center;
		});
		phase = centers.every((center, i) => clusterDistance(center, state.centers[i]) < 1e-12)
			? 'done'
			: 'assign';
		iteration++;
	}
	const inertia = points.reduce(
		(sum, point, i) => sum + clusterDistance(point, centers[assignments[i]]),
		0
	);
	return { centers, assignments, phase, iteration, inertia };
}

/** Clip each Voronoi cell to the displayed 0–10 preference square. */
export function clusterRegions(centers: CafeCenter[]): [number, number][][] {
	return centers.map((center, index) => {
		let polygon: [number, number][] = [
			[0, 0],
			[10, 0],
			[10, 10],
			[0, 10]
		];
		for (let other = 0; other < centers.length; other++) {
			if (other === index) continue;
			const next = centers[other];
			const a = next.sweetness - center.sweetness;
			const b = next.intensity - center.intensity;
			const c =
				(next.sweetness ** 2 +
					next.intensity ** 2 -
					center.sweetness ** 2 -
					center.intensity ** 2) /
				2;
			if (Math.abs(a) + Math.abs(b) < 1e-12) continue;
			const clipped: [number, number][] = [];
			for (let p = 0; p < polygon.length; p++) {
				const start = polygon[p],
					end = polygon[(p + 1) % polygon.length];
				const startDistance = a * start[0] + b * start[1] - c;
				const endDistance = a * end[0] + b * end[1] - c;
				if (startDistance <= 0) clipped.push(start);
				if (startDistance <= 0 !== endDistance <= 0) {
					const t = startDistance / (startDistance - endDistance);
					clipped.push([start[0] + t * (end[0] - start[0]), start[1] + t * (end[1] - start[1])]);
				}
			}
			polygon = clipped;
		}
		return polygon;
	});
}
