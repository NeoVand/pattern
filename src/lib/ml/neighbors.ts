import { cafePreferences, clusterDistance, type CafeCenter } from './cafe-clusters';
export const drinkLabels = ['Espresso', 'Mocha', 'Latte'];
/** Labels are supplied observations in this synthetic classification example. */
export const labeledGuests = cafePreferences().map((point, i) => ({ ...point, label: i % 3 }));
export function nearestGuestVote(query: CafeCenter, k: number) {
	const neighbors = labeledGuests
		.map((point) => ({ ...point, distance: Math.sqrt(clusterDistance(query, point)) }))
		.sort((a, b) => a.distance - b.distance || a.id - b.id)
		.slice(0, k);
	const votes = drinkLabels.map((_, label) => neighbors.filter((p) => p.label === label).length);
	// If counts tie, the closest member among the tied classes breaks the tie.
	const max = Math.max(...votes);
	const prediction = neighbors.find((p) => votes[p.label] === max)!.label;
	return { neighbors, votes, prediction };
}
