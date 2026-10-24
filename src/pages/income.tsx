import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Download, FileText, Inbox, Plus, Repeat, Users } from 'lucide-react'
import { useActiveWorkspace } from '@/store/app-store'
import { useRange } from '@/store/range'
import { useFormat } from '@/hooks/use-format'
import { useLookups } from '@/hooks/use-lookups'
import { useTerms } from '@/hooks/use-terms'
import { PageIntro } from '@/components/page'
import { Tile, TileHeader } from '@/components/tile'
import { EmptyState } from '@/components/empty-state'
import { DateRangePicker } from '@/components/date-range-picker'
import { Trend } from '@/components/trend'
import { MoneyFigure } from '@/components/money'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Segmented } from '@/components/ui/segmented'
import { TrendChart } from '@/features/charts/trend-chart'
import { TickGauge } from '@/features/charts/tick-gauge'
import { FilterBar } from '@/features/transactions/filter-bar'
import { TransactionTable, sortTransactions, type SortState } from '@/features/transactions/transaction-table'
import { useTransactionDialog } from '@/features/transactions/transaction-dialog'
import { exportTransactionsCSV } from '@/features/transactions/export'
import { RecordPaymentDialog } from '@/features/invoices/payment-dialog'
import type { Invoice } from '@/data/types'
import { applyFilter, EMPTY_FILTER, type TxFilter } from '@/lib/filters'
import { byClient, byProject, comparisonRanges, invoiceViews, receivables, recurringItems, series, totals } from '@/lib/finance'
import { formatRange, presetRange, relativeDays, todayISO } from '@/lib/dates'
import { pctChange } from '@/lib/money'
import { cn } from '@/lib/utils'

