/**
 * Deterministic prioritisation.
 *
 * Jev is never asked "is this red, amber or green?". It is asked six narrow
 * questions about evidence, and every band, ranking and lens below is arithmetic
 * over those probabilities. That split is the whole point: changing a weight or
 * a threshold here re-ranks 1,000 accounts instantly and costs nothing, because
 * no inference has to run again.
 */

import type {
	Account,
	AccountJudgments,
	BandCounts,
	PriorityBand,
	TriagedAccount,
} from "#/lib/portfolio/types";

/** Weights for the blended priority score. Tuned by hand, not by Jev. */
export const PRIORITY_WEIGHTS = {
	attention: 35,
	churn: 25,
	expansion: 15,
	urgency: 15,
	renewalProximity: 10,
} as const;

export const BAND_RULES = {
	actNow: { urgency: 3, attention: 0.8 },
	review: { attention: 0.55, churn: 0.55, expansion: 0.65 },
} as const;

/** Below this, a Choice distribution is too diffuse to route on unreviewed. */
export const CHOICE_CONFIDENCE_FLOOR = 0.55;

/** 1.0 at or inside 30 days, decaying to 0.0 at 180 days and beyond. */
export function renewalProximity(renewalInDays: number): number {
	if (renewalInDays <= 30) return 1;
	if (renewalInDays >= 180) return 0;
	return (180 - renewalInDays) / 150;
}

export function bandFor(j: AccountJudgments): PriorityBand {
	if (
		j.urgency.score >= BAND_RULES.actNow.urgency &&
		j.needsAttention > BAND_RULES.actNow.attention
	) {
		return "act-now";
	}
	if (
		j.needsAttention > BAND_RULES.review.attention ||
		j.churnSignal > BAND_RULES.review.churn ||
		j.expansionSignal > BAND_RULES.review.expansion
	) {
		return "review";
	}
	return "healthy";
}

export function priorityScore(account: Account, j: AccountJudgments): number {
	const w = PRIORITY_WEIGHTS;
	return (
		j.needsAttention * w.attention +
		j.churnSignal * w.churn +
		j.expansionSignal * w.expansion +
		(j.urgency.score / 4) * w.urgency +
		renewalProximity(account.renewalInDays) * w.renewalProximity
	);
}

/**
 * The retention lens. Same six answers, re-weighted toward evidence of leaving,
 * with the renewal clock counting for more because risk is time-boxed.
 */
export function riskScore(account: Account, j: AccountJudgments): number {
	const reason = j.primaryReason.probabilities;
	const riskyThemes =
		(reason.renewal ?? 0) + (reason.relationship ?? 0) + (reason.support ?? 0);
	return (
		j.churnSignal * 45 +
		j.needsAttention * 20 +
		(j.urgency.score / 4) * 15 +
		renewalProximity(account.renewalInDays) * 12 +
		riskyThemes * 8
	);
}

/**
 * The sales lens. Expansion evidence dominates, then the model's own belief that
 * the dominant theme is commercial growth and that an AE should own it.
 */
export function salesScore(_account: Account, j: AccountJudgments): number {
	const reason = j.primaryReason.probabilities;
	return (
		j.expansionSignal * 58 +
		(reason.expansion ?? 0) * 18 +
		(j.owner.probabilities.AE ?? 0) * 14 +
		(reason.commercial ?? 0) * 5 +
		(j.urgency.score / 4) * 5
	);
}

export function triageAccount(
	account: Account,
	judgments: AccountJudgments,
): TriagedAccount {
	const band = bandFor(judgments);
	return {
		account,
		judgments,
		band,
		priorityScore: priorityScore(account, judgments),
		riskScore: riskScore(account, judgments),
		salesScore: salesScore(account, judgments),
		// Only meaningful where a routing decision is actually being made. On a
		// healthy account the Choice distributions are diffuse because there is
		// genuinely nothing to characterise, which is not a reason to escalate.
		lowConfidence:
			band !== "healthy" &&
			(judgments.primaryReason.confidence < CHOICE_CONFIDENCE_FLOOR ||
				judgments.owner.confidence < CHOICE_CONFIDENCE_FLOOR),
	};
}

export function countBands(rows: readonly TriagedAccount[]): BandCounts {
	const counts: BandCounts = { "act-now": 0, review: 0, healthy: 0 };
	for (const row of rows) counts[row.band] += 1;
	return counts;
}

export type Lens = "all" | "risk" | "sales";

export function lensScore(row: TriagedAccount, lens: Lens): number {
	if (lens === "risk") return row.riskScore;
	if (lens === "sales") return row.salesScore;
	return row.priorityScore;
}

/** Above this on a lens, the account earns a place on that lens's shortlist. */
export const LENS_THRESHOLD: Record<Lens, number> = {
	all: 45,
	risk: 45,
	sales: 45,
};

export function onLensShortlist(row: TriagedAccount, lens: Lens): boolean {
	if (lens === "all") return row.band !== "healthy";
	return lensScore(row, lens) >= LENS_THRESHOLD[lens];
}

export const BAND_META: Record<
	PriorityBand,
	{ label: string; short: string; tone: string; dot: string; text: string }
> = {
	"act-now": {
		label: "Act now",
		short: "ACT NOW",
		tone: "danger",
		dot: "bg-band-act",
		text: "text-band-act",
	},
	review: {
		label: "Review",
		short: "REVIEW",
		tone: "warning",
		dot: "bg-band-review",
		text: "text-band-review",
	},
	healthy: {
		label: "No action",
		short: "NO ACTION",
		tone: "neutral",
		dot: "bg-band-healthy",
		text: "text-band-healthy",
	},
};
