/**
 * Every server boundary in the app.
 *
 * These are the only things the browser can call. The TypeSafe key, the SDK and
 * the baseline file all live behind them and none of it is reachable from the
 * client bundle.
 */

import { notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getRequest, setResponseHeaders } from "@tanstack/react-start/server";
import { z } from "zod";

import type { PortfolioSnapshot } from "#/lib/portfolio/baseline";
import { generatePortfolio, PORTFOLIO_SIZE } from "#/lib/portfolio/generate";
import { JEV_MODEL, QUESTIONS_PER_ACCOUNT } from "#/lib/portfolio/questions";
import { ACCOUNT_ID } from "#/lib/portfolio/search";
import { countBands, triageAccount } from "#/lib/portfolio/triage";
import type {
	Telemetry,
	TriagedAccount,
	TriageEvent,
} from "#/lib/portfolio/types";
import { recordSpend, reserveRun } from "#/server/budget.server";
import { runTriage } from "#/server/judge.server";
import {
	type ArchetypeAudit,
	findTriagedAccount,
	getArchetypeAudit,
	getSnapshot,
} from "#/server/snapshot.server";
import { estimateCostUsd, hasApiKey } from "#/server/typesafe.server";

/** Snapshot of the committed baseline run. Identical for every visitor. */
export const getPortfolioSnapshot = createServerFn({ method: "GET" }).handler(
	async (): Promise<PortfolioSnapshot & { liveRunAvailable: boolean }> => {
		// Public and identity-independent, so a shared cache is safe here.
		setResponseHeaders(
			new Headers({
				"Cache-Control": "public, max-age=60",
				"CDN-Cache-Control": "max-age=3600, stale-while-revalidate=86400",
			}),
		);
		return { ...getSnapshot(), liveRunAvailable: hasApiKey() };
	},
);

const accountIdSchema = z.object({
	accountId: z
		.string()
		.regex(ACCOUNT_ID, "Expected an account id like ACC-0138"),
});

/** Full detail for one account: inputs, raw judgments, derived scores. */
export const getAccountDetail = createServerFn({ method: "GET" })
	.validator(accountIdSchema)
	.handler(async ({ data }): Promise<TriagedAccount> => {
		const row = findTriagedAccount(data.accountId);
		if (!row) throw notFound();
		setResponseHeaders(new Headers({ "Cache-Control": "public, max-age=300" }));
		return row;
	});

/** Ground truth vs. Jev, for the methodology page. */
export const getMethodology = createServerFn({ method: "GET" }).handler(
	async (): Promise<{
		audit: ArchetypeAudit[];
		telemetry: Telemetry | null;
		bands: ReturnType<typeof countBands>;
	}> => {
		// Derived entirely from the committed baseline, so it is as cacheable as
		// the snapshot itself.
		setResponseHeaders(
			new Headers({
				"Cache-Control": "public, max-age=300",
				"CDN-Cache-Control": "max-age=3600, stale-while-revalidate=86400",
			}),
		);
		const snapshot = getSnapshot();
		return {
			audit: getArchetypeAudit(),
			telemetry: snapshot.telemetry,
			bands: snapshot.bands,
		};
	},
);

/**
 * What the live runner page needs before the visitor presses anything.
 *
 * Takes no seed: the portfolio is the same size for every one of them, and
 * building 1,000 accounts per distinct seed would let an unauthenticated caller
 * burn CPU and evict the generator's cache at will.
 */
export const getRunnerStatus = createServerFn({ method: "GET" }).handler(
	async (): Promise<{
		liveRunAvailable: boolean;
		model: string;
		questionsPerAccount: number;
		portfolioSize: number;
		baselineTelemetry: Telemetry | null;
	}> => ({
		liveRunAvailable: hasApiKey(),
		model: JEV_MODEL,
		questionsPerAccount: QUESTIONS_PER_ACCOUNT,
		portfolioSize: PORTFOLIO_SIZE,
		baselineTelemetry: getSnapshot().telemetry,
	}),
);

export const liveRunSchema = z.object({
	size: z.union([
		z.literal(50),
		z.literal(150),
		z.literal(400),
		z.literal(1000),
	]),
	concurrency: z.number().int().min(1).max(120),
	seed: z
		.number()
		.int()
		.min(0)
		.max(2 ** 31 - 1),
});

