import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowUpRight, Check, ChevronRight, CircleAlert, FileText, Lightbulb, PiggyBank, Plus, Sparkles, Target, TrendingUp, Users, X } from 'lucide-react'
import { useActiveWorkspace, useApp } from '@/store/app-store'
import { useFormat } from '@/hooks/use-format'
import { useLookups } from '@/hooks/use-lookups'
import { useTerms } from '@/hooks/use-terms'
import { MoneyFigure } from '@/components/money'
import { Trend } from '@/components/trend'
import { Sparkline } from '@/components/sparkline'
import { Tile, TileHeader } from '@/components/tile'
import { EmptyState } from '@/components/empty-state'
import { CategoryIcon } from '@/components/category-icon'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Segmented } from '@/components/ui/segmented'
import { Tip } from '@/components/ui/tooltip'
import { TickGauge } from '@/features/charts/tick-gauge'
import { SegmentBar } from '@/features/charts/segment-bar'
import { useTransactionDialog } from '@/features/transactions/transaction-dialog'
import { budgetUsage, burn, byCategory, comparisonRanges, invoiceViews, receivables, type Insight, type InvoiceView } from '@/lib/finance'
import { daysBetween, endOfMonth, formatRange, monthLabel, relativeDays, todayISO, type DateRange } from '@/lib/dates'
import { pctChange } from '@/lib/money'
import { cn } from '@/lib/utils'

/* ─────────────────────────── Metric card ─────────────────────────── */

export function MetricCard({
  label,
  value,
  pct,
  goodWhenUp = true,
  spark,
  sparkColor,
  footnote,
  variant = 'light',
  info,
  to,
}: {
  label: string
  value: number
  pct?: number | null
  goodWhenUp?: boolean
  spark?: number[]
  sparkColor?: string
  footnote?: React.ReactNode
  variant?: 'light' | 'ink' | 'sun'
  info?: string
  to?: string
}) {
  const inverse = variant === 'ink'
  const { money } = useFormat()
  const len = money(value).length
  const size = len > 12 ? 'text-[30px] sm:text-[32px]' : len > 10 ? 'text-[34px] sm:text-[36px]' : 'text-[38px] sm:text-[42px]'
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className={cn('text-[13px] font-medium', inverse ? 'text-white/70' : 'text-ink-3')}>
          {label}
          {info && (
            <Tip content={info}>
              <button className={cn('ml-1 inline-grid size-4 translate-y-[2px] place-items-center rounded-full text-[10px]', inverse ? 'bg-white/15' : 'bg-ink/[0.07] text-muted')} aria-label={`About ${label}`}>
                i
              </button>
            </Tip>
          )}
        </p>
        {to && (
          <span className={cn('grid size-8 place-items-center rounded-full transition-transform duration-200 group-hover:rotate-45', inverse ? 'bg-white/10' : 'bg-white shadow-sm')}>
            <ArrowUpRight className="size-3.5" />
          </span>
        )}
      </div>
      <MoneyFigure value={value} className={cn('mt-4 block whitespace-nowrap', size)} />
      <div className="mt-4 flex items-end justify-between gap-3">
        <div className="min-w-0">
          {pct !== undefined && <Trend pct={pct} goodWhenUp={goodWhenUp} inverse={inverse} />}
          {footnote && <p className={cn('mt-1.5 text-[12px]', inverse ? 'text-white/55' : 'text-muted')}>{footnote}</p>}
        </div>
        {spark && spark.length > 1 && <Sparkline values={spark} width={92} height={34} stroke={sparkColor ?? (inverse ? '#f5cb3c' : '#161615')} />}
      </div>
    </>
  )
  const cls = cn('group block p-5 transition-transform duration-300 ease-[var(--ease-out)] sm:p-6', to && 'hover:-translate-y-0.5', variant === 'ink' ? 'tile-ink' : 'tile', variant === 'sun' && '!bg-sun-soft/80')
  return to ? (
    <Link to={to} className={cls} aria-label={`${label}, open details`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  )
}

