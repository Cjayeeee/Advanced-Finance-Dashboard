import { useMemo } from 'react'
import { useActiveWorkspace, useApp } from '@/store/app-store'
import { budgetUsage, invoiceViews, recurringItems } from '@/lib/finance'
import { addDays, daysBetween, monthKey, todayISO } from '@/lib/dates'
import { useFormat } from './use-format'

export interface AppNotification {
  id: string
  kind: 'overdue' | 'due-soon' | 'budget' | 'recurring'
  title: string
  detail: string
  to: string
  date: string
}

/** Notifications are derived from data (not stored), so they're always accurate. */
export function useNotifications() {
  const { ws, data } = useActiveWorkspace()
  const { state } = useApp()
  const { money } = useFormat()
  return useMemo(() => {
    const today = todayISO()
    const out: AppNotification[] = []
    const prefs = state!.prefs
    const client = new Map(data.clients.map((c) => [c.id, c.name]))
    for (const v of invoiceViews(data.invoices, data.transactions, today)) {
      if (v.status === 'overdue' && prefs.overdueInvoices)
        out.push({
          id: `overdue:${v.invoice.id}`,
          kind: 'overdue',
          title: `${v.invoice.number} is overdue`,
          detail: `${money(v.outstanding)} from ${client.get(v.invoice.clientId) ?? 'client'} · ${daysBetween(v.invoice.dueDate, today) - 1} days late`,
          to: `/invoices/${v.invoice.id}`,
          date: v.invoice.dueDate,
        })
      else if ((v.status === 'sent' || v.status === 'partial') && v.invoice.dueDate <= addDays(today, 5) && prefs.overdueInvoices)
        out.push({ id: `due:${v.invoice.id}`, kind: 'due-soon', title: `${v.invoice.number} is due soon`, detail: `${money(v.outstanding)} due ${v.invoice.dueDate === today ? 'today' : 'on ' + v.invoice.dueDate}`, to: `/invoices/${v.invoice.id}`, date: v.invoice.dueDate })
    }
    if (prefs.budgetAlerts) {
      const cat = new Map(data.categories.map((c) => [c.id, c.name]))
      for (const b of data.budgets) {
        const u = budgetUsage(b, data.transactions, today)
        if (u.state === 'ok') continue
        const name = b.categoryId ? (cat.get(b.categoryId) ?? 'Category') : 'Overall spending'
        out.push({
          id: `budget:${b.id}:${monthKey(u.range.start)}:${u.state}`,
          kind: 'budget',
          title: u.state === 'over' ? `${name} budget exceeded` : `${name} budget at ${Math.round(u.ratio * 100)}%`,
          detail: `${money(u.spent)} of ${money(b.amount)} spent`,
          to: '/budgets',
          date: today,
        })
      }
    }
    for (const r of recurringItems(data.transactions, today)) {
      if (r.dueCount > 0)
        out.push({ id: `rec:${r.tx.id}:${r.next}`, kind: 'recurring', title: `${r.tx.description} may be due`, detail: `Recurring ${r.tx.recurring!.frequency} · expected ${r.next}`, to: '/transactions?view=recurring', date: r.next })
    }
    const read = new Set(state!.readNotifications)
    return { items: out.sort((a, b) => (a.date < b.date ? 1 : -1)), unread: out.filter((n) => !read.has(n.id)).length, read }
  }, [data, state, money, ws.id]) // eslint-disable-line react-hooks/exhaustive-deps
}
