import { useCallback, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowDown, ArrowUp, ArrowUpDown, Copy, FileText, MoreHorizontal, Pencil, Repeat, RotateCcw, Trash2, TriangleAlert } from 'lucide-react'
import type { Transaction } from '@/data/types'
import { useActiveWorkspace } from '@/store/app-store'
import { useLookups } from '@/hooks/use-lookups'
import { useTerms } from '@/hooks/use-terms'
import { CategoryIcon } from '@/components/category-icon'
import { Amount } from '@/components/money'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/switch'
import { ConfirmDialog } from '@/components/ui/alert-dialog'
import { Dropdown, DropdownContent, DropdownItem, DropdownSeparator, DropdownTrigger } from '@/components/ui/dropdown'
import { Tip } from '@/components/ui/tooltip'
import { formatDate } from '@/lib/dates'
import { toInputString } from '@/lib/money'
import { cn } from '@/lib/utils'
import { useTransactionDialog } from './transaction-dialog'

export type SortKey = 'date' | 'amount' | 'description'
export interface SortState {
  key: SortKey
  dir: 'asc' | 'desc'
}

export function sortTransactions(rows: Transaction[], s: SortState): Transaction[] {
  const m = s.dir === 'asc' ? 1 : -1
  return [...rows].sort((a, b) => {
    if (s.key === 'amount') return (a.amount - b.amount) * m
    if (s.key === 'description') return a.description.localeCompare(b.description) * m
    if (a.date !== b.date) return (a.date < b.date ? -1 : 1) * m
    return (a.createdAt < b.createdAt ? -1 : 1) * m
  })
}

/** Deletion with confirmation + undo toast. */
export function useDeleteTransactions() {
  const { data, actions } = useActiveWorkspace()
  const [pending, setPending] = useState<string[] | null>(null)
  const request = useCallback((ids: string[]) => setPending(ids), [])
  const linked = pending ? data.transactions.filter((t) => pending.includes(t.id) && t.invoiceId).length : 0
  const dialog = (
    <ConfirmDialog
      open={!!pending}
      onOpenChange={(o) => !o && setPending(null)}
      title={pending && pending.length > 1 ? `Delete ${pending.length} transactions?` : 'Delete this transaction?'}
      description={
        <>
          It will be removed from every total, chart and report.
          {linked > 0 && <span className="mt-2 block text-ink-3">{linked === 1 ? 'One of these is an invoice payment, so the invoice balance will go back up.' : `${linked} of these are invoice payments, so those invoice balances will go back up.`}</span>}
        </>
      }
      onConfirm={() => {
        if (!pending) return
        const removed = data.transactions.filter((t) => pending.includes(t.id))
        actions.deleteTransactions(pending)
        toast(removed.length > 1 ? `${removed.length} transactions deleted` : 'Transaction deleted', {
          action: { label: 'Undo', onClick: () => actions.restoreTransactions(removed) },
          duration: 6000,
        })
        setPending(null)
      }}
    />
  )
  return { request, dialog }
}

function SortHeader({ label, k, sort, onSort, className }: { label: string; k: SortKey; sort?: SortState; onSort?: (s: SortState) => void; className?: string }) {
  if (!sort || !onSort) return <th scope="col" className={cn('px-3 py-3 text-left text-[12px] font-medium text-muted', className)}>{label}</th>
  const active = sort.key === k
  const Icon = !active ? ArrowUpDown : sort.dir === 'asc' ? ArrowUp : ArrowDown
  return (
    <th scope="col" className={cn('px-3 py-3 text-left text-[12px] font-medium text-muted', className)} aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button className={cn('inline-flex items-center gap-1 rounded-md hover:text-ink', active && 'text-ink')} onClick={() => onSort({ key: k, dir: active && sort.dir === 'desc' ? 'asc' : 'desc' })}>
        {label}
        <Icon className="size-3" />
      </button>
    </th>
  )
}

export interface TransactionTableProps {
  rows: Transaction[]
  sort?: SortState
  onSort?: (s: SortState) => void
  selected?: Set<string>
  onSelectedChange?: (s: Set<string>) => void
  duplicates?: Set<string>
  dense?: boolean
  hideAccount?: boolean
  empty?: ReactNode
  caption: string
}

