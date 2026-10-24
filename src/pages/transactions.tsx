import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Download, Inbox, Plus, Repeat, Tags, Trash2, TriangleAlert, X } from 'lucide-react'
import { useActiveWorkspace } from '@/store/app-store'
import { useRange } from '@/store/range'
import { useFormat } from '@/hooks/use-format'
import { useLookups } from '@/hooks/use-lookups'
import { useTerms } from '@/hooks/use-terms'
import { PageIntro } from '@/components/page'
import { EmptyState } from '@/components/empty-state'
import { CategoryIcon } from '@/components/category-icon'
import { Amount } from '@/components/money'
import { DateRangePicker } from '@/components/date-range-picker'
import { Button } from '@/components/ui/button'
import { Segmented } from '@/components/ui/segmented'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { FilterBar } from '@/features/transactions/filter-bar'
import { TransactionTable, sortTransactions, useDeleteTransactions, type SortState } from '@/features/transactions/transaction-table'
import { useTransactionDialog } from '@/features/transactions/transaction-dialog'
import { exportTransactionsCSV } from '@/features/transactions/export'
import { applyFilter, EMPTY_FILTER, type TxFilter } from '@/lib/filters'
import { findDuplicates, recurringItems, totals } from '@/lib/finance'
import { formatDate, formatRange, relativeDays, todayISO } from '@/lib/dates'
import { cn } from '@/lib/utils'

const PAGE = 50

export default function TransactionsPage() {
  const [params, setParams] = useSearchParams()
  const view = params.get('view') === 'recurring' ? 'recurring' : 'all'
  const tx = useTransactionDialog()
  return (
    <>
      <PageIntro
        title="Transactions"
        description="Every record of money in, money out, and moves between your accounts."
        actions={
          <>
            <DateRangePicker className="sm:hidden" />
            <Button onClick={() => tx.open()} className="md:hidden">
              <Plus /> Add
            </Button>
          </>
        }
      />
      <Segmented
        label="View"
        className="mb-4"
        value={view}
        onChange={(v) => setParams(v === 'recurring' ? { view: 'recurring' } : {})}
        options={[
          { value: 'all', label: 'All records' },
          { value: 'recurring', label: <span className="inline-flex items-center gap-1.5"><Repeat className="size-3.5" />Recurring</span> },
        ]}
      />
      {view === 'all' ? <AllTransactions initial={{ ...EMPTY_FILTER, categoryId: params.get('category') ?? '', clientId: params.get('client') ?? '' }} /> : <RecurringView />}
    </>
  )
}

