/**
 * Server-only: turn accounts into Jev judgments.
 *
 * One request per account carries all six questions, because TypeSafe evaluates
 * every question in a request against the same `state` in parallel — six
 * questions cost barely more wall-clock than one, and one round trip instead of
 * six.
 */

import type { JsonValue } from "@typesafe-ai/sdk";

import { toAccountState } from "#/lib/portfolio/generate";
import {
	JEV_MODEL,
	PORTFOLIO_QUESTIONS,
	QUESTIONS_PER_ACCOUNT,
} from "#/lib/portfolio/questions";
import type {
	Account,
	AccountJudgments,
	ChoiceAnswer,
	Owner,
	PrimaryReason,
	ScoreAnswer,
} from "#/lib/portfolio/types";
import {
	MAX_REQUESTS_PER_SECOND,
	rateLimiter,
} from "#/server/rate-limit.server";
import { createTypeSafeClient } from "#/server/typesafe.server";

export const DEFAULT_CONCURRENCY = 32;
/** Jev's published cap is 1,200 requests/minute. Stay comfortably under it. */
export const DEFAULT_REQUESTS_PER_SECOND = 18;
export { MAX_REQUESTS_PER_SECOND };

export interface JudgeOutcome {
	account: Account;
	judgments: AccountJudgments | null;
	error: string | null;
	inputTokens: number;
	outputTokens: number;
	model: string;
}

export interface RunTriageOptions {
	concurrency?: number;
	requestsPerSecond?: number;
	signal?: AbortSignal;
}

const round4 = (n: number) => Math.round(n * 10_000) / 10_000;

function roundProbabilities<T extends string>(
	probabilities: Record<string, number>,
): Record<T, number> {
	const out = {} as Record<T, number>;
	for (const [key, value] of Object.entries(probabilities)) {
		out[key as T] = round4(value);
	}
	return out;
}

type RawAnswers = Record<string, Record<string, unknown>>;

function toJudgments(answers: RawAnswers): AccountJudgments {
	const urgency = answers.urgency as unknown as {
		score: number;
		confidence: number;
		probabilities: Record<string, number>;
	};
	const primaryReason = answers.primary_reason as unknown as {
		choice: PrimaryReason;
		confidence: number;
		probabilities: Record<PrimaryReason, number>;
	};
	const owner = answers.owner as unknown as {
		choice: Owner;
		confidence: number;
		probabilities: Record<Owner, number>;
	};

	const urgencyAnswer: ScoreAnswer = {
		score: round4(urgency.score),
		confidence: round4(urgency.confidence),
		probabilities: roundProbabilities(urgency.probabilities),
	};
	const reasonAnswer: ChoiceAnswer<PrimaryReason> = {
		choice: primaryReason.choice,
		confidence: round4(primaryReason.confidence),
		probabilities: roundProbabilities<PrimaryReason>(
			primaryReason.probabilities,
		),
	};
	const ownerAnswer: ChoiceAnswer<Owner> = {
		choice: owner.choice,
		confidence: round4(owner.confidence),
		probabilities: roundProbabilities<Owner>(owner.probabilities),
	};

	return {
		needsAttention: round4(answers.needs_attention.noul as number),
		churnSignal: round4(answers.churn_signal.noul as number),
		expansionSignal: round4(answers.expansion_signal.noul as number),
		urgency: urgencyAnswer,
		primaryReason: reasonAnswer,
		owner: ownerAnswer,
	};
}

export type TypeSafeClientLike = ReturnType<typeof createTypeSafeClient>;

/** Ask Jev the six questions about one account. Never throws. */
export async function judgeAccount(
	client: TypeSafeClientLike,
	account: Account,
	signal?: AbortSignal,
): Promise<JudgeOutcome> {
	try {
		const response = await client.systemOne(
			{
				// The SDK types `state` as an index-signature JSON value; our account
				// record is a plain serialisable object, which TypeScript will not
				// structurally match to an index signature on its own.
				state: toAccountState(account) as unknown as Record<string, JsonValue>,
				questions: PORTFOLIO_QUESTIONS,
				model: JEV_MODEL,
			},
			signal ? { signal } : undefined,
		);

		return {
			account,
			judgments: toJudgments(response.answers as unknown as RawAnswers),
			error: null,
			inputTokens: response.usage.input_tokens,
			outputTokens: response.usage.output_tokens,
			model: response.model,
		};
	} catch (error) {
		return {
			account,
			judgments: null,
			error: error instanceof Error ? error.message : String(error),
			inputTokens: 0,
			outputTokens: 0,
			model: JEV_MODEL,
		};
	}
}

/** Bounded-concurrency map that yields each result the moment it lands. */
async function* mapPool<T, R>(
	items: readonly T[],
	limit: number,
	fn: (item: T) => Promise<R>,
): AsyncGenerator<R> {
	const pending = new Map<number, Promise<{ key: number; value: R }>>();
	let next = 0;

	const fill = () => {
		while (pending.size < limit && next < items.length) {
			const key = next;
			next += 1;
			pending.set(
				key,
				fn(items[key]).then((value) => ({ key, value })),
			);
		}
	};

	fill();
	while (pending.size > 0) {
		const { key, value } = await Promise.race(pending.values());
		pending.delete(key);
		fill();
		yield value;
	}
}

/**
 * Triage a set of accounts, yielding outcomes in completion order so callers can
 * stream progress instead of waiting for the whole portfolio.
 */
export async function* runTriage(
	accounts: readonly Account[],
	options: RunTriageOptions = {},
): AsyncGenerator<JudgeOutcome> {
	const concurrency = Math.max(1, options.concurrency ?? DEFAULT_CONCURRENCY);
	const take = rateLimiter(
		Math.min(
			MAX_REQUESTS_PER_SECOND,
			Math.max(1, options.requestsPerSecond ?? DEFAULT_REQUESTS_PER_SECOND),
		),
	);
	const client = createTypeSafeClient();

	yield* mapPool(accounts, concurrency, async (account) => {
		try {
			await take(options.signal);
			options.signal?.throwIfAborted();
			return judgeAccount(client, account, options.signal);
		} catch {
			return {
				account,
				judgments: null,
				error: "aborted",
				inputTokens: 0,
				outputTokens: 0,
				model: JEV_MODEL,
			} satisfies JudgeOutcome;
		}
	});
}

export { QUESTIONS_PER_ACCOUNT };
