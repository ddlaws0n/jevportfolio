import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";

import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";

const config = defineConfig({
	resolve: { tsconfigPaths: true },
	plugins: [
		devtools(),
		nitro({
			// Nitro auto-detects Vercel from the build environment; these settings
			// only apply once it has.
			vercel: {
				functions: {
					// Three 1,000-account runs share 18 req/s: allow ~167s plus
					// response latency and retries rather than killing them at 60s.
					maxDuration: 300,
					supportsResponseStreaming: true,
				},
			},
		}),
		tailwindcss(),
		tanstackStart({
			// Only the reference page is prerendered. The portfolio and the live
			// runner are server-rendered per request on purpose: one streams its
			// loader data, the other reports runtime state.
			prerender: {
				enabled: true,
				crawlLinks: false,
				// Static-path discovery would happily prerender the whole site. Only
				// the reference page is genuinely build-time content.
				filter: (page) => page.path === "/methodology",
			},
			pages: [{ path: "/methodology", prerender: { enabled: true } }],
		}),
		viteReact(),
	],
});

export default config;
