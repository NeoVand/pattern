<script lang="ts">
	import PatternIcon from './PatternIcon.svelte';
	import {
		evaluatePolicy,
		INITIAL_POLICY_WEIGHTS,
		POLICY_FEATURES,
		POLICY_HELDOUT_TASKS,
		POLICY_TRAIN_TASKS,
		policyProbabilities,
		policyScores,
		preferenceObjective,
		preferencePairs,
		supervisedObjective,
		trainPolicy,
		type PolicyWeights,
		type PreferenceRubric
	} from '$lib/ml/assistant-policy';
	let supervised = $state.raw<PolicyWeights>([...INITIAL_POLICY_WEIGHTS]);
	let preferred = $state.raw<PolicyWeights>([...INITIAL_POLICY_WEIGHTS]);
	let supervisedSteps = $state(0);
	let preferenceSteps = $state(0);
	let rubric = $state<PreferenceRubric>('grounded');
	let selected = $state(0);
	let prediction = $state('');
	let explanation = $state('');
	const task = $derived(POLICY_HELDOUT_TASKS[selected]);
	const beforeProbabilities = $derived(policyProbabilities(supervised, task));
	const probabilities = $derived(policyProbabilities(preferred, task));
	const scores = $derived(policyScores(preferred, task));
	const supervisedMetrics = $derived(evaluatePolicy(supervised));
	const metrics = $derived(evaluatePolicy(preferred));
	const demoLoss = $derived(supervisedObjective(supervised).loss);
	const preferenceLoss = $derived(preferenceObjective(preferred, rubric).loss);
	const pairs = $derived(preferencePairs(task, rubric));
	const percent = (value: number) => `${(value * 100).toFixed(1)}%`;
	function learnExamples(steps: number) {
		supervised = trainPolicy(supervised, 'supervised', steps);
		supervisedSteps += steps;
		preferred = [...supervised];
		preferenceSteps = 0;
	}
	function learnPreferences(steps: number) {
		preferred = trainPolicy(preferred, rubric, steps);
		preferenceSteps += steps;
	}
	function chooseRubric(next: PreferenceRubric) {
		rubric = next;
		preferred = [...supervised];
		preferenceSteps = 0;
	}
	function reset() {
		supervised = [...INITIAL_POLICY_WEIGHTS];
		preferred = [...INITIAL_POLICY_WEIGHTS];
		supervisedSteps = preferenceSteps = 0;
		rubric = 'grounded';
	}
</script>