export default function IncomePage() {
  const { ws, data } = useActiveWorkspace()
  const { range } = useRange()
  const { money } = useFormat()
  const { client, project } = useLookups()
  const terms = useTerms()
  const tx = useTransactionDialog()
  const [params] = useSearchParams()
  const [filter, setFilter] = useState<TxFilter>({ ...EMPTY_FILTER, type: 'income', clientId: params.get('client') ?? '' })
  const [sort, setSort] = useState<SortState>({ key: 'date', dir: 'desc' })
  const [groupBy, setGroupBy] = useState<'client' | 'project'>('client')
  const [payFor, setPayFor] = useState<Invoice | null>(null)

  const m = useMemo(() => {
    const { current, previous } = comparisonRanges(range)
    const cur = totals(data.transactions, range)
    const prev = totals(data.transactions, previous)
    const curLike = totals(data.transactions, current)
    const views = invoiceViews(data.invoices, data.transactions)
    const recPeriod = receivables(views, range)
    const recAll = receivables(views)
    const invoicePayments = data.transactions.filter((t) => t.type === 'income' && t.invoiceId && t.date >= range.start && t.date <= range.end).reduce((s, t) => s + (t.refund ? -t.amount : t.amount), 0)
    const months = series(data.transactions, presetRange('last-12-months'), 'month').map((p) => ({ key: p.key, label: p.label, fullLabel: p.fullLabel, value: p.income, future: p.future }))
    const thisMonth = totals(data.transactions, presetRange('this-month'))
    return { cur, prev, curLike, views, recPeriod, recAll, invoicePayments, months, thisMonth }
  }, [data, range])

  const groups = useMemo(() => (groupBy === 'client' ? byClient(data.transactions, range) : byProject(data.transactions, range)), [data.transactions, range, groupBy])
  const recurring = useMemo(() => recurringItems(data.transactions).filter((r) => r.tx.type === 'income'), [data.transactions])
  const open = m.views.filter((v) => v.outstanding > 0).sort((a, b) => (a.invoice.dueDate < b.invoice.dueDate ? -1 : 1))
  const rows = useMemo(() => sortTransactions(applyFilter(data.transactions, filter, range), sort), [data.transactions, filter, range, sort])
  const targetPct = ws.revenueTarget > 0 ? m.thisMonth.income / ws.revenueTarget : 0
  const today = todayISO()

  return (
    <>
      <PageIntro
        title={terms.income}
        description={`What you've been paid, what you've billed, and what's still owed. ${terms.income} counts only once a payment is recorded.`}
        actions={
          <>
            <DateRangePicker className="sm:hidden" />
            <Button variant="secondary" asChild>
              <Link to="/invoices/new">
                <FileText /> New invoice
              </Link>
            </Button>
            <Button onClick={() => tx.open({ defaults: { type: 'income' } })}>
              <Plus /> Record {terms.incomeLower}
            </Button>
          </>
        }
      />

      {/* Received / invoiced / outstanding — kept visibly distinct */}
      <section aria-label={`${terms.income} summary`} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 [&>*]:min-w-0">
        <div className="tile-ink p-6">
          <p className="text-[13px] text-white/70">Payments received</p>
          <MoneyFigure value={m.cur.income} className="mt-4 block text-[42px]" />
          <div className="mt-4 flex items-center gap-2">
            <Trend pct={pctChange(m.curLike.income, m.prev.income)} inverse />
            <span className="text-[12px] text-white/50">{formatRange(range)}</span>
          </div>
          <p className="mt-3 text-[11.5px] text-white/45">{money(m.invoicePayments)} of this came from invoice payments</p>
        </div>
        <div className="tile p-6">
          <p className="text-[13px] text-ink-3">Invoiced</p>
          <MoneyFigure value={m.recPeriod.invoiced} className="mt-4 block text-[42px]" />
          <p className="mt-4 text-[12px] text-muted">Billed on invoices issued in this period. Not counted as {terms.incomeLower} until paid.</p>
        </div>
        <div className="tile p-6">
          <p className="text-[13px] text-ink-3">Outstanding receivables</p>
          <MoneyFigure value={m.recAll.outstanding} className="mt-4 block text-[42px]" />
          <p className="mt-4 text-[12px] text-muted">
            {m.recAll.openCount} open invoices · <span className={m.recAll.overdue ? 'text-loss' : ''}>{money(m.recAll.overdue)} overdue</span>
          </p>
        </div>
        <div className="tile flex items-center gap-4 p-6">
          {ws.revenueTarget > 0 ? (
            <>
              <TickGauge value={targetPct} size={124} ticks={40} label={`${Math.round(targetPct * 100)}% of monthly target`}>
                <p className="figure text-[26px]">{Math.round(targetPct * 100)}%</p>
              </TickGauge>
              <div className="min-w-0">
                <p className="text-[13px] text-ink-3">Monthly target</p>
                <p className="mt-1 text-[15px] font-medium num">{money(ws.revenueTarget)}</p>
                <p className="mt-1 text-[12px] text-muted num">{money(Math.max(0, ws.revenueTarget - m.thisMonth.income))} to go this month</p>
              </div>
            </>
          ) : (
            <EmptyState compact title="No revenue target" description="Set a monthly target to track progress." action={<Button size="sm" variant="secondary" asChild><Link to="/settings/workspace">Set target</Link></Button>} className="w-full py-2" />
          )}
        </div>
      </section>

      <div className="mt-4 grid gap-4 xl:grid-cols-12 [&>*]:min-w-0">
        <Tile className="xl:col-span-8" aria-labelledby="it">
          <TileHeader id="it" title={`${terms.income} trend`} subtitle="Payments received · last 12 months" />
          <TrendChart points={m.months} seriesLabel={terms.income} target={ws.revenueTarget || undefined} targetLabel="Target" height={260} />
        </Tile>
        <Tile className="xl:col-span-4" aria-labelledby="by">
          <TileHeader
            id="by"
            title={`By ${groupBy === 'client' ? terms.client.toLowerCase() : 'project'}`}
            subtitle={formatRange(range)}
            action={<Segmented size="sm" label="Group by" value={groupBy} onChange={setGroupBy} options={[{ value: 'client', label: terms.client }, { value: 'project', label: 'Project' }]} />}
          />
          {groups.length === 0 ? (
            <EmptyState compact icon={<Users />} title={`No ${terms.incomeLower} by ${groupBy}`} description={groupBy === 'project' ? 'Assign projects to income records to see this.' : `Assign a ${terms.client.toLowerCase()} to income records to see this.`} />
          ) : (
            <ul className="flex flex-col gap-3">
              {groups.slice(0, 7).map((g, i) => {
                const name = groupBy === 'client' ? (client.get(g.id)?.name ?? (g.id === 'unassigned' ? `No ${terms.client.toLowerCase()}` : 'Unknown')) : (project.get(g.id)?.name ?? 'Unknown')
                return (
                  <li key={g.id}>
                    <button className="w-full text-left" onClick={() => groupBy === 'client' && g.id !== 'unassigned' && setFilter({ ...filter, clientId: g.id })} disabled={groupBy !== 'client'}>
                      <div className="mb-1.5 flex items-baseline justify-between gap-2 text-[13.5px]">
                        <span className="truncate">{name}</span>
                        <span className="font-medium num">{money(g.total)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-ink/[0.06]">
                          <div className={cn('h-full rounded-full transition-[width] duration-700', i === 0 ? 'bg-sun' : 'bg-ink')} style={{ width: `${g.share * 100}%` }} />
                        </div>
                        <span className="w-10 text-right text-[11.5px] text-muted num">{Math.round(g.share * 100)}%</span>
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </Tile>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-12 [&>*]:min-w-0">
        <Tile className="xl:col-span-7" aria-labelledby="ow">
          <TileHeader id="ow" title={`Outstanding ${terms.client.toLowerCase()} payments`} subtitle={`${money(m.recAll.outstanding)} across ${open.length} invoices`} to="/invoices" />
          {open.length === 0 ? (
            <EmptyState compact icon={<FileText />} title="Nothing outstanding" description="Issued invoices with an unpaid balance will appear here." />
          ) : (
            <ul className="flex flex-col divide-y divide-line">
              {open.slice(0, 6).map((v) => (
                <li key={v.invoice.id} className="flex flex-wrap items-center gap-3 py-3 sm:flex-nowrap">
                  <Link to={`/invoices/${v.invoice.id}`} className="min-w-0 flex-1 hover:underline">
                    <p className="truncate text-[14px] font-medium">{client.get(v.invoice.clientId)?.name}</p>
                    <p className="text-[12px] text-muted num">
                      {v.invoice.number} · {v.paid > 0 ? `${money(v.paid)} paid · ` : ''}due {relativeDays(v.invoice.dueDate, today)}
                    </p>
                  </Link>
                  <Badge tone={v.status === 'overdue' ? 'loss' : v.status === 'partial' ? 'sunSoft' : 'neutral'} className="capitalize">
                    {v.status === 'partial' ? 'Partially paid' : v.status}
                  </Badge>
                  <span className="w-24 text-right text-[14px] font-medium num">{money(v.outstanding)}</span>
                  <Button size="sm" variant="secondary" onClick={() => setPayFor(v.invoice)}>
                    Record payment
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Tile>
        <Tile className="xl:col-span-5" aria-labelledby="ri">
          <TileHeader id="ri" title={`Recurring ${terms.incomeLower}`} subtitle="Retainers and subscriptions you've marked recurring" to="/transactions?view=recurring" />
          {recurring.length === 0 ? (
            <EmptyState compact icon={<Repeat />} title="No recurring income" description="Mark retainers or subscriptions as recurring when you record them." />
          ) : (
            <ul className="flex flex-col divide-y divide-line">
              {recurring.map((r) => (
                <li key={r.tx.id} className="flex items-center justify-between gap-3 py-2.5 text-[13.5px]">
                  <span className="min-w-0">
                    <span className="block truncate">{r.tx.description}</span>
                    <span className="text-[12px] text-muted">
                      {r.tx.recurring!.frequency[0].toUpperCase() + r.tx.recurring!.frequency.slice(1)} · next {relativeDays(r.next, today)}
                    </span>
                  </span>
                  <span className="font-medium num">{money(r.monthlyEquivalent)}/mo</span>
                </li>
              ))}
            </ul>
          )}
        </Tile>
      </div>

      <section className="tile mt-4 p-4 sm:p-6" aria-labelledby="inc-list">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 id="inc-list" className="font-display text-[19px]">
            {terms.income} records
          </h2>
          <Button variant="secondary" size="sm" disabled={!rows.length} onClick={() => (exportTransactionsCSV(rows, data, ws, 'income'), toast.success(`Exported ${rows.length} records`))}>
            <Download /> Export CSV
          </Button>
        </div>
        <FilterBar filter={filter} onChange={setFilter} lockType="income" className="mb-4" />
        <TransactionTable caption={`${terms.income} records`} rows={rows.slice(0, 60)} sort={sort} onSort={setSort} empty={<EmptyState icon={<Inbox />} title={`No ${terms.incomeLower} recorded`} description="Nothing matches this period and filter." />} />
        {rows.length > 60 && (
          <p className="mt-3 text-center text-[12.5px] text-muted">
            Showing 60 of {rows.length}.{' '}
            <Link to="/transactions" className="underline">
              See all in Transactions
            </Link>
          </p>
        )}
      </section>
      <RecordPaymentDialog invoice={payFor} open={!!payFor} onOpenChange={(o) => !o && setPayFor(null)} />
    </>
  )
}
