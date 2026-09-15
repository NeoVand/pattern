<script lang="ts">
	import PatternIcon from './PatternIcon.svelte';
	import {
		centsText,
		DEFAULT_SHOP_SYSTEM,
		evaluateShop,
		makeShopData,
		shopDocuments,
		shopPlanExport,
		type CapstoneStage,
		type ShopCommitment,
		type ShopReport,
		type ShopSystem
	} from '$lib/ml/system-choice';
	let system = $state<ShopSystem>({ ...DEFAULT_SHOP_SYSTEM });
	let round = $state(1);
	let rationale = $state('');
	let monitoring = $state('');
	let validation = $state.raw<ShopReport | null>(null);
	let finalReport = $state.raw<ShopReport | null>(null);
	let changedReport = $state.raw<ShopReport | null>(null);
	let commitment = $state.raw<ShopCommitment | null>(null);
	let selectedStage = $state<CapstoneStage>('validation');
	let exported = $state(false);
	const data = $derived(makeShopData(round));
	const currentValidation = $derived(validation?.fingerprint === JSON.stringify(system));
	const canCommit = $derived(
		currentValidation && Boolean(rationale.trim()) && Boolean(monitoring.trim())
	);
	const report = $derived(
		selectedStage === 'changed'
			? changedReport
			: selectedStage === 'final'
				? finalReport
				: validation
	);
	const visibleCount = $derived(changedReport ? 49 : finalReport ? 42 : validation ? 35 : 28);
	const chartValues = $derived(data.demand.slice(0, visibleCount));
	const maximum = $derived(
		Math.ceil(
			(Math.max(...chartValues, ...(report?.forecast.predictions.slice(0, visibleCount) ?? [])) +
				10) /
				20
		) * 20
	);
	const stages: { id: CapstoneStage; label: string }[] = [
		{ id: 'validation', label: 'Validation' },
		{ id: 'final', label: 'Final cases' },
		{ id: 'changed', label: 'Changed conditions' }
	];
	const x = (day: number) => 40 + (day / 48) * 620;
	const y = (value: number) => 202 - (value / maximum) * 166;
	const line = (values: number[]) =>
		values
			.map((value, day) => `${day ? 'L' : 'M'}${x(day).toFixed(2)},${y(value).toFixed(2)}`)
			.join(' ');
	function runValidation() {
		validation = evaluateShop(system, 'validation', data);
		selectedStage = 'validation';
	}
	function commitSystem() {
		if (!canCommit || commitment) return;
		commitment = {
			system: { ...system },
			rationale: rationale.trim(),
			monitoring: monitoring.trim(),
			round
		};
	}
	function revealFinal() {
		if (!commitment || finalReport) return;
		finalReport = evaluateShop(commitment.system, 'final', data);
		selectedStage = 'final';
	}
	function changeConditions() {
		if (!commitment || !finalReport || changedReport) return;
		changedReport = evaluateShop(commitment.system, 'changed', data);
		selectedStage = 'changed';
	}
	function newRound() {
		round++;
		validation = finalReport = changedReport = null;
		commitment = null;
		selectedStage = 'validation';
		exported = false;
	}
	function exportPlan() {
		if (!commitment || !validation) return;
		const artifact = shopPlanExport(commitment, validation, finalReport, changedReport);
		const url = URL.createObjectURL(
			new Blob([JSON.stringify(artifact, null, 2)], { type: 'application/json' })
		);
		const link = document.createElement('a');
		link.href = url;
		link.download = `pattern-shop-system-round-${round}.json`;
		link.click();
		setTimeout(() => URL.revokeObjectURL(url), 1000);
		exported = true;
	}
</script>

