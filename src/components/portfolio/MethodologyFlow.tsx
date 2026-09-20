import { ArrowDown, ArrowRight } from "lucide-react";

import {
	PORTFOLIO_QUESTIONS,
	QUESTION_IDS,
	QUESTION_META,
} from "#/lib/portfolio/questions";
import {
	BAND_RULES,
	CHOICE_CONFIDENCE_FLOOR,
	PRIORITY_WEIGHTS,
} from "#/lib/portfolio/triage";

export function MethodologyFlow() {
	const steps = [
		{
			label: "01 · Input",
			title: "One account record",
			content: (
				<>
					<p>Usage, support, renewal dates and notes.</p>
					<p className="mt-3 rounded-md border border-dashed border-border px-2 py-1.5 text-xs">
						Removed before sending: id + planted archetype
					</p>
				</>
			),
		},
		{
			label: "02 · Jev",
			title: `${QUESTION_IDS.length} parallel questions`,
			content: (
				<>
					<p>One request. The same evidence for every question.</p>
					<ul className="mt-3 space-y-1.5 text-xs">
						{QUESTION_IDS.map((id) => (
							<li
								key={id}
								className="flex items-baseline justify-between gap-2"
							>
								<span>{QUESTION_META[id].label}</span>
								<span className="numeric text-[10px] uppercase text-primary">
									{PORTFOLIO_QUESTIONS[id].type}
								</span>
							</li>
						))}
					</ul>
				</>
			),
		},
		{
			label: "03 · Typed outputs",
			title: "Evidence, not a verdict",
			content: (
				<dl className="space-y-3">
					<div>
						<dt className="text-xs font-medium text-foreground">Noul</dt>
						<dd>Probability from 0 to 1</dd>
					</div>
					<div>
						<dt className="text-xs font-medium text-foreground">Score</dt>
						<dd>Urgency across an ordered rubric</dd>
					</div>
					<div>
						<dt className="text-xs font-medium text-foreground">Choice</dt>
						<dd>Distribution over named options</dd>
					</div>
				</dl>
			),
		},
		{
			label: "04 · Your code",
			title: "Rules → a shortlist",
			content: (
				<>
					<p>
						<code className="text-foreground">triage.ts</code> applies
						thresholds and weights. No more inference.
					</p>
					<p className="numeric mt-3 rounded-md bg-background p-2 text-[11px] text-foreground">
						Act now: urgency ≥ {BAND_RULES.actNow.urgency} and attention &gt;{" "}
						{BAND_RULES.actNow.attention}
					</p>
					<p className="mt-3 text-xs">
						Act now / Review / No action, plus retention and sales lenses.
					</p>
				</>
			),
		},
	];

	return (
		<figure className="my-8 rounded-xl border border-border/60 bg-card/30 p-4 sm:p-5">
			<figcaption className="mb-5">
				<h2 className="text-base font-semibold tracking-tight">
					From evidence to action
				</h2>
				<p className="mt-1 text-sm text-muted-foreground">
					The model reads the account. Your code makes the decision.
				</p>
			</figcaption>
			<ol className="grid gap-7 lg:grid-cols-4 lg:gap-5">
				{steps.map((step, index) => (
					<li key={step.label} className="relative min-w-0">
						<div className="h-full rounded-lg border border-border/60 bg-card p-3">
							<p className="label-caps">{step.label}</p>
							<h3 className="mt-2 text-sm font-semibold">{step.title}</h3>
							<div className="mt-3 text-xs leading-relaxed text-muted-foreground">
								{step.content}
							</div>
						</div>
						{index < steps.length - 1 ? (
							<>
								<ArrowDown
									aria-hidden="true"
									className="absolute -bottom-5 left-1/2 size-3.5 -translate-x-1/2 text-primary lg:hidden"
								/>
								<ArrowRight
									aria-hidden="true"
									className="absolute -right-4 top-1/2 hidden size-3.5 -translate-y-1/2 text-primary lg:block"
								/>
							</>
						) : null}
					</li>
				))}
			</ol>
			<div className="mt-5 grid gap-3 border-t border-border/60 pt-4 text-xs leading-relaxed text-muted-foreground sm:grid-cols-2">
				<p>
					<strong className="font-medium text-foreground">
						Ranking weights:
					</strong>{" "}
					attention {PRIORITY_WEIGHTS.attention} · churn{" "}
					{PRIORITY_WEIGHTS.churn} · expansion {PRIORITY_WEIGHTS.expansion} ·
					urgency {PRIORITY_WEIGHTS.urgency} · renewal{" "}
					{PRIORITY_WEIGHTS.renewalProximity}.
				</p>
				<p>
					<strong className="font-medium text-foreground">Human review:</strong>{" "}
					on flagged accounts, Choice confidence below {CHOICE_CONFIDENCE_FLOOR}{" "}
					marks routing as uncertain.
				</p>
			</div>
		</figure>
	);
}