function AllTransactions({ initial }: { initial: TxFilter }) {
  const { ws, data, actions } = useActiveWorkspace()
  const { range } = useRange()
  const { money } = useFormat()
  const terms = useTerms()
  const tx = useTransactionDialog()
  const del = useDeleteTransactions()
  const [filter, setFilter] = useState<TxFilter>(initial)
  const [sort, setSort] = useState<SortState>({ key: 'date', dir: 'desc' })
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [limit, setLimit] = useState(PAGE)
  const [bulkCat, setBulkCat] = useState('')

  const dupes = useMemo(() => findDuplicates(data.transactions), [data.transactions])
  const rows = useMemo(() => sortTransactions(applyFilter(data.transactions, filter, range, dupes), sort), [data.transactions, filter, range, dupes, sort])
  const t = useMemo(() => totals(rows), [rows])
  const transfers = rows.filter((r) => r.type === 'transfer').reduce((s, r) => s + r.amount, 0)
  const dupesInRange = rows.filter((r) => dupes.has(r.id)).length
  const selectedRows = rows.filter((r) => selected.has(r.id))
  const selectedKinds = new Set(selectedRows.map((r) => r.type))
  const bulkKind = selectedKinds.size === 1 && !selectedKinds.has('transfer') ? [...selectedKinds][0] : null

  const changeFilter = (f: TxFilter) => {
    setFilter(f)
    setLimit(PAGE)
    setSelected(new Set())
  }

  return (
    <>
      <div className="tile mb-4 grid grid-cols-2 gap-px overflow-hidden p-0 sm:grid-cols-4 [&>div]:bg-white/0">
        {[
          { label: 'Records', value: String(rows.length), sub: formatRange(range) },
          { label: 'Money in', value: money(t.inflow), sub: `${terms.income} + refunds received` },
          { label: 'Money out', value: money(t.outflow), sub: 'Expenses + refunds paid' },
          { label: 'Net', value: money(t.netCashFlow, { signed: true }), sub: transfers ? `${money(transfers)} transferred (excluded)` : 'Transfers excluded' },
        ].map((s, i) => (
          <div key={s.label} className={cn('p-4 sm:p-5', i > 0 && 'sm:border-l sm:border-line', i % 2 === 1 && 'border-l border-line sm:border-l', i >= 2 && 'border-t border-line sm:border-t-0')}>
            <p className="text-[12px] text-muted">{s.label}</p>
            <p className="figure mt-2 text-[26px] sm:text-[30px]">{s.value}</p>
            <p className="mt-1 truncate text-[11.5px] text-subtle">{s.sub}</p>
          </div>
        ))}
      </div>

      <section className="tile p-4 sm:p-6" aria-label="Transaction list">
        <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <FilterBar filter={filter} onChange={changeFilter} />
          <Button
            variant="secondary"
            size="sm"
            className="h-9 self-start xl:self-auto"
            disabled={rows.length === 0}
            onClick={() => {
              const n = exportTransactionsCSV(rows, data, ws, 'transactions')
              toast.success(`Exported ${n} transactions`, { description: 'CSV of the current filtered view.' })
            }}
          >
            <Download /> Export CSV
          </Button>
        </div>

        {dupesInRange > 0 && !filter.dupesOnly && (
          <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl bg-loss-soft/70 px-4 py-3 text-[13px] text-ink-3">
            <TriangleAlert className="size-4 text-loss" />
            <span className="flex-1">
              {dupesInRange} records look like possible duplicates (same type, amount, date and description). Review them so totals aren't overstated.
            </span>
            <Button size="sm" variant="secondary" onClick={() => changeFilter({ ...filter, dupesOnly: true })}>
              Review
            </Button>
          </div>
        )}
        {filter.dupesOnly && (
          <div className="mb-4 flex items-center gap-2">
            <Badge tone="loss">Showing possible duplicates only</Badge>
            <button className="text-[12.5px] text-muted hover:text-ink" onClick={() => changeFilter({ ...filter, dupesOnly: false })}>
              Show all
            </button>
          </div>
        )}

        {selected.size > 0 && (
          <div className="sticky top-20 z-10 mb-3 flex flex-wrap items-center gap-2 rounded-full bg-ink py-1.5 pl-4 pr-1.5 text-[13px] text-white shadow-[var(--shadow-ink)] animate-pop">
            <span className="mr-auto">{selected.size} selected</span>
            {bulkKind && (
              <div className="flex items-center gap-1.5">
                <Tags className="size-4 text-white/60" />
                <Select
                  size="sm"
                  aria-label="Change category for selected"
                  className="h-8 w-44 bg-white/10 text-white ring-white/15 hover:bg-white/15 data-[placeholder]:text-white/60"
                  placeholder="Set category…"
                  value={bulkCat}
                  onValueChange={(v) => {
                    selectedRows.forEach((r) => actions.updateTransaction(r.id, { categoryId: v }))
                    toast.success(`Updated ${selectedRows.length} transactions`)
                    setBulkCat('')
                  }}
                  options={data.categories.filter((c) => c.kind === bulkKind).map((c) => ({ value: c.id, label: c.name }))}
                />
              </div>
            )}
            <Button size="sm" variant="ghost-inverse" onClick={() => (exportTransactionsCSV(selectedRows, data, ws, 'selected'), toast.success(`Exported ${selectedRows.length} transactions`))}>
              <Download /> Export
            </Button>
            <Button size="sm" variant="ghost-inverse" onClick={() => del.request([...selected])}>
              <Trash2 /> Delete
            </Button>
            <button onClick={() => setSelected(new Set())} className="grid size-8 place-items-center rounded-full hover:bg-white/10" aria-label="Clear selection">
              <X className="size-4" />
            </button>
          </div>
        )}

        <TransactionTable
          caption={`Transactions, ${formatRange(range)}`}
          rows={rows.slice(0, limit)}
          sort={sort}
          onSort={setSort}
          selected={selected}
          onSelectedChange={setSelected}
          duplicates={dupes}
          empty={
            <EmptyState
              icon={<Inbox />}
              title={data.transactions.length === 0 ? 'No transactions yet' : 'No transactions match'}
              description={data.transactions.length === 0 ? 'Record income, expenses and transfers to see them here.' : `Nothing in ${formatRange(range)} matches these filters. Try clearing filters or widening the period.`}
              action={
                data.transactions.length === 0 ? (
                  <Button onClick={() => tx.open()}>
                    <Plus /> Add transaction
                  </Button>
                ) : (
                  <Button variant="secondary" onClick={() => changeFilter(EMPTY_FILTER)}>
                    Clear filters
                  </Button>
                )
              }
            />
          }
        />
        {rows.length > limit && (
          <div className="mt-4 flex items-center justify-center gap-3">
            <span className="text-[12.5px] text-muted">
              Showing {limit} of {rows.length}
            </span>
            <Button variant="secondary" size="sm" onClick={() => setLimit((l) => l + PAGE)}>
              Load more
            </Button>
          </div>
        )}
      </section>
      {del.dialog}
    </>
  )
}

