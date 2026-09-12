export type DeliveryWorld = {
	width: number;
	height: number;
	start: number;
	goal: number;
	blocked: number[];
	traffic: number[];
	trafficCost: number;
	destinations?: { cell: number; reward: number; label: string }[];
};
export type DeliveryEpisode = {
	reward: number;
	discountedReward: number;
	steps: number;
	success: boolean;
	exploration: number;
	path: number[];
	explored: boolean[];
	outcome: number | null;
};
export const deliveryActions = ['Up', 'Right', 'Down', 'Left'] as const;

export const deliveryScenarios = [
	{
		id: 'discovery',
		name: 'Two deliveries',
		description:
			'The nearby delivery pays +4. A larger reward lies across town, beyond several crossings.'
	},
	{
		id: 'bridges',
		name: 'Toll bridges',
		description:
			'Three crossings: a costly direct route, a middle crossing, and a long free detour. Change the toll to change the tradeoff.'
	},
	{
		id: 'detours',
		name: 'Dead ends',
		description:
			'A tempting local delivery and a winding route to the larger reward. Side streets can lead nowhere.'
	}
] as const;
export type DeliveryScenario = (typeof deliveryScenarios)[number]['id'];

/** Layouts specify environments and rewards, never a route or prelearned values. */
export function deliveryScenario(
	id: DeliveryScenario = 'discovery',
	trafficCost = 1.2
): DeliveryWorld {
	const layouts = {
		discovery: [
			'....#...B',
			'.##.#.#..',
			'....T....',
			'..A.#.#..',
			'....T....',
			'.#..#.#..',
			'S...T....'
		],
		bridges: [
			'.........',
			'.#..#..#.',
			'.#..#..#.',
			'....T....',
			'.#..#..#.',
			'.#..#..#.',
			'S..TTT..B'
		],
		detours: [
			'....#...B',
			'.##.#.#..',
			'.#..T.#..',
			'.#.###...',
			'....T..#.',
			'.##.#.##.',
			'S..A#....'
		]
	};
	const rows = layouts[id];
	const world: DeliveryWorld = {
		width: rows[0].length,
		height: rows.length,
		start: 0,
		goal: 0,
		blocked: [],
		traffic: [],
		trafficCost,
		destinations: []
	};
	[...rows.join('')].forEach((tile, cell) => {
		if (tile === '#') world.blocked.push(cell);
		if (tile === 'T') world.traffic.push(cell);
		if (tile === 'S') world.start = cell;
		if (tile === 'A' || tile === 'B') {
			world.destinations!.push({ cell, reward: tile === 'A' ? 4 : 18, label: tile });
			if (tile === 'B') world.goal = cell;
		}
	});
	return world;
}

export const deliveryDestinations = (world: DeliveryWorld) =>
	world.destinations ?? [{ cell: world.goal, reward: 10, label: 'Delivery' }];
export const isDelivery = (world: DeliveryWorld, state: number) =>
	deliveryDestinations(world).some((d) => d.cell === state);

export function deliveryWorld(roadworks = false, trafficCost = 2): DeliveryWorld {
	return {
		width: 7,
		height: 5,
		start: 28,
		goal: 6,
		blocked: roadworks ? [2, 9, 16, 23, 12, 19] : [9, 16, 23, 12, 19],
		traffic: [3, 4, 10, 17, 24],
		trafficCost
	};
}

export function deliveryMove(world: DeliveryWorld, state: number, action: number) {
	const x = state % world.width,
		y = Math.floor(state / world.width);
	const [dx, dy] = [
		[0, -1],
		[1, 0],
		[0, 1],
		[-1, 0]
	][action];
	const nx = x + dx,
		ny = y + dy;
	const next = ny * world.width + nx;
	if (nx < 0 || nx >= world.width || ny < 0 || ny >= world.height || world.blocked.includes(next))
		return { next: state, reward: -0.8, done: false };
	const destination = deliveryDestinations(world).find((d) => d.cell === next);
	if (destination) return { next, reward: destination.reward, done: true };
	return { next, reward: world.traffic.includes(next) ? -world.trafficCost : -0.15, done: false };
}

