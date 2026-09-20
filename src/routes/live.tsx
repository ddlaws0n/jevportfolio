import {
	createFileRoute,
	Link,
	stripSearchParams,
	useNavigate,
} from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { AgentProgress } from "#/components/agents/loading-states/agent-progress";
import { ThinkingShimmer } from "#/components/agents/loading-states/thinking-shimmer";
import { AnimatedNumber } from "#/components/motion/animated-number";
import { Button } from "#/components/motion/button/base";
import { StatefulButton } from "#/components/motion/button/stateful";
import { Tabs, TabsList, TabsTrigger } from "#/components/motion/tabs";
import { TelemetryStrip } from "#/components/portfolio/TelemetryStrip";
import { count, pct, usd } from "#/lib/format";
import {
	LIVE_RUN_SIZES,
	LIVE_SEARCH_DEFAULTS,
	liveSearchSchema,
} from "#/lib/portfolio/search";
import { BAND_META } from "#/lib/portfolio/triage";
import type {
	BandCounts,
	PriorityBand,
	Telemetry,
	TriageEvent,
} from "#/lib/portfolio/types";
import { cn } from "#/lib/utils";
import {
	getRunnerStatus,
	streamLiveTriage,
} from "#/server/portfolio.functions";

export const Route = createFileRoute("/live")({
	// The console is a client-driven streaming surface: it consumes an async
	// iterator, owns timers and repaints continuously. Rendering it on the server
	// would produce markup that is thrown away on the first frame, so only the
	// loader runs there.
	ssr: "data-only",
	validateSearch: liveSearchSchema,
	search: { middlewares: [stripSearchParams(LIVE_SEARCH_DEFAULTS)] },
	loaderDeps: ({ search }) => ({ seed: search.seed }),
	loader: ({ deps }) => getRunnerStatus({ data: { seed: deps.seed } }),
	head: () => ({
		meta: [
			{ title: "Live run — 1000 Accounts" },
			{
				name: "description",
				content:
					"Trigger a real portfolio triage against the TypeSafe API and watch the judgments, tokens and cost arrive.",
			},
		],
	}),
	component: LiveRunner,
});

type Status = "idle" | "running" | "done" | "error";

interface Finding {
	id: string;
	name: string;
	band: PriorityBand;
	churnSignal: number;
	expansionSignal: number;
}

const EMPTY_BANDS: BandCounts = { "act-now": 0, review: 0, healthy: 0 };