export function TransactionTable({ rows, sort, onSort, selected, onSelectedChange, duplicates, dense, hideAccount, empty, caption }: TransactionTableProps) {
  const { cat, acc, client } = useLookups()
  const terms = useTerms()
  const dialog = useTransactionDialog()
  const { actions } = useActiveWorkspace()
  const del = useDeleteTransactions()
  const selectable = !!selected && !!onSelectedChange
  const allSelected = selectable && rows.length > 0 && rows.every((r) => selected!.has(r.id))
  const someSelected = selectable && rows.some((r) => selected!.has(r.id))

  if (rows.length === 0) return <>{empty}</>

  const toggle = (id: string) => {
    const n = new Set(selected)
    if (n.has(id)) n.delete(id)
    else n.add(id)
    onSelectedChange!(n)
  }

  const duplicate = (t: Transaction) => {
    const { id: _id, createdAt: _c, invoiceId: _i, ...rest } = t
    void _id
    void _c
    void _i
    dialog.open({ defaults: { ...rest, amount: toInputString(t.amount), tags: t.tags.join(', '), notes: t.notes ?? '', refund: !!t.refund, recurring: !!t.recurring, frequency: t.recurring?.frequency ?? 'monthly', until: t.recurring?.until ?? '' } })
  }

  const kindOf = (t: Transaction) => (t.type === 'transfer' ? 'neutral' : (t.type === 'income') !== !!t.refund ? 'in' : 'out')

  const meta = (t: Transaction) => (
    <>
      {t.recurring && (
        <Tip content={`Recurring ${t.recurring.frequency}`}>
          <Repeat className="size-3.5 text-muted" aria-label="Recurring" />
        </Tip>
      )}
      {t.refund && <Badge tone="outline" className="h-5 px-1.5 text-[10.5px]"><RotateCcw className="size-3" />Refund</Badge>}
      {t.invoiceId && (
        <Link to={`/invoices/${t.invoiceId}`} onClick={(e) => e.stopPropagation()} className="inline-flex" aria-label="Open linked invoice">
          <Badge tone="sunSoft" className="h-5 px-1.5 text-[10.5px]"><FileText className="size-3" />Invoice</Badge>
        </Link>
      )}
      {duplicates?.has(t.id) && (
        <Tip content="Possible duplicate: same type, amount, date and description as another record.">
          <span className="inline-flex"><Badge tone="loss" className="h-5 px-1.5 text-[10.5px]"><TriangleAlert className="size-3" />Duplicate?</Badge></span>
        </Tip>
      )}
    </>
  )

  const menu = (t: Transaction) => (
    <Dropdown>
      <DropdownTrigger asChild>
        <button className="grid size-8 place-items-center rounded-full text-muted transition hover:bg-ink/5 hover:text-ink" aria-label={`Actions for ${t.description}`} onClick={(e) => e.stopPropagation()}>
          <MoreHorizontal className="size-4" />
        </button>
      </DropdownTrigger>
      <DropdownContent onClick={(e) => e.stopPropagation()}>
        <DropdownItem onSelect={() => dialog.open({ edit: t })}>
          <Pencil /> Edit
        </DropdownItem>
        {!t.invoiceId && (
          <DropdownItem onSelect={() => duplicate(t)}>
            <Copy /> Duplicate
          </DropdownItem>
        )}
        {t.recurring && (
          <DropdownItem onSelect={() => actions.updateTransaction(t.id, { recurring: undefined })}>
            <Repeat /> Stop recurring
          </DropdownItem>
        )}
        <DropdownSeparator />
        <DropdownItem destructive onSelect={() => del.request([t.id])}>
          <Trash2 /> Delete
        </DropdownItem>
      </DropdownContent>
    </Dropdown>
  )

  return (
    <>
      {/* Desktop / tablet table */}
      <div className="hidden overflow-x-auto md:block scrollbar-thin">
        <table className="w-full min-w-[720px] border-separate border-spacing-0 text-[13.5px]">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="[&>th]:border-b [&>th]:border-line">
              {selectable && (
                <th scope="col" className="w-10 px-3 py-3">
                  <Checkbox checked={allSelected ? true : someSelected ? 'indeterminate' : false} onCheckedChange={() => onSelectedChange!(allSelected ? new Set() : new Set(rows.map((r) => r.id)))} aria-label="Select all rows" />
                </th>
              )}
              <SortHeader label="Description" k="description" sort={sort} onSort={onSort} className="pl-1" />
              <th scope="col" className="px-3 py-3 text-left text-[12px] font-medium text-muted">Category</th>
              <SortHeader label="Date" k="date" sort={sort} onSort={onSort} />
              {!hideAccount && <th scope="col" className="px-3 py-3 text-left text-[12px] font-medium text-muted">Account</th>}
              <th scope="col" className="px-3 py-3 text-left text-[12px] font-medium text-muted">Type</th>
              <SortHeader label="Amount" k="amount" sort={sort} onSort={onSort} className="text-right [&>button]:ml-auto [&>button]:flex" />
              <th scope="col" className="w-10 px-2"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => {
              const c = t.categoryId ? cat.get(t.categoryId) : undefined
              const sel = selected?.has(t.id)
              return (
                <tr key={t.id} className={cn('group cursor-pointer transition-colors hover:bg-white/60 [&>td]:border-b [&>td]:border-line', sel && 'bg-sun-wash/70 hover:bg-sun-wash')} onClick={() => dialog.open({ edit: t })}>
                  {selectable && (
                    <td className="px-3" onClick={(e) => e.stopPropagation()}>
                      <Checkbox checked={!!sel} onCheckedChange={() => toggle(t.id)} aria-label={`Select ${t.description}`} />
                    </td>
                  )}
                  <td className={cn('py-2.5 pl-1 pr-3', dense && 'py-2')}>
                    <div className="flex items-center gap-3">
                      <CategoryIcon icon={t.type === 'transfer' ? 'transfer' : c?.icon} color={t.type === 'transfer' ? '#ffffff' : c?.color} size={dense ? 'sm' : 'md'} className={t.type === 'transfer' ? 'ring-1 ring-line-strong' : undefined} />
                      <div className="min-w-0">
                        <p className="flex items-center gap-1.5 font-medium">
                          <span className="truncate">{t.description}</span>
                          {meta(t)}
                        </p>
                        {(t.clientId || t.tags.length > 0) && (
                          <p className="truncate text-[12px] text-muted">
                            {t.clientId ? client.get(t.clientId)?.name : ''}
                            {t.clientId && t.tags.length > 0 ? ' · ' : ''}
                            {t.tags.map((g) => `#${g}`).join(' ')}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 text-ink-3">{t.type === 'transfer' ? <span className="text-muted">Transfer</span> : (c?.name ?? <span className="text-subtle">Uncategorised</span>)}</td>
                  <td className="whitespace-nowrap px-3 text-ink-3 num">{formatDate(t.date, 'medium')}</td>
                  {!hideAccount && (
                    <td className="max-w-40 truncate px-3 text-ink-3">
                      {acc.get(t.accountId)?.name}
                      {t.type === 'transfer' && t.toAccountId && <span className="text-muted"> → {acc.get(t.toAccountId)?.name}</span>}
                    </td>
                  )}
                  <td className="px-3">
                    <Badge tone={t.type === 'income' ? 'ink' : t.type === 'expense' ? 'sunSoft' : 'outline'}>{t.type === 'income' ? terms.income : t.type === 'expense' ? 'Expense' : 'Transfer'}</Badge>
                  </td>
                  <td className="px-3 text-right">
                    <Amount value={t.amount} kind={kindOf(t)} />
                  </td>
                  <td className="px-2 text-right">{menu(t)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <ul className="flex flex-col divide-y divide-line md:hidden" aria-label={caption}>
        {rows.map((t) => {
          const c = t.categoryId ? cat.get(t.categoryId) : undefined
          const sel = selected?.has(t.id)
          return (
            <li key={t.id} className={cn('flex items-center gap-3 py-3', sel && 'bg-sun-wash/70')}>
              {selectable && <Checkbox checked={!!sel} onCheckedChange={() => toggle(t.id)} aria-label={`Select ${t.description}`} />}
              <button className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => dialog.open({ edit: t })}>
                <CategoryIcon icon={t.type === 'transfer' ? 'transfer' : c?.icon} color={t.type === 'transfer' ? '#ffffff' : c?.color} className={t.type === 'transfer' ? 'ring-1 ring-line-strong' : undefined} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 text-[14px] font-medium">
                    <span className="truncate">{t.description}</span>
                  </span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[12px] text-muted">
                    {formatDate(t.date, 'short')} · {t.type === 'transfer' ? 'Transfer' : (c?.name ?? 'Uncategorised')}
                    {meta(t)}
                  </span>
                </span>
                <Amount value={t.amount} kind={kindOf(t)} className="text-[14px]" />
              </button>
              {menu(t)}
            </li>
          )
        })}
      </ul>
      {del.dialog}
    </>
  )
}
