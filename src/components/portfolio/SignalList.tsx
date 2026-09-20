import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";

import { days, gbpFull, signedPct } from "#/lib/format";
import type { Account } from "#/lib/portfolio/types";
import { cn } from "#/lib/utils";

type Direction = "up" | "down" | "flat";

function Trend({ direction }: { direction: Direction }) {
	if (direction === "up")
		return <ArrowUpRight className="h-3.5 w-3.5 text-lens-sales" />;
	if (direction === "down")
		return <ArrowDownRight className="h-3.5 w-3.5 text-lens-risk" />;
	return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
}

function Signal({
	label,
	value,
	direction,
	emphasis,
}: {
	label: string;
	value: string;
	direction?: Direction;
	emphasis?: "risk" | "sales";
}) {
	return (
		<div className="flex items-center justify-between gap-4 py-1.5">
			<span className="flex items-center gap-2 text-xs text-muted-foreground">
				{direction ? <Trend direction={direction} /> : null}
				{label}
			</span>
			<span
				className={cn(
					"numeric text-xs font-semibold",
					emphasis === "risk" && "text-lens-risk",
					emphasis === "sales" && "text-lens-sales",
				)}
			>
				{value}
			</span>
		</div>
	);
}

const dir = (n: number): Direction => (n > 2 ? "up" : n < -2 ? "down" : "flat");

/**
 * The raw record Jev was given. Shown next to the judgments so the visitor can
 * read data -> judgment -> probability -> software action in one pass.
 */
export function SignalList({ account }: { account: Account }) {
	const { support, engagement, commercial } = account;

	return (
		<section className="space-y-4">
			<header className="flex items-baseline justify-between border-b border-border pb-2">
				<h3 className="label-caps">Input signals</h3>
				<span className="label-caps">state sent to Jev</span>
			</header>

			<div>
				<h4 className="label-caps mb-1">Usage</h4>
				<div className="divide-y divide-border/40">
					<Signal
						label="Usage, last 30 days"
						value={signedPct(account.usage30dDeltaPct)}
						direction={dir(account.usage30dDeltaPct)}
						emphasis={account.usage30dDeltaPct < -10 ? "risk" : undefined}
					/>
					<Signal
						label="Active users, last 30 days"
						value={signedPct(account.activeUsers30dDeltaPct)}
						direction={dir(account.activeUsers30dDeltaPct)}
						emphasis={account.activeUsers30dDeltaPct < -10 ? "risk" : undefined}
					/>
					<Signal
						label="Feature adoption"
						value={`${account.featureAdoptionPct}%`}
					/>
					<Signal
						label="Logins per seat"
						value={account.loginsPerSeat30d.toFixed(1)}
					/>
				</div>
			</div>

			<div>
				<h4 className="label-caps mb-1">Support</h4>
				<div className="divide-y divide-border/40">
					<Signal
						label="Open tickets"
						value={String(support.openTickets)}
						emphasis={support.openTickets >= 3 ? "risk" : undefined}
					/>
					<Signal
						label="Sev-1 incidents, last 30 days"
						value={String(support.sev1Last30d)}
						emphasis={support.sev1Last30d > 0 ? "risk" : undefined}
					/>
					<Signal
						label="Avg first response"
						value={`${support.avgFirstResponseHours.toFixed(1)}h`}
					/>
					<Signal
						label="CSAT"
						value={support.csat === null ? "—" : support.csat.toFixed(1)}
					/>
				</div>
			</div>

			<div>
				<h4 className="label-caps mb-1">Engagement</h4>
				<div className="divide-y divide-border/40">
					<Signal
						label="Last CSM meeting"
						value={days(engagement.lastCsmMeetingDaysAgo)}
						emphasis={
							engagement.lastCsmMeetingDaysAgo > 35 ? "risk" : undefined
						}
					/>
					<Signal
						label="QBRs cancelled, last 2 quarters"
						value={String(engagement.qbrsCancelledLast2Q)}
						emphasis={engagement.qbrsCancelledLast2Q > 0 ? "risk" : undefined}
					/>
					<Signal
						label="Exec sponsor changed"
						value={engagement.execSponsorChanged ? "Yes" : "No"}
						emphasis={engagement.execSponsorChanged ? "risk" : undefined}
					/>
					<Signal
						label="Champion active"
						value={engagement.championActive ? "Yes" : "No"}
						emphasis={engagement.championActive ? undefined : "risk"}
					/>
					<Signal
						label="Last NPS"
						value={
							engagement.npsLast === null ? "—" : String(engagement.npsLast)
						}
					/>
				</div>
			</div>

			<div>
				<h4 className="label-caps mb-1">Commercial</h4>
				<div className="divide-y divide-border/40">
					<Signal label="ARR" value={gbpFull(account.arrGbp)} />
					<Signal label="Seats" value={String(account.seats)} />
					<Signal
						label="Renewal"
						value={days(account.renewalInDays)}
						emphasis={account.renewalInDays <= 45 ? "risk" : undefined}
					/>
					<Signal
						label="Additional seats requested"
						value={
							commercial.seatsRequested === null
								? "—"
								: String(commercial.seatsRequested)
						}
						emphasis={commercial.seatsRequested ? "sales" : undefined}
					/>
					<Signal
						label="Pricing requested"
						value={commercial.pricingRequested ? "Yes" : "No"}
						emphasis={commercial.pricingRequested ? "sales" : undefined}
					/>
					<Signal
						label="Discount requested"
						value={commercial.discountRequested ? "Yes" : "No"}
						emphasis={commercial.discountRequested ? "risk" : undefined}
					/>
					<Signal
						label="Competitor mentioned"
						value={commercial.competitorMentioned ?? "—"}
						emphasis={commercial.competitorMentioned ? "risk" : undefined}
					/>
					<Signal
						label="Payment issues"
						value={commercial.paymentIssues ? "Yes" : "No"}
						emphasis={commercial.paymentIssues ? "risk" : undefined}
					/>
				</div>
			</div>

			<div>
				<h4 className="label-caps mb-1">Recent notes</h4>
				<ul className="space-y-1.5">
					{account.notes.map((note) => (
						<li
							key={note}
							className="rounded-md border border-border/60 bg-card px-3 py-2 text-xs leading-relaxed text-muted-foreground"
						>
							{note}
						</li>
					))}
				</ul>
			</div>
		</section>
	);
}
