/** Display formatters. Deterministic and locale-pinned so SSR and hydration agree. */

const GBP_COMPACT = new Intl.NumberFormat("en-GB", {
	style: "currency",
	currency: "GBP",
	notation: "compact",
	maximumFractionDigits: 1,
});

const GBP_FULL = new Intl.NumberFormat("en-GB", {
	style: "currency",
	currency: "GBP",
	maximumFractionDigits: 0,
});

const INT = new Intl.NumberFormat("en-GB");

export const gbp = (value: number) => GBP_COMPACT.format(value).toUpperCase();
export const gbpFull = (value: number) => GBP_FULL.format(value);
export const count = (value: number) => INT.format(value);

export const pct = (probability: number) => `${Math.round(probability * 100)}%`;

export const signedPct = (value: number) =>
	`${value > 0 ? "+" : ""}${value.toFixed(0)}%`;

export const seconds = (ms: number) => `${(ms / 1000).toFixed(2)}s`;

/** Jev costs fractions of a cent, so fixed-2 would print $0.00 for everything. */
export const usd = (value: number) => {
	if (value === 0) return "$0";
	if (value < 0.01) return `$${value.toFixed(5)}`;
	if (value < 1) return `$${value.toFixed(4)}`;
	return `$${value.toFixed(2)}`;
};

export const days = (value: number) =>
	value === 1 ? "1 day" : `${INT.format(value)} days`;

export const titleCase = (value: string) =>
	value.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
