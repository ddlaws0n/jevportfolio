import { createFileRoute } from "@tanstack/react-router";

import { BouncyAccordion } from "#/components/motion/bouncy-accordion";
import { TelemetryStrip } from "#/components/portfolio/TelemetryStrip";
import { count, pct, titleCase } from "#/lib/format";
import { PORTFOLIO_QUESTIONS, QUESTION_META } from "#/lib/portfolio/questions";
import {
	BAND_RULES,
	CHOICE_CONFIDENCE_FLOOR,
	PRIORITY_WEIGHTS,
} from "#/lib/portfolio/triage";
import { getMethodology } from "#/server/portfolio.functions";

export const Route = createFileRoute("/methodology")({
	// Static reference content — it should be in the HTML and indexable.
	ssr: true,
	loader: () => getMethodology(),
	head: () => ({
		meta: [
			{ title: "Methodology — Who Needs You" },
			{
				name: "description",
				content:
					"The exact six Jev questions, the deterministic scoring they feed, and an audit against the generator's ground truth.",
			},
		],
	}),
	component: Methodology,
});

function Section({
	title,
	kicker,
	children,
}: {
	title: string;
	kicker?: string;
	children: React.ReactNode;
}) {
	return (
		<section className="border-t border-border/60 py-10">
			{kicker ? <p className="label-caps">{kicker}</p> : null}
			<h2 className="mt-2 text-2xl font-semibold tracking-tight">{title}</h2>
			<div className="mt-5">{children}</div>
		</section>
	);
}

