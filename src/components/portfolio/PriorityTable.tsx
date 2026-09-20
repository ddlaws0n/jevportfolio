import { useEffect, useMemo, useState } from "react";

import {
	type SortState,
	Table,
	type TableColumn,
} from "#/components/motion/table";
import { gbp, pct, titleCase } from "#/lib/format";
import type { SortOrder, SortParam } from "#/lib/portfolio/search";
import { BAND_META, type Lens } from "#/lib/portfolio/triage";
import type { TriagedAccount } from "#/lib/portfolio/types";
import { cn } from "#/lib/utils";

function Probability({ value, tone }: { value: number; tone: string }) {
	return (
		<span className="inline-flex items-center gap-2">
			<span className="h-1 w-10 overflow-hidden rounded-full bg-muted">
				<span
					className={cn("block h-full rounded-full", tone)}
					style={{ width: `${value * 100}%` }}
				/>
			</span>
			<span className="numeric w-8 text-right text-xs">{pct(value)}</span>
		</span>
	);
}

const SORT_KEY: Record<Exclude<SortParam, "none">, string> = {
	priority: "score",
	arr: "arr",
	renewal: "renewal",
};

const SORT_PARAM: Record<string, SortParam> = {
	score: "priority",
	arr: "arr",
	renewal: "renewal",
};

/**
 * The keyboard-navigable view of the grid. Sorting and filtering happen over
 * already-computed numbers, so changing the question never costs an API call.
 *
 * The three sorts worth putting in a shareable link are driven by the URL and
 * mirrored back to it; the rest stay local. Sort state is held here rather than
 * seeded through `defaultSort`, which the table reads only once at mount.
 */
export function PriorityTable({
	rows,
	lens,
	sort,
	order,
	onSortChange,
	onSelect,
	height = 460,
}: {
	rows: TriagedAccount[];
	lens: Lens;
	sort: SortParam;
	order: SortOrder;
	onSortChange: (sort: SortParam, order: SortOrder) => void;
	onSelect: (accountId: string) => void;
	height?: number;
}) {
	const [tableSort, setTableSort] = useState<SortState | null>(() =>
		sort === "none" ? null : { key: SORT_KEY[sort], direction: order },
	);

	// Follow navigation, including direction and the unsorted state. Other
	// columns stay local until a URL sort changes.
	useEffect(() => {
		setTableSort(
			sort === "none" ? null : { key: SORT_KEY[sort], direction: order },
		);
	}, [sort, order]);

	const columns = useMemo<TableColumn<TriagedAccount>[]>(() => {
		const scoreKey =
			lens === "risk"
				? "riskScore"
				: lens === "sales"
					? "salesScore"
					: "priorityScore";
		const scoreHeader =
			lens === "risk" ? "Risk" : lens === "sales" ? "Sales" : "Priority";

		return [
			{
				key: "name",
				header: "Account",
				width: "26%",
				sortable: true,
				sortValue: (row) => row.account.name,
				cell: (row) => (
					<button
						type="button"
						onClick={() => onSelect(row.account.id)}
						className="flex min-w-0 flex-col items-start text-left"
					>
						<span className="truncate text-sm font-medium hover:text-primary">
							{row.account.name}
						</span>
						<span className="numeric text-[11px] text-muted-foreground">
							{row.account.id} · {row.account.segment}
						</span>
					</button>
				),
			},
			{
				key: "band",
				header: "Band",
				width: "11%",
				sortable: true,
				sortValue: (row) =>
					row.band === "act-now" ? 0 : row.band === "review" ? 1 : 2,
				cell: (row) => (
					<span className="inline-flex items-center gap-1.5">
						<span
							className={cn("h-2 w-2 rounded-[2px]", BAND_META[row.band].dot)}
						/>
						<span className="text-xs">{BAND_META[row.band].label}</span>
					</span>
				),
			},
			{
				key: "arr",
				header: "ARR",
				align: "right",
				width: "10%",
				sortable: true,
				sortValue: (row) => row.account.arrGbp,
				cell: (row) => (
					<span className="numeric text-xs">{gbp(row.account.arrGbp)}</span>
				),
			},
			{
				key: "renewal",
				header: "Renewal",
				align: "right",
				width: "10%",
				sortable: true,
				sortValue: (row) => row.account.renewalInDays,
				cell: (row) => (
					<span className="numeric text-xs text-muted-foreground">
						{row.account.renewalInDays}d
					</span>
				),
			},
			{
				key: "churn",
				header: "Churn",
				width: "12%",
				sortable: true,
				sortValue: (row) => row.judgments.churnSignal,
				cell: (row) => (
					<Probability value={row.judgments.churnSignal} tone="bg-lens-risk" />
				),
			},
			{
				key: "expansion",
				header: "Expansion",
				width: "12%",
				sortable: true,
				sortValue: (row) => row.judgments.expansionSignal,
				cell: (row) => (
					<Probability
						value={row.judgments.expansionSignal}
						tone="bg-lens-sales"
					/>
				),
			},
			{
				key: "reason",
				header: "Issue / owner",
				width: "11%",
				sortable: true,
				sortValue: (row) => row.judgments.primaryReason.choice,
				cell: (row) => (
					<span className="flex flex-col">
						<span className="text-xs">
							{titleCase(row.judgments.primaryReason.choice)}
						</span>
						<span className="text-[11px] text-muted-foreground">
							{row.judgments.owner.choice}
							{row.lowConfidence ? " · review" : ""}
						</span>
					</span>
				),
			},
			{
				key: "score",
				header: scoreHeader,
				align: "right",
				width: "8%",
				sortable: true,
				sortValue: (row) => row[scoreKey],
				cell: (row) => (
					<span
						className={cn(
							"numeric text-sm font-semibold",
							lens === "risk" && "text-lens-risk",
							lens === "sales" && "text-lens-sales",
						)}
					>
						{row[scoreKey].toFixed(0)}
					</span>
				),
			},
		];
	}, [lens, onSelect]);

	return (
		<Table
			data={rows}
			columns={columns}
			getRowId={(row) => row.account.id}
			sort={tableSort}
			onSortChange={(next) => {
				setTableSort(next);
				const mapped = next ? SORT_PARAM[next.key] : "none";
				const direction = next?.direction ?? "desc";
				if (mapped && (mapped !== sort || direction !== order)) {
					onSortChange(mapped, direction);
				}
			}}
			rowHeight={52}
			height={height}
			className="rounded-xl border border-border/60"
			emptyState={
				<span className="text-sm text-muted-foreground">
					Nothing matches this question right now.
				</span>
			}
		/>
	);
}