function LiveRunner() {
	const status = Route.useLoaderData();
	const search = Route.useSearch();
	const navigate = useNavigate({ from: Route.fullPath });
	const run = useServerFn(streamLiveTriage);

	const [state, setState] = useState<Status>("idle");
	const [error, setError] = useState<string | null>(null);
	const [done, setDone] = useState(0);
	const [elapsedMs, setElapsedMs] = useState(0);
	const [inputTokens, setInputTokens] = useState(0);
	const [judgments, setJudgments] = useState(0);
	const [failures, setFailures] = useState(0);
	const [costUsd, setCostUsd] = useState(0);
	const [bands, setBands] = useState<BandCounts>(EMPTY_BANDS);
	const [telemetry, setTelemetry] = useState<Telemetry | null>(null);
	const [findings, setFindings] = useState<Finding[]>([]);
	const [cellBands, setCellBands] = useState<Record<string, PriorityBand>>({});

	const abortRef = useRef<AbortController | null>(null);

	useEffect(() => () => abortRef.current?.abort(), []);

	const reset = useCallback(() => {
		setError(null);
		setDone(0);
		setElapsedMs(0);
		setInputTokens(0);
		setJudgments(0);
		setFailures(0);
		setCostUsd(0);
		setBands(EMPTY_BANDS);
		setTelemetry(null);
		setFindings([]);
		setCellBands({});
	}, []);

	const start = useCallback(async () => {
		abortRef.current?.abort();
		const controller = new AbortController();
		abortRef.current = controller;

		reset();
		setState("running");

		try {
			const stream = await run({
				data: {
					size: search.size,
					concurrency: search.concurrency,
					seed: search.seed,
				},
				signal: controller.signal,
			});

			for await (const event of stream as AsyncIterable<TriageEvent>) {
				if (controller.signal.aborted) return;

				if (event.type === "progress") {
					setDone(event.done);
					setElapsedMs(event.elapsedMs);
					setInputTokens(event.inputTokens);
					setJudgments(event.judgments);
					setFailures(event.failures);
					setCostUsd(event.estimatedCostUsd);
					setCellBands((prev) => {
						const next = { ...prev };
						for (const result of event.results) next[result.id] = result.band;
						return next;
					});
					const flagged = event.results.filter((r) => r.band !== "healthy");
					if (flagged.length > 0) {
						setFindings((prev) => [...flagged, ...prev].slice(0, 12));
					}
				} else if (event.type === "done") {
					setTelemetry(event.telemetry);
					setBands(event.bands);
					setElapsedMs(event.telemetry.elapsedMs);
					setState("done");
				} else if (event.type === "error") {
					setError(event.message);
					setState("error");
				}
			}
		} catch (cause) {
			if (controller.signal.aborted) return;
			setError(cause instanceof Error ? cause.message : String(cause));
			setState("error");
		}
	}, [run, reset, search.size, search.concurrency, search.seed]);

	const cells = useMemo(
		() =>
			Array.from(
				{ length: search.size },
				(_, i) => `ACC-${String(i + 1).padStart(4, "0")}`,
			),
		[search.size],
	);

	const pending = state === "running";
	const progress = done / search.size;

	return (
		<div className="mx-auto w-full max-w-[1100px] px-4 pb-16 pt-12 sm:px-6">
			<p className="label-caps">Live run</p>
			<h1 className="mt-3 text-balance text-4xl font-bold tracking-tight">
				Run it yourself.
			</h1>
			<p className="mt-4 max-w-2xl text-pretty text-muted-foreground">
				This calls the TypeSafe API right now, from this deployment, with the
				same six questions per account. The counters below move as real
				responses land — the server function streams a frame per batch of
				completed accounts.
			</p>

			{!status.liveRunAvailable ? (
				<p className="mt-6 rounded-lg border border-band-review/40 bg-band-review/10 px-4 py-3 text-sm text-band-review">
					This deployment has no TypeSafe API key configured, so the live run is
					disabled. The recorded baseline on the{" "}
					<Link
						to="/"
						search={{ lens: "all", band: "all", sort: "priority" }}
						className="underline underline-offset-4"
					>
						portfolio page
					</Link>{" "}
					is still a real run.
				</p>
			) : null}

			<div className="mt-8 flex flex-col gap-5 rounded-xl border border-border/60 bg-card/50 p-5 sm:flex-row sm:items-end sm:justify-between">
				<div className="space-y-4">
					<div>
						<p className="label-caps mb-2">Accounts to triage</p>
						<Tabs
							value={String(search.size)}
							onValueChange={(value) =>
								void navigate({
									search: (prev) => ({
										...prev,
										size: Number(value) as (typeof LIVE_RUN_SIZES)[number],
									}),
									replace: true,
									resetScroll: false,
								})
							}
							variant="segment"
						>
							<TabsList>
								{LIVE_RUN_SIZES.map((size) => (
									<TabsTrigger key={size} value={String(size)}>
										{count(size)}
									</TabsTrigger>
								))}
							</TabsList>
						</Tabs>
					</div>
					<p className="numeric text-xs text-muted-foreground">
						{count(search.size * status.questionsPerAccount)} judgments ·{" "}
						{status.model} · concurrency {search.concurrency}
					</p>
				</div>

				<div className="flex items-center gap-3">
					{pending ? (
						<Button
							variant="secondary"
							onClick={() => {
								abortRef.current?.abort();
								setState("idle");
							}}
						>
							Stop
						</Button>
					) : null}
					<StatefulButton
						size="lg"
						state={
							state === "running"
								? "loading"
								: state === "done"
									? "success"
									: state === "error"
										? "error"
										: "idle"
						}
						disabled={!status.liveRunAvailable || pending}
						onClick={() => void start()}
						loadingText="Triaging…"
						successText="Run complete"
						errorText="Run failed"
					>
						{state === "done" ? "Run again" : "Triage now"}
					</StatefulButton>
				</div>
			</div>

			{state !== "idle" ? (
				<div className="mt-8 space-y-6">
					<div className="rounded-xl border border-border/60 bg-card/40 p-5">
						<div className="flex flex-wrap items-center justify-between gap-3">
							{pending ? (
								<ThinkingShimmer>
									{count(done)} / {count(search.size)} accounts
								</ThinkingShimmer>
							) : (
								<span className="numeric text-sm font-semibold">
									{count(done)} / {count(search.size)} accounts
								</span>
							)}
							<AgentProgress
								running={pending}
								elapsedSeconds={elapsedMs / 1000}
								label={pending ? "Calling Jev" : "Finished"}
							/>
						</div>

						<div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
							<div
								className="h-full rounded-full bg-primary transition-[width] duration-200 ease-out"
								style={{ width: `${progress * 100}%` }}
							/>
						</div>

						<div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
							<Counter label="Judgments" value={judgments} />
							<Counter label="Input tokens" value={inputTokens} />
							<Metric
								label="Elapsed"
								value={`${(elapsedMs / 1000).toFixed(2)}s`}
							/>
							<Metric label="Cost" value={usd(costUsd)} />
						</div>

						{failures > 0 ? (
							<p className="numeric mt-3 text-xs text-band-review">
								{failures} request{failures === 1 ? "" : "s"} failed after
								retries and were excluded.
							</p>
						) : null}
					</div>

					<p className="sr-only">
						{`Live triage progress: ${done} of ${search.size} accounts judged.`}
					</p>
					<div
						className="grid gap-[3px] sm:gap-1"
						style={{
							gridTemplateColumns: "repeat(auto-fill, minmax(0.5rem, 1fr))",
						}}
						aria-hidden="true"
					>
						{cells.map((id) => {
							const band = cellBands[id];
							return (
								<span
									key={id}
									className={cn(
										"aspect-square rounded-[2px] transition-colors duration-300",
										band ? BAND_META[band].dot : "bg-grid-idle",
									)}
								/>
							);
						})}
					</div>

					{findings.length > 0 ? (
						<div>
							<p className="label-caps mb-2">Flagged as they land</p>
							<ul className="divide-y divide-border/50 rounded-xl border border-border/60">
								{findings.map((finding) => (
									<li
										key={finding.id}
										className="flex items-center justify-between gap-3 px-4 py-2 text-sm"
									>
										<span className="flex min-w-0 items-center gap-2">
											<span
												className={cn(
													"h-2 w-2 shrink-0 rounded-[2px]",
													BAND_META[finding.band].dot,
												)}
											/>
											<span className="truncate">{finding.name}</span>
											<span className="numeric shrink-0 text-[11px] text-muted-foreground">
												{finding.id}
											</span>
										</span>
										<span className="numeric shrink-0 text-xs text-muted-foreground">
											churn {pct(finding.churnSignal)} · expansion{" "}
											{pct(finding.expansionSignal)}
										</span>
									</li>
								))}
							</ul>
						</div>
					) : null}

					{error ? (
						<p className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
							{error}
						</p>
					) : null}

					{telemetry ? (
						<div className="space-y-4">
							<TelemetryStrip telemetry={telemetry} startOnView={false} />
							<div className="grid grid-cols-3 gap-3">
								{(["act-now", "review", "healthy"] as const).map((band) => (
									<div
										key={band}
										className="rounded-xl border border-border/60 bg-card/60 px-4 py-3"
									>
										<span className="flex items-center gap-2">
											<span
												className={cn(
													"h-2 w-2 rounded-[2px]",
													BAND_META[band].dot,
												)}
											/>
											<span className="label-caps">
												{BAND_META[band].short}
											</span>
										</span>
										<span className="numeric mt-1 block text-2xl font-bold">
											{bands[band]}
										</span>
									</div>
								))}
							</div>
							<p className="text-xs text-muted-foreground">
								Same six questions, same code path, same model —{" "}
								{telemetry.model}. Compare against the recorded baseline of{" "}
								{status.baselineTelemetry
									? `${count(status.baselineTelemetry.judgments)} judgments in ${(
											status.baselineTelemetry.elapsedMs / 1000
										).toFixed(
											2,
										)}s for ${usd(status.baselineTelemetry.estimatedCostUsd)}`
									: "the recorded run"}
								.
							</p>
						</div>
					) : null}
				</div>
			) : null}
		</div>
	);
}

function Counter({ label, value }: { label: string; value: number }) {
	return (
		<div>
			<span className="numeric block text-2xl font-bold leading-none">
				<AnimatedNumber
					value={value}
					duration={0.35}
					format={(n) => count(Math.round(n))}
				/>
			</span>
			<span className="label-caps">{label}</span>
		</div>
	);
}

function Metric({ label, value }: { label: string; value: string }) {
	return (
		<div>
			<span className="numeric block text-2xl font-bold leading-none">
				{value}
			</span>
			<span className="label-caps">{label}</span>
		</div>
	);
}
