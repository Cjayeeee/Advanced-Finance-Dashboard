# Monetra: finance for freelancers & early-stage startups

Monetra is a working finance-management SaaS front end. It covers income, expenses, invoices, budgets, cash flow and runway in one calm, legible dashboard.

> **Core principle:** make managing money feel clear, effortless, and empowering.

## Quick start

```bash
npm install
npm run dev        # http://localhost:5173
```

On the sign-in screen, choose **Freelancer** or **Startup** to open a sample workspace with 14 months of realistic data. To start from scratch, create an account and go through onboarding (workspace, type, currency, opening balance).

| Script | What it does |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm run build` | Type-check (`tsc -b`) + production build to `dist/` |
| `npm run preview` | Serve the production build |
| `npm test` | Vitest unit tests for money, dates and every financial calculation |
| `npm run typecheck` | TypeScript only |
| `VITE_ROUTER=hash npm run build` | Static build with hash routing and relative paths. Runs from any folder or static host. |

## Stack

React 19 · Vite · TypeScript (strict) · Tailwind CSS v4 · Radix primitives in shadcn/ui style (`src/components/ui`) · Recharts · Lucide · React Router · React Hook Form + Zod · Sonner (toasts) · jsPDF (lazy-loaded) · Fontsource (Outfit + Inter, self-hosted).

## What's in the app

| Area | Highlights |
| --- | --- |
| **Overview** | Greeting and plain-language summary. Four metrics (income, expenses, net profit, available balance) with like-for-like trends and sparklines. Interactive cash-flow chart (daily / weekly / monthly / yearly). Receivables card (freelancer) or runway card (startup). Budget pulse gauge, expense breakdown with share/change toggle, data-derived insights, recent transactions with search, sort and filter. Dismissible onboarding checklist. |
| **Transactions** | Create, edit, duplicate and delete (with confirmation **and undo**). Income, expense and **transfer** types, refunds, tags, notes, client and project links, recurring settings. Search, type/category/account/client/amount filters, sortable columns, bulk select (re-categorise, export, delete), possible-duplicate detection, CSV export of the filtered or selected rows. A **Recurring** view shows next due dates and lets you log the next occurrence. Nothing is auto-posted. |
| **Income** | Payments received, invoiced and outstanding receivables shown as separate figures. Revenue target gauge, 12-month trend with target line, income by client or project, outstanding client payments with one-click "Record payment", recurring income. |
| **Expenses** | Totals, daily average, recurring commitments, largest category, 12-month trend, largest expenses, category table with like-for-like change and budget utilisation, custom categories (icon + colour). |
| **Invoices** | Editor with live paper preview, line items (decimal quantities), % or fixed discount, configurable tax, auto-numbering, Net 7/15/30/45. Draft → Sent → Partially paid → Paid, with Overdue derived from the due date. Full and partial payments with overpayment protection, payment history and timeline, void/restore, duplicate, PDF download, CSV export, receivables aging. |
| **Budgets** | Overall and per-category monthly budgets plus custom-period budgets. Alert thresholds, projected spend (hatched), prior-month comparison, month navigation, budget vs actual chart, "spending without a budget" suggestions. |
| **Reports** | Summary (incl. YoY), cash-basis P&L with comparison and monthly matrix, cash-flow statement (opening/closing balances), balance chart with a clearly-marked 3-month estimate, burn & runway, category analysis, client revenue, budget vs actual. Each table exports to CSV. |
| **Settings** | Profile, workspace and business details for invoices, invoice defaults, currency and number format (INR, USD, EUR, GBP; Indian lakh/crore grouping), burn window, week start, categories (with reassignment on delete), accounts (archive, opening balances), clients and projects, in-app notification preferences, CSV/JSON export, sample-data reset, clear, delete workspace. Unsupported features are clearly labelled **Unavailable**. |
| **Global** | Collapsible sidebar, top bar with breadcrumb, ⌘/Ctrl-K command palette, derived notification centre, reporting-period picker, `N` to add a transaction, `?` for help (which explains every calculation), workspace switcher, mobile bottom navigation and bottom-sheet forms. |

## Financial model & accuracy

All logic lives in **`src/lib/finance.ts`** (pure functions, unit-tested in `finance.test.ts`). The UI only renders what those functions return. No dashboard number is hard-coded.

* **Money is stored as integer minor units** (paise/cents). Parsing (`parseMoney`) is string-based, percentages use integer basis points, and line totals use integer hundredths of quantity. Floats only appear at the display boundary.
* **Classification rules**

  | Type | Refund? | Income | Expenses | Cash in | Cash out |
  | --- | --- | --- | --- | --- | --- |
  | income | no | +a | – | +a | – |
  | income | yes | −a | – | – | +a |
  | expense | no | – | +a | – | +a |
  | expense | yes | – | −a | +a | – |
  | transfer | – | – | – | – | – |

* **Net profit (cash basis)** = income − expenses. **Net cash flow** = cash in − cash out. **Available balance** = opening balances of active accounts plus all recorded flows up to today. Transfers move money between accounts and never touch income or expenses.
* **Invoices are not revenue.** A payment is a single income transaction with `invoiceId`. Paid amount, status and receivables are *derived* from those transactions, so a payment cannot be counted twice. Deleting a payment re-opens the invoice balance.
* **Comparisons are like-for-like.** "This month" on the 24th is compared with the 1st–24th of last month (`comparisonRanges`).
* **Burn & runway (estimate):** net burn = mean of (cash out − cash in) over the last 3 or 6 *complete* months. Runway = available balance ÷ net burn, shown only when net burn is positive and at least two months of history exist.
* **Estimates are visually distinct.** Hatched fills and "Estimate" badges mark projections. Insights say "Recorded" or "Estimate", and insights are suppressed when there's too little data.
* **Duplicates:** same type, amount, date and description are flagged for review, not silently merged.

## Architecture

```
src/
  data/        types.ts (domain model) · defaults.ts · seed.ts (deterministic sample data, relative to today)
  lib/         money · dates · finance (+ tests) · filters · csv · pdf · id · utils
  store/       app-store.tsx (auth session + per-user state + typed mutations) · auth.ts · range.tsx · storage.ts
  components/  ui/ (Radix-based primitives) · shared display components (MoneyFigure, Trend, Tile…)
  features/    charts · transactions · invoices · categories · clients · overview
  layout/      app shell, sidebar, top bar, command palette, help
  pages/       one file per route (secondary pages are lazy-loaded)
