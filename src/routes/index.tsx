import {
	Await,
	createFileRoute,
	Link,
	stripSearchParams,
	useNavigate,
} from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Search } from "lucide-react";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "#/components/motion/button/base";
import { Input } from "#/components/motion/input";
import { Tabs, TabsList, TabsTrigger } from "#/components/motion/tabs";
import { AccountInspector } from "#/components/portfolio/AccountInspector";
import { BandSummary } from "#/components/portfolio/BandSummary";
import { PortfolioGrid } from "#/components/portfolio/PortfolioGrid";
import { PriorityTable } from "#/components/portfolio/PriorityTable";
import { TelemetryStrip } from "#/components/portfolio/TelemetryStrip";
import { count, gbp } from "#/lib/format";
import type { PortfolioSnapshot } from "#/lib/portfolio/baseline";
import { PORTFOLIO_SIZE } from "#/lib/portfolio/generate";
import {
	type BandFilter,
	PORTFOLIO_SEARCH_DEFAULTS,
	portfolioSearchSchema,
} from "#/lib/portfolio/search";
import { type Lens, onLensShortlist } from "#/lib/portfolio/triage";
import type { TriagedAccount } from "#/lib/portfolio/types";
import {
	getAccountDetail,
	getPortfolioSnapshot,
} from "#/server/portfolio.functions";

export const Route = createFileRoute("/")({
	// The hero, the copy and the untriaged grid are the indexable content of this
	// site, so the whole route renders on the server.
	ssr: true,
	validateSearch: portfolioSearchSchema,
	search: {
		middlewares: [stripSearchParams(PORTFOLIO_SEARCH_DEFAULTS)],
	},
	loader: () => ({
		size: PORTFOLIO_SIZE,
		// Deliberately not awaited. The shell and the untriaged grid go out in the
		// first flush; the recorded run streams in behind them.
		snapshot: getPortfolioSnapshot(),
	}),
	component: Home,
});

function Home() {
	const { size, snapshot } = Route.useLoaderData();

	return (
		<>
			<Hero />
			<Suspense fallback={<PortfolioFallback size={size} />}>
				<Await promise={snapshot}>
					{(data) => <Portfolio snapshot={data} />}
				</Await>
			</Suspense>
		</>
	);
}

function Hero() {
	return (
		<section className="console-grain border-b border-border/60">
			<div className="mx-auto w-full max-w-[1400px] px-4 pb-10 pt-14 sm:px-6 sm:pb-14 sm:pt-20">
				<p className="label-caps">Portfolio triage · TypeSafe Jev</p>
				<h1 className="mt-4 max-w-3xl text-balance text-4xl font-bold leading-[1.05] tracking-tight sm:text-6xl">
					Your customer portfolio has 1,000 accounts.
				</h1>
				<p className="mt-4 max-w-2xl text-pretty text-lg text-muted-foreground">
					You have Monday morning to work out who actually needs you. Six
					constrained judgments per account, evaluated in parallel, composed
					into a decision by ordinary code.
				</p>
			</div>
		</section>
	);
}

function PortfolioFallback({ size }: { size: number }) {
	const cells = useMemo(
		() =>
			Array.from({ length: size }, (_, i) => ({
				id: `ACC-${String(i + 1).padStart(4, "0")}`,
				name: "",
				segment: "SMB" as const,
				arrGbp: 0,
				renewalInDays: 0,
				band: "healthy" as const,
				priorityScore: 0,
				riskScore: 0,
				salesScore: 0,
			})),
		[size],
	);

	return (
		<div className="mx-auto w-full max-w-[1400px] px-4 py-10 sm:px-6">
			<div className="flex flex-wrap items-end justify-between gap-4">
				<div>
					<p className="numeric text-5xl font-bold tracking-tight">
						{count(size)}
					</p>
					<p className="label-caps mt-1">accounts · not yet triaged</p>
				</div>
				<Button size="lg" disabled>
					Loading recorded run…
				</Button>
			</div>
			<div className="mt-8 opacity-60">
				<PortfolioGrid
					cells={cells}
					revealed={false}
					lens="all"
					band="all"
					onSelect={() => {}}
				/>
			</div>
		</div>
	);
}

