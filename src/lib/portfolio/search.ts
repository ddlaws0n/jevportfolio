/**
 * Validated search params.
 *
 * Every piece of view state that should survive a reload or a shared link lives
 * in the URL, parsed through Zod at the route boundary. Nothing downstream ever
 * has to defend against a hand-typed query string.
 */

import { z } from "zod";

export const ACCOUNT_ID = /^ACC-\d{4}$/;

export const lensSchema = z.enum(["all", "risk", "sales"]);
export type LensParam = z.infer<typeof lensSchema>;

export const bandFilterSchema = z.enum(["all", "act-now", "review", "healthy"]);
export type BandFilter = z.infer<typeof bandFilterSchema>;

export const sortSchema = z.enum(["priority", "arr", "renewal"]);
export type SortParam = z.infer<typeof sortSchema>;

// Every field carries a `.catch` as well as a `.default`: a `.default` only
// covers a *missing* param, so without the catch a hand-typed `?lens=bogus`
// throws out of `validateSearch` and takes the whole route down instead of
// falling back — which is exactly what this module promises not to do.
export const portfolioSearchSchema = z.object({
	/** Which semantic question the portfolio is being asked right now. */
	lens: lensSchema.default("all").catch("all"),
	band: bandFilterSchema.default("all").catch("all"),
	/** Free-text filter over account name, id and segment. */
	q: z.string().trim().min(1).max(64).optional().catch(undefined),
	/** Open the inspector on this account. */
	account: z.string().regex(ACCOUNT_ID).optional().catch(undefined),
	sort: sortSchema.default("priority").catch("priority"),
});

export type PortfolioSearch = z.infer<typeof portfolioSearchSchema>;

export const PORTFOLIO_SEARCH_DEFAULTS: PortfolioSearch = {
	lens: "all",
	band: "all",
	sort: "priority",
	q: undefined,
	account: undefined,
};

export const LIVE_RUN_SIZES = [50, 150, 400, 1000] as const;

export const liveSearchSchema = z.object({
	size: z
		.union([z.literal(50), z.literal(150), z.literal(400), z.literal(1000)])
		.default(150)
		.catch(150),
	concurrency: z.number().int().min(1).max(120).default(60).catch(60),
	seed: z
		.number()
		.int()
		.min(0)
		.max(2 ** 31 - 1)
		.default(42)
		.catch(42),
});

export type LiveSearch = z.infer<typeof liveSearchSchema>;

export const LIVE_SEARCH_DEFAULTS: LiveSearch = {
	size: 150,
	concurrency: 60,
	seed: 42,
};

export const accountSearchSchema = z.object({
	/** Where the visitor came from, so "back" returns to the same view. */
	lens: lensSchema.default("all").catch("all"),
});

export const ACCOUNT_SEARCH_DEFAULTS = { lens: "all" } as const;
