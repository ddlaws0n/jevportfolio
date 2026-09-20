/**
 * A wallet guard for the public live-run button.
 *
 * Anyone can press "Triage now" on the deployed site, and every press spends
 * real money. This keeps an in-memory hourly spend window and a cap on
 * simultaneous runs so a burst of traffic cannot quietly drain the API key.
 *
 * In-memory means per-instance: on a serverless platform the ceiling is really
 * "per instance, per hour", which is a floor on protection rather than a
 * guarantee. That is the right trade for a demo — it costs nothing, needs no
 * store, and the failure mode is a clear message rather than a surprise bill.
 */

const HOUR_MS = 60 * 60 * 1000;

/** Measured from the recorded baseline: ~1,845 input tokens per account. */
export const TOKENS_PER_ACCOUNT = 1845;

/**
 * `Number("")` is 0, so an env var that is present but blank would read as a
 * budget of zero and disable the button rather than fall back to the default.
 */
function envNumber(name: string, fallback: number, min: number): number {
	const raw = process.env[name];
	if (raw === undefined || raw.trim() === "") return fallback;
	const value = Number(raw);
	return Number.isFinite(value) && value >= min ? value : fallback;
}

function budgetUsdPerHour(): number {
	return envNumber("LIVE_RUN_BUDGET_USD_PER_HOUR", 2, 0);
}

function maxConcurrentRuns(): number {
	return Math.floor(envNumber("LIVE_RUN_MAX_CONCURRENT", 3, 1));
}

const spend: Array<{ at: number; usd: number }> = [];
let activeRuns = 0;
/**
 * What the in-flight runs are expected to cost. Spend is only recorded when a
 * run ends, so without this every concurrent run would check itself against a
 * window that knows nothing about the others and the cap would be beatable by
 * exactly `maxConcurrentRuns()` times over.
 */
let reservedUsd = 0;

function prune(now: number) {
	while (spend.length > 0 && now - spend[0].at > HOUR_MS) spend.shift();
}

export function spentLastHourUsd(): number {
	const now = Date.now();
	prune(now);
	return spend.reduce((total, entry) => total + entry.usd, 0);
}

export function recordSpend(usd: number) {
	if (usd <= 0) return;
	spend.push({ at: Date.now(), usd });
	prune(Date.now());
}

export interface BudgetLease {
	release: () => void;
}

export type BudgetDecision =
	| { ok: true; lease: BudgetLease }
	| { ok: false; reason: string };

/**
 * Reserve capacity for a run of `accountCount` accounts, or explain why not.
 * The caller must `release()` when the run ends.
 */
export function reserveRun(
	accountCount: number,
	estimateCostUsd: (inputTokens: number) => number,
): BudgetDecision {
	if (activeRuns >= maxConcurrentRuns()) {
		return {
			ok: false,
			reason:
				"Another live run is already in flight on this instance. Give it a few seconds and press it again.",
		};
	}

	const budget = budgetUsdPerHour();
	const projected = estimateCostUsd(accountCount * TOKENS_PER_ACCOUNT);
	const alreadySpent = spentLastHourUsd();
	const committed = alreadySpent + reservedUsd;

	if (committed + projected > budget) {
		return {
			ok: false,
			reason:
				`This deployment caps live runs at $${budget.toFixed(2)} per hour and has already committed ` +
				`$${committed.toFixed(4)}. Try a smaller run, or read the recorded baseline on the portfolio page — ` +
				"it is a real 1,000-account run.",
		};
	}

	activeRuns += 1;
	reservedUsd += projected;
	let released = false;
	return {
		ok: true,
		lease: {
			release: () => {
				if (released) return;
				released = true;
				activeRuns = Math.max(0, activeRuns - 1);
				// The real spend is recorded separately by the caller, so the
				// projection has to come back off the moment the run is over.
				reservedUsd = Math.max(0, reservedUsd - projected);
			},
		},
	};
}