function Portfolio({
	snapshot,
}: {
	snapshot: PortfolioSnapshot & { liveRunAvailable: boolean };
}) {
	const search = Route.useSearch();
	const navigate = useNavigate({ from: Route.fullPath });
	const fetchAccount = useServerFn(getAccountDetail);

	const [revealed, setRevealed] = useState(false);
	const [extra, setExtra] = useState<Record<string, TriagedAccount>>({});
	const [loadingAccount, setLoadingAccount] = useState(false);

	const shortlistById = useMemo(
		() => new Map(snapshot.shortlist.map((row) => [row.account.id, row])),
		[snapshot.shortlist],
	);

	const setSearch = useCallback(
		(next: Partial<typeof search>) => {
			void navigate({
				search: (prev) => ({ ...prev, ...next }),
				replace: true,
				// Changing the question should not throw the reader back to the top.
				resetScroll: false,
			});
		},
		[navigate],
	);

	const selectAccount = useCallback(
		(accountId: string | undefined) => {
			setSearch({ account: accountId });
		},
		[setSearch],
	);

	// The 181 accounts on a shortlist ship with the page. Everything else is one
	// typed server-function call away.
	useEffect(() => {
		const id = search.account;
		if (!id || shortlistById.has(id) || extra[id]) return;
		let cancelled = false;
		setLoadingAccount(true);
		fetchAccount({ data: { accountId: id } })
			.then((row) => {
				if (!cancelled) setExtra((prev) => ({ ...prev, [id]: row }));
			})
			.catch(() => {})
			.finally(() => {
				if (!cancelled) setLoadingAccount(false);
			});
		return () => {
			cancelled = true;
		};
	}, [search.account, shortlistById, extra, fetchAccount]);

	// A shared link that names an account is already a triaged view.
	useEffect(() => {
		if (search.account || search.lens !== "all" || search.band !== "all") {
			setRevealed(true);
		}
	}, [search.account, search.lens, search.band]);

	const lens = search.lens as Lens;

	const tableRows = useMemo(() => {
		const query = (search.q ?? "").trim().toLowerCase();
		return snapshot.shortlist.filter((row) => {
			if (lens !== "all" && !onLensShortlist(row, lens)) return false;
			if (lens === "all" && row.band === "healthy") return false;
			if (search.band !== "all" && row.band !== search.band) return false;
			if (!query) return true;
			return `${row.account.name} ${row.account.id} ${row.account.segment} ${row.account.industry}`
				.toLowerCase()
				.includes(query);
		});
	}, [snapshot.shortlist, lens, search.band, search.q]);

	const selectedRow = search.account
		? (shortlistById.get(search.account) ?? extra[search.account] ?? null)
		: null;

	const telemetry = snapshot.telemetry;

	return (
		<>
			<div className="mx-auto w-full max-w-[1400px] px-4 py-10 sm:px-6">
				<div className="flex flex-wrap items-end justify-between gap-4">
					<div>
						<p className="numeric text-5xl font-bold tracking-tight">
							{count(snapshot.totals.accounts)}
						</p>
						<p className="label-caps mt-1">
							accounts · {gbp(snapshot.totals.arrGbp)} ARR under management
						</p>
					</div>

					{revealed ? (
						<div className="flex flex-wrap items-center gap-3">
							<Button variant="secondary" onClick={() => setRevealed(false)}>
								Reset
							</Button>
							<Link
								to="/live"
								search={{ size: 150, concurrency: 60, seed: 42 }}
							>
								<Button size="lg">Run it live →</Button>
							</Link>
						</div>
					) : (
						<Button size="lg" onClick={() => setRevealed(true)}>
							Triage 1,000 accounts
						</Button>
					)}
				</div>

				<div className="mt-8">
					<PortfolioGrid
						cells={snapshot.cells}
						revealed={revealed}
						lens={lens}
						band={search.band}
						query={search.q}
						selectedId={search.account}
						onSelect={selectAccount}
					/>
				</div>

				{revealed ? (
					<div className="mt-10 space-y-8">
						{telemetry ? (
							<div>
								<div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
									<h2 className="label-caps">Recorded run</h2>
									<p className="numeric text-[11px] text-muted-foreground">
										{telemetry.model} · {telemetry.failures} failures ·{" "}
										{new Date(telemetry.recordedAt).toISOString().slice(0, 10)}
									</p>
								</div>
								<TelemetryStrip telemetry={telemetry} />
								<p className="mt-2 text-xs text-muted-foreground">
									Measured, not estimated. Rebuilt by{" "}
									<code className="rounded bg-card px-1 py-0.5 text-[11px]">
										bun run baseline
									</code>
									.{" "}
									<Link
										to="/live"
										search={{ size: 150, concurrency: 60, seed: 42 }}
										className="text-primary underline decoration-dotted underline-offset-4"
									>
										Run it again live
									</Link>{" "}
									to watch the same thing happen against the API.
								</p>
							</div>
						) : null}

						<BandSummary
							bands={snapshot.bands}
							arr={{
								"act-now": snapshot.totals.actNowArrGbp,
								review: snapshot.totals.reviewArrGbp,
								healthy: snapshot.totals.healthyArrGbp,
							}}
							active={search.band}
							onSelect={(band: BandFilter) => setSearch({ band })}
						/>

						<div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
							<div>
								<p className="label-caps mb-2">Ask the portfolio a question</p>
								<Tabs
									value={search.lens}
									onValueChange={(value) =>
										setSearch({ lens: value as Lens, band: "all" })
									}
									variant="segment"
								>
									<TabsList>
										<TabsTrigger value="all">Needs attention</TabsTrigger>
										<TabsTrigger value="risk">Churn risk</TabsTrigger>
										<TabsTrigger value="sales">Expansion</TabsTrigger>
									</TabsList>
								</Tabs>
							</div>

							<div className="sm:w-72">
								<Input
									value={search.q ?? ""}
									onChange={(value) =>
										setSearch({ q: value.trim() === "" ? undefined : value })
									}
									placeholder="Filter by name, id or segment"
									leftIcon={<Search className="h-4 w-4" />}
								/>
							</div>
						</div>

						<div>
							<div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
								<h2 className="text-sm font-semibold">
									{count(tableRows.length)}{" "}
									{lens === "risk"
										? "accounts with retention evidence"
										: lens === "sales"
											? "accounts with a near-term expansion signal"
											: "accounts Jev flagged for a human"}
								</h2>
								<p className="text-xs text-muted-foreground">
									Same six answers, re-weighted in code. No re-inference.
								</p>
							</div>
							<PriorityTable
								rows={tableRows}
								lens={lens}
								sort={search.sort}
								onSortChange={(sort) => setSearch({ sort })}
								onSelect={selectAccount}
							/>
						</div>

						<WhatJustHappened />
					</div>
				) : (
					<p className="mt-8 max-w-xl text-sm text-muted-foreground">
						Nothing has been evaluated yet. Press the button to reveal a
						recorded run of{" "}
						<span className="numeric font-semibold text-foreground">
							{count((telemetry?.judgments ?? 0) || 6000)}
						</span>{" "}
						judgments across the portfolio.
					</p>
				)}
			</div>

			<AccountInspector
				row={selectedRow}
				loading={loadingAccount}
				open={Boolean(search.account)}
				onClose={() => selectAccount(undefined)}
			/>
		</>
	);
}

