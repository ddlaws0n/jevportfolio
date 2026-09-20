/**
 * Server-only TypeSafe boundary.
 *
 * Importing this module from the browser bundle throws at module scope, which
 * makes the boundary a build/runtime error rather than a code-review habit. The
 * API key is read per-call (never at module scope) so it is not inlined by the
 * bundler and so it still resolves on runtimes that inject env at request time.
 */

import { TypeSafeClient } from "@typesafe-ai/sdk";

if (typeof window !== "undefined") {
	throw new Error(
		"typesafe.server.ts was imported into a client bundle. Call it through a server function.",
	);
}

/** Published price for Jev input tokens. Output tokens are free. */
export const USD_PER_INPUT_TOKEN = 0.042 / 1_000_000;

export function estimateCostUsd(inputTokens: number): number {
	return inputTokens * USD_PER_INPUT_TOKEN;
}

export class MissingApiKeyError extends Error {
	constructor() {
		super(
			"TYPESAFE_API_KEY is not set. Add it to .env.local (local) or the project's environment (deployed).",
		);
		this.name = "MissingApiKeyError";
	}
}

export function hasApiKey(): boolean {
	return Boolean(process.env.TYPESAFE_API_KEY);
}

/**
 * Build a client for one run. Cheap to construct, and constructing per-run keeps
 * the key read inside the request rather than at module scope.
 */
export function createTypeSafeClient(): TypeSafeClient {
	const apiKey = process.env.TYPESAFE_API_KEY;
	if (!apiKey) throw new MissingApiKeyError();

	return new TypeSafeClient({
		apiKey,
		defaultModel: process.env.TYPESAFE_DEFAULT_MODEL ?? "jev-latest",
		// One account is a small request; a long tail hurts the wall-clock number
		// more than a retry does.
		timeout: 20_000,
		retry: { maxRetries: 3, backoffInitialMs: 400, backoffMaxMs: 6_000 },
		logLevel: "warn",
	});
}
