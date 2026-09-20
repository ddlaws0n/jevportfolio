import { expect, mock, test } from "bun:test";

// Exercise the server generator without an HTTP runtime or any paid API calls.
mock.module("@tanstack/react-start", () => ({
	createServerFn: () => ({
		validator() {
			return this;
		},
		handler(handler) {
			return handler;
		},
	}),
}));
mock.module("@tanstack/react-start/server", () => ({
	getRequest: () => new Request("http://localhost/live"),
	setResponseHeaders: () => {},
}));

const { streamLiveTriage } = await import("../src/server/portfolio.functions");

test("closing immediately after the start frame releases the budget lease", async () => {
	const originalKey = process.env.TYPESAFE_API_KEY;
	const originalMax = process.env.LIVE_RUN_MAX_CONCURRENT;
	process.env.TYPESAFE_API_KEY = "review-test-not-a-real-key";
	process.env.LIVE_RUN_MAX_CONCURRENT = "1";
	try {
		for (let attempt = 0; attempt < 2; attempt++) {
			const stream = streamLiveTriage({
				data: { size: 50, concurrency: 1, seed: 42 },
			});
			try {
				const first = await stream.next();
				expect(first.value.type).toBe("start");
			} finally {
				await stream.return();
			}
		}
	} finally {
		if (originalKey === undefined) delete process.env.TYPESAFE_API_KEY;
		else process.env.TYPESAFE_API_KEY = originalKey;
		if (originalMax === undefined) delete process.env.LIVE_RUN_MAX_CONCURRENT;
		else process.env.LIVE_RUN_MAX_CONCURRENT = originalMax;
	}
});
