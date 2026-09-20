import {
	createRootRoute,
	HeadContent,
	Link,
	Scripts,
} from "@tanstack/react-router";

import { PORTFOLIO_SEARCH_DEFAULTS } from "#/lib/portfolio/search";
import appCss from "#/styles.css?url";

const TITLE = "1000 Accounts — portfolio triage with Jev";
const DESCRIPTION =
	"1,000 synthetic customer accounts. 6,000 constrained AI judgments from TypeSafe's Jev. Software keeps the final decision.";

/**
 * Social cards need absolute URLs, and the deployment does not know its own
 * public origin at build time. `VITE_SITE_URL` is public by design — it is the
 * address of this page.
 */
const FALLBACK_SITE_URL = "https://jevportfolio-three.vercel.app";
// An env var that is defined but blank survives `??`, and a blank origin makes
// `og:image` relative — which no social card scraper will resolve.
const SITE_URL = (
	import.meta.env.VITE_SITE_URL?.trim() || FALLBACK_SITE_URL
).replace(/\/$/, "");

const OG_IMAGE = `${SITE_URL}/og.png`;

export const Route = createRootRoute({
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{ name: "viewport", content: "width=device-width, initial-scale=1" },
			{ title: TITLE },
			{ name: "description", content: DESCRIPTION },
			{ name: "theme-color", content: "#131418" },
			{ property: "og:site_name", content: "1000 Accounts" },
			{ property: "og:title", content: TITLE },
			{ property: "og:description", content: DESCRIPTION },
			{ property: "og:type", content: "website" },
			{ property: "og:url", content: SITE_URL },
			{ property: "og:image", content: OG_IMAGE },
			{ property: "og:image:width", content: "1200" },
			{ property: "og:image:height", content: "630" },
			{
				property: "og:image:alt",
				content:
					"A grid of 1,000 account squares with 181 highlighted, above the measured run: 1,000 accounts, 6,000 AI judgments, 9.37 seconds, $0.0775.",
			},
			{ name: "twitter:card", content: "summary_large_image" },
			{ name: "twitter:title", content: TITLE },
			{ name: "twitter:description", content: DESCRIPTION },
			{ name: "twitter:image", content: OG_IMAGE },
		],
		links: [
			{ rel: "stylesheet", href: appCss },
			{ rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
			{ rel: "preconnect", href: "https://fonts.googleapis.com" },
			{
				rel: "preconnect",
				href: "https://fonts.gstatic.com",
				crossOrigin: "anonymous",
			},
			{
				rel: "stylesheet",
				href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap",
			},
		],
	}),
	shellComponent: RootDocument,
	notFoundComponent: NotFound,
});

function RootDocument({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en">
			<head>
				<HeadContent />
			</head>
			<body className="min-h-dvh bg-background text-foreground antialiased">
				<div className="flex min-h-dvh flex-col">
					<SiteHeader />
					<main className="flex-1">{children}</main>
					<SiteFooter />
				</div>
				<Scripts />
			</body>
		</html>
	);
}

function SiteHeader() {
	return (
		<header className="sticky top-0 z-30 border-b border-border/70 bg-background/85 backdrop-blur-md">
			<div className="mx-auto flex h-14 w-full max-w-[1400px] items-center gap-6 px-4 sm:px-6">
				<Link
					to="/"
					search={PORTFOLIO_SEARCH_DEFAULTS}
					className="flex items-center gap-2.5 text-sm font-semibold tracking-tight"
				>
					<span className="grid h-6 w-6 place-items-center rounded-md bg-primary/15 text-primary">
						<span className="block h-2 w-2 rounded-[2px] bg-primary" />
					</span>
					<span>1000 Accounts</span>
				</Link>

				<nav className="hidden items-center gap-1 text-sm sm:flex">
					<HeaderLink to="/live">Live run</HeaderLink>
					<HeaderLink to="/methodology">Methodology</HeaderLink>
				</nav>

				<a
					href="https://typesafe.ai"
					target="_blank"
					rel="noreferrer"
					className="ml-auto label-caps transition-colors hover:text-foreground"
				>
					Powered by Jev
				</a>
			</div>
		</header>
	);
}

function HeaderLink({
	to,
	children,
}: {
	to: "/live" | "/methodology";
	children: React.ReactNode;
}) {
	return (
		<Link
			to={to}
			className="rounded-full px-3 py-1.5 text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
			activeProps={{ className: "bg-card text-foreground" }}
		>
			{children}
		</Link>
	);
}

function SiteFooter() {
	return (
		<footer className="border-t border-border/70">
			<div className="mx-auto flex w-full max-w-[1400px] flex-col gap-2 px-4 py-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
				<p>
					Synthetic data. No real customers, no CRM, no database. The judgments
					and the telemetry are real.
				</p>
				<p className="numeric">
					TanStack Start · Bun ·{" "}
					<a
						className="underline decoration-dotted underline-offset-4 hover:text-foreground"
						href="https://docs.typesafe.ai"
						target="_blank"
						rel="noreferrer"
					>
						TypeSafe Jev
					</a>
				</p>
			</div>
		</footer>
	);
}

function NotFound() {
	return (
		<div className="mx-auto flex max-w-lg flex-col items-center gap-4 px-6 py-32 text-center">
			<p className="label-caps">404</p>
			<h1 className="text-2xl font-semibold">No such account.</h1>
			<p className="text-sm text-muted-foreground">
				The portfolio only contains ACC-0001 through ACC-1000.
			</p>
			<Link
				to="/"
				search={PORTFOLIO_SEARCH_DEFAULTS}
				className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground"
			>
				Back to the portfolio
			</Link>
		</div>
	);
}