function WhatJustHappened() {
	return (
		<section className="rounded-xl border border-border/60 bg-card/50 p-6">
			<h2 className="text-sm font-semibold">What just happened?</h2>
			<div className="mt-4 grid gap-6 md:grid-cols-2">
				<div>
					<p className="label-caps mb-2">A traditional health score</p>
					<pre className="numeric overflow-x-auto rounded-lg border border-border/60 bg-background p-4 text-[11px] leading-relaxed text-muted-foreground">
						{`usage down 20%     → +20 risk
renewal < 90 days  → +10 risk
ticket open        → +10 risk
───────────────────────────
score 40 → "at risk"`}
					</pre>
					<p className="mt-2 text-xs text-muted-foreground">
						The rule cannot tell a restructure from a rejection, or a feature
						request from an outage. Every account with the same numbers gets the
						same verdict.
					</p>
				</div>
				<div>
					<p className="label-caps mb-2">This page</p>
					<pre className="numeric overflow-x-auto rounded-lg border border-border/60 bg-background p-4 text-[11px] leading-relaxed text-muted-foreground">
						{`"Is this evidence actually meaningful?"   0.92
"Does this suggest churn?"                0.95
"Does this suggest expansion?"            0.08
"How soon must someone act?"              3.6
"What is the dominant theme?"   relationship
"Who should own it?"              Leadership`}
					</pre>
					<p className="mt-2 text-xs text-muted-foreground">
						Jev supplies semantic judgment with calibrated probabilities. The
						thresholds, the weights and the final band stay in{" "}
						<code className="rounded bg-card px-1 py-0.5">triage.ts</code>.{" "}
						<Link
							to="/methodology"
							className="text-primary underline decoration-dotted underline-offset-4"
						>
							See the six questions and the ground-truth audit →
						</Link>
					</p>
				</div>
			</div>
		</section>
	);
}