<section class="system-lab" aria-label="System design capstone">
	<header>
		<div>
			<span class="small-overline">THE SHOP SYSTEM · ROUND {round}</span>
			<h3>Choose the pieces. Defend the choice.</h3>
		</div>
		<PatternIcon name="agent" size={29} />
	</header>
	<p class="intro">
		A small shop needs accurate invoices, answers from its policy documents, and a useful demand
		forecast. Build a system, learn from validation, then commit before seeing new cases.
	</p>
	<div class="brief">
		<div>
			<span>THE BRIEF</span>
			<p>
				Keep customer details local. Invoice totals must match to the cent. Policy answers need a
				current source. Aim for demand error below eight parcels per day on the initial
				distribution.
			</p>
		</div>
		<div>
			<span>THE TRADE-OFF</span>
			<p>
				Simple components can be fast and inexpensive, but each has limits. Review costs staff time;
				retrieval needs current documents; forecasts need monitoring. No latency, staffing time, or
				service price is measured in this exercise.
			</p>
		</div>
	</div>
	<div class="system-workspace">
		<aside class="system-controls">
			<fieldset disabled={Boolean(commitment)}>
				<legend><PatternIcon name="tool" size={18} />Invoice arithmetic</legend><label
					><input
						type="radio"
						name="invoice-approach"
						value="rounded"
						bind:group={system.invoices}
					/><span>Round each unit price<small>A rough whole-dollar estimate</small></span></label
				><label
					><input
						type="radio"
						name="invoice-approach"
						value="exact"
						bind:group={system.invoices}
					/><span>Multiply integer cents<small>An exact calculator rule</small></span></label
				>
			</fieldset>
			<fieldset disabled={Boolean(commitment)}>
				<legend><PatternIcon name="retrieval" size={18} />Policy questions</legend><label
					><input
						type="radio"
						name="policy-approach"
						value="snapshot"
						bind:group={system.policy}
					/><span>Search a saved FAQ snapshot<small>The original document version</small></span
					></label
				><label
					><input
						type="radio"
						name="policy-approach"
						value="current"
						bind:group={system.policy}
					/><span
						>Search current policy documents<small>Retrieve a passage with its source</small></span
					></label
				><label class="review-choice"
					><input type="checkbox" bind:checked={system.reviewUnknown} /><span
						>Queue missing matches for human review<small>No human answer is simulated.</small
						></span
					></label
				>
			</fieldset>
			<fieldset disabled={Boolean(commitment)}>
				<legend><PatternIcon name="forecasting" size={18} />Demand forecasts</legend><label
					><input
						type="radio"
						name="forecast-approach"
						value="mean"
						bind:group={system.forecast}
					/><span>Repeat the training average<small>A constant baseline</small></span></label
				><label
					><input
						type="radio"
						name="forecast-approach"
						value="repeat"
						bind:group={system.forecast}
					/><span
						>Repeat the last observed week<small>A seasonal baseline with no fitted weights</small
						></span
					></label
				><label
					><input
						type="radio"
						name="forecast-approach"
						value="seasonal"
						bind:group={system.forecast}
					/><span>Fit trend and a weekly cycle<small>Four learned linear coefficients</small></span
					></label
				><label class="alert-control"
					><span
						>Alert after 3-day mean error exceeds <output>{system.alertThreshold} parcels</output
						></span
					><input
						aria-label="Forecast alert threshold"
						type="range"
						min="5"
						max="40"
						step="1"
						bind:value={system.alertThreshold}
					/></label
				>
			</fieldset>
			<button class="primary-button" disabled={Boolean(commitment)} onclick={runValidation}
				><PatternIcon name="play" size={16} />{validation
					? 'Run validation again'
					: 'Run validation'}</button
			>
			<p class="control-note">
				Twenty-eight days fit the forecast. Days 29–35 and two cases per business task support model
				choice. Changing a component requires a new validation run.
			</p>
		</aside>
		<div class="evidence-panel">
			<div class="evidence-heading">
				<h4>Follow the evidence.</h4>
				<span>{commitment ? 'Choices committed' : 'Development phase'}</span>
			</div>
			<div class="report-tabs" role="group" aria-label="Evidence stage">
				{#each stages as stage (stage.id)}<button
						aria-pressed={selectedStage === stage.id}
						disabled={stage.id === 'validation'
							? !validation
							: stage.id === 'final'
								? !finalReport
								: !changedReport}
						onclick={() => (selectedStage = stage.id)}>{stage.label}</button
					>{/each}
			</div>
			{#if report}
				{#if selectedStage === 'validation' && !currentValidation}<p
						class="stale-result"
						role="status"
					>
						These results belong to your previous choices. Run validation again before committing.
					</p>{/if}
				<div class="score-grid">
					<div>
						<span>Exact invoices</span><strong data-testid="shop-invoice-score"
							>{report.summary.exactInvoices} / {report.summary.invoiceCount}</strong
						>
					</div>
					<div>
						<span>Supported policy answers</span><strong data-testid="shop-policy-score"
							>{report.summary.supportedAnswers} / {report.summary.answerableQuestions}</strong
						>
					</div>
					<div>
						<span>Demand error · MAE</span><strong data-testid="shop-forecast-error"
							>{report.forecast.mae.toFixed(1)}</strong
						><small>Parcels per day · target &lt; 8</small>
					</div>
				</div>
				<p class="control-note">
					{report.summary.reviewCount} policy questions queued for review; {report.summary
						.unsupportedAnswers} incorrect or stale answers. Review is a handoff, not a correct answer.
					The supported-answer denominator counts only questions the current documents can answer.
				</p>
				<details>
					<summary>Inspect every invoice calculation</summary>
					<div class="table-wrap">
						<table>
							<thead
								><tr
									><th>Quantity × unit price</th><th>Output</th><th>Expected</th><th>Difference</th
									></tr
								></thead
							><tbody
								>{#each report.invoices as invoice (invoice.id)}<tr
										><td>{invoice.quantity} × {centsText(invoice.unitCents)}</td><td
											>{centsText(invoice.result)}</td
										><td>{centsText(invoice.expected)}</td><td
											>{centsText(invoice.absoluteErrorCents)}</td
										></tr
									>{/each}</tbody
							>
						</table>
					</div>
				</details>
				<details>
					<summary>Inspect policy answers and their sources</summary
					>{#each report.policy as answer (answer.id)}<div class="policy-answer">
							<strong>{answer.question}</strong>
							<p>{answer.answer}</p>
							<span class:failed={answer.status === 'incorrect'}
								>{answer.status === 'supported'
									? 'Supported by the current policy'
									: answer.status === 'incorrect'
										? 'Does not match the current answer'
										: answer.status === 'review'
											? 'Review queued · unresolved'
											: 'Unanswered'}</span
							><small>Expected: {answer.expectedAnswer}</small>{#if answer.source}<small
									>Retrieved: {answer.source.title} · lexical match {(
										answer.matchScore * 100
									).toFixed(0)}%</small
								>{/if}
						</div>{/each}
				</details>
			{:else}<div class="empty-evidence">
					<PatternIcon name="evaluation" size={30} /><strong>Your choices need a check.</strong>
					<p>
						Run validation to inspect actual totals, retrieved passages, and forecasts. Then explain
						what the measurements support.
					</p>
				</div>{/if}
			<div class="demand-heading">
				<strong>Daily parcel demand</strong><span>{visibleCount} observed days revealed</span>
			</div>
			<svg
				class="demand-chart"
				viewBox="0 0 690 245"
				role="img"
				aria-label="Daily parcel demand, revealing only the training and completed evaluation stages, with the selected forecast"
				><title>Observed demand and the chosen forecast</title><rect
					x={x(27.5)}
					y="27"
					width={x(34.5) - x(27.5)}
					height="175"
					fill="var(--validation)"
					opacity=".08"
				/><rect
					x={x(34.5)}
					y="27"
					width={x(41.5) - x(34.5)}
					height="175"
					fill="var(--test)"
					opacity=".08"
				/><rect
					x={x(41.5)}
					y="27"
					width={x(48) - x(41.5)}
					height="175"
					fill="var(--chart-rose)"
					opacity=".08"
				/>{#each [0, 0.5, 1] as tick (tick)}<line
						x1="40"
						x2="660"
						y1={y(tick * maximum)}
						y2={y(tick * maximum)}
						stroke="var(--line)"
					/><text x="30" y={y(tick * maximum) + 4} text-anchor="end">{tick * maximum}</text
					>{/each}<path
					d={line(chartValues)}
					fill="none"
					stroke="var(--blue)"
					stroke-width="2.4"
				/>{#if report}<path
						d={line(report.forecast.predictions.slice(0, visibleCount))}
						fill="none"
						stroke="var(--lavender)"
						stroke-width="2"
						stroke-dasharray="5 4"
					/>{/if}<text x={x(12)} y="225" text-anchor="middle">Training · 1–28</text><text
					x={x(31)}
					y="225"
					text-anchor="middle">Validation</text
				><text x={x(38)} y="225" text-anchor="middle">Final</text><text
					x={x(45)}
					y="225"
					text-anchor="middle">Changed</text
				></svg
			>
			<div class="chart-key">
				<span><i></i>Observed</span><span><i class="prediction-key"></i>Chosen model</span>
			</div>
			{#if report}<div
					class="monitor-message"
					class:triggered={Boolean(report.forecast.alert)}
					data-testid="shop-monitor"
				>
					{#if report.forecast.alert}<PatternIcon name="alert" size={17} />
						<p>
							Alert on day {report.forecast.alert.day}: the last three observed errors average {report.forecast.alert.rollingError?.toFixed(
								1
							)} parcels, above your {report.forecast.alertThreshold}-parcel threshold. This detects
							failure after outcomes arrive; it does not repair the forecast.
						</p>{:else}<PatternIcon name="checkCircle" size={17} />
						<p>
							No alert in these seven observed days. The monitor starts after three outcomes; a
							quiet monitor does not prove the system is reliable.
						</p>{/if}
				</div>
				<details>
					<summary>Read forecast values and the fitted model</summary>
					<div class="table-wrap">
						<table>
							<thead
								><tr><th>Day</th><th>Observed</th><th>Forecast</th><th>Absolute error</th></tr
								></thead
							><tbody
								>{#each report.forecast.days as day (day.day)}<tr
										><td>{day.day}</td><td>{day.actual}</td><td>{day.prediction.toFixed(1)}</td><td
											>{day.error.toFixed(1)}</td
										></tr
									>{/each}</tbody
							>
						</table>
					</div>
					<p>
						{report.system.forecast === 'seasonal'
							? `Four coefficients learned in ${report.forecast.updates} gradient updates on the first 28 days. Features: constant, time, sin(2π day / 7), cos(2π day / 7). The weekly period is supplied.`
							: report.system.forecast === 'repeat'
								? 'Repeat days 22–28 for every future week. No future observation updates this baseline.'
								: 'The forecast is the average of the first 28 days.'} Parameters: {report.forecast.weights
							.map((weight) => weight.toFixed(3))
							.join(', ')}. All stages use the frozen training history.
					</p>
				</details>{/if}
		</div>
	</div>
	<div class="commitment-panel">
		<div class="commitment-heading">
			<PatternIcon name="checklist" size={21} />
			<div>
				<h4>Make a reviewable decision.</h4>
				<p>Use evidence, then write the operational choices that a score cannot make for you.</p>
			</div>
		</div>
		<div class="plan-fields">
			<label
				>Why these components?<textarea
					aria-label="System rationale"
					rows="3"
					disabled={Boolean(commitment)}
					bind:value={rationale}
					placeholder="Use validation evidence. Discuss accuracy, privacy, cost, and latency requirements; say what you would measure in a real trial."
				></textarea></label
			><label
				>What happens when the system fails?<textarea
					aria-label="Monitoring and fallback plan"
					rows="3"
					disabled={Boolean(commitment)}
					bind:value={monitoring}
					placeholder="Name an owner, what triggers review, how to handle an unanswered policy question, and when to update documents or retrain."
				></textarea></label
			>
		</div>
		<div class="commitment-actions">
			{#if !commitment}<button class="primary-button" disabled={!canCommit} onclick={commitSystem}
					><PatternIcon name="lock" size={16} />Commit this system</button
				>
				<p>
					{!currentValidation
						? 'Run validation with your current choices first.'
						: !rationale.trim() || !monitoring.trim()
							? 'Write both your rationale and fallback plan to commit.'
							: 'Commit freezes the components, alert threshold, and plan before the final reveal.'}
				</p>{:else}<span class="committed-status"
					><PatternIcon name="lock" size={16} />Choices and plan are frozen.</span
				>{#if !finalReport}<button class="primary-button" onclick={revealFinal}
						><PatternIcon name="eye" size={16} />Reveal final cases</button
					>{:else if !changedReport}<button class="primary-button" onclick={changeConditions}
						><PatternIcon name="shuffle" size={16} />Change the conditions</button
					>{:else}<button class="small-button" onclick={newRound}
						><PatternIcon name="reset" size={15} />Start another development round</button
					>{/if}<button class="small-button" onclick={exportPlan}
					><PatternIcon name="download" size={15} />Export plan and evidence</button
				>{/if}
		</div>
		{#if exported}<p role="status">Plan and revealed evidence exported as JSON.</p>{/if}
	</div>
	{#if finalReport}<div class="reflection">
			<strong>What did the final cases expose?</strong>
			<p>
				The policy set includes a paraphrase and a question whose answer is absent. Keyword search
				can miss a relevant source; a review queue makes that failure visible without supplying an
				answer. Improving it now requires another development round, not relabeling these cases as
				untouched.
			</p>
		</div>{/if}
	{#if changedReport}<div class="changed-note" role="status">
			<PatternIcon name="alert" size={20} />
			<div>
				<strong>The shop has changed.</strong>
				<p>
					Returns now allow 30 days, free shipping starts at $75, and pickup closes at 15:00. A
					nearby shop's closure raises daily demand by 45 parcels from day 43. Your frozen forecast
					saw none of that shift during training. Compare current-document retrieval with the saved
					snapshot and use the alert to discuss your fallback plan.
				</p>
			</div>
		</div>{/if}
	<details class="method-note">
		<summary>Inspect the local data and the experiment's limits</summary>
		<p>
			All calculations run locally on fictional data. Invoice totals multiply integer cents using an
			exact integer calculator. The rough baseline first rounds unit prices to whole dollars. Policy
			search ranks authored passages by keyword overlap and quotes the best passage only when the
			overlap reaches 20%; it does not generate prose or perform semantic retrieval. A human-review
			status only queues work.
		</p>
		<div class="source-documents">
			{#each shopDocuments(Boolean(changedReport)) as document (document.id)}<p>
					<strong>[{document.id}] {document.title}</strong><br />{document.body}
				</p>{/each}
		</div>
		<p>
			Demand follows a seeded trend plus a weekly sine wave with small bounded noise, then a
			45-parcel increase. The seasonal model is well matched to the original generator by design.
			Its coefficients are learned only from days 1–28. Validation reveals days 29–35, final
			evaluation 36–42, and changed conditions 43–49. Each stage's monitor restarts its three-day
			window.
		</p>
		<p>
			Another round creates new numerical examples from the same narrow generator; question patterns
			remain familiar. This exercise demonstrates a decision process and specific failure modes.
			Deployment needs representative data, a fresh independent evaluation, measured workload
			constraints, and someone accountable for unresolved cases.
		</p>
	</details>
</section>

<style>
	.system-lab {
		background: var(--surface);
		color: var(--ink);
		border-radius: 24px;
		padding: clamp(20px, 3vw, 38px);
		container-type: inline-size;
	}
	header,
	.evidence-heading {
		display: flex;
		justify-content: space-between;
		align-items: center;
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
		font-size: 12px;
		line-height: 1.8;
		color: var(--muted);
	}
	.intro {
		font-size: 13px;
		max-width: 810px;
		margin: 18px 0 25px;
	}
	.brief {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 22px;
		padding: 22px;
		background: var(--lab-inset);
		border-radius: 14px;
		margin-bottom: 30px;
	}
	.brief span {
		color: var(--blue);
		font: 9px var(--mono);
		letter-spacing: 1px;
	}
	.brief p {
		margin-bottom: 0;
		font-size: 11px;
	}
	.system-workspace {
		display: grid;
		grid-template-columns: 280px minmax(0, 1fr);
		gap: 32px;
	}
	.system-controls,
	.evidence-panel {
		min-width: 0;
	}
	fieldset {
		border: 0;
		margin: 0 0 24px;
		padding: 0;
	}
	legend {
		display: flex;
		align-items: center;
		gap: 9px;
		font-size: 13px;
		color: var(--ink);
		font-weight: 550;
		margin-bottom: 14px;
	}
	fieldset label {
		display: flex;
		align-items: start;
		gap: 10px;
		margin: 12px 0;
		font-size: 12px;
		line-height: 1.6;
	}
	fieldset input[type='radio'],
	fieldset input[type='checkbox'] {
		margin-top: 4px;
		flex-shrink: 0;
	}
	fieldset small {
		display: block;
		font-size: 10px;
		color: var(--quiet);
	}
	.review-choice {
		border-top: 1px solid var(--line);
		padding-top: 12px;
	}
	fieldset .alert-control {
		display: block;
		margin-top: 20px;
		font-size: 11px;
		color: var(--muted);
	}
	.alert-control output {
		color: var(--blue);
		font-family: var(--mono);
	}
	.alert-control input {
		width: 100%;
		min-height: 28px;
		margin-top: 10px;
	}
	.primary-button {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		font-size: 12px;
		padding: 11px 15px;
		min-height: 42px;
	}
	.control-note {
		font-size: 10px;
	}
	.evidence-heading span {
		color: var(--quiet);
		font-size: 10px;
	}
	.report-tabs {
		display: flex;
		gap: 7px;
		margin: 20px 0;
		flex-wrap: wrap;
	}
	.report-tabs button,
	.small-button {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		font-size: 11px;
		border: 1px solid var(--line);
		border-radius: 9px;
		background: var(--lab-inset);
		padding: 10px 12px;
		color: var(--muted);
		min-height: 42px;
	}
	.report-tabs button[aria-pressed='true'] {
		color: var(--blue);
		border-color: var(--blue);
	}
	.score-grid {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 12px;
	}
	.score-grid > div {
		background: var(--lab-inset);
		border-radius: 11px;
		padding: 17px;
	}
	.score-grid span,
	.score-grid small {
		display: block;
		font-size: 10px;
		color: var(--muted);
		line-height: 1.7;
	}
	.score-grid strong {
		display: block;
		font: 23px var(--mono);
		margin: 10px 0 5px;
		color: var(--blue);
	}
	.empty-evidence {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		padding: 30px 20px;
		background: var(--lab-inset);
		border-radius: 12px;
	}
	.empty-evidence strong {
		font-size: 13px;
		margin-top: 15px;
	}
	.empty-evidence p {
		max-width: 360px;
		font-size: 11px;
		margin-bottom: 0;
	}
	details {
		margin-top: 18px;
	}
	summary {
		cursor: pointer;
		font-size: 12px;
		color: var(--muted);
		line-height: 1.7;
	}
	.table-wrap {
		overflow-x: auto;
	}
	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 10px;
		text-align: left;
		margin-top: 12px;
	}
	td,
	th {
		padding: 10px 7px;
		border-bottom: 1px solid var(--line);
	}
	th {
		font-weight: 500;
		color: var(--muted);
	}
	.policy-answer {
		border-left: 2px solid var(--line);
		padding-left: 13px;
		margin: 19px 0;
	}
	.policy-answer strong {
		font-size: 12px;
		font-weight: 550;
	}
	.policy-answer p {
		margin: 6px 0;
	}
	.policy-answer > span {
		display: block;
		font-size: 10px;
		color: var(--blue);
	}
	.policy-answer > span.failed {
		color: var(--orange);
	}
	.policy-answer small {
		display: block;
		color: var(--quiet);
		font-size: 10px;
		line-height: 1.7;
		margin-top: 8px;
	}
	.demand-heading {
		display: flex;
		justify-content: space-between;
		gap: 12px;
		margin: 25px 0 8px;
		flex-wrap: wrap;
	}
	.demand-heading strong {
		font-size: 12px;
		font-weight: 550;
	}
	.demand-heading > span {
		color: var(--quiet);
		font-size: 10px;
	}
	.demand-chart {
		width: 100%;
	}
	.demand-chart text {
		fill: var(--muted);
		font: 11px var(--sans);
	}
	.chart-key {
		display: flex;
		gap: 20px;
		color: var(--quiet);
		font-size: 10px;
	}
	.chart-key span {
		display: flex;
		align-items: center;
		gap: 7px;
	}
	.chart-key i {
		display: block;
		width: 12px;
		height: 4px;
		background: var(--blue);
		border-radius: 2px;
	}
	.chart-key i.prediction-key {
		background: var(--lavender);
	}
	.monitor-message {
		display: flex;
		align-items: start;
		gap: 10px;
		background: var(--lab-inset);
		border-radius: 11px;
		padding: 15px;
		margin-top: 20px;
	}
	.monitor-message p {
		font-size: 11px;
		margin: 0;
		flex: 1;
	}
	.monitor-message.triggered {
		color: var(--orange);
	}
	.commitment-panel {
		border-top: 1px solid var(--line);
		padding-top: 26px;
		margin-top: 30px;
	}
	.commitment-heading {
		display: flex;
		align-items: start;
		gap: 13px;
	}
	.commitment-heading p {
		margin: 6px 0 0;
	}
	.plan-fields {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 22px;
		margin-top: 20px;
	}
	.plan-fields label {
		font-size: 12px;
		color: var(--muted);
	}
	textarea {
		width: 100%;
		min-height: 100px;
		border: 1px solid var(--line);
		background: var(--input);
		color: var(--ink);
		border-radius: 9px;
		padding: 12px;
		font: 12px/1.7 var(--sans);
		resize: vertical;
		margin-top: 9px;
	}
	.commitment-actions {
		display: flex;
		gap: 12px;
		flex-wrap: wrap;
		align-items: center;
		margin-top: 18px;
	}
	.commitment-actions p {
		font-size: 11px;
	}
	.committed-status {
		display: flex;
		align-items: center;
		gap: 8px;
		color: var(--blue);
		font-size: 11px;
	}
	.stale-result {
		color: var(--orange);
		font-size: 11px;
	}
	.reflection,
	.changed-note {
		padding: 20px;
		background: var(--lab-inset);
		border-radius: 12px;
		margin-top: 22px;
	}
	.reflection strong,
	.changed-note strong {
		color: var(--blue);
		font-size: 12px;
		font-weight: 550;
	}
	.reflection p,
	.changed-note p {
		font-size: 11px;
		margin-bottom: 0;
	}
	.changed-note {
		display: flex;
		align-items: start;
		gap: 12px;
		color: var(--orange);
	}
	.changed-note > div {
		flex: 1;
		min-width: 0;
	}
	.method-note {
		border-top: 1px solid var(--line);
		padding-top: 20px;
		margin-top: 25px;
	}
	.source-documents {
		border-left: 2px solid var(--lavender);
		padding-left: 15px;
	}
	@container (max-width: 760px) {
		.system-workspace {
			grid-template-columns: 1fr;
		}
		.plan-fields {
			grid-template-columns: 1fr;
			gap: 16px;
		}
	}
	@container (max-width: 430px) {
		.brief {
			grid-template-columns: 1fr;
			gap: 12px;
			padding: 17px;
		}
		.score-grid {
			grid-template-columns: 1fr 1fr;
		}
		.score-grid > div {
			padding: 13px;
		}
		.score-grid > div:last-child {
			grid-column: 1 / -1;
		}
		.evidence-heading {
			align-items: start;
			flex-direction: column;
			gap: 8px;
		}
	}
</style>
