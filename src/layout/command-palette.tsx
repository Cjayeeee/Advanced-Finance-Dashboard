import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import * as D from '@radix-ui/react-dialog'
import { useNavigate } from 'react-router-dom'
import { CornerDownLeft, FileText, Plus, Search, UserRound } from 'lucide-react'
import { useActiveWorkspace } from '@/store/app-store'
import { NAV } from './nav'
import { useFormat } from '@/hooks/use-format'
import { useLookups } from '@/hooks/use-lookups'
import { useTransactionDialog } from '@/features/transactions/transaction-dialog'
import { CategoryIcon } from '@/components/category-icon'
import { formatDate } from '@/lib/dates'
import { invoiceAmounts } from '@/lib/finance'
import { cn } from '@/lib/utils'

interface Item {
  id: string
  group: string
  label: string
  hint?: string
  icon: React.ReactNode
  run: () => void
}

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { data } = useActiveWorkspace()
  const { money } = useFormat()
  const { cat, client } = useLookups()
  const navigate = useNavigate()
  const tx = useTransactionDialog()
  const [q, setQ] = useState('')
  const dq = useDeferredValue(q.trim().toLowerCase())
  const [active, setActive] = useState(0)
  const listRef = useRef<HTMLUListElement>(null)

  useEffect(() => {
    if (open) {
      setQ('')
      setActive(0)
    }
  }, [open])

  const items = useMemo<Item[]>(() => {
    const go = (to: string) => () => {
      onOpenChange(false)
      navigate(to)
    }
    const out: Item[] = []
    const pages = NAV.filter((n) => !dq || n.label.toLowerCase().includes(dq) || n.description.toLowerCase().includes(dq))
    out.push(...pages.map((n) => ({ id: 'p' + n.to, group: 'Go to', label: n.label, hint: n.description, icon: <n.icon className="size-4" />, run: go(n.to) })))
    if (!dq || 'add transaction new expense income'.includes(dq))
      out.push({ id: 'a-tx', group: 'Actions', label: 'Add transaction', hint: 'N', icon: <Plus className="size-4" />, run: () => (onOpenChange(false), tx.open()) })
    if (!dq || 'create invoice new'.includes(dq)) out.push({ id: 'a-inv', group: 'Actions', label: 'Create invoice', icon: <FileText className="size-4" />, run: go('/invoices/new') })
    if (dq.length >= 2) {
      const txs = data.transactions.filter((t) => t.description.toLowerCase().includes(dq) || t.notes?.toLowerCase().includes(dq) || t.tags.some((g) => g.includes(dq))).slice(0, 6)
      out.push(
        ...txs.map((t) => {
          const c = t.categoryId ? cat.get(t.categoryId) : undefined
          return {
            id: 't' + t.id,
            group: 'Transactions',
            label: t.description,
            hint: `${formatDate(t.date, 'short')} · ${money(t.amount)}`,
            icon: <CategoryIcon icon={t.type === 'transfer' ? 'transfer' : c?.icon} color={t.type === 'transfer' ? '#d8d2c4' : c?.color} size="sm" className="size-6 [&_svg]:size-3" />,
            run: () => (onOpenChange(false), tx.open({ edit: t })),
          }
        }),
      )
      const invs = data.invoices.filter((i) => i.number.toLowerCase().includes(dq) || (client.get(i.clientId)?.name.toLowerCase().includes(dq) ?? false)).slice(0, 5)
      out.push(...invs.map((i) => ({ id: 'i' + i.id, group: 'Invoices', label: i.number, hint: `${client.get(i.clientId)?.name ?? ''} · ${money(invoiceAmounts(i).total)}`, icon: <FileText className="size-4" />, run: go(`/invoices/${i.id}`) })))
      const cls = data.clients.filter((c) => c.name.toLowerCase().includes(dq)).slice(0, 4)
      out.push(...cls.map((c) => ({ id: 'c' + c.id, group: 'Clients', label: c.name, hint: 'View income', icon: <UserRound className="size-4" />, run: go(`/income?client=${c.id}`) })))
    }
    return out
  }, [dq, data, cat, client, money, navigate, onOpenChange, tx])

  useEffect(() => setActive(0), [dq])
  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [active])

  const groups = [...new Set(items.map((i) => i.group))]

  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-[60] bg-ink/25 backdrop-blur-[3px] data-[state=open]:animate-fade" />
        <D.Content
          className="fixed left-1/2 top-[10vh] z-[70] w-[min(620px,calc(100vw-24px))] -translate-x-1/2 overflow-hidden rounded-[26px] bg-paper shadow-[var(--shadow-pop)] outline-none data-[state=open]:animate-pop"
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setActive((a) => Math.min(items.length - 1, a + 1))
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setActive((a) => Math.max(0, a - 1))
            } else if (e.key === 'Enter') {
              e.preventDefault()
              items[active]?.run()
            }
          }}
        >
          <D.Title className="sr-only">Search</D.Title>
          <D.Description className="sr-only">Search pages, transactions, invoices and clients</D.Description>
          <div className="flex items-center gap-3 border-b border-line px-5">
            <Search className="size-[18px] text-muted" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search transactions, invoices, clients…"
              className="h-14 flex-1 bg-transparent text-[15px] outline-none placeholder:text-subtle"
              role="combobox"
              aria-expanded
              aria-controls="cmd-list"
              aria-activedescendant={items[active] ? `cmd-${items[active].id}` : undefined}
            />
            <kbd className="rounded-md bg-ink/[0.06] px-1.5 py-0.5 text-[11px] text-muted">Esc</kbd>
          </div>
          <ul ref={listRef} id="cmd-list" role="listbox" className="max-h-[60vh] overflow-y-auto p-2 scrollbar-thin">
            {items.length === 0 && <li className="px-4 py-10 text-center text-[13px] text-muted">No matches for “{q}”.</li>}
            {groups.map((g) => (
              <li key={g} role="presentation">
                <p className="eyebrow px-3 pt-3 pb-1.5">{g}</p>
                <ul role="presentation">
                  {items.map((it, idx) =>
                    it.group !== g ? null : (
                      <li
                        key={it.id}
                        id={`cmd-${it.id}`}
                        role="option"
                        aria-selected={idx === active}
                        data-index={idx}
                        onMouseMove={() => setActive(idx)}
                        onClick={it.run}
                        className={cn('flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-[14px]', idx === active ? 'bg-ink text-white [&_.hint]:text-white/60' : 'text-ink-3')}
                      >
                        <span className={cn('grid size-6 place-items-center', idx === active && 'text-sun')}>{it.icon}</span>
                        <span className="min-w-0 flex-1 truncate">{it.label}</span>
                        {it.hint && <span className="hint hidden truncate text-[12px] text-muted sm:block">{it.hint}</span>}
                        {idx === active && <CornerDownLeft className="size-3.5 text-sun" />}
                      </li>
                    ),
                  )}
                </ul>
              </li>
            ))}
          </ul>
        </D.Content>
      </D.Portal>
    </D.Root>
  )
}
