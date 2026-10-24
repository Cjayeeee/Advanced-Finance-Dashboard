import type { Transaction, WorkspaceData, Workspace } from '@/data/types'
import { csvAmount, downloadFile, toCSV } from '@/lib/csv'
import { effect } from '@/lib/finance'
import { todayISO } from '@/lib/dates'

export function exportTransactionsCSV(rows: Transaction[], data: WorkspaceData, ws: Workspace, name = 'transactions') {
  const cat = new Map(data.categories.map((c) => [c.id, c.name]))
  const acc = new Map(data.accounts.map((a) => [a.id, a.name]))
  const cl = new Map(data.clients.map((c) => [c.id, c.name]))
  const pr = new Map(data.projects.map((p) => [p.id, p.name]))
  const inv = new Map(data.invoices.map((i) => [i.id, i.number]))
  const sorted = [...rows].sort((a, b) => (a.date < b.date ? -1 : 1))
  const csv = toCSV(
    ['Date', 'Type', 'Description', 'Category', 'Account', 'To account', 'Client', 'Project', 'Amount', 'Net effect', 'Currency', 'Refund', 'Recurring', 'Invoice', 'Tags', 'Notes'],
    sorted.map((t) => {
      const e = effect(t)
      return [
        t.date,
        t.type,
        t.description,
        t.categoryId ? (cat.get(t.categoryId) ?? '') : '',
        acc.get(t.accountId) ?? '',
        t.toAccountId ? (acc.get(t.toAccountId) ?? '') : '',
        t.clientId ? (cl.get(t.clientId) ?? '') : '',
        t.projectId ? (pr.get(t.projectId) ?? '') : '',
        csvAmount(t.amount),
        csvAmount(e.inflow - e.outflow),
        ws.currency,
        t.refund ? 'yes' : '',
        t.recurring?.frequency ?? '',
        t.invoiceId ? (inv.get(t.invoiceId) ?? '') : '',
        t.tags.join('; '),
        t.notes ?? '',
      ]
    }),
  )
  downloadFile(`${ws.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-${name}-${todayISO()}.csv`, csv)
  return sorted.length
}
