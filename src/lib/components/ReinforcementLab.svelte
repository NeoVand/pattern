<script lang="ts">
	import { onDestroy } from 'svelte';
	import { Tween, prefersReducedMotion } from 'svelte/motion';
	import PatternIcon from '$lib/components/PatternIcon.svelte';
	import {
		DeliveryLearner,
		deliveryActions,
		deliveryDestinations,
		deliveryScenario,
		deliveryScenarios,
		isDelivery,
		type DeliveryScenario,
		type DeliveryUpdate,
		type DeliveryEpisode
	} from '$lib/ml/delivery-learning';

	type Run = { epsilon: number; learner: DeliveryLearner; episodes: DeliveryEpisode[] };
	let scenario = $state<DeliveryScenario>('bridges'),
		toll = $state(1.2),
		seed = $state(41);
	const initialWorld = deliveryScenario('bridges');
	let world = $state.raw(initialWorld);
	let learner = new DeliveryLearner(initialWorld);
	let q = $state.raw(learner.q.map((row) => [...row]));
	let visits = $state.raw([...learner.visits]);
	let actionVisits = $state.raw(learner.actionVisits.map((row) => [...row]));
	let episodes = $state.raw<DeliveryEpisode[]>([]);
	let route = $state.raw(learner.policyRoute());
	let update = $state.raw<DeliveryUpdate | null>(null);
	let selected = $state(initialWorld.start),
		epsilon = $state(0.4);
	let view = $state<'policy' | 'trip' | 'visits'>('policy');
	let mode = $state<'batch' | 'watch' | 'compare' | null>(null);
	let live = $state.raw<DeliveryEpisode | null>(null);
	let comparisons = $state.raw<Run[]>([]);
	let comparisonIndex = $state<number | null>(null),
		budget = $state(200);
	let playing = $state(false),
		playbackStarted = $state(false),
		pathStep = $state(0);
	let citySize = $state({ width: 540, height: 420, gap: 5 });
	let timer: ReturnType<typeof setInterval> | undefined;
	let playTimer: ReturnType<typeof setInterval> | undefined;
	let mapElement: HTMLDivElement | undefined;
	const destinations = $derived(deliveryDestinations(world));
	const cells = $derived(Array.from({ length: world.width * world.height }, (_, cell) => cell));
	const scenarioInfo = $derived(deliveryScenarios.find((s) => s.id === scenario)!);
	const decisionStates = $derived(
		cells.filter((cell) => !world.blocked.includes(cell) && !isDelivery(world, cell))
	);
	const coverage = $derived(
		Math.round(
			(decisionStates.reduce((n, cell) => n + actionVisits[cell].filter((v) => v > 0).length, 0) /
				(decisionStates.length * 4)) *
				100
		)
	);
	const recent = $derived(episodes.slice(-20));
	const recentMean = $derived(
		recent.length ? recent.reduce((n, e) => n + e.reward, 0) / recent.length : null
	);
	const recentRandom = $derived(
		recent.length
			? recent.reduce((n, e) => n + e.exploration, 0) / recent.reduce((n, e) => n + e.steps, 0)
			: null
	);
	const displayed = $derived(view === 'trip' ? (live ?? episodes.at(-1) ?? route) : route);
	const visiblePath = $derived(
		playbackStarted ? displayed.path.slice(0, pathStep + 1) : displayed.path
	);
	const chosenValues = $derived(q[selected]);
	const terminal = $derived(isDelivery(world, selected));
	const maxVisits = $derived(Math.max(1, ...visits));
	const cellX = (cell: number) =>
		(((cell % world.width) + 0.5) * (citySize.width + citySize.gap)) / world.width -
		citySize.gap / 2;
	const cellY = (cell: number) =>
		((Math.floor(cell / world.width) + 0.5) * (citySize.height + citySize.gap)) / world.height -
		citySize.gap / 2;
	const currentCell = $derived(visiblePath.at(-1) ?? world.start);
	const courier = Tween.of(() => ({ x: cellX(currentCell), y: cellY(currentCell) }), {
		duration: () => (prefersReducedMotion.current ? 0 : 110)
	});
	const pathPoints = $derived(visiblePath.map((cell) => `${cellX(cell)},${cellY(cell)}`).join(' '));
	const curve = $derived.by(() => {
		const history = episodes.slice(-120);
		const min = Math.min(-1, ...history.map((e) => e.reward)),
			max = Math.max(18, ...history.map((e) => e.reward));
		return history
			.map(
				(e, i) =>
					`${(i / Math.max(1, history.length - 1)) * 400},${64 - ((e.reward - min) / (max - min)) * 58}`
			)
			.join(' ');
	});
	function measureCity(node: HTMLDivElement) {
		mapElement = node;
		const measure = () =>
			(citySize = {
				width: node.clientWidth,
				height: node.clientHeight,
				gap: parseFloat(getComputedStyle(node).columnGap) || 0
			});
		measure();
		const observer = new ResizeObserver(measure);
		observer.observe(node);
		return () => observer.disconnect();
	}
	function stop() {
		clearInterval(timer);
		mode = null;
	}
	function stopPlayback() {
		clearInterval(playTimer);
		playing = false;
	}
	function stopAll() {
		stop();
		stopPlayback();
	}
	function publish() {
		q = learner.q.map((row) => [...row]);
		visits = [...learner.visits];
		actionVisits = learner.actionVisits.map((row) => [...row]);
		route = learner.policyRoute();
		update = learner.lastUpdate;
	}
	function clearPlayback() {
		stopPlayback();
		playbackStarted = false;
		pathStep = 0;
	}
	function reset(nextScenario = scenario, nextToll = toll, nextSeed = seed) {
		stopAll();
		scenario = nextScenario;
		toll = nextToll;
		seed = nextSeed;
		world = deliveryScenario(scenario, toll);
		learner = new DeliveryLearner(world, seed);
		episodes = [];
		live = null;
		comparisons = [];
		comparisonIndex = null;
		selected = world.start;
		view = 'policy';
		clearPlayback();
		publish();
	}
	function changeExploration(value: number) {
		epsilon = value;
		comparisonIndex = null;
	}
	function changeView(next: typeof view) {
		clearPlayback();
		view = next;
	}
	function train() {
		if (mode === 'batch') return stop();
		stopAll();
		clearPlayback();
		live = null;
		comparisonIndex = null;
		mode = 'batch';
		const target = episodes.length + 200;
		timer = setInterval(() => {
			const batch = Array.from({ length: Math.min(5, target - episodes.length) }, () =>
				learner.trainEpisode(epsilon)
			);
			episodes = [...episodes, ...batch];
			publish();
			if (episodes.length >= target) stop();
		}, 60);
	}
	function watch() {
		if (mode === 'watch') return stop();
		stopAll();
		clearPlayback();
		view = 'trip';
		comparisonIndex = null;
		if (!live || live.success || live.steps >= 200)
			live = {
				reward: 0,
				discountedReward: 0,
				steps: 0,
				success: false,
				exploration: 0,
				path: [world.start],
				explored: [],
				outcome: null
			};
		mode = 'watch';
		timer = setInterval(() => {
			const episode = live!;
			const u = learner.trainTransition(episode.path.at(-1)!, epsilon);
			live = {
				reward: episode.reward + u.reward,
				discountedReward: episode.discountedReward + learner.discount ** episode.steps * u.reward,
				steps: episode.steps + 1,
				success: u.done,
				exploration: episode.exploration + Number(u.explore),
				path: [...episode.path, u.next],
				explored: [...episode.explored, u.explore],
				outcome: u.done ? u.next : null
			};
			publish();
			if (live.success || live.steps >= 200) {
				episodes = [...episodes, live];
				stop();
			}
		}, 150);
	}
	function learnMove(action?: number) {
		stopAll();
		clearPlayback();
		live = null;
		comparisonIndex = null;
		learner.trainTransition(selected, epsilon, action);
		publish();
	}
	function playRoute() {
		if (playing) return stopPlayback();
		if (!playbackStarted || pathStep >= displayed.path.length - 1) pathStep = 0;
		playbackStarted = true;
		playing = true;
		playTimer = setInterval(() => {
			pathStep++;
			if (pathStep >= displayed.path.length - 1) stopPlayback();
		}, 180);
	}
	function selectRun(index: number, reveal = true) {
		stopAll();
		clearPlayback();
		const run = comparisons[index];
		// Clone the snapshot, so continuing a run never rewrites its comparison result.
		learner = run.learner.clone();
		episodes = [...run.episodes];
		epsilon = run.epsilon;
		live = null;
		comparisonIndex = index;
		view = 'policy';
		publish();
		if (reveal && mapElement) {
			const bounds = mapElement.getBoundingClientRect();
			if (bounds.top < 90 || bounds.bottom > window.innerHeight)
				mapElement.scrollIntoView({
					behavior: prefersReducedMotion.current ? 'instant' : 'smooth',
					block: 'center'
				});
		}
	}
	function compare() {
		if (mode === 'compare') return stop();
		stopAll();
		clearPlayback();
		live = null;
		mode = 'compare';
		comparisonIndex = null;
		const runs: Run[] = [0, 0.4, 0.8].map((epsilon) => ({
			epsilon,
			learner: new DeliveryLearner(world, seed),
			episodes: []
		}));
		comparisons = runs;
		timer = setInterval(() => {
			for (const run of runs) {
				const count = Math.min(20, budget - run.episodes.length);
				for (let i = 0; i < count; i++) run.episodes.push(run.learner.trainEpisode(run.epsilon));
			}
			comparisons = runs.map((run) => ({ ...run, episodes: [...run.episodes] }));
			if (runs[0].episodes.length >= budget) {
				stop();
				selectRun(1, false);
			}
		}, 40);
	}
	const outcomeName = (episode: DeliveryEpisode) =>
		episode.success
			? `Delivery ${destinations.find((d) => d.cell === episode.outcome)?.label}`
			: 'Not solved yet';
	onDestroy(stopAll);
