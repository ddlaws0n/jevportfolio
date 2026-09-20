import { count, pct, titleCase } from "#/lib/format";
import type { ArchetypeAudit } from "#/server/snapshot.server";

const outcomes = [
	{ key: "actNow", label: "Act now", color: "bg-band-act" },
	{ key: "review", label: "Review", color: "bg-band-review" },
	{ key: "healthy", label: "No action", color: "bg-band-healthy" },
] as const;

const signals = [
	{
		key: "avgNeedsAttention",
		label: "Attention",
		marker: "rounded-full bg-primary",
	},
	{ key: "avgChurnSignal", label: "Churn", marker: "bg-lens-risk" },
	{
		key: "avgExpansionSignal",
		label: "Expansion",
		marker: "rotate-45 bg-lens-sales",
	},
] as const;

export function ArchetypeAuditChart({ audit }: { audit: ArchetypeAudit[] }) {
	return (
		<figure className="mt-6 rounded-xl border border-border/60 bg-card/30 p-4 sm:p-5">
			<figcaption>
				<h3 className="text-base font-semibold tracking-tight">
					Same questions. Different signals.
				</h3>
				<p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground">
					Each bar shows the share of an archetype sent to each action band.
					Dots show mean model outputs from this synthetic run, not measured
					churn rates or evidence of calibration.
				</p>
			</figcaption>

			<div
				aria-hidden="true"
				className="label-caps mt-5 hidden gap-6 border-b border-border/60 pb-3 md:grid md:grid-cols-[150px_minmax(0,1fr)_minmax(0,1fr)]"
			>
				<span>Planted archetype</span>
				<span>Routing outcomes · share of accounts</span>
				<span>Mean signals · 0–100%</span>
			</div>

			<ul className="mt-4 space-y-4 md:mt-0 md:space-y-0">
				{audit.map((row) => (
					<li
						key={row.archetype}
						className="grid gap-5 rounded-lg border border-border/60 bg-card/50 p-3 md:grid-cols-[150px_minmax(0,1fr)_minmax(0,1fr)] md:items-center md:gap-6 md:rounded-none md:border-0 md:border-b md:bg-transparent md:px-0 md:py-5 md:last:border-0"
					>
						<div>
							<h4 className="text-sm font-medium">
								{titleCase(row.archetype)}
							</h4>
							<p className="numeric mt-1 text-[11px] text-muted-foreground">
								n = {count(row.planted)}
							</p>
						</div>

						<div className="min-w-0">
							<p className="label-caps mb-2 md:hidden">Routing outcomes</p>
							<div
								aria-hidden="true"
								className="flex h-4 overflow-hidden rounded-sm bg-muted"
							>
								{outcomes.map((outcome) => (
									<span
										key={outcome.key}
										className={outcome.color}
										style={{
											width: `${row.planted > 0 ? (row[outcome.key] / row.planted) * 100 : 0}%`,
										}}
									/>
								))}
							</div>
							<dl className="mt-2 grid grid-cols-3 gap-2 text-[10px] leading-relaxed">
								{outcomes.map((outcome) => (
									<div key={outcome.key}>
										<dt className="text-muted-foreground">{outcome.label}</dt>
										<dd className="numeric text-xs">
											{count(row[outcome.key])}
										</dd>
									</div>
								))}
							</dl>
						</div>

						<div className="min-w-0">
							<p className="label-caps mb-2 md:hidden">Mean signals</p>
							<div className="numeric mb-1 ml-[68px] mr-10 flex justify-between text-[9px] text-muted-foreground">
								<span>0%</span>
								<span>50%</span>
								<span>100%</span>
							</div>
							<dl className="space-y-1.5">
								{signals.map((signal) => (
									<div
										key={signal.key}
										className="grid grid-cols-[64px_minmax(0,1fr)_32px] items-center gap-1 text-[10px]"
									>
										<dt className="text-muted-foreground">{signal.label}</dt>
										<dd className="col-span-2 grid grid-cols-subgrid items-center">
											<div aria-hidden="true" className="relative mx-1 h-3">
												<span className="absolute inset-x-0 top-1/2 h-px bg-border" />
												<span className="absolute inset-y-0 left-0 w-px bg-border" />
												<span className="absolute inset-y-0 left-1/2 w-px bg-border" />
												<span className="absolute inset-y-0 right-0 w-px bg-border" />
												<span
													className={`absolute top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 ${signal.marker}`}
													style={{ left: `${row[signal.key] * 100}%` }}
												/>
											</div>
											<span className="numeric text-right text-xs">
												{pct(row[signal.key])}
											</span>
										</dd>
									</div>
								))}
							</dl>
						</div>
					</li>
				))}
			</ul>
			<p className="mt-3 text-xs leading-relaxed text-muted-foreground">
				Bars are normalized within each archetype; group sizes differ. Exact
				counts, signal means and urgency scores are in the table below.
			</p>
		</figure>
	);
}