export type LiveRunInput = z.infer<typeof liveRunSchema>;

type ProgressResult = Extract<
	TriageEvent,
	{ type: "progress" }
>["results"][number];

/**
 * Run a real triage now and stream it.
 *
 * Yields a typed `TriageEvent` per batch of completed accounts, so the client
 * watches the counters move against real API responses rather than a simulated
 * progress bar.
 */
export const streamLiveTriage = createServerFn({ method: "POST" })
	.validator(liveRunSchema)
	.handler(async function* ({ data }): AsyncGenerator<TriageEvent> {
		if (!hasApiKey()) {
			yield {
				type: "error",
				message:
					"No TypeSafe API key is configured on this deployment, so the live run is disabled. The recorded baseline below is a real run.",
			};
			return;
		}

		// Anyone on the internet can press this button, so it spends from a capped
		// hourly budget rather than straight from the API key.
		const reservation = reserveRun(data.size, estimateCostUsd);
		if (!reservation.ok) {
			yield { type: "error", message: reservation.reason };
			return;
		}

		// Stop paying for a run the visitor has already navigated away from.
		const signal = getRequest().signal;
		const accounts = generatePortfolio(data.seed).slice(0, data.size);

		yield {
			type: "start",
			total: accounts.length,
			concurrency: data.concurrency,
			model: JEV_MODEL,
		};

		let done = 0;
		let inputTokens = 0;
		let outputTokens = 0;
		let failures = 0;
		let succeeded = 0;
		let model = JEV_MODEL;
		const rows: TriagedAccount[] = [];
		let pending: ProgressResult[] = [];

		const startedAt = performance.now();
		// Batch frames so a 1,000-account run does not emit 1,000 chunks.
		const frameSize = Math.max(5, Math.round(accounts.length / 60));

		try {
			for await (const outcome of runTriage(accounts, {
				concurrency: data.concurrency,
				// Ask for a request rate matching the worker count — the workers are
				// what issue requests, so a lower ceiling would just idle them. This is
				// a request, not a grant: `runTriage` clamps it to
				// `MAX_REQUESTS_PER_SECOND`, because `concurrency` comes from the URL
				// and the published per-minute cap is not the visitor's to raise.
				requestsPerSecond: data.concurrency,
				signal,
			})) {
				done += 1;
				inputTokens += outcome.inputTokens;
				outputTokens += outcome.outputTokens;
				model = outcome.model;

				if (outcome.judgments) {
					succeeded += 1;
					const row = triageAccount(outcome.account, outcome.judgments);
					rows.push(row);
					pending.push({
						id: row.account.id,
						name: row.account.name,
						band: row.band,
						priorityScore: Math.round(row.priorityScore * 10) / 10,
						churnSignal: row.judgments.churnSignal,
						expansionSignal: row.judgments.expansionSignal,
					});
				} else {
					failures += 1;
				}

				if (pending.length >= frameSize || done === accounts.length) {
					yield {
						type: "progress",
						done,
						total: accounts.length,
						elapsedMs: Math.round(performance.now() - startedAt),
						inputTokens,
						outputTokens,
						estimatedCostUsd: estimateCostUsd(inputTokens),
						judgments: succeeded * QUESTIONS_PER_ACCOUNT,
						failures,
						results: pending,
					};
					pending = [];
				}
			}

			const telemetry: Telemetry = {
				model,
				accountsProcessed: succeeded,
				questionsPerAccount: QUESTIONS_PER_ACCOUNT,
				judgments: succeeded * QUESTIONS_PER_ACCOUNT,
				requests: accounts.length,
				elapsedMs: Math.round(performance.now() - startedAt),
				inputTokens,
				outputTokens,
				estimatedCostUsd: estimateCostUsd(inputTokens),
				concurrency: data.concurrency,
				failures,
				recordedAt: new Date().toISOString(),
			};

			yield { type: "done", telemetry, bands: countBands(rows) };
		} catch (error) {
			yield {
				type: "error",
				message: error instanceof Error ? error.message : String(error),
			};
		} finally {
			// Charge what was actually spent, including on a run that was abandoned
			// halfway through.
			recordSpend(estimateCostUsd(inputTokens));
			reservation.lease.release();
		}
	});
