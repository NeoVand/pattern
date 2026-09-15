<script lang="ts">
	import PatternIcon from './PatternIcon.svelte';
	import ChoiceGroup from './ChoiceGroup.svelte';
	import { originDefaults, runDataOrigins, type OriginSettings } from '$lib/ml/data-origins';

	let settings = $state<OriginSettings>({ ...originDefaults });
	const result = $derived(runDataOrigins(settings));
	const exampleCustomers = $derived(result.customers.slice(0, 9));
	const percent = (value: number) => `${Math.round(value * 100)}%`;
	const inputDescription = $derived(
		settings.feature === 'identifier'
			? 'A random customer code has no relationship to the outcome. It can still identify a duplicated customer.'
			: settings.feature === 'future'
				? 'This field records the outcome a week later. It is filled in for historical records, but missing when a new prediction is needed.'
				: 'Past visit frequency, past spending, and visit time are all available before the outcome.'
	);
</script>

<section class="origins-lab" aria-label="Data origins experiment">
	<header>
		<div>
			<span class="small-overline">A CAFÉ DATASET · 72 CUSTOMERS</span>
			<h3>Where did the score come from?</h3>
		</div>
		<button class="text-button" onclick={() => settings.seed++}
			><PatternIcon name="shuffle" size={15} />New sample</button
		>
	</header>
	<p class="intro">
		A café wants to predict what a new customer will do next week. Each historical customer appears
		three times in the export. Choose what the model can see, then examine who its evaluation
		actually measures.
	</p>

	<div class="workspace">
		<div class="data-view">
			<div class="panel-heading">
				<PatternIcon name="database" size={17} /><strong>One customer, three records</strong><span
					>9 of 72 shown</span
				>
			</div>
			<div class="record-grid" aria-label="Training and validation records by customer">
				<div class="record-heading">
					<span>Customer</span><span>Record 1</span><span>Record 2</span><span>Record 3</span>
				</div>
				{#each exampleCustomers as customer, index (customer.id)}
					<div class="record-row">
						<span>C{String(index + 1).padStart(2, '0')}<small>{customer.group}</small></span>
						{#each [0, 1, 2] as copy (copy)}
							{@const training = settings.split === 'rows' ? copy < 2 : index % 3 !== 2}
							<span class={['record', training ? 'training' : 'validation']}
								><span>{training ? 'Train' : 'Check'}</span><b>{customer.label ? 'Yes' : 'No'}</b
								></span
							>
						{/each}
					</div>
				{/each}
			</div>
			<p class="split-reading" data-testid="customer-overlap">
				<strong>{result.overlap} customers</strong> appear on both sides of the split. Training has {result
					.train.length} records from {result.trainingCustomers} unique customers.
			</p>
		</div>

		<aside class="controls">
			<label class="select-label"
				>Predict next week’s outcome<select
					aria-label="Prediction target"
					bind:value={settings.target}
					><option value="return">Will the customer return?</option><option value="large-order"
						>Will the order be large?</option
					></select
				></label
			>
			<label class="select-label"
				>Give the model this input<select aria-label="Model input" bind:value={settings.feature}
					><option value="identifier">Random customer code</option><option value="history"
						>History + visit time</option
					><option value="future">Next week’s outcome field</option></select
				></label
			>
			<p class="input-description">{inputDescription}</p>
			<ChoiceGroup
				label="Separate the records by"
				value={settings.split}
				options={[
					{ value: 'rows', label: 'Row' },
					{ value: 'customers', label: 'Customer' }
				]}
				onchange={(value) => (settings.split = value)}
			/>
			<details class="collection">
				<summary>Change collection &amp; labels</summary>
				<ChoiceGroup
					label="Customers in the source data"
					value={settings.coverage}
					options={[
						{ value: 'morning', label: 'Morning only' },
						{ value: 'both', label: 'Both times' }
					]}
					onchange={(value) => (settings.coverage = value)}
				/>
				<label class="noise-label"
					><span>Incorrect source labels<output>{percent(settings.labelNoise)}</output></span><input
						type="range"
						aria-label="Incorrect source labels"
						min="0"
						max="0.5"
						step="0.05"
						bind:value={settings.labelNoise}
					/></label
				>
				<p>
					{result.corrupted} of 72 customers have a flipped label. Copies share that same label error.
				</p>
			</details>
		</aside>
	</div>

	<div class="score-comparison" aria-live="polite">
		<div>
			<span>Historical validation</span><strong data-testid="origins-validation"
				>{percent(result.validationAccuracy)}</strong
			><small>{result.validationCorrect} / {result.validation.length} records correct</small>
		</div>
		<PatternIcon name="arrowRight" size={23} />
		<div>
			<span>New customers · available inputs</span><strong data-testid="origins-fresh"
				>{percent(result.freshAccuracy)}</strong
			><small>{result.correct} / {result.results.length} customers correct</small>
		</div>
	</div>
	<div class="reading">
		<PatternIcon
			name={settings.feature === 'history' && settings.split === 'customers' ? 'idea' : 'alert'}
			size={19}
		/>
		<p>
			{#if settings.feature === 'future'}<strong>The input arrives too late.</strong> The historical check
				can read the answer. For new customers the unknown field is filled with 0.5, so every customer
				looks identical to this model. Remove this field and use information available at prediction time.
			{:else if settings.split === 'rows'}<strong>New rows can still be familiar customers.</strong> An
				exact copy is already in training. Split by customer to ask whether the model learned something
				useful for a person it has never seen.
			{:else if settings.feature === 'identifier'}<strong
					>A customer code does not explain behavior.</strong
				> The closest code belongs to an unrelated person. The lower validation score exposes that limitation
				before use on new customers.
			{:else}<strong>Now examine whom the data represents.</strong> Open collection settings and remove
				evening customers. An independent split still cannot test a population absent from both sides
				of the source data.
			{/if}
		</p>
	</div>

	<div class="coverage-panel">
		<div>
			<strong>Who does the new-customer score include?</strong>
			<p>Equal numbers of morning and evening customers. Neither group enters the fitted model.</p>
		</div>
		{#each result.groups as group (group.group)}
			<div class="group-score">
				<span
					>{group.group === 'morning' ? 'Morning' : 'Evening'}<small
						>{group.source} source customers</small
					></span
				>
				<div class="bar-track"><i style:width={percent(group.accuracy)}></i></div>
				<b>{percent(group.accuracy)}</b><small>{group.correct} / {group.total} correct</small>
			</div>
		{/each}
	</div>
	<div class="practice">
		<PatternIcon name="idea" size={18} />
		<p>
			<strong>Predict → observe → explain.</strong> Before changing Row to Customer, predict which score
			will fall. Then try useful history with morning-only data. Explain why fixing duplicate records
			does not fix missing populations.
		</p>
	</div>
	<details class="method">
		<summary>How the experiment works · provenance &amp; consent</summary>
		<p>
			A one-nearest-neighbor classifier stores the training records and predicts the label of the
			closest one. History inputs are normalized visit frequency, spending weighted by 0.6, and
			visit time encoded as 0 or 1.5. A row split uses two copies for training and one for
			validation; a customer split uses all copies of 48 customers for training and the other 24 for
			validation. Equal row budgets do not mean equal numbers of independent people.
		</p>
		<p>
			These are generated customers. In this invented mechanism, morning return probability
			increases with visit frequency; evening return probability decreases with it. Large-order
			outcomes mainly depend on spending. A small random term makes outcomes imperfectly
			predictable. Label errors affect source labels; the 240 new-customer outcomes remain clean.
			All scores are computed from predictions. Changing controls rebuilds the model; repeatedly
			consulting the new-customer scores makes them exploratory checks, not a final untouched test.
		</p>
		<p>
			<strong>In a real project:</strong> provenance means recording where a field came from, when it
			was available, and how its label was obtained. Permission to collect a receipt does not by itself
			establish permission for every later use. Define the purpose, confirm the appropriate permission,
			minimize identifying information, and document whose behavior your sample omits. This synthetic
			lab collects no personal data.
		</p>
	</details>
</section>

<style>
	.origins-lab {
		background: var(--surface);
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
	header button {
		white-space: nowrap;
		font-size: 12px;
	}
	.intro {
		font-size: 13px;
		color: var(--muted);
		line-height: 1.8;
		max-width: 760px;
		margin: 17px 0 24px;
	}
	.workspace {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 275px;
		gap: 24px;
	}
	.data-view {
		min-width: 0;
	}
	.panel-heading {
		display: flex;
		align-items: center;
		gap: 8px;
		margin: 0 0 18px;
		color: var(--blue);
	}
	.panel-heading strong {
		font-size: 13px;
		font-weight: 550;
		color: var(--ink);
	}
	.panel-heading > span {
		margin-left: auto;
		color: var(--quiet);
		font-size: 10px;
	}
	.record-grid {
		display: grid;
		gap: 6px;
	}
	.record-heading,
	.record-row {
		display: grid;
		grid-template-columns: 1.1fr repeat(3, 1fr);
		gap: 7px;
		align-items: center;
	}
	.record-heading {
		color: var(--quiet);
		font: 10px var(--sans);
		margin-bottom: 5px;
	}
	.record-heading > span:not(:first-child) {
		text-align: center;
	}
	.record-row > span:first-child {
		font: 11px var(--mono);
		color: var(--ink);
	}
	.record-row small {
		display: block;
		color: var(--quiet);
		font: 9px var(--sans);
		margin-top: 2px;
	}
	.record {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 6px;
		border-radius: 7px;
		padding: 9px 10px;
		background: color-mix(in srgb, var(--training) 10%, var(--lab-inset));
		color: var(--training);
		font-size: 10px;
	}
	.record b {
		font: 10px var(--mono);
	}
	.record.validation {
		background: color-mix(in srgb, var(--validation) 10%, var(--lab-inset));
		color: var(--validation);
	}
	.split-reading {
		color: var(--muted);
		font-size: 11px;
		line-height: 1.7;
		margin: 15px 0 0;
	}
	.split-reading strong {
		color: var(--ink);
		font-weight: 550;
	}
	.controls {
		background: var(--lab-inset);
		padding: 20px;
		border-radius: 16px;
	}
	.select-label {
		display: block;
		color: var(--muted);
		font-size: 11px;
		margin-bottom: 18px;
	}
	select {
		width: 100%;
		display: block;
		background: var(--surface);
		color: var(--ink);
		border: 1px solid var(--line);
		border-radius: 8px;
		padding: 10px 8px;
		font-size: 11px;
		margin-top: 8px;
	}
	select:focus-visible,
	input:focus-visible {
		outline: 2px solid var(--focus);
		outline-offset: 3px;
	}
	.input-description,
	.collection p {
		font-size: 11px;
		color: var(--muted);
		line-height: 1.7;
		margin: -6px 0 18px;
	}
	.controls :global(.choice-group) {
		margin: 0;
	}
	.controls :global(.choice-group legend) {
		font-size: 11px;
		margin-bottom: 9px;
	}
	.controls :global(.choice-group button) {
		padding: 9px 12px;
		font-size: 11px;
	}
	summary {
		color: var(--blue);
		font-size: 11px;
		cursor: pointer;
		line-height: 1.7;
	}
	.collection {
		margin-top: 21px;
		border-top: 1px solid var(--line);
		padding-top: 16px;
	}
	.collection :global(.choice-group) {
		margin-top: 17px;
	}
	.noise-label {
		display: block;
		margin: 20px 0 14px;
	}
	.noise-label span {
		display: flex;
		justify-content: space-between;
		color: var(--muted);
		font-size: 10px;
	}
	.noise-label output {
		color: var(--blue);
		font-family: var(--mono);
	}
	.noise-label input {
		width: 100%;
		min-height: 26px;
	}
	.collection p {
		margin: 0;
	}
	.score-comparison {
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		gap: 30px;
		align-items: center;
		margin-top: 24px;
		border: 1px solid var(--line);
		border-radius: 16px;
		padding: 24px;
		color: var(--quiet);
	}
	.score-comparison > div {
		min-width: 0;
	}
	.score-comparison span {
		color: var(--muted);
		font-size: 12px;
	}
	.score-comparison strong {
		display: block;
		color: var(--validation);
		font: 38px var(--mono);
		margin: 9px 0;
	}
	.score-comparison > div:last-child strong {
		color: var(--test);
	}
	.score-comparison small {
		font-size: 10px;
		color: var(--quiet);
	}
	.reading,
	.practice {
		display: flex;
		align-items: flex-start;
		gap: 12px;
		color: var(--lavender);
	}
	.reading {
		margin: 22px 0;
	}
	.reading :global(svg),
	.practice :global(svg) {
		flex-shrink: 0;
		margin-top: 2px;
	}
	.reading p,
	.practice p {
		margin: 0;
		font-size: 12px;
		line-height: 1.8;
		color: var(--muted);
	}
	.reading strong,
	.practice strong,
	.method strong {
		color: var(--ink);
		font-weight: 550;
	}
	.coverage-panel {
		padding: 20px;
		background: var(--lab-inset);
		border-radius: 14px;
	}
	.coverage-panel > div:first-child strong {
		color: var(--ink);
		font-size: 12px;
		font-weight: 550;
	}
	.coverage-panel p {
		color: var(--quiet);
		font-size: 11px;
		margin: 7px 0 20px;
		line-height: 1.6;
	}
	.group-score {
		display: grid;
		grid-template-columns: 132px minmax(40px, 1fr) 40px 85px;
		gap: 14px;
		align-items: center;
		margin-top: 14px;
	}
	.group-score > span {
		font-size: 11px;
		color: var(--ink);
	}
	.group-score small {
		font-size: 10px;
		color: var(--quiet);
	}
	.group-score > span small {
		display: block;
		margin-top: 4px;
	}
	.group-score b {
		font: 12px var(--mono);
		color: var(--blue);
		text-align: right;
	}
	.bar-track {
		height: 7px;
		background: var(--surface-raised);
		border-radius: 10px;
		overflow: hidden;
	}
	.bar-track i {
		display: block;
		height: 100%;
		background: var(--blue);
		border-radius: 10px;
	}
	.practice {
		margin-top: 23px;
	}
	.method {
		margin-top: 20px;
		border-top: 1px solid var(--line);
		padding-top: 16px;
	}
	.method p {
		font-size: 11px;
		line-height: 1.8;
		color: var(--muted);
		margin: 12px 0 0;
	}
	@container (max-width: 720px) {
		.workspace {
			grid-template-columns: 1fr;
		}
		.controls {
			display: grid;
			grid-template-columns: 1fr 1fr;
			gap: 0 20px;
		}
		.input-description,
		.collection {
			grid-column: 1/-1;
		}
		.group-score {
			grid-template-columns: 112px minmax(30px, 1fr) 40px;
		}
		.group-score > small {
			grid-column: 2/-1;
			margin-top: -7px;
		}
	}
	@container (max-width: 440px) {
		header {
			flex-direction: column;
			align-items: flex-start;
			gap: 12px;
		}
		.controls {
			display: block;
			padding: 17px;
		}
		.panel-heading {
			flex-wrap: wrap;
		}
		.panel-heading > span {
			margin-left: 0;
		}
		.record {
			flex-direction: column;
			padding: 7px 3px;
			gap: 3px;
		}
		.record-row {
			gap: 5px;
		}
		.score-comparison {
			gap: 14px;
			padding: 17px;
		}
		.score-comparison span {
			font-size: 10px;
			display: block;
			min-height: 30px;
		}
		.score-comparison strong {
			font-size: 28px;
		}
		.score-comparison small {
			font-size: 9px;
		}
		.coverage-panel {
			padding: 17px;
		}
		.group-score {
			grid-template-columns: 93px minmax(20px, 1fr) 36px;
			gap: 10px;
		}
	}
</style>
