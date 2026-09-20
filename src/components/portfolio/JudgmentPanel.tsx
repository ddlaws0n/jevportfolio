import { AnimatedNumber } from "#/components/motion/animated-number";
import { pct, titleCase } from "#/lib/format";
import {
	QUESTION_META,
	URGENCY_LABELS,
	URGENCY_LEVELS,
} from "#/lib/portfolio/questions";
import { CHOICE_CONFIDENCE_FLOOR } from "#/lib/portfolio/triage";
import type { AccountJudgments } from "#/lib/portfolio/types";
import { cn } from "#/lib/utils";

/** A probability rendered as a bar plus its number, tinted by what it means. */
function Bar({
	value,
	tone,
}: {
	value: number;
	tone: "risk" | "sales" | "neutral";
}) {
	const fill =
		tone === "risk"
			? "bg-lens-risk"
			: tone === "sales"
				? "bg-lens-sales"
				: "bg-primary";
	return (
		<div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
			<div
				className={cn(
					"h-full rounded-full transition-[width] duration-700",
					fill,
				)}
				style={{ width: `${Math.max(2, value * 100)}%` }}
			/>
		</div>
	);
}

function Row({
	label,
	primitive,
	verdict,
	verdictTone,
	value,
	tone,
	footnote,
}: {
	label: string;
	primitive: string;
	verdict: string;
	verdictTone?: string;
	value: number;
	tone: "risk" | "sales" | "neutral";
	footnote?: string;
}) {
	return (
		<div className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 py-3">
			<div className="min-w-0">
				<div className="flex items-baseline gap-2">
					<span className="truncate text-sm font-medium">{label}</span>
					<span className="label-caps shrink-0">{primitive}</span>
				</div>
				{footnote ? (
					<p className="mt-0.5 truncate text-xs text-muted-foreground">
						{footnote}
					</p>
				) : null}
			</div>
			<div className="flex items-baseline gap-3 justify-self-end">
				<span
					className={cn(
						"numeric text-xs font-semibold uppercase tracking-wider",
						verdictTone ?? "text-foreground",
					)}
				>
					{verdict}
				</span>
				<span className="numeric w-11 text-right text-sm font-semibold">
					<AnimatedNumber
						value={value * 100}
						// Count up on mount, not on scroll: most of these rows start below
						// the fold and a reader scrolling past a row of zeroes would read
						// them as real answers.
						startOnView={false}
						format={(n) => `${Math.round(n)}%`}
					/>
				</span>
			</div>
			<div className="col-span-2">
				<Bar value={value} tone={tone} />
			</div>
		</div>
	);
}

export function JudgmentPanel({ judgments }: { judgments: AccountJudgments }) {
	const urgencyLevel = Math.round(judgments.urgency.score);
	const urgencyProbability =
		judgments.urgency.probabilities[String(urgencyLevel)] ?? 0;

	return (
		<section>
			<header className="flex items-baseline justify-between border-b border-border pb-2">
				<h3 className="label-caps">Jev judgments</h3>
				<span className="label-caps">6 questions · 1 request</span>
			</header>

			<div className="divide-y divide-border/60">
				<Row
					label={QUESTION_META.needs_attention.label}
					primitive="Noul"
					verdict={judgments.needsAttention >= 0.5 ? "YES" : "NO"}
					verdictTone={
						judgments.needsAttention >= 0.5
							? "text-primary"
							: "text-muted-foreground"
					}
					value={judgments.needsAttention}
					tone="neutral"
				/>
				<Row
					label={QUESTION_META.churn_signal.label}
					primitive="Noul"
					verdict={judgments.churnSignal >= 0.5 ? "YES" : "NO"}
					verdictTone={
						judgments.churnSignal >= 0.5
							? "text-lens-risk"
							: "text-muted-foreground"
					}
					value={judgments.churnSignal}
					tone="risk"
				/>
				<Row
					label={QUESTION_META.expansion_signal.label}
					primitive="Noul"
					verdict={judgments.expansionSignal >= 0.5 ? "YES" : "NO"}
					verdictTone={
						judgments.expansionSignal >= 0.5
							? "text-lens-sales"
							: "text-muted-foreground"
					}
					value={judgments.expansionSignal}
					tone="sales"
				/>
				<Row
					label={QUESTION_META.urgency.label}
					primitive="Score"
					verdict={URGENCY_LABELS[urgencyLevel] ?? "—"}
					value={urgencyProbability}
					tone="neutral"
					footnote={URGENCY_LEVELS[urgencyLevel]}
				/>
				<Row
					label={QUESTION_META.primary_reason.label}
					primitive="Choice"
					verdict={titleCase(judgments.primaryReason.choice)}
					value={judgments.primaryReason.confidence}
					tone="neutral"
					footnote={confidenceNote(judgments.primaryReason.confidence)}
				/>
				<Row
					label={QUESTION_META.owner.label}
					primitive="Choice"
					verdict={judgments.owner.choice}
					value={judgments.owner.confidence}
					tone="neutral"
					footnote={confidenceNote(judgments.owner.confidence)}
				/>
			</div>

			<p className="mt-3 text-xs leading-relaxed text-muted-foreground">
				Noul rows show the probability the proposition is true. Choice rows show
				the model's confidence in the option it picked, not its probability —
				see the full distribution below.
			</p>

			<Distribution
				title="Primary issue"
				probabilities={judgments.primaryReason.probabilities}
				selected={judgments.primaryReason.choice}
			/>
			<Distribution
				title="Suggested owner"
				probabilities={judgments.owner.probabilities}
				selected={judgments.owner.choice}
			/>
		</section>
	);
}

function confidenceNote(confidence: number) {
	return confidence < CHOICE_CONFIDENCE_FLOOR
		? "Below the routing threshold — send to a human."
		: undefined;
}

function Distribution({
	title,
	probabilities,
	selected,
}: {
	title: string;
	probabilities: Record<string, number>;
	selected: string;
}) {
	const entries = Object.entries(probabilities)
		.filter(([, p]) => p > 0.005)
		.sort((a, b) => b[1] - a[1]);

	return (
		<div className="mt-4">
			<h4 className="label-caps">{title} — full distribution</h4>
			<ul className="mt-2 space-y-1">
				{entries.map(([option, probability]) => (
					<li key={option} className="flex items-center gap-3 text-xs">
						<span
							className={cn(
								"w-28 shrink-0 truncate",
								option === selected
									? "font-semibold text-foreground"
									: "text-muted-foreground",
							)}
						>
							{titleCase(option)}
						</span>
						<span className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
							<span
								className={cn(
									"block h-full rounded-full",
									option === selected ? "bg-primary" : "bg-muted-foreground/50",
								)}
								style={{ width: `${probability * 100}%` }}
							/>
						</span>
						<span className="numeric w-9 shrink-0 text-right text-muted-foreground">
							{pct(probability)}
						</span>
					</li>
				))}
			</ul>
		</div>
	);
}
