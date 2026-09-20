/**
 * Shape of the committed baseline run and the snapshots derived from it.
 * Client-safe: the route loaders return these types across the wire.
 */

import type {
	AccountJudgments,
	BandCounts,
	PriorityBand,
	Segment,
	Telemetry,
	TriagedAccount,
} from "#/lib/portfolio/types";

export const BASELINE_VERSION = 1;

export interface Baseline {
	version: number;
	seed: number;
	telemetry: Telemetry;
	/** Raw Jev answers, keyed by account id. Nothing derived is stored. */
	judgments: Record<string, AccountJudgments>;
}

/** One square in the 1,000-account grid. Deliberately tiny. */
export interface GridCell {
	id: string;
	name: string;
	segment: Segment;
	arrGbp: number;
	renewalInDays: number;
	band: PriorityBand;
	priorityScore: number;
	riskScore: number;
	salesScore: number;
}

/**
 * Generator intent against Jev's outcome, for the committed run. The
 * "planted" scenarios are synthetic archetypes, not observed churn, so this is
 * an evaluation-set summary rather than an accuracy claim.
 */
export interface EvaluationSummary {
	/** Accounts the generator planted as needing a person. */
	planted: number;
	/** Planted problems that came back "act now" or "review". */
	plantedSurfaced: number;
	/** Deliberately quiet accounts that were flagged anyway. */
	quietFlagged: number;
}

export interface PortfolioSnapshot {
	available: boolean;
	seed: number;
	telemetry: Telemetry | null;
	bands: BandCounts;
	evaluation: EvaluationSummary;
	cells: GridCell[];
	/** Full detail for every account that lands on any lens's shortlist. */
	shortlist: TriagedAccount[];
	totals: {
		accounts: number;
		arrGbp: number;
		actNowArrGbp: number;
		reviewArrGbp: number;
		healthyArrGbp: number;
		expansionArrGbp: number;
		riskArrGbp: number;
	};
}