</script>

<svelte:document
	onvisibilitychange={() => {
		if (document.hidden) stopAll();
	}}
/>

<section class="reinforcement-lab" aria-label="Explore and exploit with real Q-learning">
	<header class="rl-heading">
		<div>
			<span class="small-overline">EXPERIENCE CHANGES THE ROUTE</span>
			<h3>You only find the paths you try.</h3>
		</div>
		<button
			class="fresh-run"
			onclick={() => reset(scenario, toll, seed + 1)}
			disabled={mode !== null}
			><PatternIcon name="shuffle" size={15} />New seed <span>{seed}</span></button
		>
	</header>
	<div class="world-picker" role="group" aria-label="Delivery environment">
		{#each deliveryScenarios as item (item.id)}<button
				aria-pressed={scenario === item.id}
				onclick={() => reset(item.id)}>{item.name}</button
			>{/each}
	</div>
	<p class="scenario-description">{scenarioInfo.description}</p>
	<div class="rl-training-bar">
		<label class="exploration-control"
			><span>Exploration <output>{Math.round(epsilon * 100)}%</output></span><input
				type="range"
				min="0"
				max="1"
				step=".05"
				aria-label="Exploration"
				disabled={mode === 'compare'}
				bind:value={() => epsilon, changeExploration}
			/><small
				>{Math.round(epsilon * 100)}% random actions; otherwise choose a best-valued move. Equal
				values break ties randomly.</small
			></label
		>
		<div class="rl-actions">
			<button class="run-button" disabled={mode !== null && mode !== 'batch'} onclick={train}
				><PatternIcon name={mode === 'batch' ? 'pause' : 'play'} size={16} />{mode === 'batch'
					? 'Pause training'
					: episodes.length
						? 'Train 200 more'
						: 'Train 200 episodes'}</button
			><button class="watch-button" disabled={mode !== null && mode !== 'watch'} onclick={watch}
				><PatternIcon name={mode === 'watch' ? 'pause' : 'eye'} size={15} />{mode === 'watch'
					? 'Pause trip'
					: live && !live.success && live.steps < 200
						? 'Resume trip'
						: 'Watch one trip'}</button
			>
		</div>
	</div>
	<p class="exploration-note">
		Exploration changes the next training moves; it preserves existing knowledge. Compare fresh
		agents below for a fair test.
	</p>
	<div class="rl-workspace">
		<div class="rl-map-panel">
			<div class="map-toolbar">
				<div role="group" aria-label="Map view">
					{#each [{ id: 'policy', label: 'Best policy' }, { id: 'trip', label: 'Training trip' }, { id: 'visits', label: 'Visits' }] as item (item.id)}<button
							aria-pressed={view === item.id}
							disabled={mode === 'watch'}
							onclick={() => changeView(item.id as typeof view)}>{item.label}</button
						>{/each}
				</div>
				<span>{episodes.length.toLocaleString()} episodes</span>
			</div>
			<div class="city-grid" style:--columns={world.width} {@attach measureCity}>
				{#each cells as cell (cell)}
					{@const blocked = world.blocked.includes(cell)}{@const traffic =
						world.traffic.includes(cell)}{@const destination = destinations.find(
						(d) => d.cell === cell
					)}{@const value = Math.max(...q[cell])}
					<button
						class="city-cell"
						class:blocked
						class:traffic
						class:chosen={selected === cell}
						class:destination={!!destination}
						class:start={cell === world.start}
						style:--heat={view === 'visits'
							? Math.sqrt(visits[cell] / maxVisits) * 0.55
							: Math.max(0, value / 18) * 0.22}
						disabled={blocked}
						aria-pressed={selected === cell}
						aria-label={`${cell === world.start ? 'Start, ' : destination ? `Delivery ${destination.label}, reward ${destination.reward}, ` : ''}row ${Math.floor(cell / world.width) + 1}, column ${(cell % world.width) + 1}${blocked ? ', closed road' : traffic ? ', toll crossing' : ''}. ${visits[cell]} visits.`}
						onclick={() => (selected = cell)}
					>
						{#if destination}<b>{destination.label}</b><small>+{destination.reward}</small
							>{:else if cell === world.start}<PatternIcon
								name="reinforcement"
								size={17}
							/>{:else if !blocked && view === 'visits'}<span class="visit-count"
								>{visits[cell] || '·'}</span
							>{:else if !blocked && visits[cell]}
							<svg
								class="policy-arrow"
								viewBox="0 0 24 24"
								aria-hidden="true"
								style:rotate={`${q[cell].indexOf(value) * 90}deg`}
								><path d="M12 18V6m-4 4 4-4 4 4" /></svg
							>
						{:else if !blocked}<i class="unlearned-dot"></i>{/if}
					</button>
				{/each}
				{#if view !== 'visits' && (episodes.length || live)}
					<svg
						class="route-overlay"
						viewBox={`0 0 ${citySize.width} ${citySize.height}`}
						aria-hidden="true"
					>
						<polyline points={pathPoints} class:trip={view === 'trip'} />
						{#if view === 'trip'}{#each visiblePath.slice(1) as cell, i (i)}{#if displayed.explored[i]}<line
										x1={cellX(visiblePath[i])}
										y1={cellY(visiblePath[i])}
										x2={cellX(cell)}
										y2={cellY(cell)}
										class="explored-step"
									/>{/if}{/each}{/if}
						{#if playing || mode === 'watch'}<circle
								class="courier"
								cx={courier.current.x}
								cy={courier.current.y}
								r="8"
							/>{/if}
					</svg>
				{/if}
			</div>
			<div class="map-legend">
				<span><i class="toll-key"></i>Toll −{toll.toFixed(1)}</span><span
					><i class="wall-key"></i>Closed</span
				><span><i class="policy-key"></i>Greedy move</span><span
					><i class="explore-key"></i>Random move</span
				>
			</div>
			<div class="route-summary" role="status">
				<div>
					<strong
						>{view === 'trip'
							? mode === 'watch'
								? 'Learning one move at a time'
								: outcomeName(displayed)
							: view === 'visits'
								? `${coverage}% of action choices tried`
								: episodes.length
									? outcomeName(route)
									: 'No route has been supplied'}</strong
					><span
						>{view === 'policy'
							? 'Greedy evaluation · no random actions'
							: view === 'trip'
								? `${displayed.steps} moves · ${displayed.exploration} random choices`
								: 'Darker cells have more visits'}</span
					>
				</div>
				<button
					class="route-play"
					disabled={!episodes.length || mode !== null || view === 'visits'}
					onclick={playRoute}
					><PatternIcon name={playing ? 'pause' : 'play'} size={15} />{playing
						? 'Pause route'
						: playbackStarted && pathStep < displayed.path.length - 1
							? 'Resume route'
							: 'Replay route'}</button
				>
			</div>
			<div class="cell-inspector">
				<div class="inspector-heading">
					<span
						>Street {Math.floor(selected / world.width) + 1}, {(selected % world.width) + 1} · four Q-values</span
					><button disabled={terminal || mode !== null} onclick={() => learnMove()}
						><PatternIcon name="next" size={13} />Try a move</button
					>
				</div>
				<div class="action-trials">
					{#each deliveryActions as action, i (action)}<button
							disabled={terminal || mode !== null}
							onclick={() => learnMove(i)}
							><span>{action}</span><strong>{chosenValues[i].toFixed(2)}</strong><small
								>{actionVisits[selected][i]} tries</small
							></button
						>{/each}
				</div>
			</div>
		</div>
		<aside class="rl-controls">
			<div class="policy-metrics">
				<div>
					<span>Best policy</span><strong
						>{route.success ? route.steps : '—'}<small>moves</small></strong
					>
				</div>
				<div>
					<span>Discounted return</span><strong
						>{route.success ? route.discountedReward.toFixed(2) : '—'}</strong
					>
				</div>
			</div>
			<p class="discount-note">
				Q-learning values earlier rewards more: each step discounts future reward by 5%. A shorter
				paid route can beat a long free one.
			</p>
			<div class="experience-stats">
				<span>Actions tried <b>{coverage}%</b></span><span
					>Recent random moves <b
						>{recentRandom === null ? '—' : `${Math.round(recentRandom * 100)}%`}</b
					></span
				>
			</div>
			<div class="return-heading">
				<span>Training return</span><b
					>{recentMean === null ? '—' : recentMean.toFixed(2)}<small>mean of last 20</small></b
				>
			</div>
			<svg
				class="return-chart"
				viewBox="0 0 400 70"
				preserveAspectRatio="none"
				role="img"
				aria-label="Net reward per training episode, including random actions"
				><polyline points={curve} /></svg
			>
			<label class="toll-control"
				><span>Toll cost<output>−{toll.toFixed(1)}</output></span><input
					type="range"
					min="0"
					max="4"
					step=".2"
					aria-label="Toll cost"
					value={toll}
					oninput={(event) => reset(scenario, +event.currentTarget.value)}
				/><small>Changing rewards starts a fresh learner.</small></label
			>
			<div class="reset-row">
				<span>Each move −0.15 · wall −0.8</span><button onclick={() => reset()}
					>Reset learning</button
				>
			</div>
		</aside>
	</div>
	<section class="exploration-comparison" aria-label="Compare exploration rates">
		<div class="compare-heading">
			<div>
				<h4>Same city. Different experience.</h4>
				<p>Fresh agents, the same seed, and the same episode budget.</p>
			</div>
			<div class="compare-actions">
				<div role="group" aria-label="Comparison budget">
					{#each [200, 2000] as n (n)}<button
							aria-pressed={budget === n}
							disabled={mode !== null}
							onclick={() => (budget = n)}>{n.toLocaleString()}</button
						>{/each}
				</div>
				<button
					class="compare-button"
					disabled={mode !== null && mode !== 'compare'}
					onclick={compare}
					><PatternIcon name={mode === 'compare' ? 'pause' : 'layers'} size={15} />{mode ===
					'compare'
						? 'Pause'
						: 'Compare'}</button
				>
			</div>
		</div>
		{#if comparisons.length}<div class="comparison-cards">
				{#each comparisons as run, index (run.epsilon)}{@const r =
						run.learner.policyRoute()}{@const tried = run.learner.actionVisits
						.flat()
						.filter((v) => v > 0).length}{@const random = run.episodes.reduce(
						(n, e) => n + e.exploration,
						0
					)}{@const steps = run.episodes.reduce((n, e) => n + e.steps, 0)}
					<button
						aria-pressed={comparisonIndex === index}
						disabled={mode !== null}
						onclick={() => selectRun(index)}
						aria-label={`Inspect ${Math.round(run.epsilon * 100)}% exploration result`}
						><div class="comparison-label">
							<strong>{Math.round(run.epsilon * 100)}%<small>exploration</small></strong
							><PatternIcon name={comparisonIndex === index ? 'check' : 'arrowUpRight'} size={16} />
						</div>
						<div class="comparison-result">
							<b>{r.success ? `${r.steps} moves` : 'Still searching'}</b><span
								>{r.success ? `Value ${r.discountedReward.toFixed(2)}` : 'No complete policy'}</span
							>
						</div>
						<p>
							{Math.round((tried / (decisionStates.length * 4)) * 100)}% of actions tried · {steps
								? Math.round((random / steps) * 100)
								: 0}% random moves
						</p>
						<small
							>{run.episodes.length.toLocaleString()} episodes · {run.episodes
								.filter((e) => e.outcome === world.goal)
								.length.toLocaleString()} deliveries to B</small
						></button
					>
				{/each}
			</div>{/if}
		<p class="comparison-note">
			More exploration can uncover a better route, while lowering reward during training. With
			enough experience, different agents may learn the same policy.
		</p>
	</section>
	<details class="q-explanation">
		<summary
			><PatternIcon name="grid" size={17} /><span>Inside the latest Q-learning update</span
			><PatternIcon name="chevronDown" size={15} /></summary
		>
		<div class="q-detail">
			{#if update}<div class="transition-story">
					<b
						>{update.forced
							? 'Your chosen action'
							: update.explore
								? 'Explore · a random action'
								: 'Exploit · a highest-valued action'}</b
					><span
						>{deliveryActions[update.action]} from street {Math.floor(update.state / world.width) +
							1}, {(update.state % world.width) + 1} · reward {update.reward.toFixed(2)}</span
					>
				</div>
				<div class="update-formula">
					<span><small>Old Q</small>{update.oldValue.toFixed(3)}</span><b>+</b><span
						><small>Learning rate</small>0.25</span
					><b>×</b><span
						><small>Target − old Q</small>({update.target.toFixed(3)} − {update.oldValue.toFixed(
							3
						)})</span
					><b>=</b><span class="new-value"><small>New Q</small>{update.newValue.toFixed(3)}</span>
				</div>
				<p>
					Target = {update.reward.toFixed(2)} + 0.95 × {update.future.toFixed(3)}. {update.done
						? 'A delivery ends the episode, so future value is zero.'
						: 'The last term is the best next-state value.'} Only this one table entry changes.
				</p>{:else}<p>
					All Q-values start at zero. Select a street and try an action, or watch a training trip to
					see the actual update.
				</p>{/if}
		</div>
	</details>
	<p class="rl-footnote">
		Tabular Q-learning. Any delivery ends an episode; unfinished trips stop at 200 moves. The
		environment is deterministic. Exploration and tie-breaking are random, with a reproducible seed.
	</p>
</section>

<style>
	.reinforcement-lab {
		margin: 24px 0;
		padding: clamp(20px, 3vw, 32px);
		background: var(--surface);
		border-radius: 24px;
		container-type: inline-size;
	}
	.rl-heading {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 20px;
		margin-bottom: 22px;
	}
	.small-overline {
		font-size: 9px;
		color: var(--quiet);
	}
	h3 {
		font: italic clamp(29px, 3vw, 41px)/1.12 var(--serif);
		margin: 8px 0 0;
	}
	.fresh-run {
		display: flex;
		align-items: center;
		gap: 7px;
		background: none;
		border: 0;
		padding: 8px 0;
		color: var(--muted);
		font-size: 11px;
		white-space: nowrap;
	}
	.fresh-run span {
		font: 10px var(--mono);
		color: var(--quiet);
	}
	.world-picker {
		display: flex;
		gap: 4px;
		padding: 4px;
		background: var(--lab-inset);
		border-radius: 11px;
		width: fit-content;
	}
	.world-picker button,
	.map-toolbar button,
	.compare-actions button {
		padding: 8px 12px;
		border: 0;
		border-radius: 8px;
		background: none;
		color: var(--muted);
		font-size: 12px;
		white-space: nowrap;
	}
	.world-picker button[aria-pressed='true'],
	.map-toolbar button[aria-pressed='true'],
	.compare-actions button[aria-pressed='true'] {
		background: var(--selection-fill);
		color: var(--selection-ink);
	}
	.scenario-description {
		font-size: 12px;
		line-height: 1.65;
		color: var(--muted);
		margin: 12px 0 24px;
		max-width: 88ch;
	}
	.rl-training-bar {
		display: grid;
		grid-template-columns: minmax(240px, 1fr) auto;
		gap: 32px;
		align-items: center;
	}
	.rl-training-bar .exploration-control {
		max-width: 460px;
	}
	.rl-training-bar .rl-actions {
		min-width: 350px;
	}
	.reinforcement-lab > .exploration-note {
		margin: 10px 0 22px;
	}
	.rl-workspace {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 280px;
		gap: 26px;
		align-items: start;
	}
	.rl-map-panel {
		min-width: 0;
	}
	.map-toolbar {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 12px;
		margin-bottom: 18px;
	}
	.map-toolbar > div {
		display: flex;
		gap: 3px;
	}
	.map-toolbar button {
		font-size: 11px;
		padding: 7px 9px;
	}
	.map-toolbar > span {
		font: 10px var(--mono);
		color: var(--quiet);
		white-space: nowrap;
	}
	.city-grid {
		display: grid;
		grid-template-columns: repeat(var(--columns), minmax(0, 1fr));
		gap: 5px;
		position: relative;
		width: 100%;
		max-width: 610px;
		margin-inline: auto;
	}
	.city-cell {
		position: relative;
		aspect-ratio: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 0;
		border: 0;
		border-radius: 7px;
		background:
			linear-gradient(
				color-mix(in srgb, var(--chart-blue) calc(var(--heat) * 100%), transparent),
				color-mix(in srgb, var(--chart-blue) calc(var(--heat) * 100%), transparent)
			),
			var(--lab-inset);
		color: var(--chart-blue);
		transition:
			background 180ms,
			box-shadow 180ms;
	}
	.city-cell.chosen {
		box-shadow: inset 0 0 0 1.5px var(--locator);
	}
	.city-cell.traffic {
		background: color-mix(in srgb, var(--chart-amber) 17%, var(--lab-inset));
		color: var(--chart-amber);
	}
	.city-cell.blocked {
		background: repeating-linear-gradient(
			-45deg,
			var(--surface-raised),
			var(--surface-raised) 1px,
			var(--lab-inset) 1px,
			var(--lab-inset) 6px
		);
		opacity: 0.55;
	}
	.city-cell.destination {
		background: var(--action-gradient);
		color: var(--control-ink);
	}
	.city-cell.destination b {
		font: 22px var(--serif);
	}
	.city-cell.destination small {
		font: 10px var(--mono);
	}
	.city-cell.start {
		background: var(--selection-fill);
		color: var(--selection-ink);
	}
	.policy-arrow {
		width: 22px;
		height: 22px;
		transition: rotate 180ms;
		fill: none;
		stroke: currentColor;
		stroke-width: 1.5;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.unlearned-dot {
		width: 3px;
		height: 3px;
		background: var(--quiet);
		border-radius: 50%;
		opacity: 0.5;
	}
	.visit-count {
		font: 11px var(--mono);
	}
	.route-overlay {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		pointer-events: none;
		overflow: visible;
	}
	.route-overlay polyline {
		fill: none;
		stroke: var(--chart-blue);
		stroke-width: 2.5;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.route-overlay polyline.trip {
		opacity: 0.65;
		stroke-width: 2;
	}
	.explored-step {
		stroke: var(--chart-lavender);
		stroke-width: 2.5;
		stroke-dasharray: 4 3;
	}
	.courier {
		fill: none;
		stroke: var(--locator);
		stroke-width: 2.5;
	}
	.map-legend {
		display: flex;
		gap: 13px;
		flex-wrap: wrap;
		margin-top: 14px;
		color: var(--quiet);
		font-size: 9px;
	}
	.map-legend span {
		display: flex;
		gap: 5px;
		align-items: center;
	}
	.map-legend i {
		display: block;
		width: 7px;
		height: 7px;
		border-radius: 2px;
	}
	.toll-key {
		background: var(--chart-amber);
	}
	.wall-key {
		background: var(--quiet);
	}
	.policy-key {
		background: var(--chart-blue);
	}
	.explore-key {
		background: var(--chart-lavender);
	}
	.route-summary {
		display: flex;
		gap: 15px;
		align-items: center;
		justify-content: space-between;
		margin-top: 18px;
	}
	.route-summary > div {
		display: grid;
		gap: 5px;
	}
	.route-summary strong {
		font-size: 13px;
		font-weight: 550;
	}
	.route-summary span {
		font-size: 10px;
		color: var(--quiet);
	}
	.route-play {
		display: flex;
		align-items: center;
		gap: 6px;
		background: none;
		color: var(--blue);
		padding: 7px 0;
		border: 0;
		font-size: 11px;
		white-space: nowrap;
	}
	.cell-inspector {
		margin-top: 22px;
	}
	.inspector-heading {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		color: var(--muted);
		font-size: 10px;
	}
	.inspector-heading button {
		display: flex;
		gap: 5px;
		align-items: center;
		padding: 5px 0;
		border: 0;
		color: var(--blue);
		background: none;
		font-size: 10px;
	}
	.action-trials {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 6px;
		margin-top: 9px;
	}
	.action-trials button {
		display: grid;
		gap: 5px;
		text-align: left;
		padding: 10px 12px;
		background: var(--lab-inset);
		border: 0;
		border-radius: 10px;
		color: var(--muted);
		font-size: 10px;
	}
	.action-trials strong {
		font: 16px var(--mono);
		color: var(--blue);
	}
	.action-trials small {
		font-size: 9px;
		color: var(--quiet);
	}
	.rl-controls {
		min-width: 0;
		padding: 20px;
		background: var(--lab-inset);
		border-radius: 16px;
	}
	.rl-controls label,
	.rl-training-bar label {
		display: block;
	}
	.rl-controls label > span,
	.rl-training-bar label > span {
		display: flex;
		align-items: center;
		justify-content: space-between;
		color: var(--ink);
		font-size: 12px;
	}
	.rl-controls output,
	.rl-training-bar output {
		font: 13px var(--mono);
		color: var(--blue);
	}
	.rl-controls input,
	.rl-training-bar input {
		width: 100%;
		margin: 12px 0 5px;
		padding: 0;
		height: 22px;
		min-height: 22px;
	}
	.rl-controls label small,
	.rl-training-bar label small {
		font-size: 10px;
		line-height: 1.6;
		color: var(--muted);
		display: block;
	}
	.rl-actions {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 7px;
		margin-top: 0;
	}
	.rl-actions button {
		display: flex;
		gap: 8px;
		align-items: center;
		justify-content: center;
		min-height: 40px;
		padding: 8px 12px;
		border: 0;
		border-radius: 9px;
		font-size: 12px;
	}
	.run-button {
		background: var(--action-gradient);
		color: var(--control-ink);
	}
	.watch-button {
		background: var(--surface-raised);
		color: var(--ink);
	}
	.exploration-note,
	.discount-note {
		font-size: 10px;
		line-height: 1.65;
		color: var(--quiet);
		margin: 12px 0 0;
	}
	.policy-metrics {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 12px;
		margin-top: 0;
	}
	.policy-metrics > div {
		display: grid;
		gap: 8px;
	}
	.policy-metrics span {
		font-size: 10px;
		color: var(--muted);
	}
	.policy-metrics strong {
		font: 24px var(--mono);
		color: var(--ink);
	}
	.policy-metrics strong small {
		font: 10px var(--sans);
		color: var(--muted);
		margin-left: 5px;
	}
	.experience-stats {
		display: grid;
		gap: 9px;
		font-size: 10px;
		color: var(--muted);
		margin-top: 22px;
	}
	.experience-stats span {
		display: flex;
		justify-content: space-between;
		gap: 8px;
	}
	.experience-stats b {
		font: 11px var(--mono);
		color: var(--blue);
	}
	.return-heading {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-size: 10px;
		color: var(--muted);
		margin-top: 20px;
	}
	.return-heading b {
		font: 13px var(--mono);
		color: var(--ink);
		text-align: right;
	}
	.return-heading small {
		display: block;
		font: 9px var(--sans);
		color: var(--quiet);
		margin-top: 4px;
	}
	.return-chart {
		display: block;
		width: 100%;
		height: 62px;
		margin: 8px 0 20px;
		overflow: visible;
	}
	.return-chart polyline {
		stroke: var(--chart-blue);
		fill: none;
		stroke-width: 1.2;
		vector-effect: non-scaling-stroke;
	}
	.reset-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 10px;
		color: var(--quiet);
		font-size: 9px;
		margin-top: 15px;
	}
	.reset-row button {
		padding: 4px 0;
		border: 0;
		background: none;
		color: var(--muted);
		font-size: 10px;
	}
	.exploration-comparison {
		margin-top: 28px;
	}
	.compare-heading {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 18px;
	}
	h4 {
		font-size: 18px;
		font-weight: 500;
		margin: 0 0 7px;
		letter-spacing: -0.02em;
	}
	.compare-heading p {
		margin: 0;
		color: var(--muted);
		font-size: 11px;
	}
	.compare-actions {
		display: flex;
		gap: 10px;
		align-items: center;
	}
	.compare-actions > div {
		display: flex;
		gap: 3px;
		background: var(--lab-inset);
		padding: 3px;
		border-radius: 9px;
	}
	.compare-actions .compare-button {
		display: flex;
		align-items: center;
		gap: 6px;
		background: var(--action-gradient);
		color: var(--control-ink);
		padding: 10px 14px;
	}
	.comparison-cards {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 10px;
		margin-top: 18px;
	}
	.comparison-cards > button {
		text-align: left;
		padding: 16px;
		background: var(--lab-inset);
		border: 1px solid transparent;
		border-radius: 13px;
		color: var(--ink);
		transition:
			background 180ms,
			border-color 180ms;
	}
	.comparison-cards > button[aria-pressed='true'] {
		border-color: var(--blue);
		background: color-mix(in srgb, var(--blue) 7%, var(--lab-inset));
	}
	.comparison-label {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}
	.comparison-label strong {
		font: 22px var(--mono);
		color: var(--blue);
	}
	.comparison-label small {
		font: 10px var(--sans);
		color: var(--muted);
		margin-left: 6px;
	}
	.comparison-result {
		display: flex;
		justify-content: space-between;
		gap: 10px;
		margin-top: 15px;
		font-size: 12px;
	}
	.comparison-result b {
		font-weight: 550;
	}
	.comparison-result span {
		color: var(--lavender);
		font-family: var(--mono);
		font-size: 11px;
	}
	.comparison-cards p {
		font-size: 10px;
		color: var(--muted);
		line-height: 1.6;
		margin: 9px 0 6px;
	}
	.comparison-cards > button > small {
		font-size: 9px;
		color: var(--quiet);
	}
	.comparison-note {
		color: var(--muted);
		font-size: 11px;
		line-height: 1.65;
		margin: 14px 0 0;
	}
	.q-explanation {
		margin-top: 23px;
		background: var(--lab-inset);
		border-radius: 12px;
	}
	.q-explanation summary {
		list-style: none;
		display: flex;
		gap: 10px;
		align-items: center;
		font-size: 12px;
		color: var(--muted);
		cursor: pointer;
		padding: 14px 16px;
	}
	.q-explanation summary::-webkit-details-marker {
		display: none;
	}
	.q-explanation summary span {
		flex: 1;
	}
	.q-detail {
		padding: 4px 20px 18px;
	}
	.transition-story {
		display: grid;
		gap: 6px;
		font-size: 12px;
		color: var(--muted);
	}
	.transition-story b {
		color: var(--lavender);
		font-weight: 500;
	}
	.update-formula {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 14px;
		font: 15px var(--mono);
		padding: 20px 0 0;
	}
	.update-formula small {
		display: block;
		margin-bottom: 8px;
		font: 10px var(--sans);
		color: var(--muted);
	}
	.update-formula > b {
		font-weight: 400;
		padding-top: 20px;
		color: var(--quiet);
	}
	.new-value {
		color: var(--blue);
	}
	.q-detail p,
	.rl-footnote {
		color: var(--quiet);
		font-size: 10px;
		line-height: 1.7;
	}
	.rl-footnote {
		margin: 16px 0 0;
	}
	button:disabled {
		opacity: 0.45;
		cursor: default;
	}
	button:not(:disabled):hover {
		filter: brightness(1.06);
	}
	@container (max-width:850px) {
		.rl-workspace {
			grid-template-columns: minmax(0, 1fr) 250px;
			gap: 20px;
		}
		.rl-controls {
			padding: 16px;
		}
		.map-toolbar {
			flex-wrap: wrap;
			gap: 8px;
		}
		.comparison-result {
			flex-direction: column;
			gap: 5px;
		}
		.comparison-cards > button {
			padding: 13px;
		}
	}
	@container (max-width:650px) {
		.rl-training-bar {
			grid-template-columns: 1fr;
			gap: 14px;
		}
		.rl-training-bar .rl-actions {
			min-width: 0;
		}
		.rl-training-bar .exploration-control {
			max-width: none;
		}
		.rl-workspace {
			grid-template-columns: 1fr;
		}
		.rl-controls {
			display: grid;
			grid-template-columns: 1fr 1fr;
			gap: 16px 22px;
		}
		.rl-controls .reset-row {
			grid-column: 1/-1;
		}
		.rl-actions {
			grid-template-columns: 1fr 1fr;
			margin: 0;
		}

		.policy-metrics {
			margin-top: 0;
		}
		.discount-note {
			margin: 0;
		}
		.experience-stats {
			margin: 0;
		}
		.return-heading {
			margin: 0;
		}
		.return-chart {
			grid-column: 1 / -1;
			margin: 0;
		}
		.toll-control {
			grid-column: 1/-1;
		}
		.rl-controls .reset-row {
			margin: 0;
		}
		.compare-heading {
			flex-wrap: wrap;
		}
		.fresh-run {
			font-size: 10px;
		}
		.rl-heading {
			align-items: flex-start;
		}
		.rl-heading h3 {
			max-width: 300px;
		}
		.comparison-label {
			align-items: flex-start;
		}
		.comparison-label strong {
			font-size: 20px;
		}
		.comparison-label small {
			display: block;
			margin: 5px 0 0;
		}
		.comparison-cards {
			gap: 7px;
		}
		.comparison-cards p {
			font-size: 9px;
		}
		.map-toolbar > span {
			margin-left: auto;
		}
		.city-grid {
			max-width: 540px;
		}
	}
	@container (max-width:400px) {
		.rl-heading {
			flex-direction: column;
			gap: 9px;
		}
		.fresh-run {
			padding: 0;
		}
		.world-picker {
			width: 100%;
		}
		.world-picker button {
			flex: 1;
			padding: 8px 6px;
			font-size: 11px;
		}
		.rl-actions button {
			font-size: 11px;
			padding-inline: 8px;
			gap: 5px;
		}
		.city-grid {
			gap: 3px;
		}
		.city-cell {
			border-radius: 4px;
		}
		.city-cell.destination b {
			font-size: 17px;
		}
		.city-cell.destination small {
			font-size: 8px;
		}
		.policy-arrow {
			width: 18px;
			height: 18px;
		}
		.visit-count {
			font-size: 8px;
		}
		.map-legend {
			gap: 9px;
			font-size: 8px;
		}
		.route-summary {
			align-items: flex-start;
		}
		.route-summary strong {
			font-size: 12px;
		}
		.route-play {
			font-size: 10px;
		}
		.action-trials button {
			padding: 8px;
		}
		.action-trials strong {
			font-size: 13px;
		}
		.comparison-cards {
			grid-template-columns: 1fr;
		}
		.comparison-cards > button {
			display: grid;
			grid-template-columns: 1fr 1fr;
			gap: 5px 10px;
		}
		.comparison-label strong small {
			display: inline;
			margin-left: 5px;
		}
		.comparison-result {
			margin: 0;
			text-align: right;
		}
		.comparison-cards p {
			margin: 5px 0 0;
			grid-column: 1/-1;
		}
		.comparison-cards > button > small {
			grid-column: 1/-1;
		}
		.rl-controls {
			gap: 14px;
		}
		.policy-metrics strong {
			font-size: 19px;
		}
		.policy-metrics {
			gap: 7px;
		}
		.discount-note {
			font-size: 9px;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.city-cell,
		.policy-arrow,
		.comparison-cards > button {
			transition: none;
		}
	}
</style>
