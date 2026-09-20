/**
 * The six Jev questions asked about every account.
 *
 * This module is deliberately client-safe: the methodology page renders these
 * definitions verbatim, so what the visitor reads is the literal payload sent
 * to `POST /v1/systemone`, not a paraphrase of it.
 *
 * Design notes, following TypeSafe's guidance:
 * - One narrow judgment per question. No question is asked to "analyse the
 *   account"; each asks a single thing the code then composes.
 * - Nothing here decides a priority. Jev supplies evidence; `triage.ts` decides.
 * - All six are independent, so they go out in one request and are evaluated in
 *   parallel against one shared `state`.
 */

import type { OWNERS, PRIMARY_REASONS } from "#/lib/portfolio/types";

export const JEV_MODEL = "jev-latest";

/** Ordered rubric for the urgency Score. Index is the score value. */
export const URGENCY_LEVELS = [
	"Nothing to do. The account is running normally and the next scheduled touchpoint is soon enough.",
	"Worth watching. One soft indicator has moved; note it and look again at the next regular review.",
	"Review within the next two weeks. Several indicators point the same way, or a renewal is approaching without a plan.",
	"Investigate now. There is a live problem or a live opportunity that decays if it is left until the next cycle.",
	"Immediate intervention. The account is failing, leaving, or ready to buy right now, and a delay of days changes the outcome.",
] as const;

export const URGENCY_LABELS = [
	"NONE",
	"MONITOR",
	"REVIEW",
	"INVESTIGATE",
	"IMMEDIATE",
] as const;

const PRIMARY_REASON_CRITERIA: Record<
	(typeof PRIMARY_REASONS)[number],
	string
> = {
	adoption:
		"The dominant issue is that the customer is not using what they bought: low or falling usage, unconfigured workspaces, or stalled onboarding.",
	support:
		"The dominant issue is unresolved product or service failure: live incidents, a backlog of tickets, or slow resolution.",
	relationship:
		"The dominant issue is the human relationship: a lost champion, a changed executive sponsor, cancelled meetings, or a vendor review.",
	commercial:
		"The dominant issue is money or contract mechanics other than the renewal itself: pricing pressure, discount demands, billing or payment problems.",
	renewal:
		"The dominant issue is the renewal event itself. It is close and the outcome is not secured.",
	expansion:
		"The dominant theme is a growth opportunity rather than a problem to fix.",
	none: "There is no dominant issue. Nothing about this account needs characterising.",
};

const OWNER_CRITERIA: Record<(typeof OWNERS)[number], string> = {
	CSM: "Customer Success Manager. Adoption, value realisation, relationship health, and the routine renewal motion.",
	TAM: "Technical Account Manager. Implementation, configuration or integration work that needs hands-on technical ownership.",
	AE: "Account Executive. A commercial conversation: additional seats, pricing, packaging, or negotiating terms.",
	Support:
		"Support. An open technical failure that should be resolved through the support process rather than by a relationship owner.",
	Leadership:
		"Vendor leadership. The account is valuable or severe enough that an executive needs to be personally involved.",
	"No action":
		"Nobody needs to pick this up. Leave it in the normal review cycle.",
};

/**
 * The literal `questions` map for the TypeSafe request.
 *
 * `as const` keeps the Choice option keys and Score arity in the type system,
 * so the SDK infers narrowed answer types for every one of them.
 */
export const PORTFOLIO_QUESTIONS = {
	needs_attention: {
		type: "noul",
		instructions: {
			question:
				"Does this account contain evidence that a person at the vendor should act on it within the next two weeks?",
			guidance:
				"Weigh `notes`, `usage30dDeltaPct`, `activeUsers30dDeltaPct`, `support`, `engagement` and `commercial` together. A single moved number is not evidence; a coherent story across several fields is.",
		},
		criteria: {
			true: "There is concrete evidence of something worth a person's time: a deteriorating trend with a plausible cause, an unresolved failure, a change in the relationship, or a live commercial opening.",
			false:
				"Nothing here is materially different from a normal, well-running account. Routine variation, seasonal dips, ordinary how-to tickets and a distant renewal are not evidence.",
		},
	},
	churn_signal: {
		type: "noul",
		instructions: {
			question:
				"Is there meaningful evidence that this customer's retention is at risk?",
			guidance:
				"Judge the evidence for the customer reducing, not renewing, or replacing the product — not how large or important the account is.",
		},
		criteria: {
			true: "Something in the record points at leaving: sustained disengagement, an unaddressed failure, a lost champion or changed sponsor, a competitor or consolidation review, payment or budget obstacles, or discount demands tied to a near renewal.",
			false:
				"No retention risk beyond ordinary account noise. Falling usage on its own, with a stated benign cause and an engaged champion, is not churn evidence.",
		},
	},
	expansion_signal: {
		type: "noul",
		instructions: {
			question:
				"Is there meaningful evidence of a near-term opportunity to sell this customer more?",
			guidance:
				"'Near-term' means a conversation the vendor could open this quarter. Judge `commercial`, `notes`, and the direction of usage together.",
		},
		criteria: {
			true: "The record shows actionable demand: additional seats requested, pricing or packaging asked for, a new team or region adopting, usage growing against a stated plan, or a sponsor referencing new budget.",
			false:
				"No near-term buying signal. A healthy, stable account with no stated demand is not an expansion opportunity.",
		},
	},
	urgency: {
		type: "score",
		instructions: {
			question:
				"How soon does someone need to act on this account, given everything in the record?",
			guidance:
				"Rate the timing only. A large opportunity and a large problem can both be urgent; a large account that is running fine is not.",
		},
		criteria: URGENCY_LEVELS,
	},
	primary_reason: {
		type: "choice",
		instructions: {
			question:
				"If someone picks this account up, what is the single dominant theme they will be dealing with?",
			guidance:
				"Choose the one theme that best characterises the account right now. Pick `none` when the account is simply running normally.",
		},
		criteria: PRIMARY_REASON_CRITERIA,
	},
	owner: {
		type: "choice",
		instructions: {
			question:
				"Which role at the vendor is best placed to take the next action on this account?",
			guidance:
				"Choose by the kind of work the next action requires, not by account size alone.",
		},
		criteria: OWNER_CRITERIA,
	},
} as const;

export type PortfolioQuestions = typeof PORTFOLIO_QUESTIONS;

export const QUESTION_IDS = Object.keys(PORTFOLIO_QUESTIONS) as Array<
	keyof PortfolioQuestions
>;

export const QUESTIONS_PER_ACCOUNT = QUESTION_IDS.length;

/** Display metadata for the judgment rows in the UI. */
export const QUESTION_META: Record<
	keyof PortfolioQuestions,
	{
		label: string;
		primitive: "Noul" | "Score" | "Choice";
		lens: "risk" | "sales" | "both";
	}
> = {
	needs_attention: {
		label: "Needs attention",
		primitive: "Noul",
		lens: "both",
	},
	churn_signal: { label: "Churn evidence", primitive: "Noul", lens: "risk" },
	expansion_signal: {
		label: "Expansion signal",
		primitive: "Noul",
		lens: "sales",
	},
	urgency: { label: "Urgency", primitive: "Score", lens: "both" },
	primary_reason: { label: "Primary issue", primitive: "Choice", lens: "both" },
	owner: { label: "Suggested owner", primitive: "Choice", lens: "both" },
};
