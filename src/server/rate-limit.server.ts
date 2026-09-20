import { setTimeout as delay } from "node:timers/promises";

/** Per-instance ceiling, shared by every run and every SDK retry. */
export const MAX_REQUESTS_PER_SECOND = 18;

export function rateLimiter(requestsPerSecond: number) {
	let tokens = requestsPerSecond;
	let last = performance.now();
	return async function take(signal?: AbortSignal | null): Promise<void> {
		for (;;) {
			signal?.throwIfAborted();
			const now = performance.now();
			tokens = Math.min(
				requestsPerSecond,
				tokens + ((now - last) / 1000) * requestsPerSecond,
			);
			last = now;
			if (tokens >= 1) {
				tokens -= 1;
				return;
			}
			const waitMs = ((1 - tokens) / requestsPerSecond) * 1000;
			await delay(Math.max(5, waitMs), undefined, {
				signal: signal ?? undefined,
			});
		}
	};
}

// A limiter per run can be bypassed by parallel runs or repeated short runs.
// Applying this at the transport boundary also accounts for automatic retries.
export const takeRequest = rateLimiter(MAX_REQUESTS_PER_SECOND);
