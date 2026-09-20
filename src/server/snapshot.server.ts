/**
 * Server-only: read the committed baseline run and compose it into the shapes
 * the routes send over the wire.
 *
 * The baseline stores nothing but Jev's raw answers. Bands, scores, lenses and
 * totals are all recomputed here from `triage.ts`, which means a weight change
 * is a redeploy, not a re-run.
 */

import rawBaseline from "#/data/baseline.json" with { type: "json" };
import type {
	Baseline,
	EvaluationSummary,
	GridCell,
	PortfolioSnapshot,
} from "#/lib/portfolio/baseline";
import { generatePortfolio } from "#/lib/portfolio/generate";
import {
	countBands,
	LENS_THRESHOLD,
	triageAccount,
} from "#/lib/portfolio/triage";
import {
	type AccountJudgments,
	isPlantedProblem,
	type TriagedAccount,
} from "#/lib/portfolio/types";

const baseline = rawBaseline as unknown as Baseline;

let memo: { rows: TriagedAccount[]; snapshot: PortfolioSnapshot } | null = null;

function build() {
	if (memo) return memo;

	const accounts = generatePortfolio(baseline.seed);
	const rows: TriagedAccount[] = [];
	for (const account of accounts) {
		const judgments = (
			baseline.judgments as Record<string, AccountJudgments | undefined>
		)[account.id];
		if (!judgments) continue;
		rows.push(triageAccount(account, judgments));
	}

	const cells: GridCell[] = rows.map((row) => ({
		id: row.account.id,
		name: row.account.name,
		segment: row.account.segment,
		arrGbp: row.account.arrGbp,
		renewalInDays: row.account.renewalInDays,
		band: row.band,
		priorityScore: Math.round(row.priorityScore * 10) / 10,
		riskScore: Math.round(row.riskScore * 10) / 10,
		salesScore: Math.round(row.salesScore * 10) / 10,
	}));

	// Anything that lands on any lens's shortlist ships with full detail, so the
	// inspector opens instantly for every account a visitor is likely to click.
	const shortlist = rows
		.filter(
			(row) =>
				row.band !== "healthy" ||
				row.riskScore >= LENS_THRESHOLD.risk ||
				row.salesScore >= LENS_THRESHOLD.sales,
		)
		.sort((a, b) => b.priorityScore - a.priorityScore);

	const sum = (predicate: (row: TriagedAccount) => boolean) =>
		rows.reduce(
			(total, row) => (predicate(row) ? total + row.account.arrGbp : total),
			0,
		);

	const snapshot: PortfolioSnapshot = {
		available: rows.length > 0,
		seed: baseline.seed,
		telemetry: baseline.telemetry,
		bands: countBands(rows),
		evaluation: summarizeEvaluation(rows),
		cells,
		shortlist,
		totals: {
			accounts: rows.length,
			arrGbp: sum(() => true),
			actNowArrGbp: sum((row) => row.band === "act-now"),
			reviewArrGbp: sum((row) => row.band === "review"),
			healthyArrGbp: sum((row) => row.band === "healthy"),
			expansionArrGbp: sum((row) => row.judgments.expansionSignal > 0.65),
			riskArrGbp: sum((row) => row.judgments.churnSignal > 0.55),
		},
	};

	memo = { rows, snapshot };
	return memo;
}

/**
 * Planted scenarios against outcomes. Counted off the rows rather than typed in,
 * so a re-run of the baseline or a threshold change moves the number on the
 * page.
 */
export function summarizeEvaluation(
	rows: readonly TriagedAccount[],
): EvaluationSummary {
	let planted = 0;
	let plantedSurfaced = 0;
	let quietFlagged = 0;
	for (const row of rows) {
		const flagged = row.band !== "healthy";
		if (isPlantedProblem(row.account.archetype)) {
			planted += 1;
			if (flagged) plantedSurfaced += 1;
		} else if (flagged) {
			quietFlagged += 1;
		}
	}
	return { planted, plantedSurfaced, quietFlagged };
}

export function getSnapshot(): PortfolioSnapshot {
	return build().snapshot;
}

export function getTriagedRows(): TriagedAccount[] {
	return build().rows;
}

export function findTriagedAccount(accountId: string): TriagedAccount | null {
	return build().rows.find((row) => row.account.id === accountId) ?? null;
}

/** Generator intent vs. what Jev found, per archetype, for the methodology page. */
export interface ArchetypeAudit {
	archetype: string;
	planted: number;
	actNow: number;
	review: number;
	healthy: number;
	avgNeedsAttention: number;
	avgChurnSignal: number;
	avgExpansionSignal: number;
	avgUrgency: number;
}

let auditMemo: ArchetypeAudit[] | null = null;

export function getArchetypeAudit(): ArchetypeAudit[] {
	if (auditMemo) return auditMemo;
	const byArchetype = new Map<string, ArchetypeAudit>();

	for (const row of build().rows) {
		const key = row.account.archetype;
		let entry = byArchetype.get(key);
		if (!entry) {
			entry = {
				archetype: key,
				planted: 0,
				actNow: 0,
				review: 0,
				healthy: 0,
				avgNeedsAttention: 0,
				avgChurnSignal: 0,
				avgExpansionSignal: 0,
				avgUrgency: 0,
			};
			byArchetype.set(key, entry);
		}
		entry.planted += 1;
		if (row.band === "act-now") entry.actNow += 1;
		else if (row.band === "review") entry.review += 1;
		else entry.healthy += 1;
		entry.avgNeedsAttention += row.judgments.needsAttention;
		entry.avgChurnSignal += row.judgments.churnSignal;
		entry.avgExpansionSignal += row.judgments.expansionSignal;
		entry.avgUrgency += row.judgments.urgency.score;
	}

	const order = [
		"healthy",
		"healthy_noise",
		"adoption_concern",
		"support_escalation",
		"relationship_risk",
		"renewal_risk",
		"expansion_opportunity",
		"ambiguous",
	];

	// The baseline is immutable, so this only has to be walked once per instance.
	auditMemo = [...byArchetype.values()]
		.map((entry) => ({
			...entry,
			avgNeedsAttention: entry.avgNeedsAttention / entry.planted,
			avgChurnSignal: entry.avgChurnSignal / entry.planted,
			avgExpansionSignal: entry.avgExpansionSignal / entry.planted,
			avgUrgency: entry.avgUrgency / entry.planted,
		}))
		.sort((a, b) => order.indexOf(a.archetype) - order.indexOf(b.archetype));
	return auditMemo;
}
