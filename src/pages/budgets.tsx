import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { ChevronLeft, ChevronRight, MoreHorizontal, Pencil, Plus, Target, Trash2 } from 'lucide-react'
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useActiveWorkspace } from '@/store/app-store'
import { useFormat } from '@/hooks/use-format'
import { useLookups } from '@/hooks/use-lookups'
import { useReducedMotion } from '@/hooks/use-media'
import { PageIntro } from '@/components/page'
import { Tile, TileHeader } from '@/components/tile'
import { EmptyState } from '@/components/empty-state'
import { CategoryIcon } from '@/components/category-icon'
import { Trend } from '@/components/trend'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Field, Input, MoneyInput } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Segmented } from '@/components/ui/segmented'
import { ConfirmDialog } from '@/components/ui/alert-dialog'
import { Dropdown, DropdownContent, DropdownItem, DropdownTrigger } from '@/components/ui/dropdown'
import { TickGauge } from '@/features/charts/tick-gauge'
import { PillBar } from '@/features/charts/lollipop'
import type { Budget } from '@/data/types'
import { budgetUsage, byCategory, spentIn, type BudgetUsage } from '@/lib/finance'
import { addMonths, daysBetween, endOfMonth, formatRange, isValidISO, monthLabel, startOfMonth, todayISO } from '@/lib/dates'
import { parseMoney, pctChange, toInputString } from '@/lib/money'
import { uid } from '@/lib/id'
import { cn } from '@/lib/utils'

const STATE_META = { ok: { label: 'On track', tone: 'neutral' as const }, warning: { label: 'Approaching limit', tone: 'sunSoft' as const }, over: { label: 'Over budget', tone: 'loss' as const } }

