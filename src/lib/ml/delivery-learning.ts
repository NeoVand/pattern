export type DeliveryWorld = {
	width: number;
	height: number;
	start: number;
	goal: number;
	blocked: number[];
	traffic: number[];
	trafficCost: number;
};
export type DeliveryEpisode = {
	reward: number;
	steps: number;
	success: boolean;
	exploration: number;
	path: number[];
};
export const deliveryActions = ['Up', 'Right', 'Down', 'Left'] as const;

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
	if (next === world.goal) return { next, reward: 10, done: true };
	return { next, reward: world.traffic.includes(next) ? -world.trafficCost : -0.15, done: false };
}

export class DeliveryLearner {
	readonly q: number[][];
	readonly visits: number[];
	private seed: number;
	constructor(
		readonly world: DeliveryWorld,
		seed = 41
	) {
		this.seed = seed;
		this.q = Array.from({ length: world.width * world.height }, () => [0, 0, 0, 0]);
		this.visits = this.q.map(() => 0);
	}
	private random() {
		this.seed = (Math.imul(1664525, this.seed) + 1013904223) >>> 0;
		return this.seed / 4294967296;
	}
	bestAction(state: number) {
		const values = this.q[state];
		return values.indexOf(Math.max(...values));
	}
	trainEpisode(epsilon = 0.25, maxSteps = 200): DeliveryEpisode {
		let state = this.world.start,
			reward = 0,
			exploration = 0;
		const path = [state];
		for (let step = 0; step < maxSteps; step++) {
			const explore = this.random() < epsilon;
			const best = Math.max(...this.q[state]);
			const tied = this.q[state]
				.map((value, action) => ({ value, action }))
				.filter((entry) => entry.value === best);
			const action = explore
				? Math.floor(this.random() * 4)
				: tied[Math.floor(this.random() * tied.length)].action;
			if (explore) exploration++;
			const transition = deliveryMove(this.world, state, action);
			const target =
				transition.reward + (transition.done ? 0 : 0.95 * Math.max(...this.q[transition.next]));
			this.q[state][action] += 0.25 * (target - this.q[state][action]);
			this.visits[state]++;
			state = transition.next;
			path.push(state);
			reward += transition.reward;
			if (transition.done) return { reward, steps: step + 1, success: true, exploration, path };
		}
		return { reward, steps: maxSteps, success: false, exploration, path };
	}
	policyRoute(): DeliveryEpisode {
		let state = this.world.start,
			reward = 0;
		const path = [state],
			seen = new Set(path);
		for (let step = 0; step < this.q.length * 2; step++) {
			const transition = deliveryMove(this.world, state, this.bestAction(state));
			state = transition.next;
			path.push(state);
			reward += transition.reward;
			if (transition.done) return { reward, steps: step + 1, success: true, exploration: 0, path };
			if (seen.has(state)) break;
			seen.add(state);
		}
		return { reward, steps: path.length - 1, success: false, exploration: 0, path };
	}
}
