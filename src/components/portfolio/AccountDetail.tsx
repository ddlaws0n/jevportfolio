import { Link } from "@tanstack/react-router";
import { TriangleAlert } from "lucide-react";

import { AnimatedBadge } from "#/components/motion/animated-badge";
import { JudgmentPanel } from "#/components/portfolio/JudgmentPanel";
import { SignalList } from "#/components/portfolio/SignalList";
import { days, gbpFull } from "#/lib/format";
import { BAND_META } from "#/lib/portfolio/triage";
import type { TriagedAccount } from "#/lib/portfolio/types";
import { cn } from "#/lib/utils";

function ScorePill({
	label,
	value,
	tone,
}: {
	label: string;
	value: number;
	tone: "neutral" | "risk" | "sales";
}) {
	return (
		<div className="rounded-lg border border-border/60 bg-card px-3 py-2">
			<div className="label-caps">{label}</div>
			<div
				className={cn(
					"numeric text-lg font-bold leading-tight",
					tone === "risk" && "text-lens-risk",
					tone === "sales" && "text-lens-sales",
				)}
			>
				{value.toFixed(1)}
			</div>
		</div>
	);
}

export function AccountDetailHeader({
	row,
	showLink = false,
}: {
	row: TriagedAccount;
	showLink?: boolean;
}) {
	const meta = BAND_META[row.band];
	const { account } = row;

	return (
		<header className="space-y-4">
			<div className="flex flex-wrap items-start justify-between gap-3">
				<div className="min-w-0">
					<h2 className="truncate text-xl font-semibold tracking-tight">
						{account.name}
					</h2>
					<p className="numeric mt-1 text-xs text-muted-foreground">
						{account.id} · {account.segment} · {account.industry}
					</p>
				</div>
				<div className="text-right">
					<div className="numeric text-lg font-bold">
						{gbpFull(account.arrGbp)}
					</div>
					<div className="label-caps">ARR · {account.seats} seats</div>
				</div>
			</div>

			<div className="flex flex-wrap items-center gap-2">
				<span
					className={cn(
						"inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wider",
						row.band === "act-now" &&
							"border-band-act/40 bg-band-act/15 text-band-act",
						row.band === "review" &&
							"border-band-review/40 bg-band-review/15 text-band-review",
						row.band === "healthy" &&
							"border-border bg-card text-muted-foreground",
					)}
				>
					<span className={cn("h-2 w-2 rounded-[2px]", meta.dot)} />
					{meta.short}
				</span>
				<span className="numeric rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
					Renewal in {days(account.renewalInDays)}
				</span>
				{row.lowConfidence ? (
					<AnimatedBadge status="warning" size="sm" icon={<TriangleAlert />}>
						Low confidence — route to a human
					</AnimatedBadge>
				) : null}
			</div>

			<div className="grid grid-cols-3 gap-2">
				<ScorePill label="Priority" value={row.priorityScore} tone="neutral" />
				<ScorePill label="Risk lens" value={row.riskScore} tone="risk" />
				<ScorePill label="Sales lens" value={row.salesScore} tone="sales" />
			</div>

			{showLink ? (
				<Link
					to="/accounts/$accountId"
					params={{ accountId: account.id }}
					search={{ lens: "all" }}
					className="inline-block text-xs text-primary underline decoration-dotted underline-offset-4"
				>
					Open the full account page →
				</Link>
			) : null}
		</header>
	);
}

export function AccountDetailBody({ row }: { row: TriagedAccount }) {
	return (
		<div className="space-y-8">
			<JudgmentPanel judgments={row.judgments} />
			<SignalList account={row.account} />
		</div>
	);
}