<section class="assistant-lab" aria-label="Assistant training lab">
	<header>
		<div>
			<span class="small-overline">EXAMPLES → PREFERENCES → BEHAVIOR</span>
			<h3>What are we teaching it to value?</h3>
		</div>
		<button class="icon-button" onclick={reset} aria-label="Reset assistant policy"
			><PatternIcon name="reset" size={18} /></button
		>
	</header>
	<p class="intro">
		A helpful assistant needs more than fluent continuation. Teach a tiny response selector with
		examples, then choose what its rater rewards. Watch three learned weights change the answers it
		favors.
	</p>
	<div class="training-pipeline" aria-label="Conceptual assistant training pipeline">
		<div>
			<span>01 · Pretraining</span><strong>Predict the next token</strong>
			<p>
				Learn patterns from text. This stage is explained in the language chapter; it is not
				simulated here.
			</p>
		</div>
		<div>
			<span>02 · Supervised tuning</span><strong>Imitate demonstrations</strong>
			<p>Update weights to make selected example answers more probable.</p>
		</div>
		<div>
			<span>03 · Preference learning</span><strong>Learn which answer wins</strong>
			<p>
				Update weights using comparisons. The rater's criteria become part of the training signal.
			</p>
		</div>
	</div>
	<div class="assistant-workspace">
		<aside class="training-controls">
			<div class="training-step">
				<div class="step-heading">
					<PatternIcon name="book" size={20} />
					<h4>First, show good answers.</h4>
				</div>
				<p>
					Eight training cards ask for a parcel's shelf. Four have a shelf record; four do not.
					Demonstrations cite the record when it exists and acknowledge missing evidence otherwise.
				</p>
				<div class="training-actions">
					<button class="primary-button" onclick={() => learnExamples(20)}
						><PatternIcon name="play" size={15} />{supervisedSteps
							? 'Learn 20 more steps'
							: 'Learn from examples'}</button
					><button class="small-button" onclick={() => learnExamples(1)}>One step</button>
				</div>
				<div class="training-status">
					<span>{supervisedSteps} supervised updates</span><span>Loss {demoLoss.toFixed(3)}</span>
				</div>
				<details>
					<summary>Inspect a training demonstration</summary>
					<blockquote>
						{POLICY_TRAIN_TASKS[0].prompt}<br /><span>{POLICY_TRAIN_TASKS[0].record}</span>
					</blockquote>
					<p class="demonstration">{POLICY_TRAIN_TASKS[0].responses[0].text}</p>
					<p>
						For a missing record, the demonstration is: “There is not enough information in the
						record to name a shelf.”
					</p>
				</details>
			</div>
			<div class="training-step">
				<div class="step-heading">
					<PatternIcon name="reinforcement" size={20} />
					<h4>Then, choose the rater.</h4>
				</div>
				<fieldset>
					<legend>What wins a comparison?</legend><button
						aria-pressed={rubric === 'grounded'}
						onclick={() => chooseRubric('grounded')}>Supported and honest</button
					><button aria-pressed={rubric === 'confident'} onclick={() => chooseRubric('confident')}
						>Sounds most confident</button
					>
				</fieldset>
				<p>
					{rubric === 'grounded'
						? 'Prefer the supported answer when evidence exists; prefer acknowledging a missing record when it does not.'
						: 'Prefer more assertive wording regardless of the record. This tempting shortcut rewards the unsupported “definitely” answer.'}
				</p>
				<div class="training-actions">
					<button
						class="primary-button"
						disabled={!supervisedSteps}
						onclick={() => learnPreferences(20)}
						><PatternIcon name="play" size={15} />Learn from preferences</button
					><button
						class="small-button"
						disabled={!supervisedSteps}
						onclick={() => learnPreferences(1)}>One preference step</button
					>
				</div>
				<div class="training-status">
					<span>{preferenceSteps} preference updates</span><span
						>Loss {preferenceLoss.toFixed(3)}</span
					>
				</div>
				<p class="fine-print">
					Changing the rater restarts from the supervised weights. More supervised learning also
					starts a fresh preference branch.
				</p>
			</div>
		</aside>
		<div class="policy-inspector">
			<div class="inspector-heading">
				<strong>A card held out of weight updates</strong><label
					><span class="visually-hidden">Inspect held-out card</span><select
						aria-label="Inspect held-out card"
						bind:value={selected}
						>{#each POLICY_HELDOUT_TASKS as item, index (item.id)}<option value={index}
								>Card {index + 1} · {item.hasEvidence
									? 'record available'
									: 'record missing'}</option
							>{/each}</select
					></label
				>
			</div>
			<div class="task-card">
				<span>REQUEST</span>
				<p>{task.prompt}</p>
				<span>AVAILABLE RECORD</span>
				<p>{task.record}</p>
			</div>
			<div class="probability-legend">
				<span><i></i>After examples</span><span
					><i class="preference-key"></i>After preferences</span
				>
			</div>
			<div class="response-list">
				{#each task.responses as response, index (response.id)}
					<div class="response-row">
						<div class="response-top">
							<p>{response.text}</p>
							<span class:appropriate={response.appropriate}
								>{response.appropriate
									? 'Appropriate'
									: response.id === 'uncertain'
										? 'Unneeded refusal'
										: 'Unsupported claim'}</span
							>
						</div>
						<div class="response-probabilities">
							<div>
								<span class="visually-hidden">After examples</span>
								<div class="probability-track">
									<i style:width={`${beforeProbabilities[index] * 100}%`}></i>
								</div>
								<output>{percent(beforeProbabilities[index])}</output>
							</div>
							<div>
								<span class="visually-hidden">After preferences</span>
								<div class="probability-track preference">
									<i style:width={`${probabilities[index] * 100}%`}></i>
								</div>
								<output data-testid={`policy-probability-${response.id}`}
									>{percent(probabilities[index])}</output
								>
							</div>
						</div>
					</div>
				{/each}
			</div>
			<p class="fine-print">
				These percentages are the policy's chances of selecting each authored response. They are not
				confidence estimates that the answer is true.
			</p>
			<details>
				<summary>What would this rater prefer on this card?</summary>
				<p>
					This inspection does not train on the held-out card. It applies the selected rule so you
					can understand the comparisons used on the eight training cards.
				</p>
				{#each pairs as pair (`${pair.preferred}-${pair.rejected}`)}<div class="preference-pair">
						<span>Preferred</span>
						<p>{task.responses[pair.preferred].text}</p>
						<span>Over</span>
						<p>{task.responses[pair.rejected].text}</p>
					</div>{/each}
			</details>
		</div>
	</div>
	<div class="heldout-results">
		<div class="result-heading">
			<h4>Check the behavior, alongside the training loss.</h4>
			<span>12 separate diagnostic cards · same task family</span>
		</div>
		<div class="metric-grid">
			<div>
				<span>Appropriate answer probability</span><strong data-testid="policy-appropriate"
					>{percent(metrics.appropriateProbability)}</strong
				><small>After examples: {percent(supervisedMetrics.appropriateProbability)}</small>
			</div>
			<div>
				<span>Unsupported answer probability</span><strong data-testid="policy-unsupported"
					>{percent(metrics.unsupportedProbability)}</strong
				><small>After examples: {percent(supervisedMetrics.unsupportedProbability)}</small>
			</div>
			<div>
				<span>Average assertiveness</span><strong data-testid="policy-assertiveness"
					>{metrics.assertiveness.toFixed(2)}</strong
				><small>After examples: {supervisedMetrics.assertiveness.toFixed(2)}</small>
			</div>
			<div>
				<span>Top choice is appropriate</span><strong
					>{metrics.correctTopChoice} / {metrics.count}</strong
				><small
					>After examples: {supervisedMetrics.correctTopChoice} / {supervisedMetrics.count}</small
				>
			</div>
		</div>
		<p>
			Probability metrics average the full response distribution; “top choice” uses only its most
			likely answer. These cards never enter updates, but repeatedly tuning against their visible
			results makes them validation data. They test new card details using the same supplied
			features, not general language understanding.
		</p>
	</div>
	<div class="weights-panel">
		<h4>Three weights. Every change visible.</h4>
		<div class="weight-grid">
			{#each POLICY_FEATURES as feature, index (feature)}<div>
					<span>{feature}</span><strong data-testid={`policy-weight-${index}`}
						>{preferred[index].toFixed(3)}</strong
					><small>After examples: {supervised[index].toFixed(3)}</small>
				</div>{/each}
		</div>
		<details>
			<summary>Inspect the equation and actual feature values</summary>
			<p>
				Score = w₁ × assertive wording + w₂ × matches the visible record + w₃ × admits a missing
				record. Softmax converts the three response scores to selection probabilities: exp(score) /
				sum exp(scores). Evidence checks and the wording scale are supplied by this toy; training
				learns only the weights.
			</p>
			<div class="table-wrap">
				<table>
					<caption>Current held-out card · preference policy</caption><thead
						><tr
							><th>Response</th><th>Wording</th><th>Matches</th><th>Admits missing</th><th>Score</th
							></tr
						></thead
					><tbody
						>{#each task.responses as response, index (response.id)}<tr
								><th scope="row">{response.id}</th
								>{#each response.features as feature, featureIndex (`${response.id}-${POLICY_FEATURES[featureIndex]}`)}<td
										>{feature}</td
									>{/each}<td>{scores[index].toFixed(3)}</td></tr
							>{/each}</tbody
					>
				</table>
			</div>
			<p>
				Supervised loss is −log probability(demonstration). Pairwise loss is −log
				sigmoid(score(preferred) − score(rejected)), averaged over unequal-rated pairs. Each click
				performs exact full-batch gradient descent on eight training cards at learning rate 0.35.
				Starting weights are [0.8, 0.1, −0.2]; they were chosen for this experiment and are not a
				pretrained checkpoint.
			</p>
		</details>
	</div>
	<div class="experiment-prompt">
		<PatternIcon name="idea" size={20} />
		<div>
			<strong>Predict → observe → explain</strong><label
				>What will happen if we reward confident wording?<textarea
					rows="2"
					bind:value={prediction}
					placeholder="Predict the direction of both loss and unsupported answers."
				></textarea></label
			>
			<p>
				Learn from examples for 40 steps. Try the honest rater, then switch to the confident rater
				and run several rounds. Inspect a card with a missing record.
			</p>
			<label
				>Did a lower preference loss mean a better assistant?<textarea
					rows="2"
					bind:value={explanation}
					placeholder="Explain using a changed weight, an answer probability, and the held-out results."
				></textarea></label
			>
		</div>
	</div>
	<details class="scope-note">
		<summary>How this relates to real assistant training</summary>
		<p>
			Real supervised instruction tuning trains a language model on prompt–response demonstrations.
			Preference data compares responses to the same prompt. One approach trains a reward model from
			those comparisons and then optimizes the language policy against that reward with
			reinforcement learning, often called RLHF when feedback comes from people. Direct preference
			methods update the policy from comparisons without a separately trained reward model.
		</p>
		<p>
			This experiment uses a much smaller pairwise logistic objective: three linear weights over
			fixed answer options. It is neither a full language model nor an implementation of RLHF or
			DPO. Preference quality, useful features, and the held-out task distribution are deliberately
			visible so the reward-proxy failure is inspectable.
		</p>
		<p>
			A prompt changes the current input, retrieval adds evidence to that input, and tools perform
			outside operations. These mechanisms normally leave model weights fixed. Supervised and
			preference training change the weights and therefore affect later interactions. Fluent,
			agreeable, helpful, and factually grounded are different properties; rewarding one does not
			automatically produce the others.
		</p>
	</details>
</section>

<style>
	.assistant-lab {
		background: var(--surface);
		color: var(--ink);
		border-radius: 24px;
		padding: clamp(20px, 3vw, 38px);
		container-type: inline-size;
	}
	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 20px;
	}
	h3 {
		font: italic 400 clamp(30px, 3.2vw, 44px) var(--serif);
		margin: 9px 0 0;
	}
	h4 {
		font-size: 14px;
		font-weight: 550;
		margin: 0;
	}
	p {
		color: var(--muted);
		font-size: 12px;
		line-height: 1.8;
	}
	.intro {
		font-size: 13px;
		max-width: 820px;
		margin: 18px 0 25px;
	}
	.training-pipeline {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 16px;
		margin-bottom: 32px;
	}
	.training-pipeline > div {
		background: var(--lab-inset);
		border-radius: 13px;
		padding: 19px;
	}
	.training-pipeline span {
		display: block;
		color: var(--blue);
		font: 10px var(--mono);
		margin-bottom: 12px;
	}
	.training-pipeline strong {
		display: block;
		font-size: 12px;
		font-weight: 550;
	}
	.training-pipeline p {
		font-size: 11px;
		margin-bottom: 0;
	}
	.assistant-workspace {
		display: grid;
		grid-template-columns: minmax(250px, 0.8fr) minmax(0, 1.2fr);
		gap: 32px;
	}
	.training-controls,
	.policy-inspector {
		min-width: 0;
	}
	.training-step + .training-step {
		border-top: 1px solid var(--line);
		padding-top: 25px;
		margin-top: 25px;
	}
	.step-heading {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.training-actions {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
	}
	.primary-button {
		font-size: 12px;
		padding: 11px 14px;
		min-height: 42px;
	}
	.small-button {
		background: var(--lab-inset);
		color: var(--muted);
		border: 1px solid var(--line);
		border-radius: 9px;
		padding: 10px 12px;
		font-size: 11px;
		min-height: 42px;
	}
	.training-status {
		display: flex;
		justify-content: space-between;
		gap: 14px;
		flex-wrap: wrap;
		color: var(--quiet);
		font: 10px var(--mono);
		margin-top: 12px;
	}
	details {
		margin-top: 18px;
	}
	summary {
		cursor: pointer;
		font-size: 12px;
		line-height: 1.7;
		color: var(--muted);
	}
	blockquote {
		margin: 15px 0;
		padding-left: 12px;
		border-left: 2px solid var(--lavender);
		font-size: 11px;
		line-height: 1.8;
	}
	blockquote span {
		color: var(--muted);
	}
	.demonstration {
		color: var(--blue);
	}
	fieldset {
		margin: 18px 0 12px;
		padding: 0;
		border: 0;
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 7px;
	}
	legend {
		color: var(--muted);
		font-size: 11px;
		margin-bottom: 10px;
	}
	fieldset button {
		background: var(--lab-inset);
		border: 1px solid var(--line);
		border-radius: 9px;
		padding: 11px 10px;
		font-size: 11px;
		text-align: left;
		line-height: 1.5;
	}
	fieldset button[aria-pressed='true'] {
		color: var(--blue);
		border-color: var(--blue);
	}
	.fine-print {
		font-size: 10px;
		line-height: 1.75;
	}
	.inspector-heading {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 14px;
		flex-wrap: wrap;
		margin-bottom: 14px;
	}
	.inspector-heading strong {
		font-size: 12px;
		font-weight: 550;
	}
	select,
	textarea {
		border: 1px solid var(--line);
		background: var(--input);
		color: var(--ink);
		border-radius: 8px;
		padding: 10px;
		font: 11px var(--sans);
		max-width: 100%;
	}
	select {
		min-height: 42px;
		width: 100%;
	}
	.inspector-heading label {
		min-width: 0;
	}
	.task-card {
		background: var(--lab-inset);
		border-radius: 12px;
		padding: 20px;
	}
	.task-card > span {
		font: 9px var(--mono);
		letter-spacing: 0.8px;
		color: var(--quiet);
	}
	.task-card > p {
		color: var(--ink);
		margin: 6px 0 18px;
	}
	.task-card > p:last-child {
		margin-bottom: 0;
	}
	.probability-legend {
		display: flex;
		gap: 20px;
		flex-wrap: wrap;
		margin: 20px 0 0;
		color: var(--muted);
		font-size: 10px;
	}
	.probability-legend span {
		display: flex;
		align-items: center;
		gap: 6px;
	}
	.probability-legend i {
		width: 10px;
		height: 5px;
		border-radius: 2px;
		background: var(--blue);
	}
	.probability-legend i.preference-key {
		background: var(--lavender);
	}
	.response-row {
		padding: 17px 0;
		border-bottom: 1px solid var(--line);
	}
	.response-top {
		display: flex;
		align-items: start;
		gap: 15px;
	}
	.response-top p {
		margin: 0;
		color: var(--ink);
		font-size: 12px;
		flex: 1;
	}
	.response-top > span {
		color: var(--orange);
		font-size: 9px;
		text-align: right;
		flex: 0 0 83px;
		margin-top: 4px;
	}
	.response-top > span.appropriate {
		color: var(--blue);
	}
	.response-probabilities {
		display: grid;
		gap: 6px;
		margin-top: 12px;
	}
	.response-probabilities > div {
		display: flex;
		align-items: center;
		gap: 12px;
	}
	.probability-track {
		background: var(--lab-inset);
		height: 6px;
		border-radius: 3px;
		flex: 1;
		overflow: hidden;
	}
	.probability-track i {
		display: block;
		background: var(--blue);
		height: 100%;
		border-radius: 3px;
	}
	.probability-track.preference i {
		background: var(--lavender);
	}
	.response-probabilities output {
		min-width: 50px;
		text-align: right;
		font: 10px var(--mono);
		color: var(--muted);
	}
	.preference-pair {
		border-left: 2px solid var(--lavender);
		padding-left: 12px;
		margin-top: 15px;
	}
	.preference-pair span {
		color: var(--quiet);
		font: 9px var(--mono);
	}
	.preference-pair p {
		font-size: 11px;
		margin: 3px 0 7px;
	}
	.heldout-results,
	.weights-panel {
		border-top: 1px solid var(--line);
		padding-top: 26px;
		margin-top: 28px;
	}
	.result-heading {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		flex-wrap: wrap;
	}
	.result-heading > span {
		color: var(--quiet);
		font-size: 10px;
	}
	.metric-grid {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 16px;
		margin: 22px 0 16px;
	}
	.metric-grid span,
	.weight-grid span {
		font-size: 10px;
		line-height: 1.6;
		color: var(--muted);
		display: block;
	}
	.metric-grid strong,
	.weight-grid strong {
		display: block;
		font: 22px var(--mono);
		margin: 10px 0;
	}
	.metric-grid small,
	.weight-grid small {
		font-size: 10px;
		color: var(--quiet);
		line-height: 1.7;
	}
	.weight-grid {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 16px;
		margin-top: 20px;
	}
	.weight-grid > div {
		background: var(--lab-inset);
		border-radius: 12px;
		padding: 18px;
	}
	.weight-grid strong {
		color: var(--lavender);
	}
	.table-wrap {
		overflow-x: auto;
	}
	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 11px;
		margin-top: 12px;
		text-align: left;
	}
	table caption {
		text-align: left;
		font-size: 10px;
		color: var(--quiet);
		margin-bottom: 8px;
	}
	table th,
	table td {
		border-bottom: 1px solid var(--line);
		padding: 9px;
	}
	table th {
		font-weight: 500;
		color: var(--muted);
	}
	.experiment-prompt {
		display: flex;
		align-items: start;
		gap: 13px;
		padding: 22px;
		margin-top: 28px;
		background: var(--lab-inset);
		border-radius: 14px;
	}
	.experiment-prompt > div {
		flex: 1;
		min-width: 0;
	}
	.experiment-prompt strong {
		display: block;
		font-size: 12px;
		color: var(--blue);
		margin-bottom: 16px;
	}
	.experiment-prompt label {
		display: block;
		font-size: 12px;
		color: var(--muted);
		line-height: 1.7;
	}
	textarea {
		width: 100%;
		resize: vertical;
		margin-top: 7px;
		font-size: 12px;
		line-height: 1.6;
	}
	.scope-note {
		padding-top: 20px;
		border-top: 1px solid var(--line);
	}
	@container (max-width: 760px) {
		.assistant-workspace {
			grid-template-columns: 1fr;
		}
		.metric-grid {
			grid-template-columns: 1fr 1fr;
		}
	}
	@container (max-width: 490px) {
		.training-pipeline {
			grid-template-columns: 1fr;
			gap: 10px;
		}
		.weight-grid {
			grid-template-columns: 1fr;
			gap: 10px;
		}
		.training-pipeline > div,
		.weight-grid > div {
			padding: 16px;
		}
		.response-top {
			flex-direction: column;
			gap: 3px;
		}
		.response-top > span {
			flex-basis: auto;
		}
		.experiment-prompt {
			padding: 16px;
		}
	}
</style>
