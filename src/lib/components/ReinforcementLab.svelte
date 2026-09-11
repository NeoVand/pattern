<script lang="ts">
	import { onDestroy } from 'svelte';
	import PatternIcon from '$lib/components/PatternIcon.svelte';
	import {
		DeliveryLearner,
		deliveryActions,
		deliveryWorld,
		type DeliveryEpisode
	} from '$lib/ml/delivery-learning';
	let roadworks = $state(false);
	let world = $state.raw(deliveryWorld());
	let learner = new DeliveryLearner(deliveryWorld());
	let q = $state.raw(learner.q.map((row) => [...row]));
	let visits = $state.raw([...learner.visits]);
	let episodes = $state.raw<DeliveryEpisode[]>([]);
	let route = $state.raw(learner.policyRoute());
	let epsilon = $state(0.25);
	let selected = $state(28);
	let training = $state(false);
	let playing = $state(false);
	let pathStep = $state(0);
	let showPath = $state(false);
	let timer: ReturnType<typeof setInterval> | undefined;
	let playTimer: ReturnType<typeof setInterval> | undefined;
	const cells = Array.from({ length: 35 }, (_, id) => id);
	const recent = $derived(episodes.slice(-20));
	const recentReturn = $derived(
		recent.length ? recent.reduce((sum, episode) => sum + episode.reward, 0) / recent.length : null
	);
	const recentSuccess = $derived(
		recent.length ? recent.filter((episode) => episode.success).length / recent.length : null
	);
	const chosenValues = $derived(q[selected]);
	const bestAction = $derived(chosenValues.indexOf(Math.max(...chosenValues)));
	const currentCell = $derived(route.path[Math.min(pathStep, route.path.length - 1)]);
	const pathPoints = $derived(
		(playing ? route.path.slice(0, pathStep + 1) : route.path)
			.map((cell) => `${(cell % 7) * 100 + 50},${Math.floor(cell / 7) * 100 + 50}`)
			.join(' ')
	);
	const curve = $derived.by(() => {
		const history = episodes.slice(-150);
		const minimum = Math.min(-1, ...history.map((episode) => episode.reward));
		const maximum = Math.max(10, ...history.map((episode) => episode.reward));
		return {
			minimum,
			maximum,
			points: history
				.map(
					(episode, index) =>
						`${(index / Math.max(1, history.length - 1)) * 400},${75 - ((episode.reward - minimum) / (maximum - minimum)) * 70}`
				)
				.join(' ')
		};
	});
	function stop() {
		clearInterval(timer);
		training = false;
	}
	function stopPlayback() {
		clearInterval(playTimer);
		playing = false;
	}
	function publish() {
		q = learner.q.map((row) => [...row]);
		visits = [...learner.visits];
		route = learner.policyRoute();
	}
	function train() {
		if (training) return stop();
		stopPlayback();
		showPath = false;
		training = true;
		const target = episodes.length + 300;
		timer = setInterval(() => {
			const batch = Array.from({ length: Math.min(5, target - episodes.length) }, () =>
				learner.trainEpisode(epsilon)
			);
			episodes = [...episodes, ...batch];
			publish();
			if (episodes.length >= target) {
				stop();
				showPath = true;
			}
		}, 55);
	}
	function reset(nextRoadworks = roadworks) {
		stop();
		stopPlayback();
		roadworks = nextRoadworks;
		world = deliveryWorld(nextRoadworks);
		learner = new DeliveryLearner(world);
		episodes = [];
		selected = world.start;
		pathStep = 0;
		showPath = false;
		publish();
	}
	function playRoute() {
		if (playing) return stopPlayback();
		showPath = true;
		pathStep = 0;
		playing = true;
		playTimer = setInterval(() => {
			pathStep++;
			if (pathStep >= route.path.length - 1) stopPlayback();
		}, 230);
	}
	onDestroy(() => {
		stop();
		stopPlayback();
	});
</script>

