import { afterEach, expect, spyOn, test } from "bun:test";

import { PORTFOLIO_QUESTIONS } from "../src/lib/portfolio/questions";
import {
	accountSearchSchema,
	LIVE_SEARCH_DEFAULTS,
	liveSearchSchema,
	PORTFOLIO_SEARCH_DEFAULTS,
	portfolioSearchSchema,
} from "../src/lib/portfolio/search";
import {
	recordSpend,
	reserveRun,
	TOKENS_PER_ACCOUNT,
} from "../src/server/budget.server";
import { rateLimiter } from "../src/server/rate-limit.server";
import { createTypeSafeClient } from "../src/server/typesafe.server";

const originalEnv = { ...process.env };
afterEach(() => {
	for (const name of [
		"TYPESAFE_API_KEY",
		"LIVE_RUN_BUDGET_USD_PER_HOUR",
		"LIVE_RUN_MAX_CONCURRENT",
	]) {
		if (originalEnv[name] === undefined) delete process.env[name];
		else process.env[name] = originalEnv[name];
	}
});

test("malformed search parameters degrade to safe defaults", () => {
	expect(
		portfolioSearchSchema.parse({ lens: "bogus", band: [], sort: 2 }),
	).toEqual(PORTFOLIO_SEARCH_DEFAULTS);
	expect(
		liveSearchSchema.parse({ size: 7, concurrency: -1, seed: null }),
	).toEqual(LIVE_SEARCH_DEFAULTS);
	expect(accountSearchSchema.parse({ lens: "bogus" })).toEqual({ lens: "all" });
});

test("shared sort URLs preserve direction and the cleared sort state", () => {
	for (const sort of ["priority", "arr", "renewal", "none"]) {
		for (const order of ["asc", "desc"]) {
			const parsed = portfolioSearchSchema.parse({ sort, order });
			expect(parsed.sort).toBe(sort);
			expect(parsed.order).toBe(order);
		}
	}
	expect(portfolioSearchSchema.parse({ order: "bogus" }).order).toBe("desc");
});

test("cancelling a queued request stops its limiter wait", async () => {
	const take = rateLimiter(1);
	await take();
	const controller = new AbortController();
	const queued = take(controller.signal);
	controller.abort();
	await expect(queued).rejects.toThrow();
	await expect(take(controller.signal)).rejects.toThrow();
});

test("budget includes active reservations and releases each lease only once", () => {
	process.env.LIVE_RUN_BUDGET_USD_PER_HOUR = "0.10";
	process.env.LIVE_RUN_MAX_CONCURRENT = "3";
	const estimate = (tokens) => (tokens / TOKENS_PER_ACCOUNT) * 0.06;
	const first = reserveRun(1, estimate);
	expect(first.ok).toBe(true);
	try {
		expect(reserveRun(1, estimate).ok).toBe(false);
	} finally {
		if (first.ok) {
			first.lease.release();
			first.lease.release();
		}
	}
	const next = reserveRun(1, estimate);
	expect(next.ok).toBe(true);
	try {
		expect(reserveRun(1, estimate).ok).toBe(false);
	} finally {
		if (next.ok) next.lease.release();
	}
	recordSpend(0.06);
	expect(reserveRun(1, estimate).ok).toBe(false);
});

test("all clients and SDK retries share the request-rate ceiling", async () => {
	process.env.TYPESAFE_API_KEY = "review-test-not-a-real-key";
	const calls = [];
	const attempts = new Map();
	const fetchSpy = spyOn(globalThis, "fetch").mockImplementation(
		async (_, init) => {
			calls.push(performance.now());
			const { state } = JSON.parse(init.body);
			const attempt = attempts.get(state.id) ?? 0;
			attempts.set(state.id, attempt + 1);
			return new Response(
				JSON.stringify({ answers: {}, usage: {}, model: "test" }),
				{
					status: attempt === 0 ? 503 : 200,
					headers: { "Content-Type": "application/json" },
				},
			);
		},
	);
	try {
		const clients = Array.from({ length: 3 }, () => createTypeSafeClient());
		await Promise.all(
			Array.from({ length: 36 }, (_, id) =>
				clients[id % clients.length].systemOne(
					{ state: { id }, questions: PORTFOLIO_QUESTIONS },
					{ retry: { maxRetries: 1, backoffInitialMs: 0, backoffMaxMs: 0 } },
				),
			),
		);
		expect(calls).toHaveLength(72);
		// Token bucket: at most 18 initially, then 18 per elapsed second.
		for (let i = 0; i < calls.length; i++) {
			expect(i + 1).toBeLessThanOrEqual(
				18 + ((calls[i] - calls[0] + 5) / 1000) * 18,
			);
		}
	} finally {
		fetchSpy.mockRestore();
	}
}, 10000);
