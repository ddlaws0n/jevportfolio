# Who Needs You

A portfolio triage engine built on [TypeSafe](https://typesafe.ai)'s **Jev**.

**[whoneedsyou.vercel.app](https://whoneedsyou.vercel.app)**

> You manage 1,000 customers. It's Monday morning. Who actually needs you?

1,000 synthetic SaaS accounts go in. Six constrained judgments per account come
back — six thousand of them — and ordinary TypeScript decides which accounts a
human should open today.

The recorded baseline run, committed in `src/data/baseline.json`:

| | |
|-|-|
| Model | `jev-1.13.0` |
| Accounts | 1,000 |
| Judgments | 6,000 |
| Wall clock | 9.37s |
| Input tokens | 1,845,032 |
| Cost | $0.0775 |
| Failures | 0 |

Every number on the site is measured from that run. Nothing is estimated.

---

## The idea

Jev is a *System One* model: you hand it state plus typed questions and it
returns constrained probabilistic decisions, not prose. TypeSafe's own guidance
is to keep the workflow in code and give the model narrow semantic judgments.
This app is that split, made literal.

**Jev is asked six things about each account, and nothing else:**

| Question | Primitive | What it answers |
|-|-|-|
| `needs_attention` | Noul | Is there evidence a person should act within two weeks? |
| `churn_signal` | Noul | Is there meaningful evidence retention is at risk? |
| `expansion_signal` | Noul | Is there a near-term opportunity to sell more? |
| `urgency` | Score (0–4) | How soon does someone need to act? |
| `primary_reason` | Choice (7) | What is the dominant theme? |
| `owner` | Choice (6) | Which role should pick it up? |

All six go out in **one request per account**, because TypeSafe evaluates every
question in a request against the same `state` in parallel.

**Jev is never asked to decide a priority.** Bands, rankings, the risk lens and
the sales lens are all arithmetic over those probabilities, in
`src/lib/portfolio/triage.ts`:

```ts
band =
  urgency >= 3 && needsAttention > 0.8   ? "act-now"
: needsAttention > 0.55
  || churnSignal > 0.55
  || expansionSignal > 0.65              ? "review"
:                                          "healthy"
```

Because the raw answers are stored and every view is derived, switching the
portfolio from "who needs attention" to "who is churning" to "who is ready to
buy" re-ranks 1,000 accounts instantly and costs nothing. That is the point of
the three lens buttons.

### Does it actually work?

The generator knows which archetype produced each account and Jev never sees it,
so `/methodology` can compare intent against outcome. From the committed run:

| Archetype planted | n | Act now | Review | No action | Attention | Churn | Expansion | Urgency |
|-|-|-|-|-|-|-|-|-|
| healthy | 618 | — | — | 618 | 10% | 8% | 12% | 0.63 |
| healthy + noise | 201 | — | 1 | 200 | 22% | 15% | 14% | 1.23 |
| adoption concern | 45 | 2 | 43 | — | 78% | 71% | 8% | 2.85 |
| support escalation | 25 | 21 | 4 | — | 87% | 71% | 10% | 3.17 |
| relationship risk | 21 | 12 | 9 | — | 84% | 92% | 7% | 3.12 |
| renewal risk | 25 | 9 | 16 | — | 77% | 82% | 15% | 3.02 |
| expansion opportunity | 34 | 1 | 33 | — | 73% | 6% | 96% | 2.99 |
| ambiguous | 31 | — | 30 | 1 | 69% | 38% | 25% | 2.49 |

180 of the 181 planted problems were surfaced; one deliberately quiet account
was flagged. Run `bun run audit` to reproduce that table locally.

---

## Stack

TanStack Start on Bun, deployed to Vercel.

- **File-based routes** in `src/routes`, with a different SSR mode per route:
  - `/` — `ssr: true`. The hero and the untriaged grid go out in the first
    flush; the recorded run streams in behind them from a deferred loader
    promise.
  - `/accounts/$accountId` — `ssr: true`. Deep-linkable, with the judgments in
    the HTML and in the meta description.
  - `/live` — `ssr: 'data-only'`. The loader runs on the server; the console
    itself is client-rendered because it consumes an async iterator and repaints
    continuously.
  - `/methodology` — prerendered at build time. It is reference content that
    cannot change between deploys.
- **Validated search params** (`src/lib/portfolio/search.ts`). Lens, band,
  query, sort and the open account all live in the URL, parsed through Zod at
  the route boundary, with defaults stripped so links stay clean.
- **Typed server functions** (`src/server/portfolio.functions.ts`). The live run
  is an async-generator server function that yields a typed `TriageEvent` per
  batch, so the browser watches real counters rather than a simulated bar.
- **Server-only boundaries.** `*.server.ts` modules hold the SDK, the key and
  the baseline. `typesafe.server.ts` throws at module scope if it is ever
  imported into a client bundle, and the key is read per-request, never at
  module scope.

UI components come from the [beUI](https://beui.dev) registry under
`src/components/motion` and `src/components/agents`; they are vendored as-is and
excluded from linting.

---

## Running it

```sh
bun install
```

Set `TYPESAFE_API_KEY` in `.env.local` (see `.env.example`), or keep it in
1Password and use the `:op` scripts, which resolve `.env.op`:

```sh
bun run dev          # http://localhost:3000
bun run dev:op       # same, with the key resolved via `op run`
```

The site renders from the committed baseline, so it works without a key — only
the **Live run** page needs one.

### Scripts

| | |
|-|-|
| `bun run dev` | Dev server |
| `bun run build` | Production build (`.output`) |
| `bun run baseline` | Re-record the baseline against the live API |
| `bun run audit` | Print the committed baseline's bands, archetype audit and top accounts. No API calls |
| `bun run typecheck` | `tsc --noEmit` |
| `bun run check` | Biome lint + format |

The social card at `public/og.png` is rendered from `scripts/og-card.html`; open
that file in a 1200×630 viewport and screenshot it after changing the numbers.

Re-recording the whole portfolio costs about eight cents:

```sh
bun run baseline:op -- --concurrency 100 --rps 100
```

Useful flags: `--limit`, `--concurrency`, `--rps`, `--seed`.

> Changing anything in `src/lib/portfolio/generate.ts` changes the accounts, so
> the committed judgments no longer describe them. Re-run the baseline after any
> generator change — `bun run audit` warns if the two have drifted apart.

### Environment

| Variable | Purpose |
|-|-|
| `TYPESAFE_API_KEY` | Required for `bun run baseline` and the live run. Server-only |
| `TYPESAFE_DEFAULT_MODEL` | Optional. Defaults to `jev-latest` |
| `LIVE_RUN_BUDGET_USD_PER_HOUR` | Optional. Caps public live-run spend per instance per hour. Default `2` |
| `LIVE_RUN_MAX_CONCURRENT` | Optional. Simultaneous live runs per instance. Default `3` |
| `VITE_SITE_URL` | Public. Absolute origin used for `og:image` and `og:url` |

The live-run button is public and spends real money, so
`src/server/budget.server.ts` holds an in-memory hourly spend window and refuses
politely once it is exhausted.

---

## What this is not

The accounts are synthetic and the archetypes were written to be separable,
which makes them easier than real CRM data. Ground truth here is the generator's
intent, not a real outcome — nothing on the site shows whether a flagged account
would actually have churned. Typed output guarantees the interface, not the
truth; thresholds worth trusting have to be evaluated on real data and real
consequences. `/methodology` says all of this on the page itself.

No database, no auth, no CRM integration, no LLM-written summaries.
