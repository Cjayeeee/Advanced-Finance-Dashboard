# Monetra design system

## 1. Reference analysis

The reference is an HR dashboard ("Crextio"). What makes it work:

| Aspect | Observation | Translation for Monetra |
| --- | --- | --- |
| Atmosphere | Warm grey canvas fading into a soft butter-yellow glow in one corner. Optimistic, calm, not corporate. | Same warm canvas `#ebeae5` with a radial sunflower glow fixed to the bottom-right of the viewport. |
| Typography | Very large, *light-weight* geometric numerals carry the hierarchy. Labels are small and grey. | **Outfit 300** for every financial figure (`.figure`), **Inter** for UI. Tabular lining numerals everywhere so money columns align. |
| Palette | Three working colours: ink black, sunflower yellow, translucent white. | `ink #161615`, `sun #f5cb3c`, `surface rgba(255,255,255,.58)`. Gain/loss colours are used *only* for financial direction. |
| Shape | 28px tiles, fully pill-shaped nav, buttons and chips, round icon buttons with a ↗ affordance. | Same radii. Every tile that leads somewhere has the ↗ button, which rotates 45° on hover. |
| Signature details | Hatched stripes for "remaining", lollipop bars with one yellow highlight, tick-ring dial, one inverted dark card. | **Hatched = estimate / projected / remaining**, never a recorded fact. Lollipop bars for cash flow and trends. Tick-ring gauge for budget use and revenue target. One ink tile per screen for the "needs action / money on hand" moment. |
| Density | Generous padding, few borders, hierarchy made with whitespace and weight. | Few dividers, hairline `line` borders only inside tables and lists. |

What was deliberately *not* copied: the top pill navigation (the brief asks for a sidebar, so it became a floating rounded sidebar with a black active pill), the HR content, the photo card, and the branding.

## 2. Tokens (`src/index.css` → `@theme`)

| Token | Value | Use |
| --- | --- | --- |
| `canvas` | `#ebeae5` | page background |
| `paper` | `#f7f6f2` | dialogs, popovers |
| `surface` / `surface-strong` | white 58% / 82% | tiles |
| `ink`, `ink-2`, `ink-3` | `#161615` → `#3d3d3a` | text, primary buttons, inverted tiles |
| `muted`, `subtle` | `#77756f`, `#a3a19a` | secondary text |
| `line`, `line-strong` | ink 8% / 14% | hairlines, field rings |
| `sun`, `sun-deep`, `sun-soft`, `sun-wash` | `#f5cb3c` … `#fdf6d8` | highlight, expenses series, warnings, net-profit tile |
| `gain` / `loss` (+ `-soft`) | `#3f7a4f` / `#b8463a` | direction of money only |
| `radius-tile` / `panel` / `field` | 28 / 22 / 14 px | |
| `shadow-tile` / `pop` / `ink` | | resting tiles / overlays / inverted tiles |
| `ease-out` | `cubic-bezier(.22,1,.36,1)` | all transitions |

## 3. Components

* **Buttons:** `primary` (ink), `sun`, `secondary` (white), `outline`, `ghost`, `danger`, `ghost-inverse`. Pill-shaped, with a press-scale of 0.97.
* **Fields:** 44px, 14px radius, inset ring that becomes a 2px ink ring on focus and a 2px loss ring when invalid. `MoneyInput` has a currency prefix and a `large` variant for primary amounts.
* **Segmented:** a radio group with arrow-key support. The active segment is an ink pill. Used for type, granularity, view and status filters.
* **Tiles:** `tile` (light) and `tile-ink` (inverted). `TileHeader` provides the title, subtitle and an optional ↗ link.
* **Status badges:** Draft (outline) · Sent (neutral) · Partially paid (sun) · Paid (gain) · Overdue (loss) · Void (hatched).
* **Charts:** `Lollipop` / `PillBar` bar shapes, `TickGauge`, `SegmentBar`, `Sparkline`, and the ink `ChartTooltipCard`. Income is ink, expenses are sunflower, and net is a dashed grey line.

## 4. Motion

Page content rises 8px over 450ms. Dialogs pop on desktop and slide up as a sheet on mobile. Numbers tween with a quartic ease-out (`AnimatedNumber`). Chart bars grow in using Recharts' own animation. The sidebar width transitions on collapse. Skeletons shimmer while lazy pages load. Everything collapses to instant under `prefers-reduced-motion`. GSAP was deliberately not added because CSS and Recharts cover every case without another dependency.

## 5. Responsive behaviour

* **≥1280px:** persistent 248px sidebar and a 12-column dashboard. The invoice editor shows a live preview beside the form.
* **768–1100px:** the sidebar auto-collapses to icons with tooltips, and grids reflow to two columns.
* **<768px:** a top bar with a menu drawer, a floating ink bottom nav with a central "+" action, bottom-sheet dialogs, card lists instead of tables, and the period picker moves into the page header. No horizontal overflow (verified at 390px on every route).