function Methodology() {
	const { audit, telemetry, bands } = Route.useLoaderData();

	const items = Object.entries(PORTFOLIO_QUESTIONS).map(([id, question]) => {
		const meta = QUESTION_META[id as keyof typeof QUESTION_META];
		return {
			id,
			title: (
				<span className="flex flex-wrap items-baseline gap-2">
					<span className="font-medium">{meta.label}</span>
					<span className="label-caps">
						{meta.primitive} · {id}
					</span>
				</span>
			),
			description: (
				<pre className="numeric overflow-x-auto whitespace-pre-wrap rounded-lg border border-border/60 bg-background p-4 text-[11px] leading-relaxed text-muted-foreground">
					{JSON.stringify(question, null, 2)}
				</pre>
			),
		};
	});

	const isProblem = (archetype: string) =>
		archetype !== "healthy" && archetype !== "healthy_noise";

	// Counted off the audit rather than a literal 1,000: the portfolio size and
	// the archetype mix are both constants that can move.
	const totalAccounts = audit.reduce((total, row) => total + row.planted, 0);
	const planted = audit
		.filter((row) => isProblem(row.archetype))
		.reduce((total, row) => total + row.planted, 0);
	const surfaced = bands["act-now"] + bands.review;
	// A planted problem that came back "no action".
	const missed = audit
		.filter((row) => isProblem(row.archetype))
		.reduce((total, row) => total + row.healthy, 0);
	// A deliberately healthy account that was flagged anyway.
	const falseFlags = audit
		.filter((row) => !isProblem(row.archetype))
		.reduce((total, row) => total + row.actNow + row.review, 0);

	return (
		<div className="mx-auto w-full max-w-[980px] px-4 pb-16 pt-12 sm:px-6">
			<p className="label-caps">Methodology</p>
			<h1 className="mt-3 text-balance text-4xl font-bold tracking-tight">
				Jev supplies judgment. Code keeps control.
			</h1>
			<p className="mt-4 max-w-2xl text-pretty text-muted-foreground">
				Nothing on this site asks a model to decide a priority. It asks six
				narrow questions about evidence, gets calibrated probabilities back, and
				then does ordinary arithmetic. This page is the whole method, including
				the parts that would be embarrassing if they were wrong.
			</p>

			{telemetry ? (
				<div className="mt-8">
					<TelemetryStrip telemetry={telemetry} animate={false} />
				</div>
			) : null}

			<Section kicker="Step one" title="One request per account, six questions">
				<p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
					TypeSafe evaluates every question in a request against the same{" "}
					<code className="rounded bg-card px-1 py-0.5">state</code> in
					parallel, so six questions cost one round trip rather than six. The
					account record goes over with its ground-truth archetype and its id
					stripped out — the model never sees which bucket the generator drew it
					from.
				</p>
				<pre className="numeric mt-4 overflow-x-auto rounded-lg border border-border/60 bg-card p-4 text-[11px] leading-relaxed">
					{`POST https://api.typesafe.ai/v1/systemone

{
  "model": "jev-latest",
  "state":  { …the account record… },
  "questions": { …the six below… }
}`}
				</pre>
				<div className="mt-5">
					<BouncyAccordion items={items} />
				</div>
			</Section>

			<Section
				kicker="Step two"
				title="The final decision never leaves the codebase"
			>
				<p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
					Bands, rankings and both lenses are arithmetic over the six answers.
					Changing a weight re-ranks 1,000 accounts instantly and costs nothing,
					because the evidence and the question meanings have not changed.
				</p>
				<pre className="numeric mt-4 overflow-x-auto rounded-lg border border-border/60 bg-card p-4 text-[11px] leading-relaxed">
					{`band =
  urgency >= ${BAND_RULES.actNow.urgency} && needsAttention > ${BAND_RULES.actNow.attention}
    ? "act-now"
  : needsAttention > ${BAND_RULES.review.attention}
    || churnSignal    > ${BAND_RULES.review.churn}
    || expansionSignal > ${BAND_RULES.review.expansion}
    ? "review"
  : "healthy"

priorityScore =
    needsAttention   * ${PRIORITY_WEIGHTS.attention}
  + churnSignal      * ${PRIORITY_WEIGHTS.churn}
  + expansionSignal  * ${PRIORITY_WEIGHTS.expansion}
  + urgency / 4      * ${PRIORITY_WEIGHTS.urgency}
  + renewalProximity * ${PRIORITY_WEIGHTS.renewalProximity}

// A Choice distribution flatter than ${CHOICE_CONFIDENCE_FLOOR} is not routed
// automatically — it is flagged for a person.`}
				</pre>
			</Section>

			<Section kicker="Step three" title="Did it actually find the right ones?">
				<p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
					The generator knows which archetype produced each account, and Jev
					never sees it. That makes this table a real check rather than a demo.
					The generator planted{" "}
					<span className="font-semibold text-foreground">
						{count(planted)}
					</span>{" "}
					accounts that should need attention and{" "}
					<span className="font-semibold text-foreground">
						{count(totalAccounts - planted)}
					</span>{" "}
					that should not. The triage surfaced{" "}
					<span className="font-semibold text-foreground">
						{count(surfaced)}
					</span>
					, missing{" "}
					<span className="font-semibold text-foreground">{count(missed)}</span>{" "}
					planted problem{missed === 1 ? "" : "s"} and flagging{" "}
					<span className="font-semibold text-foreground">
						{count(falseFlags)}
					</span>{" "}
					account{falseFlags === 1 ? "" : "s"} that was meant to be quiet.
				</p>

				<div className="mt-5 overflow-x-auto rounded-xl border border-border/60">
					<table className="w-full min-w-[720px] border-collapse text-sm">
						<thead>
							<tr className="border-b border-border/60 bg-card/60">
								<th className="label-caps px-4 py-3 text-left">
									Archetype planted
								</th>
								<th className="label-caps px-3 py-3 text-right">n</th>
								<th className="label-caps px-3 py-3 text-right">Act now</th>
								<th className="label-caps px-3 py-3 text-right">Review</th>
								<th className="label-caps px-3 py-3 text-right">No action</th>
								<th className="label-caps px-3 py-3 text-right">Attention</th>
								<th className="label-caps px-3 py-3 text-right">Churn</th>
								<th className="label-caps px-3 py-3 text-right">Expansion</th>
								<th className="label-caps px-4 py-3 text-right">Urgency</th>
							</tr>
						</thead>
						<tbody>
							{audit.map((row) => (
								<tr
									key={row.archetype}
									className="border-b border-border/40 last:border-0"
								>
									<td className="px-4 py-2.5">{titleCase(row.archetype)}</td>
									<td className="numeric px-3 py-2.5 text-right text-muted-foreground">
										{row.planted}
									</td>
									<td className="numeric px-3 py-2.5 text-right text-band-act">
										{row.actNow || "—"}
									</td>
									<td className="numeric px-3 py-2.5 text-right text-band-review">
										{row.review || "—"}
									</td>
									<td className="numeric px-3 py-2.5 text-right text-muted-foreground">
										{row.healthy || "—"}
									</td>
									<td className="numeric px-3 py-2.5 text-right">
										{pct(row.avgNeedsAttention)}
									</td>
									<td className="numeric px-3 py-2.5 text-right">
										{pct(row.avgChurnSignal)}
									</td>
									<td className="numeric px-3 py-2.5 text-right">
										{pct(row.avgExpansionSignal)}
									</td>
									<td className="numeric px-4 py-2.5 text-right">
										{row.avgUrgency.toFixed(2)}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>

				<p className="mt-3 max-w-2xl text-xs leading-relaxed text-muted-foreground">
					The last four columns are mean probabilities across every account of
					that archetype. They are the interesting part: the separation between
					a planted problem and planted noise is produced by the model reading
					the record, not by a rule keyed to the field the generator moved.
				</p>
			</Section>

			<Section kicker="Caveats" title="What this does not show">
				<ul className="max-w-2xl space-y-3 text-sm leading-relaxed text-muted-foreground">
					<li>
						The accounts are synthetic. The archetypes were written to be
						separable, which makes them easier than real CRM data, where the
						notes are shorter, staler and more contradictory.
					</li>
					<li>
						Ground truth here is the generator's intent, not a real outcome.
						Nothing on this page shows whether a flagged account would actually
						have churned.
					</li>
					<li>
						Typed output guarantees the interface, not the truth. Thresholds
						worth trusting have to be evaluated on your own data and your own
						consequences — these were chosen by hand, on this portfolio.
					</li>
					<li>
						Cost is computed from the input tokens the API reported, at Jev's
						published $0.042 per million input tokens with output tokens free.
					</li>
				</ul>
			</Section>
		</div>
	);
}