export default function BudgetsPage() {
  const { data, actions } = useActiveWorkspace()
  const { money, compact } = useFormat()
  const { cat } = useLookups()
  const reduced = useReducedMotion()
  const [params, setParams] = useSearchParams()
  const today = todayISO()
  const [month, setMonth] = useState(startOfMonth(today))
  const isCurrent = month === startOfMonth(today)
  const ref = isCurrent ? today : endOfMonth(month)
  const [dialog, setDialog] = useState<{ open: boolean; editing?: Budget; categoryId?: string | null }>({ open: false })
  const [toDelete, setToDelete] = useState<Budget | null>(null)

  useEffect(() => {
    const n = params.get('new')
    if (n) {
      setDialog({ open: true, categoryId: n === 'overall' ? null : n })
      setParams({}, { replace: true })
    }
  }, [params, setParams])

  const monthly = data.budgets.filter((b) => b.period === 'monthly')
  const custom = data.budgets.filter((b) => b.period === 'custom')
  const overall = monthly.find((b) => b.categoryId === null)
  const usages = useMemo(() => monthly.filter((b) => b.categoryId).map((b) => budgetUsage(b, data.transactions, ref)).sort((a, b) => b.ratio - a.ratio), [monthly, data.transactions, ref])
  const ov = overall ? budgetUsage(overall, data.transactions, ref) : null
  const customUsages = custom.map((b) => budgetUsage(b, data.transactions, today))
  const totalBudgeted = usages.reduce((s, u) => s + u.budget.amount, 0)
  const unbudgeted = useMemo(() => {
    const has = new Set(monthly.map((b) => b.categoryId))
    return byCategory(data.transactions, { start: month, end: endOfMonth(month) }, 'expense').filter((s) => !has.has(s.id) && s.id !== 'uncategorised')
  }, [data.transactions, monthly, month])

  const history = useMemo(() => {
    if (!overall) return []
    return Array.from({ length: 6 }, (_, i) => {
      const s = addMonths(startOfMonth(today), i - 5)
      return { key: s, label: monthLabel(s.slice(0, 7)).slice(0, 3), actual: spentIn(data.transactions, { start: s, end: endOfMonth(s) }, null) / 100, budget: overall.amount / 100 }
    })
  }, [overall, data.transactions, today])

  const daysLeft = isCurrent ? daysBetween(today, endOfMonth(today)) - 1 : 0

  return (
    <>
      <PageIntro
        title="Budgets"
        description="Set spending limits and see how each month is pacing. Budgets use the same transactions and categories as everything else."
        actions={
          <Button onClick={() => setDialog({ open: true, categoryId: overall ? undefined : null })}>
            <Plus /> New budget
          </Button>
        }
      />

      <div className="mb-4 flex items-center gap-2">
        <Button variant="secondary" size="icon-sm" onClick={() => setMonth(addMonths(month, -1))} aria-label="Previous month">
          <ChevronLeft />
        </Button>
        <p className="min-w-36 text-center font-display text-[18px]" aria-live="polite">
          {monthLabel(month.slice(0, 7))}
        </p>
        <Button variant="secondary" size="icon-sm" onClick={() => setMonth(addMonths(month, 1))} disabled={isCurrent} aria-label="Next month">
          <ChevronRight />
        </Button>
        {!isCurrent && (
          <Button variant="ghost" size="sm" onClick={() => setMonth(startOfMonth(today))}>
            Back to this month
          </Button>
        )}
      </div>

      <div className="grid gap-4 xl:grid-cols-12 [&>*]:min-w-0">
        <section className="tile-ink flex flex-col gap-6 p-6 sm:flex-row sm:items-center xl:col-span-5" aria-labelledby="ov-b">
          {ov ? (
            <>
              <TickGauge inverse value={ov.ratio} projected={ov.projected !== null ? ov.projected / ov.budget.amount : null} size={210} label={`${Math.round(ov.ratio * 100)}% of overall budget used`}>
                <p className="figure text-[46px]">{Math.round(ov.ratio * 100)}%</p>
                <p className="text-[11.5px] text-white/55">used</p>
              </TickGauge>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <h2 id="ov-b" className="font-display text-[19px]">
                    Overall limit
                  </h2>
                  <BudgetMenu inverse onEdit={() => setDialog({ open: true, editing: ov.budget })} onDelete={() => setToDelete(ov.budget)} />
                </div>
                <p className="figure mt-3 text-[34px]">{money(ov.spent)}</p>
                <p className="text-[13px] text-white/55">of {money(ov.budget.amount)}</p>
                <dl className="mt-4 grid grid-cols-2 gap-3 text-[12.5px]">
                  <div className="rounded-2xl bg-white/[0.06] p-3">
                    <dt className="text-white/50">{ov.remaining >= 0 ? 'Remaining' : 'Over by'}</dt>
                    <dd className={cn('mt-0.5 text-[14px] font-medium num', ov.remaining < 0 && 'text-[#ff9a8a]')}>{money(Math.abs(ov.remaining))}</dd>
                  </div>
                  <div className="hatch-light rounded-2xl bg-white/[0.06] p-3">
                    <dt className="text-white/50">{isCurrent ? 'Projected' : 'vs prior month'}</dt>
                    <dd className="mt-0.5 text-[14px] font-medium num">{isCurrent ? (ov.projected !== null ? money(ov.projected) : '—') : <Trend pct={pctChange(ov.spent, ov.previousSpent ?? 0)} goodWhenUp={false} inverse />}</dd>
                  </div>
                </dl>
                {isCurrent && ov.remaining > 0 && daysLeft > 0 && <p className="mt-3 text-[12px] text-white/50">≈ {money(Math.floor(ov.remaining / daysLeft / 100) * 100)} per day for the remaining {daysLeft} days</p>}
              </div>
            </>
          ) : (
            <EmptyState className="w-full text-white [&_p]:text-white/60" icon={<Target />} title="No overall limit" description="An overall monthly limit caps total spending across all categories." action={<Button variant="sun" onClick={() => setDialog({ open: true, categoryId: null })}>Set overall limit</Button>} />
          )}
        </section>

        <Tile className="xl:col-span-7" aria-labelledby="bva">
          <TileHeader id="bva" title="Budget vs actual" subtitle="Overall spending · last 6 months" />
          {history.length ? (
            <div className="h-[230px] -ml-2">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={history} margin={{ top: 10, right: 6, bottom: 0, left: 0 }} barCategoryGap="38%">
                  <CartesianGrid vertical={false} stroke="rgb(22 22 21 / 0.07)" strokeDasharray="3 5" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11.5, fill: '#77756f' }} dy={6} />
                  <YAxis tickLine={false} axisLine={false} width={56} tick={{ fontSize: 11.5, fill: '#a3a19a' }} tickFormatter={(v: number) => compact(v * 100)} />
                  <Tooltip
                    cursor={{ fill: 'rgb(22 22 21 / 0.04)', radius: 12 }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null
                      const p = payload[0].payload as (typeof history)[number]
                      return (
                        <div className="rounded-2xl bg-ink px-3.5 py-2.5 text-[13px] text-white shadow-[var(--shadow-ink)]">
                          <p className="text-[12px] text-white/60">{monthLabel(p.key.slice(0, 7))}</p>
                          <p className="num">Spent {money(Math.round(p.actual * 100))}</p>
                          <p className="text-white/60 num">Limit {money(Math.round(p.budget * 100))}</p>
                        </div>
                      )
                    }}
                  />
                  <Bar dataKey="actual" fill="#f5cb3c" shape={<PillBar />} isAnimationActive={!reduced} />
                  <Line dataKey="budget" stroke="#161615" strokeWidth={1.5} strokeDasharray="5 4" dot={false} type="stepAfter" isAnimationActive={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState compact title="Set an overall limit to compare months" />
          )}
          <p className="mt-2 flex gap-4 text-[12px] text-muted">
            <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-sun" /> Actual</span>
            <span className="flex items-center gap-1.5"><span className="h-0 w-4 border-t-[1.5px] border-dashed border-ink" /> Limit (current)</span>
          </p>
        </Tile>
      </div>

      <section className="mt-6" aria-labelledby="cat-b">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 id="cat-b" className="font-display text-[22px] font-light tracking-tight">
            Category budgets
          </h2>
          <span className="text-[12.5px] text-muted num">{money(totalBudgeted)} budgeted</span>
        </div>
        {usages.length === 0 ? (
          <div className="tile">
            <EmptyState icon={<Target />} title="No category budgets" description="Set a limit for categories you want to keep an eye on, like software or marketing." action={<Button onClick={() => setDialog({ open: true })}><Plus /> Add a category budget</Button>} />
          </div>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {usages.map((u, i) => (
              <li key={u.budget.id} className="animate-rise" style={{ animationDelay: `${i * 40}ms` }}>
                <BudgetCard u={u} name={cat.get(u.budget.categoryId!)?.name ?? 'Category'} icon={cat.get(u.budget.categoryId!)?.icon} color={cat.get(u.budget.categoryId!)?.color} current={isCurrent} onEdit={() => setDialog({ open: true, editing: u.budget })} onDelete={() => setToDelete(u.budget)} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {customUsages.length > 0 && (
        <section className="mt-6" aria-labelledby="cus-b">
          <h2 id="cus-b" className="mb-3 font-display text-[22px] font-light tracking-tight">
            Custom-period budgets
          </h2>
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {customUsages.map((u) => (
              <li key={u.budget.id}>
                <BudgetCard u={u} name={u.budget.categoryId ? (cat.get(u.budget.categoryId)?.name ?? 'Category') : 'All spending'} icon={u.budget.categoryId ? cat.get(u.budget.categoryId)?.icon : 'wallet'} color={u.budget.categoryId ? cat.get(u.budget.categoryId)?.color : '#161615'} current subtitle={formatRange(u.range)} onEdit={() => setDialog({ open: true, editing: u.budget })} onDelete={() => setToDelete(u.budget)} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {unbudgeted.length > 0 && (
        <Tile className="mt-6" aria-labelledby="unb">
          <TileHeader id="unb" title="Spending without a budget" subtitle={`${monthLabel(month.slice(0, 7))} · categories with no monthly limit`} />
          <ul className="flex flex-wrap gap-2">
            {unbudgeted.map((s) => (
              <li key={s.id}>
                <button onClick={() => setDialog({ open: true, categoryId: s.id })} className="flex h-11 items-center gap-2.5 rounded-full bg-white/70 pl-1.5 pr-4 text-[13px] ring-1 ring-line transition hover:bg-white">
                  <CategoryIcon icon={cat.get(s.id)?.icon} color={cat.get(s.id)?.color} size="sm" />
                  {cat.get(s.id)?.name}
                  <span className="text-muted num">{money(s.total)}</span>
                  <Plus className="size-3.5 text-muted" />
                </button>
              </li>
            ))}
          </ul>
        </Tile>
      )}

      <BudgetDialog state={dialog} onClose={() => setDialog({ open: false })} />
      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="Delete this budget?"
        description="Your transactions are not affected."
        onConfirm={() => {
          if (toDelete) actions.deleteBudget(toDelete.id)
          toast('Budget deleted')
          setToDelete(null)
        }}
      />
    </>
  )
}

function BudgetMenu({ onEdit, onDelete, inverse }: { onEdit: () => void; onDelete: () => void; inverse?: boolean }) {
  return (
    <Dropdown>
      <DropdownTrigger asChild>
        <button className={cn('grid size-8 place-items-center rounded-full', inverse ? 'text-white/60 hover:bg-white/10' : 'text-muted hover:bg-ink/5')} aria-label="Budget actions">
          <MoreHorizontal className="size-4" />
        </button>
      </DropdownTrigger>
      <DropdownContent>
        <DropdownItem onSelect={onEdit}>
          <Pencil /> Edit
        </DropdownItem>
        <DropdownItem destructive onSelect={onDelete}>
          <Trash2 /> Delete
        </DropdownItem>
      </DropdownContent>
    </Dropdown>
  )
}

function BudgetCard({ u, name, icon, color, current, subtitle, onEdit, onDelete }: { u: BudgetUsage; name: string; icon?: string; color?: string; current: boolean; subtitle?: string; onEdit: () => void; onDelete: () => void }) {
  const { money } = useFormat()
  const meta = STATE_META[u.state]
  const pct = Math.min(100, u.ratio * 100)
  const proj = u.projected !== null && current ? Math.min(100, (u.projected / u.budget.amount) * 100) : null
  return (
    <article className="tile h-full p-5">
      <div className="flex items-start gap-3">
        <CategoryIcon icon={icon} color={color} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[14.5px] font-medium">{name}</h3>
          <p className="text-[12px] text-muted">{subtitle ?? `Alert at ${u.budget.alertAt}%`}</p>
        </div>
        <BudgetMenu onEdit={onEdit} onDelete={onDelete} />
      </div>
      <div className="mt-5 flex items-end justify-between gap-2">
        <p>
          <span className="figure text-[30px]">{money(u.spent)}</span>
          <span className="ml-1 text-[12.5px] text-muted">/ {money(u.budget.amount)}</span>
        </p>
        <Badge tone={meta.tone}>{meta.label}</Badge>
      </div>
      <div className="relative mt-3 h-3 overflow-hidden rounded-full bg-ink/[0.06]" role="progressbar" aria-valuenow={Math.round(u.ratio * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={`${name} budget used`}>
        {proj !== null && proj > pct && <div className="hatch absolute inset-y-0 left-0 rounded-full bg-sun-soft" style={{ width: `${proj}%` }} title="Projected by month end" />}
        <div className={cn('absolute inset-y-0 left-0 rounded-full transition-[width] duration-700 ease-[var(--ease-out)]', u.state === 'over' ? 'bg-loss' : u.state === 'warning' ? 'bg-sun-deep' : 'bg-ink')} style={{ width: `${pct}%` }} />
        <div className="absolute inset-y-0 w-px bg-ink/30" style={{ left: `${u.budget.alertAt}%` }} aria-hidden />
      </div>
      <div className="mt-2.5 flex justify-between text-[12px] text-muted">
        <span className="num">{Math.round(u.ratio * 100)}% used</span>
        <span className="num">{u.remaining >= 0 ? `${money(u.remaining)} left` : <span className="text-loss">{money(-u.remaining)} over</span>}</span>
      </div>
      {u.previousSpent !== null && (
        <p className="mt-3 flex items-center gap-2 border-t border-line pt-3 text-[12px] text-muted">
          Prior month {money(u.previousSpent)}
          <Trend pct={pctChange(u.spent, u.previousSpent)} goodWhenUp={false} className="ml-auto" />
        </p>
      )}
      {proj !== null && <p className="mt-1.5 text-[11.5px] text-subtle">Estimate: {money(u.projected!)} by month end at current pace</p>}
    </article>
  )
}

function BudgetDialog({ state, onClose }: { state: { open: boolean; editing?: Budget; categoryId?: string | null }; onClose: () => void }) {
  return <Dialog open={state.open} onOpenChange={(o) => !o && onClose()}>{state.open && <BudgetForm editing={state.editing} preset={state.categoryId} onDone={onClose} />}</Dialog>
}

function BudgetForm({ editing, preset, onDone }: { editing?: Budget; preset?: string | null; onDone: () => void }) {
  const { data, actions } = useActiveWorkspace()
  const { symbol, money } = useFormat()
  const today = todayISO()
  const [categoryId, setCategoryId] = useState<string>(editing ? (editing.categoryId ?? 'overall') : preset === null ? 'overall' : (preset ?? ''))
  const [amount, setAmount] = useState(editing ? toInputString(editing.amount) : '')
  const [period, setPeriod] = useState<'monthly' | 'custom'>(editing?.period ?? 'monthly')
  const [start, setStart] = useState(editing?.start ?? startOfMonth(today))
  const [end, setEnd] = useState(editing?.end ?? endOfMonth(addMonths(today, 2)))
  const [alertAt, setAlertAt] = useState(editing?.alertAt ?? 80)
  const [touched, setTouched] = useState(false)
  const cid = categoryId === 'overall' ? null : categoryId
  const minor = parseMoney(amount)
  const conflict = period === 'monthly' && data.budgets.some((b) => b.id !== editing?.id && b.period === 'monthly' && b.categoryId === cid)
  const errors = {
    category: !categoryId ? 'Choose what this budget covers' : conflict ? 'A monthly budget for this already exists. Edit that one instead.' : undefined,
    amount: minor === null ? 'Enter a valid amount' : minor <= 0 ? 'Budget must be greater than zero' : undefined,
    range: period === 'custom' && (!isValidISO(start) || !isValidISO(end) || end < start) ? 'End date must be after the start date' : undefined,
  }
  const lastMonth = cid !== undefined && categoryId ? spentIn(data.transactions, { start: addMonths(startOfMonth(today), -1), end: endOfMonth(addMonths(today, -1)) }, cid) : 0

  const save = () => {
    setTouched(true)
    if (errors.category || errors.amount || errors.range) return
    actions.saveBudget({ id: editing?.id ?? uid('bud'), categoryId: cid, amount: minor!, period, start: period === 'custom' ? start : undefined, end: period === 'custom' ? end : undefined, alertAt })
    toast.success(editing ? 'Budget updated' : 'Budget created')
    onDone()
  }

  return (
    <DialogContent
      title={editing ? 'Edit budget' : 'New budget'}
      description="Spending is measured from expense transactions, minus refunds."
      footer={
        <>
          <Button variant="ghost" onClick={onDone}>
            Cancel
          </Button>
          <Button onClick={save}>{editing ? 'Save' : 'Create budget'}</Button>
        </>
      }
    >
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          save()
        }}
      >
        <Field label="Applies to" htmlFor="b-cat" error={touched ? errors.category : undefined}>
          <Select id="b-cat" value={categoryId} onValueChange={setCategoryId} invalid={touched && !!errors.category} placeholder="Choose…" options={[{ value: 'overall', label: 'Overall spending (all categories)' }, ...data.categories.filter((c) => c.kind === 'expense').map((c) => ({ value: c.id, label: c.name }))]} />
        </Field>
        <Field label="Limit" htmlFor="b-amount" error={touched ? errors.amount : undefined} hint={categoryId && lastMonth > 0 ? `Last month you spent ${money(lastMonth)} here.` : undefined}>
          <MoneyInput id="b-amount" symbol={symbol} large value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" aria-invalid={(touched && !!errors.amount) || undefined} />
        </Field>
        <Segmented label="Period" value={period} onChange={setPeriod} options={[{ value: 'monthly', label: 'Every month' }, { value: 'custom', label: 'Custom period' }]} />
        {period === 'custom' && (
          <div className="grid grid-cols-2 gap-3 animate-rise">
            <Field label="From" htmlFor="b-start">
              <Input id="b-start" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
            </Field>
            <Field label="To" htmlFor="b-end" error={touched ? errors.range : undefined}>
              <Input id="b-end" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
            </Field>
          </div>
        )}
        <div>
          <label htmlFor="b-alert" className="flex justify-between text-[13px] font-medium text-ink-3">
            Warn me at <span className="num">{alertAt}%</span>
          </label>
          <input id="b-alert" type="range" min={50} max={100} step={5} value={alertAt} onChange={(e) => setAlertAt(Number(e.target.value))} className="mt-2 w-full accent-[#161615]" />
          <p className="mt-1 text-[12px] text-muted">You'll see an in-app notification when spending crosses this point.</p>
        </div>
      </form>
    </DialogContent>
  )
}