<div class="reinforcement-lab">
	<div class="delivery-layout">
		<div class="delivery-stage">
			<div class="delivery-stage-heading">
				<span>LEARNING BY CONSEQUENCE</span><span>{episodes.length.toLocaleString()} episodes</span>
			</div>
			<div class="city-grid">
				{#each cells as cell (cell)}
					{@const isBlocked = world.blocked.includes(cell)}
					{@const isTraffic = world.traffic.includes(cell)}
					{@const value = Math.max(...q[cell])}
					<button
						class="city-cell"
						class:blocked={isBlocked}
						class:traffic={isTraffic}
						class:chosen={selected === cell}
						class:endpoint={cell === world.start || cell === world.goal}
						style:--value-opacity={Math.max(0, Math.min(0.36, (value / 10) * 0.36))}
						disabled={isBlocked}
						aria-pressed={selected === cell}
						aria-label={`${cell === world.start ? 'Start, ' : cell === world.goal ? 'Delivery, ' : ''}row ${Math.floor(cell / 7) + 1}, column ${(cell % 7) + 1}${isBlocked ? ', closed road' : isTraffic ? ', traffic' : ''}. ${visits[cell] ? `Best learned value ${value.toFixed(2)}, action ${deliveryActions[q[cell].indexOf(value)]}` : 'Not yet visited'}`}
						onclick={() => (selected = cell)}
					>
						{#if cell === world.goal}<span class="destination-mark">10</span><small>DELIVERY</small>
						{:else if cell === world.start}<span class="start-mark"></span><small>START</small>
						{:else if !isBlocked && visits[cell] > 0}<svg
								class="policy-arrow"
								viewBox="0 0 24 24"
								aria-hidden="true"
								style:rotate={`${q[cell].indexOf(value) * 90}deg`}
								><path
									d="M12 19V5m-5 5 5-5 5 5"
									fill="none"
									stroke="currentColor"
									stroke-width="1.5"
									stroke-linecap="round"
									stroke-linejoin="round"
								/></svg
							>
						{:else if !isBlocked}<span class="unlearned-dot"></span>{/if}
					</button>
				{/each}
				{#if showPath && episodes.length > 0}<svg
						class="route-overlay"
						viewBox="0 0 700 500"
						preserveAspectRatio="none"
						aria-hidden="true"
						><polyline
							points={pathPoints}
							fill="none"
							stroke="#e7bf8c"
							stroke-width="4"
							stroke-linecap="round"
							stroke-linejoin="round"
							opacity=".9"
						/>{#if playing}<circle
								cx={(currentCell % 7) * 100 + 50}
								cy={Math.floor(currentCell / 7) * 100 + 50}
								r="11"
								fill="#f6e7cd"
								stroke="#17251d"
								stroke-width="4"
							/>{/if}</svg
					>{/if}
			</div>
			<div class="city-legend">
				<span><i class="road-swatch"></i> Street</span><span
					><i class="traffic-swatch"></i> Traffic</span
				><span><i class="blocked-swatch"></i> Closed</span><span>Arrows = learned policy</span>
			</div>
			<div class="route-status" role="status">
				{#if training}Learning from actions and rewards…{:else if episodes.length === 0}No route is
					supplied. The agent must discover one.{:else if route.success}Current policy: delivery in {route.steps}
					steps · return {route.reward.toFixed(2)}{:else}The current policy loops before delivery.
					Give it more experience.{/if}
			</div>
		</div>
		<aside class="delivery-controls">
			<div class="lab-signature">
				<PatternIcon name="reinforcement" size={25} /><span>Experience becomes a policy</span>
			</div>
			<h2>A route is earned,<br /><em>one move at a time.</em></h2>
			<p>
				The agent tries a move, receives a reward, and updates its estimate of which action pays off
				over time.
			</p>
			<div class="reward-menu">
				<div><strong>+10</strong><span>Delivery</span></div>
				<div><strong>−0.15</strong><span>Each step</span></div>
				<div><strong>−2</strong><span>In traffic</span></div>
			</div>
			<label class="exploration-control" for="delivery-exploration"
				><span>Exploration <strong>{Math.round(epsilon * 100)}%</strong></span><input
					id="delivery-exploration"
					type="range"
					min="0"
					max="0.8"
					step="0.05"
					bind:value={epsilon}
				/><small
					>{Math.round(epsilon * 100)}% random actions. Otherwise, choose a best-valued action.</small
				></label
			>
			<fieldset class="street-picker">
				<legend>Street map</legend>
				<div>
					<button aria-pressed={!roadworks} onclick={() => reset(false)}>Open route</button><button
						aria-pressed={roadworks}
						onclick={() => reset(true)}>Roadworks</button
					>
				</div>
			</fieldset>
			<div class="delivery-actions">
				<button class="run-button" onclick={train}
					>{training
						? 'Pause training'
						: episodes.length
							? 'Train 300 more'
							: 'Train 300 episodes'}<PatternIcon name="arrowRight" size={16} /></button
				><button class="policy-button" disabled={!episodes.length || training} onclick={playRoute}
					>{playing ? 'Pause route' : 'Run the policy'}</button
				>
			</div>
			<button class="reset-button" onclick={() => reset()}>Reset learning</button>
			<p class="map-note">Changing the street map resets the learned values.</p>
		</aside>
	</div>
	<div class="delivery-analysis">
		<div class="return-history">
			<div class="analysis-heading">
				<h3>Return per episode</h3>
				<span>Last {Math.min(150, episodes.length)} attempts</span>
			</div>
			<div class="return-chart">
				<svg
					viewBox="0 0 400 80"
					preserveAspectRatio="none"
					role="img"
					aria-label={episodes.length
						? `Episode returns range from ${curve.minimum.toFixed(1)} to ${curve.maximum.toFixed(1)} in this chart.`
						: 'No episode returns yet.'}
					><polyline
						points={curve.points}
						fill="none"
						stroke="var(--green)"
						stroke-width="1.7"
						vector-effect="non-scaling-stroke"
					/></svg
				>{#if !episodes.length}<span>Train to see the learning history.</span>{/if}
			</div>
			<div class="return-metrics">
				<span
					><strong>{recentReturn === null ? '—' : recentReturn.toFixed(2)}</strong> mean return</span
				><span
					><strong>{recentSuccess === null ? '—' : `${Math.round(recentSuccess * 100)}%`}</strong> deliveries</span
				><small>Last 20 training episodes, including exploration</small>
			</div>
		</div>
		<div class="action-values">
			<div class="analysis-heading">
				<h3>What is this move worth?</h3>
				<span>Cell {Math.floor(selected / 7) + 1}, {(selected % 7) + 1}</span>
			</div>
			<div class="q-bars">
				{#each deliveryActions as action, index (action)}<div
						class:best={visits[selected] > 0 && index === bestAction}
					>
						<span>{action}</span>
						<div>
							<i style:width={`${Math.max(0, Math.min(100, Math.abs(chosenValues[index]) * 10))}%`}
							></i>
						</div>
						<strong>{chosenValues[index].toFixed(2)}</strong>
					</div>{/each}
			</div>
			<p>
				{selected === world.goal
					? 'The delivery ends the episode; no action is needed here.'
					: visits[selected]
						? 'These Q-values estimate discounted future return. Select any street to inspect its four choices.'
						: 'All values begin at zero. Experience—not a supplied route—changes them.'}
			</p>
		</div>
	</div>
	<p class="delivery-footnote">
		This is tabular Q-learning in a small deterministic world. Exploration can make a training trip
		look worse even after a useful policy has emerged. Hitting a wall costs −0.8; an episode ends
		after delivery or 200 moves.
	</p>
</div>

<style>
	.reinforcement-lab {
		margin: 28px 0;
	}
	.delivery-layout {
		display: grid;
		grid-template-columns: minmax(0, 1.6fr) minmax(260px, 1fr);
		gap: 36px;
		align-items: start;
	}
	.delivery-stage {
		background: #101b17;
		border-radius: 22px;
		color: #dce7de;
		padding: 25px 24px 18px;
	}
	.delivery-stage-heading {
		display: flex;
		justify-content: space-between;
		gap: 12px;
		color: #9bada0;
		font-size: 10px;
		letter-spacing: 0.1em;
	}
	.delivery-stage-heading span:last-child {
		letter-spacing: 0;
	}
	.city-grid {
		display: grid;
		grid-template-columns: repeat(7, minmax(0, 1fr));
		gap: 6px;
		margin: 30px 0 22px;
		position: relative;
	}
	.city-cell {
		position: relative;
		aspect-ratio: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-direction: column;
		padding: 0;
		border: 0;
		border-radius: 8px;
		background:
			linear-gradient(
				rgb(137 191 144 / var(--value-opacity)),
				rgb(137 191 144 / var(--value-opacity))
			),
			#1b2b22;
		color: #b9d5be;
		cursor: pointer;
	}
	.city-cell.chosen {
		box-shadow: inset 0 0 0 1.5px #d1e5d1;
	}
	.city-cell:focus-visible {
		outline: 2px solid #d1e5d1;
		outline-offset: 2px;
	}
	.city-cell.traffic {
		background:
			linear-gradient(
				rgb(137 191 144 / var(--value-opacity)),
				rgb(137 191 144 / var(--value-opacity))
			),
			#423929;
		color: #dec5a2;
	}
	.city-cell.blocked {
		background: repeating-linear-gradient(-45deg, #24302a, #24302a 2px, #18231d 2px, #18231d 7px);
		cursor: default;
		opacity: 0.55;
	}
	.city-cell.endpoint {
		background: #adcb9e;
		color: #122217;
	}
	.city-cell.endpoint.chosen {
		box-shadow: inset 0 0 0 2px #e8f0df;
	}
	.city-cell small {
		font-size: 6px;
		letter-spacing: 0.1em;
		font-weight: 600;
		margin-top: 5px;
	}
	.start-mark {
		width: 11px;
		height: 11px;
		border-radius: 50%;
		background: #243e2d;
	}
	.destination-mark {
		font-family: 'Instrument Serif', serif;
		font-size: 23px;
		line-height: 1;
	}
	.policy-arrow {
		width: 22px;
		height: 22px;
	}
	.unlearned-dot {
		width: 3px;
		height: 3px;
		border-radius: 50%;
		background: #718b79;
		opacity: 0.5;
	}
	.route-overlay {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		pointer-events: none;
		overflow: visible;
	}
	.city-legend {
		display: flex;
		align-items: center;
		gap: 15px;
		font-size: 9px;
		color: #9bada0;
	}
	.city-legend span {
		display: inline-flex;
		align-items: center;
		gap: 6px;
	}
	.city-legend i {
		height: 7px;
		width: 7px;
		border-radius: 2px;
	}
	.road-swatch {
		background: #45674f;
	}
	.traffic-swatch {
		background: #ad8f60;
	}
	.blocked-swatch {
		background: #667169;
	}
	.city-legend span:last-child {
		margin-left: auto;
	}
	.route-status {
		margin-top: 23px;
		color: #b2c4b7;
		font-size: 11px;
		line-height: 1.6;
		min-height: 35px;
	}
	.delivery-controls {
		padding: 10px 0;
		min-width: 0;
	}
	.lab-signature {
		display: flex;
		align-items: center;
		gap: 9px;
		font-size: 12px;
		color: var(--muted);
	}
	h2 {
		font-weight: 500;
		font-size: clamp(26px, 2.35vw, 37px);
		line-height: 1.13;
		letter-spacing: -0.035em;
		margin: 20px 0 14px;
	}
	h2 em {
		font-family: 'Instrument Serif', serif;
		font-weight: 400;
		font-size: 1.14em;
	}
	.delivery-controls > p {
		color: var(--muted);
		font-size: 13px;
		line-height: 1.7;
		max-width: 37ch;
	}
	.reward-menu {
		display: flex;
		gap: 24px;
		margin: 23px 0;
	}
	.reward-menu > div {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.reward-menu strong {
		font-family: 'Instrument Serif', serif;
		font-weight: 400;
		font-size: 26px;
	}
	.reward-menu span {
		font-size: 10px;
		color: var(--muted);
	}
	.exploration-control {
		display: block;
		margin: 20px 0 22px;
	}
	.exploration-control > span {
		display: flex;
		align-items: center;
		justify-content: space-between;
		font-size: 12px;
	}
	.exploration-control strong {
		font-weight: 500;
		color: var(--green);
		font-variant-numeric: tabular-nums;
	}
	.exploration-control input {
		width: 100%;
		margin: 13px 0 8px;
		accent-color: var(--green);
	}
	.exploration-control small {
		display: block;
		font-size: 10px;
		color: var(--quiet);
		line-height: 1.6;
	}
	.street-picker {
		border: 0;
		padding: 0;
		margin: 0 0 23px;
	}
	.street-picker legend {
		font-size: 11px;
		margin-bottom: 10px;
	}
	.street-picker > div {
		display: flex;
		gap: 7px;
	}
	.street-picker button {
		border: 0;
		padding: 9px 13px;
		border-radius: 9px;
		background: var(--surface-raised);
		color: var(--muted);
		font-size: 11px;
		cursor: pointer;
	}
	.street-picker button[aria-pressed='true'] {
		background: var(--accent-bg);
		color: var(--green);
	}
	.delivery-actions {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
	}
	.delivery-actions button {
		min-height: 41px;
		padding: 10px 14px;
		border-radius: 11px;
		font-size: 12px;
		cursor: pointer;
		border: 0;
	}
	.run-button {
		background: var(--green);
		color: var(--paper);
		display: inline-flex;
		align-items: center;
		gap: 12px;
		font-weight: 600;
	}
	.policy-button {
		background: var(--surface-raised);
		color: var(--ink);
	}
	button:disabled {
		opacity: 0.4;
		cursor: default;
	}
	.reset-button {
		border: 0;
		padding: 3px 0;
		margin-top: 14px;
		color: var(--muted);
		background: none;
		font-size: 11px;
		cursor: pointer;
	}
	.delivery-controls .map-note {
		font-size: 9px;
		color: var(--quiet);
		margin-top: 8px;
	}
	.delivery-analysis {
		display: grid;
		grid-template-columns: 1.3fr 1fr;
		gap: 40px;
		margin-top: 33px;
	}
	.analysis-heading {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}
	.analysis-heading h3 {
		font-size: 13px;
		font-weight: 500;
		margin: 0;
	}
	.analysis-heading > span {
		color: var(--quiet);
		font-size: 9px;
	}
	.return-chart {
		height: 85px;
		position: relative;
		margin: 20px 0;
		background: var(--surface);
		border-radius: 12px;
		padding: 10px 14px;
	}
	.return-chart svg {
		width: 100%;
		height: 100%;
		overflow: visible;
	}
	.return-chart > span {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		font-size: 11px;
		color: var(--quiet);
	}
	.return-metrics {
		display: flex;
		gap: 10px 20px;
		flex-wrap: wrap;
		font-size: 10px;
		color: var(--muted);
	}
	.return-metrics strong {
		font-size: 16px;
		font-weight: 500;
		margin-right: 4px;
		color: var(--ink);
		font-variant-numeric: tabular-nums;
	}
	.return-metrics small {
		flex-basis: 100%;
		color: var(--quiet);
		font-size: 9px;
	}
	.q-bars {
		margin-top: 18px;
		display: grid;
		gap: 10px;
	}
	.q-bars > div {
		display: grid;
		grid-template-columns: 35px 1fr 40px;
		align-items: center;
		gap: 10px;
		font-size: 10px;
		color: var(--muted);
	}
	.q-bars > div > div {
		height: 5px;
		border-radius: 5px;
		background: var(--surface-raised);
	}
	.q-bars i {
		display: block;
		height: 5px;
		border-radius: 5px;
		background: var(--quiet);
	}
	.q-bars strong {
		text-align: right;
		font-weight: 500;
		font-variant-numeric: tabular-nums;
	}
	.q-bars .best {
		color: var(--green);
	}
	.q-bars .best i {
		background: var(--green);
	}
	.action-values > p {
		color: var(--quiet);
		font-size: 10px;
		line-height: 1.7;
		margin: 17px 0 0;
	}
	.delivery-footnote {
		font-size: 11px;
		color: var(--muted);
		line-height: 1.8;
		max-width: 800px;
		margin-top: 28px;
	}
	@media (max-width: 1100px) {
		.delivery-layout {
			gap: 24px;
			grid-template-columns: minmax(0, 1.3fr) minmax(240px, 1fr);
		}
		.delivery-stage {
			padding: 22px 16px 18px;
		}
		.city-grid {
			gap: 4px;
		}
		.city-legend {
			gap: 10px;
		}
		.city-legend span:last-child {
			display: none;
		}
	}
	@media (max-width: 760px) {
		.delivery-layout {
			grid-template-columns: 1fr;
			gap: 20px;
		}
		.delivery-controls {
			padding: 0 4px;
		}
		.delivery-controls > p {
			max-width: 52ch;
		}
		h2 {
			font-size: 30px;
		}
		.delivery-analysis {
			grid-template-columns: 1fr;
			gap: 28px;
		}
		.city-cell small {
			font-size: 7px;
			letter-spacing: 0;
		}
		.destination-mark {
			font-size: 20px;
		}
		.policy-arrow {
			width: 18px;
			height: 18px;
		}
		.city-cell {
			border-radius: 6px;
		}
		.city-grid {
			gap: 4px;
		}
		.city-legend {
			font-size: 10px;
		}
	}
</style>