```

## Data storage: local or Supabase

Monetra runs in one of two modes, chosen by environment variables:

| | **Local mode** (no keys set) | **Cloud mode** (Supabase keys set) |
| --- | --- | --- |
| Accounts | Browser-only, PBKDF2-hashed passwords | Supabase Auth: real sign-up, email confirmation, reset links |
| Data | `localStorage`, per user and workspace | `public.user_state` table, one JSON document per user, plus a local cache for speed |
| Security | None beyond the browser profile | Row Level Security: a user can only read or write their own row |
| Devices | This browser only | Synced across devices; changes from another device load when you return to the tab |
| Demo workspaces | Local | Still local (no account needed) |

### Set up Supabase (cloud mode)

1. **Run the SQL.** In Supabase, open SQL Editor → New query, paste [`supabase/migrations/001_user_state.sql`](supabase/migrations/001_user_state.sql), and click Run. It creates the table and the owner-only policies.
2. **Copy your keys.** In Project Settings → API (or the green **Connect** button), copy the **Project URL** and the **anon / publishable key**. Never use the `service_role` / secret key in the app.
3. **Add them locally.** Copy `.env.example` to `.env.local` and fill in:
   ```
   VITE_SUPABASE_URL=https://vkddesqcvlxzooqlutdw.supabase.co
   VITE_SUPABASE_ANON_KEY=<your anon key>
   ```
   Restart `npm run dev`.
4. **Add them on Vercel.** Go to Project → Settings → Environment Variables, add the same two variables, then redeploy.
5. **Set the auth URLs.** In Authentication → URL Configuration, set **Site URL** to your Vercel URL. Under **Redirect URLs**, add `https://<your-domain>/**` and `http://localhost:5173/**`, so confirmation and password-reset emails link back to the app.
6. *(Optional)* For quick testing, turn off **Confirm email** under Authentication → Sign In / Providers → Email. For production, configure custom SMTP, because Supabase's built-in email service is rate-limited.

**Existing local data:** the first time you sign in to a cloud account, Monetra uploads this browser's data for a local account with the same email (or this device's cached copy), so nothing is lost.

**How sync works** (`src/store/app-store.tsx`, `src/store/cloud.ts`): changes save to the cloud 0.8 seconds after you stop editing, and the sidebar shows *Saving… / All changes saved / Offline*. Saving waits until the server copy has loaded, so a stale cache can never overwrite it. If the connection drops, changes stay on the device and upload when it returns. Signing out removes the cached copy from that browser. When two devices both edit, the last save wins. Step 2 (normalised tables, see [`docs/supabase-schema.sql`](docs/supabase-schema.sql)) would add per-record merging, team sharing and database-level rules.

## SEO & sharing

* **Public landing page at `/`**, pre-rendered to static HTML at build time (`src/entry-prerender.tsx` + `scripts/prerender.mjs`), so crawlers and link previews see the real content without running JavaScript. Signed-in users see the dashboard at the same URL.
* **Head tags:** title, description, canonical URL, robots, Open Graph and Twitter cards with a 1200×630 share image (`public/og-image.png`), theme colour, web app manifest, SVG/PNG favicons and an Apple touch icon.
* **Structured data (JSON-LD):** `SoftwareApplication`, `WebSite`, `Organization` and `FAQPage` (generated from the landing page's FAQ, so the two never drift apart).
* **`robots.txt` and `sitemap.xml`** are generated on every build. Only `/` and `/signup` are listed. Private app pages are disallowed and also carry `noindex, nofollow`.
* **Per-page titles** such as "Invoices · Monetra" (`src/lib/seo.ts`).
* **Performance:** charts and other app code are split out of the landing page, the two above-the-fold fonts are preloaded, screenshots are served as responsive WebP with explicit dimensions (no layout shift), and Vercel caches hashed assets for a year.
* **Lighthouse (landing page):** desktop scores 99 / 100 / 100 / 100 (performance / accessibility / best practices / SEO). Mobile scores about 84 / 100 / 100 / 100 under its slow-4G simulation.

### Set your domain

Canonical URLs, Open Graph URLs and the sitemap use the site URL chosen at build time:

1. `SITE_URL` environment variable, e.g. `https://monetra.app` (set it in Vercel → Project → Settings → Environment Variables when you add a custom domain)
2. otherwise Vercel's production URL, detected automatically
3. otherwise `http://localhost:5173`

After deploying, submit `https://<your-domain>/sitemap.xml` in Google Search Console and Bing Webmaster Tools.

## Design

The reference analysis and the design system are documented in [`docs/DESIGN.md`](docs/DESIGN.md).

## Accessibility & motion

Semantic landmarks, a skip link, labelled form fields with `aria-invalid` and linked error messages, keyboard-operable menus, dialogs, segmented controls and command palette, visible focus rings, chart summaries for screen readers, and `prefers-reduced-motion` support (animations and chart transitions are disabled).
