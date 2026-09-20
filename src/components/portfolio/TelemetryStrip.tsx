import { AnimatedNumber } from "#/components/motion/animated-number";
import { NumberTicker } from "#/components/motion/number-ticker";
import { count, usd } from "#/lib/format";
import type { Telemetry } from "#/lib/portfolio/types";
import { cn } from "#/lib/utils";

function Stat({
	label,
	children,
	footnote,
}: {
	label: string;
	children: React.ReactNode;
	footnote?: string;
}) {
	return (
		<div className="flex flex-col gap-1 px-4 py-4 sm:px-6">
			<span className="numeric text-2xl font-bold leading-none tracking-tight sm:text-3xl">
				{children}
			</span>
			<span className="label-caps">{label}</span>
			{footnote ? (
				<span className="text-[11px] text-muted-foreground/70">{footnote}</span>
			) : null}
		</div>
	);
}

/**
 * The measured run. Every number here came out of a real call to Jev — the
 * baseline is rebuilt with `bun run baseline`, not edited by hand.
 */
export function TelemetryStrip({
	telemetry,
	animate = true,
	/** Count up when scrolled into view. Turn off where the strip can appear far
	 * below the fold, so a reader never scrolls down onto a row of zeroes. */
	startOnView = true,
	className,
}: {
	telemetry: Telemetry;
	animate?: boolean;
	startOnView?: boolean;
	className?: string;
}) {
	return (
		<div
			className={cn(
				"grid grid-cols-2 divide-x divide-y divide-border/60 rounded-xl border border-border/60 bg-card/60 sm:grid-cols-4 sm:divide-y-0",
				className,
			)}
		>
			<Stat label="Accounts">
				{animate ? (
					<NumberTicker
						value={telemetry.accountsProcessed}
						locale
						startOnView={startOnView}
					/>
				) : (
					count(telemetry.accountsProcessed)
				)}
			</Stat>
			<Stat
				label="Jev judgments"
				footnote={`${telemetry.questionsPerAccount} questions × ${count(telemetry.requests)} requests`}
			>
				{animate ? (
					<NumberTicker
						value={telemetry.judgments}
						locale
						startOnView={startOnView}
					/>
				) : (
					count(telemetry.judgments)
				)}
			</Stat>
			<Stat
				label="Wall clock"
				footnote={`concurrency ${telemetry.concurrency}`}
			>
				{animate ? (
					<AnimatedNumber
						value={telemetry.elapsedMs / 1000}
						duration={1.4}
						startOnView={startOnView}
						format={(n) => `${n.toFixed(2)}s`}
					/>
				) : (
					`${(telemetry.elapsedMs / 1000).toFixed(2)}s`
				)}
			</Stat>
			<Stat
				label="Cost"
				footnote={`${count(telemetry.inputTokens)} input tokens`}
			>
				{animate ? (
					<AnimatedNumber
						value={telemetry.estimatedCostUsd}
						duration={1.4}
						startOnView={startOnView}
						format={(n) => usd(n)}
					/>
				) : (
					usd(telemetry.estimatedCostUsd)
				)}
			</Stat>
		</div>
	);
}
