import { memo, useCallback, useMemo, useState } from "react";

import { Tooltip } from "#/components/motion/tooltip";
import { gbp } from "#/lib/format";
import type { GridCell } from "#/lib/portfolio/baseline";
import type { BandFilter } from "#/lib/portfolio/search";
import { BAND_META, type Lens } from "#/lib/portfolio/triage";
import { cn } from "#/lib/utils";

/**
 * 1,000 squares, one per account.
 *
 * Rendered as plain spans behind one delegated pointer handler rather than 1,000
 * React event subscriptions, and marked up as a single image: the keyboard- and
 * screen-reader-accessible view of the same data is the priority table below.
 */

const REVEAL_MS = 1400;

function toneFor(cell: GridCell, lens: Lens, revealed: boolean): string {
	if (!revealed) return "bg-grid-idle";

	if (lens === "risk") {
		if (cell.riskScore >= 62) return "bg-lens-risk";
		if (cell.riskScore >= 45) return "bg-lens-risk/45";
		return "bg-grid-idle";
	}
	if (lens === "sales") {
		if (cell.salesScore >= 62) return "bg-lens-sales";
		if (cell.salesScore >= 45) return "bg-lens-sales/45";
		return "bg-grid-idle";
	}
	return BAND_META[cell.band].dot;
}

function matches(cell: GridCell, band: BandFilter, query: string): boolean {
	if (band !== "all" && cell.band !== band) return false;
	if (!query) return true;
	const haystack = `${cell.name} ${cell.id} ${cell.segment}`.toLowerCase();
	return haystack.includes(query);
}

const Dot = memo(function Dot({
	id,
	tone,
	delayMs,
	dim,
	selected,
}: {
	id: string;
	tone: string;
	delayMs: number;
	dim: boolean;
	selected: boolean;
}) {
	return (
		<span
			data-account={id}
			className={cn(
				"aspect-square rounded-[2px] transition-[background-color,opacity,transform] duration-500 ease-out",
				tone,
				dim && "opacity-15",
				selected &&
					"scale-150 ring-2 ring-foreground ring-offset-1 ring-offset-background",
			)}
			style={{ transitionDelay: `${delayMs}ms` }}
		/>
	);
});

export interface PortfolioGridProps {
	cells: GridCell[];
	revealed: boolean;
	lens: Lens;
	band: BandFilter;
	query?: string;
	selectedId?: string;
	onSelect: (accountId: string) => void;
}

export function PortfolioGrid({
	cells,
	revealed,
	lens,
	band,
	query,
	selectedId,
	onSelect,
}: PortfolioGridProps) {
	// The anchor is state, not a ref: `Tooltip` re-places from a layout effect
	// keyed on the identity of the ref object it was handed, so mutating one ref
	// in place would leave the tooltip pinned to the first square the pointer
	// touched while its contents changed underneath.
	const [anchor, setAnchor] = useState<HTMLElement | null>(null);
	const anchorRef = useMemo(() => ({ current: anchor }), [anchor]);
	const [hovered, setHovered] = useState<GridCell | null>(null);

	const normalisedQuery = (query ?? "").trim().toLowerCase();

	// Stagger the reveal by position so the triage reads as a sweep across the
	// portfolio rather than 1,000 dots flipping at once.
	const delays = useMemo(
		() =>
			cells.map((_, index) =>
				Math.round((index / Math.max(1, cells.length - 1)) * REVEAL_MS),
			),
		[cells],
	);

	const byId = useMemo(
		() => new Map(cells.map((cell) => [cell.id, cell])),
		[cells],
	);

	const resolve = useCallback(
		(
			target: EventTarget | null,
		): { cell: GridCell; el: HTMLElement } | null => {
			if (!(target instanceof HTMLElement)) return null;
			const el = target.closest<HTMLElement>("[data-account]");
			const id = el?.dataset.account;
			if (!el || !id) return null;
			const cell = byId.get(id);
			return cell ? { cell, el } : null;
		},
		[byId],
	);

	const visible = useMemo(
		() =>
			cells.reduce(
				(total, cell) =>
					matches(cell, band, normalisedQuery) ? total + 1 : total,
				0,
			),
		[cells, band, normalisedQuery],
	);

	return (
		<div className="relative">
			<p className="sr-only">
				{`A grid of ${cells.length} account squares, ${visible} of them currently
				highlighted. The same accounts are listed, sortable and keyboard
				navigable, in the priority table below.`}
			</p>
			{/* The grid is a picture of the table below. Hiding it from assistive
			    tech keeps 1,000 squares out of the reading order; the click handler
			    is a pointer shortcut for what the table already does with a keyboard. */}
			<div
				aria-hidden="true"
				className="grid gap-[3px] sm:gap-1"
				style={{
					gridTemplateColumns: "repeat(auto-fill, minmax(0.5rem, 1fr))",
				}}
				onPointerOver={(event) => {
					const hit = resolve(event.target);
					if (!hit) return;
					setAnchor(hit.el);
					setHovered(hit.cell);
				}}
				onPointerLeave={() => setHovered(null)}
				onClick={(event) => {
					const hit = resolve(event.target);
					if (hit) onSelect(hit.cell.id);
				}}
			>
				{cells.map((cell, index) => (
					<Dot
						key={cell.id}
						id={cell.id}
						tone={toneFor(cell, lens, revealed)}
						delayMs={delays[index]}
						dim={!matches(cell, band, normalisedQuery)}
						selected={cell.id === selectedId}
					/>
				))}
			</div>

			<Tooltip
				anchorRef={anchorRef}
				open={hovered !== null}
				side="top"
				content={
					hovered ? (
						<span className="flex flex-col gap-0.5">
							<span className="font-semibold">{hovered.name}</span>
							<span className="numeric text-[11px] opacity-80">
								{hovered.id} · {gbp(hovered.arrGbp)} ·{" "}
								{revealed ? BAND_META[hovered.band].label : "Not triaged"}
							</span>
						</span>
					) : null
				}
			/>
		</div>
	);
}