function RecurringView() {
  const { data, actions } = useActiveWorkspace()
  const { money } = useFormat()
  const { cat } = useLookups()
  const terms = useTerms()
  const items = useMemo(() => recurringItems(data.transactions), [data.transactions])
  const monthlyOut = items.filter((i) => i.tx.type === 'expense' && !i.tx.refund).reduce((s, i) => s + i.monthlyEquivalent, 0)
  const monthlyIn = items.filter((i) => i.tx.type === 'income' && !i.tx.refund).reduce((s, i) => s + i.monthlyEquivalent, 0)
  const today = todayISO()

  const logNext = (i: (typeof items)[number]) => {
    const { id: _a, createdAt: _b, invoiceId: _c, ...rest } = i.tx
    void _a
    void _b
    void _c
    actions.addTransaction({ ...rest, date: i.next })
    toast.success(`Logged ${i.tx.description}`, { description: `${money(i.tx.amount)} on ${formatDate(i.next, 'medium')}` })
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_320px] [&>*]:min-w-0">
      <section className="tile p-4 sm:p-6" aria-labelledby="rec-h">
        <h2 id="rec-h" className="font-display text-[19px]">
          Recurring series
        </h2>
        <p className="mb-4 mt-1 text-[12.5px] text-muted">Based on the most recent entry of each series. Monetra never posts future entries on its own. Use “Log” once a payment has actually happened.</p>
        {items.length === 0 ? (
          <EmptyState icon={<Repeat />} title="No recurring transactions" description="Turn on “Recurring” when adding a subscription, retainer or rent payment to track it here." />
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {items.map((i) => {
              const c = i.tx.categoryId ? cat.get(i.tx.categoryId) : undefined
              const due = i.dueCount > 0
              return (
                <li key={i.tx.id} className="flex flex-wrap items-center gap-3 py-3 sm:flex-nowrap">
                  <CategoryIcon icon={c?.icon} color={c?.color} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-medium">{i.tx.description}</p>
                    <p className="text-[12px] capitalize text-muted">
                      {i.tx.recurring!.frequency} · {c?.name}
                    </p>
                  </div>
                  <div className="text-right">
                    <Amount value={i.tx.amount} kind={i.tx.type === 'income' ? 'in' : 'out'} />
                    <p className="text-[11.5px] text-muted num">≈ {money(i.monthlyEquivalent)}/mo</p>
                  </div>
                  <div className="w-32 text-right">
                    <Badge tone={due ? 'sun' : 'neutral'}>{due ? `Due ${relativeDays(i.next, today)}` : `Next ${formatDate(i.next, 'short')}`}</Badge>
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant={due ? 'primary' : 'secondary'} onClick={() => logNext(i)} disabled={i.next > today && !due} title={i.next > today ? 'Not due yet' : undefined}>
                      Log
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => (actions.updateTransaction(i.tx.id, { recurring: undefined }), toast('Stopped tracking as recurring'))}>
                      Stop
                    </Button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>
      <aside className="flex flex-col gap-4">
        <div className="tile-ink p-6">
          <p className="text-[12.5px] text-white/60">Recurring costs</p>
          <p className="figure mt-3 text-[40px]">{money(monthlyOut)}</p>
          <p className="mt-1 text-[12px] text-white/50">per month, normalised</p>
        </div>
        <div className="tile p-6">
          <p className="text-[12.5px] text-muted">Recurring {terms.incomeLower}</p>
          <p className="figure mt-3 text-[34px]">{money(monthlyIn)}</p>
          <p className="mt-1 text-[12px] text-muted">per month, normalised</p>
        </div>
      </aside>
    </div>
  )
}
