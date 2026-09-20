/**
 * Print what the committed baseline actually says.
 *
 *   bun run audit
 *
 * No API calls: this reads `src/data/baseline.json` and runs it back through
 * the same composition the site uses, so it is a cheap way to see what a weight
 * or threshold change would do to the bands before deploying it.
 */

import { generatePortfolio } from "#/lib/portfolio/generate";
import { countBands, type Lens, onLensShortlist } from "#/lib/portfolio/triage";
import type { Archetype, TriagedAccount } from "#/lib/portfolio/types";
import { getSnapshot, getTriagedRows } from "#/server/snapshot.server";

const snapshot = getSnapshot();
const rows = getTriagedRows();

if (rows.length === 0) {
	console.error("No baseline found. Run `bun run baseline` first.");
	process.exit(1);
}

const t = snapshot.telemetry;
if (t) {
	console.log(
		`Baseline · ${t.model} · ${t.accountsProcessed} accounts · ${t.judgments} judgments · ` +
			`${(t.elapsedMs / 1000).toFixed(2)}s · $${t.estimatedCostUsd.toFixed(5)} · ${t.failures} failures`,
	);
}

console.log("\nBands:", countBands(rows));
for (const lens of ["all", "risk", "sales"] as Lens[]) {
	const n = rows.filter((row) => onLensShortlist(row, lens)).length;
	console.log(`  lens ${lens.padEnd(6)} ${String(n).padStart(4)}`);
}
console.log(
	`  low confidence ${rows.filter((row) => row.lowConfidence).length}`,
);

interface Bucket {
	n: number;
	act: number;
	review: number;
	attention: number;
	churn: number;
	expansion: number;
	urgency: number;
}

const buckets = new Map<Archetype, Bucket>();
for (const row of rows) {
	const key = row.account.archetype;
	const bucket = buckets.get(key) ?? {
		n: 0,
		act: 0,
		review: 0,
		attention: 0,
		churn: 0,
		expansion: 0,
		urgency: 0,
	};
	bucket.n += 1;
	if (row.band === "act-now") bucket.act += 1;
	if (row.band === "review") bucket.review += 1;
	bucket.attention += row.judgments.needsAttention;
	bucket.churn += row.judgments.churnSignal;
	bucket.expansion += row.judgments.expansionSignal;
	bucket.urgency += row.judgments.urgency.score;
	buckets.set(key, bucket);
}

console.log("\narchetype                 n  act  rev | attn churn  exp   urg");
for (const [archetype, b] of buckets) {
	console.log(
		`${archetype.padEnd(24)}${String(b.n).padStart(4)}${String(b.act).padStart(5)}${String(
			b.review,
		).padStart(
			5,
		)} | ${(b.attention / b.n).toFixed(2)}  ${(b.churn / b.n).toFixed(2)}  ${(
			b.expansion / b.n
		).toFixed(2)}  ${(b.urgency / b.n).toFixed(2)}`,
	);
}

function top(list: TriagedAccount[], score: (row: TriagedAccount) => number) {
	return [...list].sort((a, b) => score(b) - score(a)).slice(0, 10);
}

console.log("\nTop 10 by priority:");
for (const row of top(rows, (r) => r.priorityScore)) {
	console.log(
		`  ${row.account.id} ${row.account.name.padEnd(24)} ${row.band.padEnd(9)} ` +
			`p=${row.priorityScore.toFixed(1)} risk=${row.riskScore.toFixed(1)} sales=${row.salesScore.toFixed(1)} ` +
			`${row.judgments.primaryReason.choice}/${row.judgments.owner.choice} [${row.account.archetype}]`,
	);
}

console.log("\nTop 10 by sales lens:");
for (const row of top(rows, (r) => r.salesScore)) {
	console.log(
		`  ${row.account.id} ${row.account.name.padEnd(24)} sales=${row.salesScore.toFixed(1)} ` +
			`expansion=${row.judgments.expansionSignal} [${row.account.archetype}]`,
	);
}

const named = [
	"Acme Corp",
	"Globex",
	"Initech",
	"Hooli Health",
	"Soylent Logistics",
	"Umbrella Retail",
];
const byName = new Map(rows.map((row) => [row.account.name, row]));

console.log("\nHand-authored accounts:");
for (const name of named) {
	const row = byName.get(name);
	if (!row) {
		console.log(`  ${name.padEnd(20)} (missing from the baseline)`);
		continue;
	}
	const j = row.judgments;
	console.log(
		`  ${name.padEnd(20)} ${row.band.padEnd(9)} attn=${j.needsAttention} churn=${j.churnSignal} ` +
			`exp=${j.expansionSignal} urg=${j.urgency.score} ` +
			`${j.primaryReason.choice}(${j.primaryReason.confidence})/${j.owner.choice}(${j.owner.confidence})`,
	);
}

// Sanity: the generator and the baseline must agree on the portfolio.
const generated = generatePortfolio(snapshot.seed);
const mismatch = generated.length - rows.length;
if (mismatch !== 0) {
	console.warn(
		`\nWarning: ${mismatch} generated accounts have no judgments in the baseline. ` +
			"Re-run `bun run baseline` after changing the generator.",
	);
}