/* ─────────────────────────── Receivables (freelancer) ─────────────────────────── */

export function ReceivablesCard() {
  const { data } = useActiveWorkspace()
  const { money } = useFormat()
  const { client } = useLookups()
  const views = useMemo(() => invoiceViews(data.invoices, data.transactions), [data.invoices, data.transactions])
  const rec = receivables(views)
  const open = views
    .filter((v) => v.outstanding > 0)
    .sort((a, b) => (a.status === 'overdue' ? -1 : 0) - (b.status === 'overdue' ? -1 : 0) || (a.invoice.dueDate < b.invoice.dueDate ? -1 : 1))
  const recent = views.filter((v) => v.status === 'paid').sort((a, b) => (a.invoice.issueDate < b.invoice.issueDate ? 1 : -1))
  const list: InvoiceView[] = [...open.slice(0, 4), ...recent.slice(0, Math.max(0, 5 - Math.min(4, open.length)))]

  return (
    <section className="tile-ink flex h-full flex-col p-5 sm:p-6" aria-labelledby="rec-title">
      <TileHeader id="rec-title" title="Receivables" subtitle="Unpaid amounts on issued invoices" to="/invoices" inverse />
      <div className="flex items-end justify-between gap-3">
        <MoneyFigure value={rec.outstanding} className="text-[40px]" />
        <span className="pb-1 text-[12.5px] text-white/55 num">
          {rec.openCount} open · {rec.overdueCount} overdue
        </span>
      </div>
      <div className="mt-4 flex h-2.5 gap-1 overflow-hidden rounded-full" role="img" aria-label={`Overdue ${money(rec.overdue)}, not yet due ${money(rec.outstanding - rec.overdue)}`}>
        {rec.outstanding > 0 ? (
          <>
            <span className="rounded-full bg-sun" style={{ flex: rec.overdue || 0.0001 }} />
            <span className="hatch-light rounded-full bg-white/25" style={{ flex: rec.outstanding - rec.overdue || 0.0001 }} />
          </>
        ) : (
          <span className="flex-1 rounded-full bg-white/10" />
        )}
      </div>
      <div className="mt-2 flex justify-between text-[11.5px] text-white/55">
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-sun" /> Overdue {money(rec.overdue)}
        </span>
        <span>Not yet due {money(rec.outstanding - rec.overdue)}</span>
      </div>

      <ul className="mt-5 flex flex-1 flex-col gap-1">
        {list.length === 0 && <li className="py-6 text-center text-[13px] text-white/55">No invoices yet. Create one to start tracking payments.</li>}
        {list.map((v) => (
          <li key={v.invoice.id}>
            <Link to={`/invoices/${v.invoice.id}`} className="flex items-center gap-3 rounded-2xl p-2 transition hover:bg-white/[0.06]">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white/[0.08]">
                <FileText className="size-4 text-white/80" />
              </span>
              <span className="min-w-0 flex-1">
                <span className={cn('block truncate text-[13.5px]', v.status === 'paid' && 'text-white/45 line-through decoration-white/30')}>{client.get(v.invoice.clientId)?.name ?? 'Client'}</span>
                <span className="block text-[11.5px] text-white/45 num">
                  {v.invoice.number} · {v.status === 'paid' ? 'paid' : v.status === 'overdue' ? `${daysBetween(v.invoice.dueDate, todayISO()) - 1}d overdue` : `due ${relativeDays(v.invoice.dueDate)}`}
                </span>
              </span>
              <span className="text-right">
                <span className="block text-[13px] font-medium num">{money(v.status === 'paid' ? v.amounts.total : v.outstanding)}</span>
              </span>
              <span className={cn('grid size-5 shrink-0 place-items-center rounded-full', v.status === 'paid' ? 'bg-sun text-ink' : v.status === 'overdue' ? 'ring-2 ring-sun' : 'bg-white/15')} aria-label={v.status}>
                {v.status === 'paid' && <Check className="size-3" strokeWidth={3} />}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <Button variant="sun" asChild className="mt-4 w-full">
        <Link to="/invoices/new">
          <Plus /> New invoice
        </Link>
      </Button>
    </section>
  )
}

/* ─────────────────────────── Runway (startup) ─────────────────────────── */

export function RunwayCard({ balance }: { balance: number }) {
  const { ws, data } = useActiveWorkspace()
  const { money, compact } = useFormat()
  const b = useMemo(() => burn(data.transactions, balance, ws.burnWindow), [data.transactions, balance, ws.burnWindow])
  const max = Math.max(1, ...b.months.map((m) => Math.abs(m.net)))
  return (
    <section className="tile-ink flex h-full flex-col p-5 sm:p-6" aria-labelledby="runway-title">
      <TileHeader id="runway-title" title="Runway" subtitle={<>Estimate · last {ws.burnWindow} complete months</>} to="/reports" inverse />
      {!b.sufficient ? (
        <div className="flex flex-1 flex-col justify-center py-6 text-center">
          <p className="figure text-[44px] text-white/30">— mo</p>
          <p className="mx-auto mt-3 max-w-60 text-[13px] text-white/60">Runway needs at least two complete months of transactions to estimate an average burn.</p>
        </div>
      ) : b.runwayMonths === null ? (
        <div className="py-4">
          <p className="figure text-[48px]">Cash-flow positive</p>
          <p className="mt-2 text-[13px] text-white/60">Inflows exceeded outflows on average. No burn to project.</p>
        </div>
      ) : (
        <>
          <p className="flex items-baseline gap-2">
            <span className="figure text-[64px] leading-none">{b.runwayMonths.toFixed(1)}</span>
            <span className="text-[15px] text-white/60">months</span>
          </p>
          <p className="mt-1 text-[12.5px] text-white/55">
            Cash lasts until about <span className="text-white">{monthLabel(addMonthsKey(todayISO(), Math.floor(b.runwayMonths)))}</span> at current burn
          </p>
        </>
      )}
      <dl className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-white/[0.06] p-3">
          <dt className="text-[11.5px] text-white/50">Avg net burn</dt>
          <dd className="mt-1 text-[15px] font-medium num">{b.sufficient ? money(Math.max(0, b.avgNetBurn)) : '—'}</dd>
        </div>
        <div className="rounded-2xl bg-white/[0.06] p-3">
          <dt className="text-[11.5px] text-white/50">Avg gross burn</dt>
          <dd className="mt-1 text-[15px] font-medium num">{b.sufficient ? money(b.avgGrossBurn) : '—'}</dd>
        </div>
      </dl>
      {b.months.length > 0 && (
        <div className="mt-5">
          <p className="mb-2 text-[11.5px] text-white/50">Net burn by month</p>
          <div className="flex h-24 items-end gap-2" role="img" aria-label={b.months.map((m) => `${monthLabel(m.key)} ${money(m.net)}`).join(', ')}>
            {b.months.map((m, i) => (
              <div key={m.key} className="flex flex-1 flex-col items-center gap-1">
                <span className="text-[10px] text-white/50 num">{compact(m.net)}</span>
                <span className={cn('w-2 rounded-full', i === b.months.length - 1 ? 'bg-sun' : 'bg-white/70')} style={{ height: `${Math.max(4, (Math.abs(m.net) / max) * 52)}px` }} />
                <span className={cn('size-2 rounded-full', i === b.months.length - 1 ? 'bg-sun' : 'bg-white/70')} />
                <span className="text-[10.5px] text-white/50">{monthLabel(m.key).slice(0, 3)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      <p className="mt-auto pt-4 text-[11.5px] leading-relaxed text-white/40">Runway = available balance ÷ average monthly net burn (cash out − cash in). Excludes the current partial month.</p>
    </section>
  )
}

function addMonthsKey(iso: string, n: number) {
  const d = new Date(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1 + n, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/* ─────────────────────────── Budget pulse ─────────────────────────── */

export function BudgetPulse() {
  const { data } = useActiveWorkspace()
  const { money } = useFormat()
  const { cat } = useLookups()
  const overall = data.budgets.find((b) => b.categoryId === null && b.period === 'monthly')
  const today = todayISO()
  const u = overall ? budgetUsage(overall, data.transactions, today) : null
  const daysLeft = daysBetween(today, endOfMonth(today)) - 1
  return (
    <Tile className="flex h-full flex-col" aria-labelledby="bp-title">
      <TileHeader id="bp-title" title="Budget pulse" subtitle={formatRange({ start: today.slice(0, 8) + '01', end: endOfMonth(today) })} to="/budgets" />
      {!u ? (
        <EmptyState compact icon={<Target />} title="No monthly limit yet" description="Set an overall spending limit to see how this month is pacing." action={<Button size="sm" asChild><Link to="/budgets?new=overall">Set a budget</Link></Button>} />
      ) : (
        <div className="flex flex-1 flex-col items-center">
          <TickGauge value={u.ratio} projected={u.projected !== null ? u.projected / u.budget.amount : null} size={196} label={`${Math.round(u.ratio * 100)}% of monthly budget used`}>
            <p className="figure text-[42px]">{Math.round(u.ratio * 100)}%</p>
            <p className="mt-1 text-[11.5px] text-muted">of {money(u.budget.amount)}</p>
          </TickGauge>
          <div className="mt-3 flex w-full items-center justify-between gap-2 text-[12.5px]">
            <span className="text-muted">
              {u.remaining >= 0 ? (
                <>
                  <span className="font-medium text-ink num">{money(u.remaining)}</span> left · {daysLeft}d to go
                </>
              ) : (
                <span className="font-medium text-loss num">{money(-u.remaining)} over</span>
              )}
            </span>
            {u.projected !== null && (
              <Badge tone="hatch" title="Projected at current daily pace">
                est. {money(u.projected)}
              </Badge>
            )}
          </div>
          <ul className="mt-4 flex w-full flex-col gap-2.5 border-t border-line pt-4">
            {data.budgets
              .filter((b) => b.categoryId)
              .map((b) => budgetUsage(b, data.transactions, today))
              .sort((a, b) => b.ratio - a.ratio)
              .slice(0, 3)
              .map((c) => (
                <li key={c.budget.id} className="text-[12px]">
                  <div className="mb-1 flex justify-between gap-2">
                    <span className="truncate text-ink-3">{cat.get(c.budget.categoryId!)?.name}</span>
                    <span className={cn('num', c.state === 'over' ? 'text-loss' : 'text-muted')}>{Math.round(c.ratio * 100)}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-ink/[0.06]">
                    <div className={cn('h-full rounded-full transition-[width] duration-700', c.state === 'over' ? 'bg-loss' : c.state === 'warning' ? 'bg-sun-deep' : 'bg-ink')} style={{ width: `${Math.min(100, c.ratio * 100)}%` }} />
                  </div>
                </li>
              ))}
          </ul>
        </div>
      )}
    </Tile>
  )
}

/* ─────────────────────────── Expense breakdown ─────────────────────────── */

export function ExpenseBreakdown({ range }: { range: DateRange }) {
  const { data } = useActiveWorkspace()
  const { money } = useFormat()
  const { cat } = useLookups()
  const navigate = useNavigate()
  const [mode, setMode] = useState<'share' | 'change'>('share')
  const { current, previous } = comparisonRanges(range)
  const slices = useMemo(() => byCategory(data.transactions, range, 'expense'), [data.transactions, range])
  const prev = useMemo(() => new Map(byCategory(data.transactions, previous, 'expense').map((s) => [s.id, s.total])), [data.transactions, previous])
  const curLike = useMemo(() => new Map(byCategory(data.transactions, current, 'expense').map((s) => [s.id, s.total])), [data.transactions, current])
  const total = slices.reduce((s, x) => s + Math.max(0, x.total), 0)

  return (
    <Tile className="flex h-full flex-col" aria-labelledby="eb-title">
      <TileHeader
        id="eb-title"
        title="Expense breakdown"
        subtitle={`${money(total)} across ${slices.length} categories`}
        action={<Segmented label="Breakdown view" size="sm" value={mode} onChange={setMode} options={[{ value: 'share', label: 'Share' }, { value: 'change', label: 'Change' }]} />}
      />
      {slices.length === 0 ? (
        <EmptyState compact icon={<PiggyBank />} title="No expenses in this period" description="Recorded expenses will be grouped by category here." />
      ) : (
        <>
          <SegmentBar segments={slices.slice(0, 6).map((s) => ({ id: s.id, value: s.total, color: cat.get(s.id)?.color ?? '#d8d2c4', label: cat.get(s.id)?.name ?? 'Uncategorised' })).concat(slices.length > 6 ? [{ id: 'more', value: slices.slice(6).reduce((a, b) => a + b.total, 0), color: '#d8d2c4', label: 'Other' }] : [])} />
          <ul className="mt-5 flex flex-col">
            {slices.slice(0, 7).map((s) => {
              const c = cat.get(s.id)
              const ch = pctChange(curLike.get(s.id) ?? 0, prev.get(s.id) ?? 0)
              return (
                <li key={s.id}>
                  <button onClick={() => navigate(`/expenses?category=${s.id}`)} className="flex w-full items-center gap-3 rounded-2xl px-2 py-2 text-left transition hover:bg-white/70">
                    <CategoryIcon icon={c?.icon} color={c?.color} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px]">{c?.name ?? 'Uncategorised'}</span>
                      <span className="mt-1 block h-1 overflow-hidden rounded-full bg-ink/[0.06]">
                        <span className="block h-full rounded-full bg-ink/70 transition-[width] duration-700" style={{ width: `${Math.round(s.share * 100)}%` }} />
                      </span>
                    </span>
                    <span className="w-20 text-right text-[13px] font-medium num">{money(s.total)}</span>
                    <span className="w-16 text-right">{mode === 'share' ? <span className="text-[12px] text-muted num">{(s.share * 100).toFixed(1)}%</span> : <Trend pct={ch} goodWhenUp={false} />}</span>
                    <ChevronRight className="size-4 text-subtle" />
                  </button>
                </li>
              )
            })}
          </ul>
          {mode === 'change' && <p className="mt-2 text-[11.5px] text-subtle">Compared like-for-like with {formatRange(previous)}.</p>}
        </>
      )}
    </Tile>
  )
}

/* ─────────────────────────── Insights ─────────────────────────── */

const INSIGHT_STYLE: Record<Insight['kind'], { label: string; tone: 'ink' | 'hatch' | 'loss' | 'gain'; icon: typeof Lightbulb }> = {
  fact: { label: 'Recorded', tone: 'ink', icon: Lightbulb },
  estimate: { label: 'Estimate', tone: 'hatch', icon: TrendingUp },
  warning: { label: 'Attention', tone: 'loss', icon: CircleAlert },
  positive: { label: 'Recorded', tone: 'gain', icon: Sparkles },
}

export function InsightsList({ items }: { items: Insight[] }) {
  return (
    <Tile className="flex h-full flex-col" aria-labelledby="ins-title">
      <TileHeader id="ins-title" title="Insights" subtitle="From your recorded data. Estimates are marked." />
      <ul className="flex flex-col gap-2">
        {items.slice(0, 4).map((i, idx) => {
          const s = INSIGHT_STYLE[i.kind]
          return (
            <li key={i.id} className="flex gap-3 rounded-2xl bg-white/55 p-3 ring-1 ring-line animate-rise" style={{ animationDelay: `${idx * 50}ms` }}>
              <span className={cn('grid size-8 shrink-0 place-items-center rounded-full', i.kind === 'estimate' ? 'hatch bg-sun-soft' : i.kind === 'warning' ? 'bg-loss-soft text-loss' : i.kind === 'positive' ? 'bg-gain-soft text-gain' : 'bg-sun-soft')}>
                <s.icon className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13.5px] leading-snug">{i.title}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <Badge tone={s.tone} className="h-5 px-2 text-[10.5px]">
                    {s.label}
                  </Badge>
                  {i.detail && <span className="text-[12px] text-muted num">{i.detail}</span>}
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </Tile>
  )
}

/* ─────────────────────────── Onboarding checklist ─────────────────────────── */

export function OnboardingChecklist() {
  const { ws, data } = useActiveWorkspace()
  const { updateWorkspace } = useApp()
  const tx = useTransactionDialog()
  const navigate = useNavigate()
  const terms = useTerms()
  if (ws.onboarding.dismissed) return null
  const steps = [
    { id: 'balance', label: 'Set your opening balance', done: !!ws.onboarding.done.balance || data.accounts.some((a) => a.openingBalance !== 0), run: () => navigate('/settings/accounts') },
    { id: 'transaction', label: 'Record a transaction', done: !!ws.onboarding.done.transaction || data.transactions.length > 0, run: () => tx.open() },
    { id: 'client', label: `Add a ${terms.client.toLowerCase()}`, done: data.clients.length > 0, run: () => navigate('/settings/clients') },
    { id: 'invoice', label: 'Create an invoice', done: data.invoices.length > 0, run: () => navigate('/invoices/new') },
    { id: 'budget', label: 'Set a budget', done: data.budgets.length > 0, run: () => navigate('/budgets?new=overall') },
  ]
  const done = steps.filter((s) => s.done).length
  if (done === steps.length) return null
  return (
    <section className="tile mb-4 flex flex-col gap-4 p-5 animate-rise lg:flex-row lg:items-center" aria-labelledby="ob-title">
      <div className="flex items-center gap-4 lg:w-64">
        <div className="relative grid size-14 shrink-0 place-items-center">
          <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90" aria-hidden>
            <circle cx="18" cy="18" r="15.5" fill="none" stroke="rgb(22 22 21 / 0.08)" strokeWidth="3" />
            <circle cx="18" cy="18" r="15.5" fill="none" stroke="#f5cb3c" strokeWidth="3" strokeLinecap="round" strokeDasharray={`${(done / steps.length) * 97.4} 97.4`} style={{ transition: 'stroke-dasharray .6s' }} />
          </svg>
          <span className="figure text-[17px] num">
            {done}/{steps.length}
          </span>
        </div>
        <div>
          <h2 id="ob-title" className="font-display text-[18px]">
            Get set up
          </h2>
          <p className="text-[12.5px] text-muted">A few steps to a complete picture.</p>
        </div>
      </div>
      <ol className="flex flex-1 flex-wrap gap-2">
        {steps.map((s) => (
          <li key={s.id}>
            <button
              onClick={s.run}
              disabled={s.done}
              className={cn('flex h-10 items-center gap-2 rounded-full pl-1.5 pr-4 text-[13px] ring-1 transition', s.done ? 'bg-ink/[0.03] text-muted ring-transparent' : 'bg-white/80 ring-line hover:bg-white')}
            >
              <span className={cn('grid size-7 place-items-center rounded-full', s.done ? 'bg-sun text-ink' : 'bg-ink/[0.06]')}>{s.done ? <Check className="size-3.5" strokeWidth={3} /> : <Users className="hidden" />}</span>
              <span className={cn(s.done && 'line-through decoration-ink/25')}>{s.label}</span>
            </button>
          </li>
        ))}
      </ol>
      <button onClick={() => updateWorkspace({ onboarding: { ...ws.onboarding, dismissed: true } })} className="grid size-9 shrink-0 place-items-center self-end rounded-full text-muted hover:bg-ink/5 hover:text-ink lg:self-center" aria-label="Dismiss setup checklist">
        <X className="size-4" />
      </button>
    </section>
  )
}

