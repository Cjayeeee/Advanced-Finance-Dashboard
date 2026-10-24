import type { Client, Invoice, Workspace } from '@/data/types'
import { invoiceAmounts, lineTotal } from '@/lib/finance'
import { formatDate } from '@/lib/dates'
import { formatMoney } from '@/lib/money'
import { LogoMark } from '@/components/logo'
import { cn } from '@/lib/utils'

/** Print-like invoice document. Pure presentation — used by the editor preview and the detail page. */
export function InvoicePaper({ invoice, client, ws, fromName, fromEmail, paid = 0, className }: { invoice: Invoice; client?: Client; ws: Workspace; fromName: string; fromEmail?: string; paid?: number; className?: string }) {
  const a = invoiceAmounts(invoice)
  const m = (v: number) => formatMoney(v, ws.currency, ws.locale, { decimals: true })
  const balance = Math.max(0, a.total - paid)
  return (
    <article className={cn('relative overflow-hidden rounded-[22px] bg-white p-6 text-[12.5px] text-ink shadow-[0_1px_2px_rgb(22_22_21/0.06),0_24px_48px_-24px_rgb(22_22_21/0.25)] sm:p-9', className)} aria-label={`Invoice ${invoice.number}`}>
      {invoice.state === 'draft' && <span className="pointer-events-none absolute right-6 top-6 rotate-6 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-muted ring-1 ring-line-strong hatch">Draft</span>}
      {invoice.state === 'void' && <span className="pointer-events-none absolute right-6 top-6 rotate-6 rounded-full bg-loss-soft px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-loss">Void</span>}
      <header className="flex flex-wrap items-start justify-between gap-6">
        <div className="flex items-center gap-3">
          <LogoMark className="size-10" />
          <div>
            <p className="text-[15px] font-semibold">{ws.name}</p>
            <p className="text-muted">{fromEmail ?? ws.businessEmail}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="font-display text-[30px] font-light tracking-tight">Invoice</p>
          <p className="text-muted num">{invoice.number || '—'}</p>
        </div>
      </header>

      <div className="mt-8 grid gap-6 sm:grid-cols-3">
        <div>
          <p className="eyebrow mb-1.5">Billed to</p>
          <p className="font-medium">{client?.name ?? 'Select a client'}</p>
          {client?.address && <p className="whitespace-pre-line text-muted">{client.address}</p>}
          {client?.email && <p className="text-muted">{client.email}</p>}
          {client?.taxId && <p className="text-muted">Tax ID: {client.taxId}</p>}
        </div>
        <div>
          <p className="eyebrow mb-1.5">From</p>
          <p className="font-medium">{fromName}</p>
          {ws.businessAddress && <p className="whitespace-pre-line text-muted">{ws.businessAddress}</p>}
          {ws.businessTaxId && <p className="text-muted">Tax ID: {ws.businessTaxId}</p>}
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 sm:justify-self-end">
          <dt className="text-muted">Issued</dt>
          <dd className="text-right num">{formatDate(invoice.issueDate, 'medium')}</dd>
          <dt className="text-muted">Due</dt>
          <dd className="text-right font-medium num">{formatDate(invoice.dueDate, 'medium')}</dd>
          <dt className="text-muted">Currency</dt>
          <dd className="text-right">{ws.currency}</dd>
        </dl>
      </div>

      <table className="mt-8 w-full">
        <thead>
          <tr className="border-b border-ink text-left text-[11px] uppercase tracking-wider text-muted">
            <th scope="col" className="pb-2 font-medium">Description</th>
            <th scope="col" className="w-16 pb-2 text-right font-medium">Qty</th>
            <th scope="col" className="w-28 pb-2 text-right font-medium">Rate</th>
            <th scope="col" className="w-32 pb-2 text-right font-medium">Amount</th>
          </tr>
        </thead>
        <tbody>
          {invoice.lines.map((l) => (
            <tr key={l.id} className="border-b border-line align-top">
              <td className="py-2.5 pr-3">{l.description || <span className="text-subtle">Item description</span>}</td>
              <td className="py-2.5 text-right num">{l.quantity}</td>
              <td className="py-2.5 text-right num">{m(l.rate)}</td>
              <td className="py-2.5 text-right font-medium num">{m(lineTotal(l.quantity, l.rate))}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-5 flex justify-end">
        <dl className="grid w-full max-w-72 grid-cols-[1fr_auto] gap-y-1.5">
          <dt className="text-muted">Subtotal</dt>
          <dd className="text-right num">{m(a.subtotal)}</dd>
          {a.discount > 0 && (
            <>
              <dt className="text-muted">Discount{invoice.discount.type === 'percent' ? ` (${invoice.discount.value}%)` : ''}</dt>
              <dd className="text-right num">−{m(a.discount)}</dd>
            </>
          )}
          {(invoice.taxRate > 0 || invoice.taxLabel) && (
            <>
              <dt className="text-muted">
                {invoice.taxLabel || 'Tax'} ({invoice.taxRate}%)
              </dt>
              <dd className="text-right num">{m(a.tax)}</dd>
            </>
          )}
          <dt className="mt-2 border-t border-ink pt-2 text-[14px] font-semibold">Total</dt>
          <dd className="mt-2 border-t border-ink pt-2 text-right text-[14px] font-semibold num">{m(a.total)}</dd>
          {paid > 0 && (
            <>
              <dt className="text-muted">Paid</dt>
              <dd className="text-right num">−{m(paid)}</dd>
              <dt className="font-medium">Balance due</dt>
              <dd className="text-right font-medium num">{m(balance)}</dd>
            </>
          )}
        </dl>
      </div>

      {(invoice.notes || invoice.terms) && (
        <footer className="mt-8 grid gap-5 border-t border-line pt-5 sm:grid-cols-2">
          {invoice.notes && (
            <div>
              <p className="eyebrow mb-1">Notes</p>
              <p className="whitespace-pre-line text-muted">{invoice.notes}</p>
            </div>
          )}
          {invoice.terms && (
            <div>
              <p className="eyebrow mb-1">Payment terms</p>
              <p className="whitespace-pre-line text-muted">{invoice.terms}</p>
            </div>
          )}
        </footer>
      )}
    </article>
  )
}
