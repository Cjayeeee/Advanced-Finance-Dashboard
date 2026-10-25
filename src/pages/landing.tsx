import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Check,
  ChevronDown,
  FileText,
  Gauge,
  Landmark,
  Lock,
  Repeat,
  Rocket,
  ShieldCheck,
  Target,
  UserRound,
  Wallet,
} from 'lucide-react'
import { useApp } from '@/store/app-store'
import { Logo } from '@/components/logo'
import { Button } from '@/components/ui/button'
import { useSeo } from '@/lib/seo'
import { cn } from '@/lib/utils'

const BASE = import.meta.env.BASE_URL

/* Content lives in plain arrays so the FAQ structured data in index.html stays in sync (see scripts/prerender.mjs). */

const FEATURES = [
  { icon: Gauge, title: 'A dashboard that answers the real questions', body: 'How much you earned, where it went, and how much is left, with like-for-like comparisons against last period.' },
  { icon: FileText, title: 'Invoices that get paid', body: 'Line items, GST/VAT, discounts, due dates and partial payments. Overdue invoices are flagged automatically. Print or download as PDF.' },
  { icon: Target, title: 'Budgets with an early warning', body: 'Monthly or custom-period limits per category, alert thresholds, and a projection of where spending will land by month end.' },
  { icon: BarChart3, title: 'Reports your accountant will like', body: 'Cash-basis profit & loss, monthly cash-flow statement, category and client analysis, budget vs actual, all exportable to CSV.' },
  { icon: Rocket, title: 'Burn rate and runway', body: 'For startups: average net burn over your last 3 or 6 complete months, and how many months your cash will last.' },
  { icon: Repeat, title: 'Every transaction, organised', body: 'Income, expenses, transfers and refunds with categories, clients, projects, tags and recurring schedules. Search, filter, bulk-edit.' },
]

const FREELANCER = ['Income by client and project', 'Invoices with partial-payment tracking', 'Monthly revenue target progress', 'Software subscription and business expense tracking', 'Overdue reminders in the app']
const STARTUP = ['Revenue vs operating expenses', 'Payroll, contractor and marketing spend', 'Monthly burn rate and cash runway', 'Budget utilisation by department', 'Customer revenue analysis']

export const FAQ: { q: string; a: string }[] = [
  { q: 'Who is Monetra for?', a: 'Freelancers, consultants, creators, small agencies and early-stage startups who want a clear view of income, expenses, invoices and cash without a full accounting package.' },
  { q: 'Which currencies are supported?', a: 'Indian Rupee (₹) with lakh and crore formatting, US Dollar ($), Euro (€) and British Pound (£). Each workspace uses one currency; amounts are not converted between currencies.' },
  { q: 'How does Monetra avoid counting an invoice payment twice?', a: 'An invoice is not revenue on its own. When you record a payment, Monetra creates one income transaction linked to that invoice, and the invoice balance is calculated from those payments. The money is counted exactly once.' },
  { q: 'Are transfers between my own accounts counted as income or expenses?', a: 'No. Transfers change account balances but are excluded from income, expenses and profit.' },
  { q: 'Can I export my data?', a: 'Yes. Transactions, invoices and every report export to CSV, invoices can be printed or downloaded as PDF, and you can download a full JSON backup of a workspace.' },
  { q: 'Where is my data stored?', a: 'In this version, your data is saved in your own browser on your device, separately for each account and workspace. It is not uploaded to a server, so export a backup regularly.' },
  { q: 'Does Monetra file taxes or connect to my bank?', a: 'No. Reports are simple cash-basis summaries, not statutory statements or tax filings, and transactions are entered by you rather than imported from a bank.' },
]

