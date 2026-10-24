import type { Invoice, InvoiceStatus } from '@/data/types'

export function nextInvoiceNumber(prefix: string, invoices: Invoice[], year = new Date().getFullYear()): string {
  const re = new RegExp(`(\\d+)$`)
  let max = 0
  for (const i of invoices) {
    const m = i.number.match(re)
    if (m) max = Math.max(max, Number(m[1]))
  }
  return `${prefix}${year}-${String(max + 1).padStart(3, '0')}`
}

export const STATUS_META: Record<InvoiceStatus, { label: string; tone: 'outline' | 'neutral' | 'sunSoft' | 'gain' | 'loss' | 'hatch' | 'ink' }> = {
  draft: { label: 'Draft', tone: 'outline' },
  sent: { label: 'Sent', tone: 'neutral' },
  partial: { label: 'Partially paid', tone: 'sunSoft' },
  paid: { label: 'Paid', tone: 'gain' },
  overdue: { label: 'Overdue', tone: 'loss' },
  void: { label: 'Void', tone: 'hatch' },
}
