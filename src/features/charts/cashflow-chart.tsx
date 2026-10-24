import { useMemo, useState } from 'react'
import { Bar, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { BarChart3 } from 'lucide-react'
import { Segmented } from '@/components/ui/segmented'
import { EmptyState } from '@/components/empty-state'
import { MoneyFigure } from '@/components/money'
import { useActiveWorkspace } from '@/store/app-store'
import { useFormat } from '@/hooks/use-format'
import { useTerms } from '@/hooks/use-terms'
import { useReducedMotion } from '@/hooks/use-media'
import { allowedGranularities, autoGranularity, formatRange, type DateRange, type Granularity } from '@/lib/dates'
import { series, totals } from '@/lib/finance'
import { Lollipop, PillBar } from './lollipop'
import { ChartTooltipCard } from './chart-tooltip'

const G_LABEL: Record<Granularity, string> = { day: 'Daily', week: 'Weekly', month: 'Monthly', year: 'Yearly' }

export function CashflowChart({ range, height = 300, showSummary = true }: { range: DateRange; height?: number; showSummary?: boolean }) {
  const { ws, data } = useActiveWorkspace()
  const { compact, money } = useFormat()
  const terms = useTerms()
  const reduced = useReducedMotion()
  const allowed = allowedGranularities(range)
  const [pick, setPick] = useState<Granularity | null>(null)
  const g = pick && allowed.includes(pick) ? pick : allowed.includes(autoGranularity(range)) ? autoGranularity(range) : allowed[0]

  const points = useMemo(() => series(data.transactions, range, g, ws.weekStartsOn), [data.transactions, range, g, ws.weekStartsOn])
  const t = useMemo(() => totals(data.transactions, range), [data.transactions, range])
  const dense = points.length > 20
  const chartData = points.map((p) => ({ ...p, incomeV: p.income / 100, expensesV: p.expenses / 100, netV: p.net / 100 }))
  const empty = t.count === 0

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        {showSummary && (
          <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
            <div>
              <p className="text-[12.5px] text-muted">Net cash flow</p>
              <MoneyFigure value={t.netCashFlow} className="mt-1 block text-[40px]" />
            </div>
            <dl className="flex gap-6 pb-1 text-[13px]">
              <div>
                <dt className="flex items-center gap-1.5 text-muted">
                  <span className="size-2 rounded-full bg-ink" /> Money in
                </dt>
                <dd className="mt-0.5 font-medium num">{money(t.inflow)}</dd>
              </div>
              <div>
                <dt className="flex items-center gap-1.5 text-muted">
                  <span className="size-2 rounded-full bg-sun" /> Money out
                </dt>
                <dd className="mt-0.5 font-medium num">{money(t.outflow)}</dd>
              </div>
            </dl>
          </div>
        )}
        <Segmented label="Chart granularity" size="sm" value={g} onChange={setPick} options={(['day', 'week', 'month', 'year'] as Granularity[]).map((x) => ({ value: x, label: G_LABEL[x], disabled: !allowed.includes(x) }))} />
      </div>

      {empty ? (
        <div style={{ height }} className="grid place-items-center rounded-[22px] bg-ink/[0.02]">
          <EmptyState compact icon={<BarChart3 />} title="No activity in this period" description={`Transactions between ${formatRange(range)} will chart here.`} />
        </div>
      ) : (
        <figure>
          <div style={{ height }} className="-ml-2">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 8, right: 4, bottom: 0, left: 0 }} barGap={dense ? 1 : 4} barCategoryGap={dense ? '18%' : '28%'}>
                <CartesianGrid vertical={false} stroke="rgb(22 22 21 / 0.07)" strokeDasharray="3 5" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11.5, fill: '#77756f' }} interval={dense ? 'preserveStartEnd' : 0} minTickGap={8} dy={6} />
                <YAxis tickLine={false} axisLine={false} width={56} tick={{ fontSize: 11.5, fill: '#a3a19a' }} tickFormatter={(v: number) => compact(v * 100)} />
                <ReferenceLine y={0} stroke="rgb(22 22 21 / 0.2)" />
                <Tooltip
                  cursor={{ fill: 'rgb(22 22 21 / 0.04)', radius: 12 }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null
                    const p = payload[0].payload as (typeof chartData)[number]
                    return (
                      <ChartTooltipCard
                        title={p.fullLabel}
                        rows={[
                          { label: terms.income, value: p.income, color: '#ffffff' },
                          { label: 'Expenses', value: p.expenses, color: '#f5cb3c' },
                        ]}
                        footer={
                          <span className="flex justify-between gap-4">
                            <span className="text-white/60">Net</span>
                            <span className={p.net >= 0 ? 'font-medium text-sun num' : 'font-medium text-[#ff9a8a] num'}>{money(p.net, { signed: true })}</span>
                          </span>
                        }
                      />
                    )
                  }}
                />
                <Bar dataKey="incomeV" name={terms.income} fill="#161615" shape={dense ? <PillBar /> : <Lollipop />} isAnimationActive={!reduced} animationDuration={650} animationEasing="ease-out" />
                <Bar dataKey="expensesV" name="Expenses" fill="#f5cb3c" shape={dense ? <PillBar /> : <Lollipop />} isAnimationActive={!reduced} animationDuration={650} animationBegin={80} animationEasing="ease-out" />
                <Line type="monotone" dataKey="netV" name="Net" stroke="#77756f" strokeWidth={1.5} strokeDasharray="4 4" dot={false} activeDot={{ r: 4, fill: '#161615', stroke: '#fff', strokeWidth: 2 }} isAnimationActive={!reduced} animationDuration={800} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <figcaption className="mt-3 flex flex-wrap items-center gap-4 text-[12px] text-muted">
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-ink" /> {terms.income}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-sun" /> Expenses
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-0 w-4 border-t-[1.5px] border-dashed border-muted" /> Net
            </span>
            <span className="sr-only">
              {`${G_LABEL[g]} cash flow for ${formatRange(range)}: income ${money(t.income)}, expenses ${money(t.expenses)}, net ${money(t.net)}.`}
            </span>
          </figcaption>
        </figure>
      )}
    </div>
  )
}
