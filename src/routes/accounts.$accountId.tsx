import {
	createFileRoute,
	Link,
	stripSearchParams,
} from "@tanstack/react-router";

import {
	AccountDetailBody,
	AccountDetailHeader,
} from "#/components/portfolio/AccountDetail";
import {
	ACCOUNT_SEARCH_DEFAULTS,
	accountSearchSchema,
} from "#/lib/portfolio/search";
import { getAccountDetail } from "#/server/portfolio.functions";

export const Route = createFileRoute("/accounts/$accountId")({
	// Deep-linked and shareable: the judgments need to be in the HTML.
	ssr: true,
	validateSearch: accountSearchSchema,
	search: { middlewares: [stripSearchParams(ACCOUNT_SEARCH_DEFAULTS)] },
	loader: ({ params }) =>
		getAccountDetail({ data: { accountId: params.accountId } }),
	head: ({ loaderData }) => ({
		meta: loaderData
			? [
					{
						title: `${loaderData.account.name} — 1000 Accounts`,
					},
					{
						name: "description",
						content: `${loaderData.account.name}: needs attention ${Math.round(
							loaderData.judgments.needsAttention * 100,
						)}%, churn ${Math.round(
							loaderData.judgments.churnSignal * 100,
						)}%, expansion ${Math.round(
							loaderData.judgments.expansionSignal * 100,
						)}%.`,
					},
				]
			: [],
	}),
	component: AccountPage,
});

function AccountPage() {
	const row = Route.useLoaderData();
	const { lens } = Route.useSearch();

	return (
		<div className="mx-auto w-full max-w-[880px] px-4 py-10 sm:px-6">
			<Link
				to="/"
				search={{
					lens,
					band: "all",
					sort: "priority",
					account: row.account.id,
				}}
				className="label-caps transition-colors hover:text-foreground"
			>
				← Back to the portfolio
			</Link>

			<div className="mt-6 space-y-8">
				<AccountDetailHeader row={row} />
				<AccountDetailBody row={row} />
			</div>

			<p className="mt-10 border-t border-border/60 pt-4 text-xs text-muted-foreground">
				Every probability on this page came from one request to Jev carrying six
				questions about this account's record. The band, the three scores and
				the low-confidence flag were computed afterwards in{" "}
				<code className="rounded bg-card px-1 py-0.5">
					src/lib/portfolio/triage.ts
				</code>
				.
			</p>
		</div>
	);
}
