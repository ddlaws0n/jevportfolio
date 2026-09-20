/**
 * Record a real 1,000-account triage run and commit it as the page's baseline.
 *
 *   bun run baseline              # full portfolio
 *   bun run baseline -- --limit 25 --concurrency 8
 *
 * Everything the homepage reports — elapsed time, tokens, cost — comes out of
 * this run. Nothing here is estimated or rounded up for the demo.
 */

import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { BASELINE_VERSION, type Baseline } from "#/lib/portfolio/baseline";
import { DEFAULT_SEED, generatePortfolio } from "#/lib/portfolio/generate";
import { JEV_MODEL, QUESTIONS_PER_ACCOUNT } from "#/lib/portfolio/questions";
import type { AccountJudgments, Telemetry } from "#/lib/portfolio/types";
import {
	DEFAULT_CONCURRENCY,
	DEFAULT_REQUESTS_PER_SECOND,
	runTriage,
} from "#/server/judge.server";
import { estimateCostUsd, hasApiKey } from "#/server/typesafe.server";

const OUT = resolve(import.meta.dirname, "../src/data/baseline.json");

function flag(name: string, fallback: number): number {
	const i = process.argv.indexOf(`--${name}`);
	if (i === -1) return fallback;
	const value = Number(process.argv[i + 1]);
	return Number.isFinite(value) ? value : fallback;
}

async function main() {
	if (!hasApiKey()) {
		console.error(
			"TYPESAFE_API_KEY is not set.\n" +
				"Try: op run --env-file .env.op -- bun run baseline\n" +
				"or put the key in .env.local.",
		);
		process.exit(1);
	}

	const seed = flag("seed", DEFAULT_SEED);
	const concurrency = flag("concurrency", DEFAULT_CONCURRENCY);
	const rps = flag("rps", DEFAULT_REQUESTS_PER_SECOND);
	const all = generatePortfolio(seed);
	const limit = flag("limit", all.length);
	const accounts = all.slice(0, limit);

	console.log(
		`Triaging ${accounts.length} accounts · ${QUESTIONS_PER_ACCOUNT} questions each · ` +
			`${accounts.length * QUESTIONS_PER_ACCOUNT} judgments · concurrency ${concurrency} · ${rps} req/s`,
	);

	const judgments: Record<string, AccountJudgments> = {};
	let inputTokens = 0;
	let outputTokens = 0;
	let failures = 0;
	let done = 0;
	let model = JEV_MODEL;
	const errors = new Map<string, number>();

	const startedAt = performance.now();
	for await (const outcome of runTriage(accounts, {
		concurrency,
		requestsPerSecond: rps,
	})) {
		done += 1;
		inputTokens += outcome.inputTokens;
		outputTokens += outcome.outputTokens;
		model = outcome.model;

		if (outcome.judgments) {
			judgments[outcome.account.id] = outcome.judgments;
		} else {
			failures += 1;
			const key = outcome.error ?? "unknown";
			errors.set(key, (errors.get(key) ?? 0) + 1);
		}

		if (done % 25 === 0 || done === accounts.length) {
			const elapsed = (performance.now() - startedAt) / 1000;
			process.stdout.write(
				`\r  ${done}/${accounts.length}  ${elapsed.toFixed(1)}s  ` +
					`${inputTokens.toLocaleString()} tok  $${estimateCostUsd(inputTokens).toFixed(5)}  ` +
					`${failures} failed   `,
			);
		}
	}
	const elapsedMs = Math.round(performance.now() - startedAt);
	process.stdout.write("\n");

	if (errors.size > 0) {
		console.warn("\nFailures:");
		for (const [message, count] of errors) {
			console.warn(`  ${count}x ${message}`);
		}
	}

	const succeeded = Object.keys(judgments).length;
	if (succeeded === 0) {
		console.error("No accounts were judged. Baseline not written.");
		process.exit(1);
	}

	const telemetry: Telemetry = {
		model,
		accountsProcessed: succeeded,
		questionsPerAccount: QUESTIONS_PER_ACCOUNT,
		judgments: succeeded * QUESTIONS_PER_ACCOUNT,
		requests: accounts.length,
		elapsedMs,
		inputTokens,
		outputTokens,
		estimatedCostUsd: estimateCostUsd(inputTokens),
		concurrency,
		failures,
		recordedAt: new Date().toISOString(),
	};

	const baseline: Baseline = {
		version: BASELINE_VERSION,
		seed,
		telemetry,
		judgments,
	};

	await writeFile(OUT, `${JSON.stringify(baseline)}\n`, "utf8");

	console.log(
		`\nWrote ${OUT}\n` +
			`  model            ${telemetry.model}\n` +
			`  accounts         ${telemetry.accountsProcessed}\n` +
			`  judgments        ${telemetry.judgments}\n` +
			`  elapsed          ${(elapsedMs / 1000).toFixed(2)}s\n` +
			`  input tokens     ${telemetry.inputTokens.toLocaleString()}\n` +
			`  estimated cost   $${telemetry.estimatedCostUsd.toFixed(5)}\n` +
			`  failures         ${telemetry.failures}`,
	);
}

await main();
