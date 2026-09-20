/**
 * Shared, client-safe domain types for the portfolio.
 *
 * Nothing in this module touches the network or `process.env`; it is imported
 * from both the browser bundle and the server bundle.
 */

export const ARCHETYPES = [
	"healthy",
	"healthy_noise",
	"adoption_concern",
	"support_escalation",
	"relationship_risk",
	"renewal_risk",
	"expansion_opportunity",
	"ambiguous",
] as const;

export type Archetype = (typeof ARCHETYPES)[number];

/**
 * The archetypes the generator planted as problems a person should look at.
 * The two healthy variants are the deliberately quiet accounts.
 */
export const QUIET_ARCHETYPES: readonly Archetype[] = [
	"healthy",
	"healthy_noise",
];

export function isPlantedProblem(archetype: string): boolean {
	return !(QUIET_ARCHETYPES as readonly string[]).includes(archetype);
}

export type Segment = "Enterprise" | "Mid-Market" | "SMB";

export interface AccountSupport {
	openTickets: number;
	sev1Last30d: number;
	avgFirstResponseHours: number;
	csat: number | null;
}

export interface AccountEngagement {
	lastCsmMeetingDaysAgo: number;
	qbrsCancelledLast2Q: number;
	execSponsorChanged: boolean;
	championActive: boolean;
	npsLast: number | null;
}

export interface AccountCommercial {
	seatsRequested: number | null;
	pricingRequested: boolean;
	discountRequested: boolean;
	competitorMentioned: string | null;
	paymentIssues: boolean;
	multiYearDiscussed: boolean;
}

export interface Account {
	id: string;
	name: string;
	segment: Segment;
	industry: string;
	arrGbp: number;
	seats: number;
	tenureMonths: number;
	renewalInDays: number;
	usage30dDeltaPct: number;
	activeUsers30dDeltaPct: number;
	featureAdoptionPct: number;
	loginsPerSeat30d: number;
	support: AccountSupport;
	engagement: AccountEngagement;
	commercial: AccountCommercial;
	notes: string[];
	/**
	 * Generator intent. Never sent to Jev — it exists only so the methodology
	 * page can compare the scenario the generator planted against what Jev
	 * actually found. It is a synthetic label, not an observed outcome.
	 */
	archetype: Archetype;
}

/** The account shape that is actually sent to Jev as `state`. */
export type AccountState = Omit<Account, "archetype" | "id">;

export const PRIMARY_REASONS = [
	"adoption",
	"support",
	"relationship",
	"commercial",
	"renewal",
	"expansion",
	"none",
] as const;
export type PrimaryReason = (typeof PRIMARY_REASONS)[number];

export const OWNERS = [
	"CSM",
	"TAM",
	"AE",
	"Support",
	"Leadership",
	"No action",
] as const;
export type Owner = (typeof OWNERS)[number];

/** A Choice answer, narrowed to the option set we defined. */
export interface ChoiceAnswer<T extends string> {
	choice: T;
	confidence: number;
	probabilities: Record<T, number>;
}

/** A Score answer over a fixed, ordered rubric. */
export interface ScoreAnswer {
	score: number;
	confidence: number;
	probabilities: Record<string, number>;
}

/**
 * The six raw Jev judgments for one account, exactly as returned.
 *
 * These are deliberately stored raw. Every band, ranking and lens in the app is
 * recomputed from them in code, so changing a weight never requires re-running
 * inference.
 */
export interface AccountJudgments {
	needsAttention: number;
	churnSignal: number;
	expansionSignal: number;
	urgency: ScoreAnswer;
	primaryReason: ChoiceAnswer<PrimaryReason>;
	owner: ChoiceAnswer<Owner>;
}

export type PriorityBand = "act-now" | "review" | "healthy";

export interface TriagedAccount {
	account: Account;
	judgments: AccountJudgments;
	band: PriorityBand;
	/** Blended 0-100 priority. */
	priorityScore: number;
	/** 0-100 retention-risk lens. */
	riskScore: number;
	/** 0-100 expansion/sales lens. */
	salesScore: number;
	/** True when a Choice answer was too diffuse to act on unreviewed. */
	lowConfidence: boolean;
}

export interface Telemetry {
	model: string;
	accountsProcessed: number;
	questionsPerAccount: number;
	judgments: number;
	requests: number;
	elapsedMs: number;
	inputTokens: number;
	outputTokens: number;
	estimatedCostUsd: number;
	concurrency: number;
	failures: number;
	recordedAt: string;
}

export interface BandCounts {
	"act-now": number;
	review: number;
	healthy: number;
}

/** Progress frame streamed from the live triage server function. */
export type TriageEvent =
	| { type: "start"; total: number; concurrency: number; model: string }
	| {
			type: "progress";
			done: number;
			total: number;
			elapsedMs: number;
			inputTokens: number;
			outputTokens: number;
			estimatedCostUsd: number;
			judgments: number;
			failures: number;
			results: Array<{
				id: string;
				name: string;
				band: PriorityBand;
				priorityScore: number;
				churnSignal: number;
				expansionSignal: number;
			}>;
	  }
	| { type: "done"; telemetry: Telemetry; bands: BandCounts }
	| { type: "error"; message: string };