export type DeliveryUpdate = {
	state: number;
	action: number;
	next: number;
	reward: number;
	done: boolean;
	explore: boolean;
	forced: boolean;
	oldValue: number;
	future: number;
	target: number;
	newValue: number;
};
export class DeliveryLearner {
	readonly rate = 0.25;
	readonly discount = 0.95;
	lastUpdate: DeliveryUpdate | null = null;
	trainTransition(state: number, epsilon = 0.25, forcedAction?: number): DeliveryUpdate {
		if (isDelivery(this.world, state) || this.world.blocked.includes(state))
			throw new Error('Choose a non-terminal street.');
		const explore = forcedAction === undefined && this.random() < epsilon;
		const best = Math.max(...this.q[state]);
		const tied = this.q[state].map((v, a) => ({ v, a })).filter((x) => x.v === best);
		const action =
			forcedAction ??
			(explore ? Math.floor(this.random() * 4) : tied[Math.floor(this.random() * tied.length)].a);
		const transition = deliveryMove(this.world, state, action);
		const oldValue = this.q[state][action];
		const future = transition.done ? 0 : Math.max(...this.q[transition.next]);
		const target = transition.reward + this.discount * future;
		const newValue = oldValue + this.rate * (target - oldValue);
		this.q[state][action] = newValue;
		this.visits[state]++;
		this.actionVisits[state][action]++;
		return (this.lastUpdate = {
			state,
			action,
			...transition,
			explore,
			forced: forcedAction !== undefined,
			oldValue,
			future,
			target,
			newValue
		});
	}

	readonly q: number[][];
	readonly visits: number[];
	readonly actionVisits: number[][];
	private seed: number;
	constructor(
		readonly world: DeliveryWorld,
		seed = 41
	) {
		this.seed = seed;
		this.q = Array.from({ length: world.width * world.height }, () => [0, 0, 0, 0]);
		this.visits = this.q.map(() => 0);
		this.actionVisits = this.q.map(() => [0, 0, 0, 0]);
	}
	private random() {
		this.seed = (Math.imul(1664525, this.seed) + 1013904223) >>> 0;
		return this.seed / 4294967296;
	}
	clone() {
		const copy = new DeliveryLearner(this.world, this.seed);
		for (let state = 0; state < this.q.length; state++) {
			copy.q[state] = [...this.q[state]];
			copy.visits[state] = this.visits[state];
			copy.actionVisits[state] = [...this.actionVisits[state]];
		}
		copy.lastUpdate = this.lastUpdate ? { ...this.lastUpdate } : null;
		return copy;
	}
	bestAction(state: number) {
		const values = this.q[state];
		return values.indexOf(Math.max(...values));
	}
	trainEpisode(epsilon = 0.25, maxSteps = 200): DeliveryEpisode {
		let state = this.world.start,
			reward = 0,
			discountedReward = 0,
			exploration = 0;
		const path = [state],
			explored: boolean[] = [];
		for (let step = 0; step < maxSteps; step++) {
			const transition = this.trainTransition(state, epsilon);
			if (transition.explore) exploration++;
			explored.push(transition.explore);
			state = transition.next;
			path.push(state);
			reward += transition.reward;
			discountedReward += this.discount ** step * transition.reward;
			if (transition.done)
				return {
					reward,
					discountedReward,
					steps: step + 1,
					success: true,
					exploration,
					path,
					explored,
					outcome: state
				};
		}
		return {
			reward,
			discountedReward,
			steps: maxSteps,
			success: false,
			exploration,
			path,
			explored,
			outcome: null
		};
	}
	policyRoute(): DeliveryEpisode {
		let state = this.world.start,
			reward = 0,
			discountedReward = 0;
		const path = [state],
			seen = new Set(path);
		for (let step = 0; step < this.q.length * 2; step++) {
			const transition = deliveryMove(this.world, state, this.bestAction(state));
			state = transition.next;
			path.push(state);
			reward += transition.reward;
			discountedReward += this.discount ** step * transition.reward;
			if (transition.done)
				return {
					reward,
					discountedReward,
					steps: step + 1,
					success: true,
					exploration: 0,
					path,
					explored: Array(path.length - 1).fill(false),
					outcome: state
				};
			if (seen.has(state)) break;
			seen.add(state);
		}
		return {
			reward,
			discountedReward,
			steps: path.length - 1,
			success: false,
			exploration: 0,
			path,
			explored: Array(path.length - 1).fill(false),
			outcome: null
		};
	}
}

/** Independent fresh learners: equal episode budget, initial seed, rewards and zero Q-values. */
export function compareDeliveryExploration(world: DeliveryWorld, seed = 41, budget = 200) {
	return [0, 0.4, 0.8].map((epsilon) => {
		const learner = new DeliveryLearner(world, seed);
		const episodes = Array.from({ length: budget }, () => learner.trainEpisode(epsilon));
		return {
			epsilon,
			learner,
			episodes,
			route: learner.policyRoute(),
			coverage: learner.visits.filter((v) => v > 0).length
		};
	});
}
