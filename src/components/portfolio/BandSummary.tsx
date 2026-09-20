import { NumberTicker } from "#/components/motion/number-ticker";
import { gbp } from "#/lib/format";
import type { BandFilter } from "#/lib/portfolio/search";
import { BAND_META } from "#/lib/portfolio/triage";
import type { BandCounts, PriorityBand } from "#/lib/portfolio/types";
import { cn } from "#/lib/utils";

const ORDER: PriorityBand[] = ["act-now", "review", "healthy"];

export function BandSummary({
	bands,
	arr,
	active,
	onSelect,
	animate = true,
}: {
	bands: BandCounts;
	arr: { "act-now": number; review: number; healthy: number };
	active: BandFilter;
	onSelect: (band: BandFilter) => void;
	animate?: boolean;
}) {
	return (
		<div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
			{ORDER.map((band) => {
				const meta = BAND_META[band];
				const selected = active === band;
				return (
					<button
						key={band}
						type="button"
						aria-pressed={selected}
						onClick={() => onSelect(selected ? "all" : band)}
						className={cn(
							"group rounded-xl border bg-card/60 px-5 py-4 text-left transition-colors",
							selected
								? "border-foreground/40 bg-card"
								: "border-border/60 hover:border-border hover:bg-card",
						)}
					>
						<span className="flex items-center gap-2">
							<span className={cn("h-2.5 w-2.5 rounded-[3px]", meta.dot)} />
							<span className="label-caps">{meta.short}</span>
						</span>
						<span className="numeric mt-2 block text-4xl font-bold leading-none tracking-tight">
							{animate ? (
								<NumberTicker value={bands[band]} locale />
							) : (
								bands[band]
							)}
						</span>
						<span className="numeric mt-1.5 block text-xs text-muted-foreground">
							{gbp(arr[band])} ARR
						</span>
					</button>
				);
			})}
		</div>
	);
}