function DemoButtons({ className, inverse }: { className?: string; inverse?: boolean }) {
  const { loginDemo } = useApp()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const go = async () => {
    setBusy(true)
    try {
      await loginDemo('freelancer')
      navigate('/')
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className={cn('flex flex-wrap items-center gap-3', className)}>
      <Button size="lg" variant={inverse ? 'sun' : 'primary'} asChild>
        <Link to="/signup">
          Get started free <ArrowRight />
        </Link>
      </Button>
      <Button size="lg" variant={inverse ? 'ghost-inverse' : 'secondary'} onClick={go} disabled={busy}>
        {busy ? 'Opening demo…' : 'Try the live demo'}
      </Button>
    </div>
  )
}

export default function LandingPage() {
  useSeo({ path: '/' })
  const [open, setOpen] = useState<number | null>(0)

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 bg-canvas/80 backdrop-blur-xl">
        <nav aria-label="Main" className="mx-auto flex max-w-[1200px] items-center gap-4 px-4 py-3.5 sm:px-6">
          <Link to="/" aria-label="Monetra home" className="rounded-xl">
            <Logo />
          </Link>
          <ul className="ml-6 hidden items-center gap-1 text-[14px] text-ink-3 md:flex">
            {[
              ['#features', 'Features'],
              ['#who', 'Who it’s for'],
              ['#accuracy', 'Accuracy'],
              ['#faq', 'FAQ'],
            ].map(([href, label]) => (
              <li key={href}>
                <a href={href} className="rounded-full px-3 py-2 transition hover:bg-white/70 hover:text-ink">
                  {label}
                </a>
              </li>
            ))}
          </ul>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" asChild>
              <Link to="/login">Sign in</Link>
            </Button>
            <Button asChild className="max-sm:hidden">
              <Link to="/signup">Get started</Link>
            </Button>
          </div>
        </nav>
      </header>

      <main id="main">
        {/* Hero */}
        <section aria-labelledby="hero-title" className="mx-auto max-w-[1200px] px-4 pt-10 pb-16 sm:px-6 sm:pt-16">
          <p className="eyebrow">Income · Expenses · Invoices · Budgets · Runway</p>
          <h1 id="hero-title" className="mt-4 max-w-4xl font-display text-[44px] font-light leading-[1.02] tracking-[-0.04em] text-balance sm:text-[72px]">
            Know what you earn, where it goes, and <span className="relative whitespace-nowrap">how long it lasts<span className="absolute inset-x-0 bottom-1 -z-10 h-3 rounded-full bg-sun/70 sm:h-4" aria-hidden /></span>.
          </h1>
          <p className="mt-6 max-w-2xl text-[17px] leading-relaxed text-ink-3">
            Monetra is a finance app for freelancers and early-stage startups. Track income and expenses, send invoices and record payments, set budgets, and see your cash flow and runway in one calm dashboard.
          </p>
          <DemoButtons className="mt-8" />
          <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-[13px] text-muted">
            {['Free to use', 'Works in ₹, $, € and £', 'Indian lakh/crore formatting', 'Export to CSV and PDF'].map((t) => (
              <li key={t} className="flex items-center gap-1.5">
                <Check className="size-3.5 text-gain" /> {t}
              </li>
            ))}
          </ul>

          <figure className="mt-12 overflow-hidden rounded-[28px] bg-white/50 p-2 shadow-[var(--shadow-pop)] ring-1 ring-white/80 sm:p-3">
            <picture>
              <source type="image/webp" srcSet={`${BASE}screens/overview-960.webp 960w, ${BASE}screens/overview-1440.webp 1440w`} sizes="(min-width: 1200px) 1176px, 100vw" />
              <img
                src={`${BASE}screens/overview-1440.jpg`}
                width={1440}
                height={900}
                alt="Monetra dashboard showing total income, expenses, net profit and available balance, a cash-flow chart, receivables, budget gauge and expense breakdown"
                className="h-auto w-full rounded-[20px]"
                fetchPriority="high"
              />
            </picture>
            <figcaption className="sr-only">The Monetra overview dashboard with sample freelancer data.</figcaption>
          </figure>
        </section>

        {/* Features */}
        <section id="features" aria-labelledby="features-title" className="mx-auto max-w-[1200px] scroll-mt-20 px-4 py-16 sm:px-6">
          <h2 id="features-title" className="max-w-2xl font-display text-[34px] font-light leading-tight tracking-[-0.03em] text-balance sm:text-[46px]">
            Everything a small business needs to stay on top of money
          </h2>
          <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <li key={f.title} className="tile p-6">
                <span className="grid size-11 place-items-center rounded-full bg-ink text-sun">
                  <f.icon className="size-5" />
                </span>
                <h3 className="mt-5 font-display text-[20px] leading-snug tracking-tight">{f.title}</h3>
                <p className="mt-2 text-[14px] leading-relaxed text-muted">{f.body}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* Audiences */}
        <section id="who" aria-labelledby="who-title" className="mx-auto max-w-[1200px] scroll-mt-20 px-4 py-16 sm:px-6">
          <h2 id="who-title" className="font-display text-[34px] font-light tracking-[-0.03em] sm:text-[46px]">
            Built for two kinds of independent
          </h2>
          <div className="mt-10 grid gap-4 lg:grid-cols-2">
            <article className="tile p-7 sm:p-9">
              <span className="grid size-12 place-items-center rounded-full bg-sun-soft">
                <UserRound className="size-5" />
              </span>
              <h3 className="mt-5 font-display text-[26px] tracking-tight">Freelancers & consultants</h3>
              <p className="mt-2 text-[14.5px] leading-relaxed text-muted">Know which clients pay the bills, chase overdue invoices, and see whether you're on track for this month's target.</p>
              <ul className="mt-6 flex flex-col gap-2.5">
                {FREELANCER.map((t) => (
                  <li key={t} className="flex items-center gap-2.5 text-[14px]">
                    <Check className="size-4 shrink-0 text-gain" /> {t}
                  </li>
                ))}
              </ul>
            </article>
            <article className="tile-ink p-7 sm:p-9">
              <span className="grid size-12 place-items-center rounded-full bg-sun text-ink">
                <Rocket className="size-5" />
              </span>
              <h3 className="mt-5 font-display text-[26px] tracking-tight">Early-stage startups</h3>
              <p className="mt-2 text-[14.5px] leading-relaxed text-white/65">Watch revenue against operating costs, keep marketing and payroll inside budget, and know exactly how many months of runway you have.</p>
              <ul className="mt-6 flex flex-col gap-2.5">
                {STARTUP.map((t) => (
                  <li key={t} className="flex items-center gap-2.5 text-[14px]">
                    <Check className="size-4 shrink-0 text-sun" /> {t}
                  </li>
                ))}
              </ul>
            </article>
          </div>
        </section>

        {/* Accuracy */}
        <section id="accuracy" aria-labelledby="acc-title" className="mx-auto max-w-[1200px] scroll-mt-20 px-4 py-16 sm:px-6">
          <div className="tile grid gap-10 p-7 sm:p-10 lg:grid-cols-[1fr_1.2fr]">
            <div>
              <h2 id="acc-title" className="font-display text-[34px] font-light leading-tight tracking-[-0.03em] text-balance sm:text-[42px]">
                Numbers you can trust
              </h2>
              <p className="mt-4 text-[15px] leading-relaxed text-muted">Every figure on every page comes from one set of calculations over your recorded transactions. Nothing is hard-coded, and estimates are always labelled as estimates.</p>
            </div>
            <dl className="grid gap-5 sm:grid-cols-2">
              {[
                { icon: Wallet, t: 'Exact to the paisa', d: 'Amounts are stored as whole paise or cents, so totals never drift from rounding errors.' },
                { icon: FileText, t: 'No double counting', d: 'Invoice payments become income exactly once, and the invoice balance updates from them.' },
                { icon: Landmark, t: 'Transfers excluded', d: 'Moving money between your own accounts never inflates income or expenses.' },
                { icon: ShieldCheck, t: 'Fair comparisons', d: 'Mid-month figures are compared with the same days of last month, not the whole month.' },
              ].map((x) => (
                <div key={x.t}>
                  <dt className="flex items-center gap-2.5 text-[15px] font-medium">
                    <x.icon className="size-4 text-muted" /> {x.t}
                  </dt>
                  <dd className="mt-1.5 text-[13.5px] leading-relaxed text-muted">{x.d}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" aria-labelledby="faq-title" className="mx-auto max-w-[860px] scroll-mt-20 px-4 py-16 sm:px-6">
          <h2 id="faq-title" className="font-display text-[34px] font-light tracking-[-0.03em] sm:text-[46px]">
            Questions, answered
          </h2>
          <div className="mt-8 flex flex-col gap-2">
            {FAQ.map((f, i) => (
              <div key={f.q} className="tile overflow-hidden p-0">
                <h3>
                  <button className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left text-[15.5px] font-medium" aria-expanded={open === i} aria-controls={`faq-${i}`} onClick={() => setOpen(open === i ? null : i)}>
                    {f.q}
                    <ChevronDown className={cn('size-4 shrink-0 text-muted transition-transform duration-200', open === i && 'rotate-180')} />
                  </button>
                </h3>
                {/* Answers stay in the HTML (hidden attribute toggled) so crawlers and screen readers can read them. */}
                <div id={`faq-${i}`} hidden={open !== i} className="px-6 pb-5 text-[14.5px] leading-relaxed text-muted">
                  {f.a}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section aria-labelledby="cta-title" className="mx-auto max-w-[1200px] px-4 pt-8 pb-20 sm:px-6">
          <div className="tile-ink relative overflow-hidden p-8 sm:p-14">
            <div className="absolute -right-24 -bottom-32 size-[420px] rounded-full bg-sun/25 blur-3xl" aria-hidden />
            <h2 id="cta-title" className="relative max-w-2xl font-display text-[34px] font-light leading-tight tracking-[-0.03em] text-balance sm:text-[50px]">
              Make managing money feel clear and effortless.
            </h2>
            <p className="relative mt-4 max-w-xl text-[15px] text-white/65">Open the demo workspace with 14 months of sample data, or start fresh in under a minute.</p>
            <DemoButtons className="relative mt-8" inverse />
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-6 px-4 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <Logo />
            <p className="mt-3 max-w-sm text-[12.5px] leading-relaxed text-muted">
              Income, expense and invoice tracking for freelancers and startups. Reports are cash-basis summaries, not tax or statutory filings.
            </p>
          </div>
          <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2 text-[13.5px] text-ink-3">
            <a href="#features" className="hover:text-ink">Features</a>
            <a href="#faq" className="hover:text-ink">FAQ</a>
            <Link to="/login" className="hover:text-ink">Sign in</Link>
            <Link to="/signup" className="inline-flex items-center gap-1 hover:text-ink">
              Create account <ArrowUpRight className="size-3.5" />
            </Link>
          </nav>
        </div>
        <p className="mx-auto flex max-w-[1200px] items-center gap-1.5 px-4 pb-8 text-[11.5px] text-subtle sm:px-6">
          <Lock className="size-3" /> © {new Date().getFullYear()} Monetra. Your data stays in your browser.
        </p>
      </footer>
    </div>
  )
}
