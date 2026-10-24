import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Download, FileText, MoreHorizontal, Pencil, Plus, Search, Wallet } from 'lucide-react'
import { useActiveWorkspace, useApp } from '@/store/app-store'
import { useFormat } from '@/hooks/use-format'
import { useLookups } from '@/hooks/use-lookups'
import { useTerms } from '@/hooks/use-terms'
import { PageIntro } from '@/components/page'
import { EmptyState } from '@/components/empty-state'
import { MoneyFigure } from '@/components/money'
import { Button } from '@/components/ui/button'
import { Segmented } from '@/components/ui/segmented'
import { Dropdown, DropdownContent, DropdownItem, DropdownTrigger } from '@/components/ui/dropdown'
import { StatusBadge } from '@/features/invoices/status-badge'
import { RecordPaymentDialog } from '@/features/invoices/payment-dialog'
import type { Invoice, InvoiceStatus } from '@/data/types'
import { agingBuckets, invoiceViews, receivables, type InvoiceView } from '@/lib/finance'
import { formatDate, relativeDays } from '@/lib/dates'
import { csvAmount, downloadFile, toCSV } from '@/lib/csv'
import { downloadInvoicePDF } from '@/lib/pdf'
import { cn } from '@/lib/utils'

type Tab = 'all' | InvoiceStatus

export default function InvoicesPage() {
  const { ws, data } = useActiveWorkspace()
  const { user } = useApp()
  const { money } = useFormat()
  const { client } = useLookups()
  const terms = useTerms()
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('all')
  const [q, setQ] = useState('')
  const [payFor, setPayFor] = useState<Invoice | null>(null)

  const views = useMemo(() => invoiceViews(data.invoices, data.transactions), [data.invoices, data.transactions])
  const rec = receivables(views)
  const aging = agingBuckets(views)
  const counts = views.reduce<Record<string, number>>((m, v) => ((m[v.status] = (m[v.status] ?? 0) + 1), m), {})
  const rows = views
    .filter((v) => (tab === 'all' ? true : v.status === tab))
    .filter((v) => !q.trim() || v.invoice.number.toLowerCase().includes(q.toLowerCase()) || (client.get(v.invoice.clientId)?.name.toLowerCase().includes(q.toLowerCase()) ?? false))
    .sort((a, b) => (a.invoice.issueDate < b.invoice.issueDate ? 1 : a.invoice.issueDate > b.invoice.issueDate ? -1 : b.invoice.number.localeCompare(a.invoice.number)))

  const pdf = async (v: InvoiceView) => {
    try {
      await downloadInvoicePDF(v.invoice, ws, client.get(v.invoice.clientId), user?.name ?? ws.name, ws.businessEmail ?? user?.email, v.paid)
    } catch {
      toast.error("Couldn't generate the PDF")
    }
  }

  const exportCSV = () => {
    const csv = toCSV(
      ['Number', 'Client', 'Issue date', 'Due date', 'Status', 'Subtotal', 'Discount', 'Tax', 'Total', 'Paid', 'Outstanding', 'Currency'],
      rows.map((v) => [v.invoice.number, client.get(v.invoice.clientId)?.name ?? '', v.invoice.issueDate, v.invoice.dueDate, v.status, csvAmount(v.amounts.subtotal), csvAmount(v.amounts.discount), csvAmount(v.amounts.tax), csvAmount(v.amounts.total), csvAmount(v.paid), csvAmount(v.outstanding), ws.currency]),
    )
    downloadFile(`invoices-${new Date().toISOString().slice(0, 10)}.csv`, csv)
    toast.success(`Exported ${rows.length} invoices`)
  }

  const agingTotal = aging.current + aging.d30 + aging.d60 + aging.d90

  return (
    <>
      <PageIntro
        title="Invoices"
        description={`Bill ${terms.clients.toLowerCase()}, record full or partial payments, and see what's still owed.`}
        actions={
          <>
            <Button variant="secondary" onClick={exportCSV} disabled={!rows.length}>
              <Download /> Export
            </Button>
            <Button asChild>
              <Link to="/invoices/new">
                <Plus /> New invoice
              </Link>
            </Button>
          </>
        }
      />

      <section aria-label="Invoice totals" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_1.35fr] [&>*]:min-w-0">
        <div className="tile p-6">
          <p className="text-[13px] text-ink-3">Total invoiced</p>
          <MoneyFigure value={rec.invoiced} className="mt-4 block text-[38px]" />
          <p className="mt-3 text-[12px] text-muted">All issued invoices, excluding drafts & void</p>
        </div>
        <div className="tile p-6">
          <p className="text-[13px] text-ink-3">Payments received</p>
          <MoneyFigure value={rec.received} className="mt-4 block text-[38px]" />
          <p className="mt-3 text-[12px] text-muted">{rec.invoiced ? Math.round((rec.received / rec.invoiced) * 100) : 0}% collected</p>
        </div>
        <div className="tile p-6">
          <p className="text-[13px] text-ink-3">Outstanding</p>
          <MoneyFigure value={rec.outstanding} className="mt-4 block text-[38px]" />
          <p className="mt-3 text-[12px] text-muted">{rec.openCount} invoices awaiting payment</p>
        </div>
        <div className="tile-ink p-6">
          <div className="flex items-baseline justify-between">
            <p className="text-[13px] text-white/70">Overdue</p>
            <span className="text-[12px] text-white/50">{rec.overdueCount} invoices</span>
          </div>
          <MoneyFigure value={rec.overdue} className="mt-4 block text-[38px] text-sun" />
          <div className="mt-4">
            <div className="flex h-2 gap-1 overflow-hidden rounded-full">
              {agingTotal > 0 ? (
                <>
                  <span className="hatch-light rounded-full bg-white/20" style={{ flex: aging.current || 0.001 }} />
                  <span className="rounded-full bg-sun-soft" style={{ flex: aging.d30 || 0.001 }} />
                  <span className="rounded-full bg-sun" style={{ flex: aging.d60 || 0.001 }} />
                  <span className="rounded-full bg-[#ff9a8a]" style={{ flex: aging.d90 || 0.001 }} />
                </>
              ) : (
                <span className="flex-1 rounded-full bg-white/10" />
              )}
            </div>
            <dl className="mt-2 grid grid-cols-4 gap-1 text-[10.5px] text-white/55">
              <div><dt>Not due</dt><dd className="text-white num">{money(aging.current)}</dd></div>
              <div><dt>1–30d</dt><dd className="text-white num">{money(aging.d30)}</dd></div>
              <div><dt>31–60d</dt><dd className="text-white num">{money(aging.d60)}</dd></div>
              <div><dt>60d+</dt><dd className="text-white num">{money(aging.d90)}</dd></div>
            </dl>
          </div>
        </div>
      </section>

      <section className="tile mt-4 p-4 sm:p-6" aria-label="Invoice list">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="-mx-1 overflow-x-auto px-1 no-scrollbar">
            <Segmented
              label="Status"
              size="sm"
              value={tab}
              onChange={setTab}
              options={(['all', 'draft', 'sent', 'partial', 'overdue', 'paid'] as Tab[]).map((t) => ({
                value: t,
                label: (
                  <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                    {t === 'all' ? 'All' : t === 'partial' ? 'Partially paid' : t[0].toUpperCase() + t.slice(1)}
                    <span className="text-[11px] opacity-60 num">{t === 'all' ? views.length : (counts[t] ?? 0)}</span>
                  </span>
                ),
              }))}
            />
          </div>
          <label className="relative lg:w-72">
            <span className="sr-only">Search invoices</span>
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Number or ${terms.client.toLowerCase()}`} className="h-10 w-full rounded-full bg-white/80 pl-10 pr-4 text-[13.5px] ring-1 ring-line outline-none focus:bg-white focus:ring-2 focus:ring-ink" />
          </label>
        </div>

        {rows.length === 0 ? (
          <EmptyState
            icon={<FileText />}
            title={views.length === 0 ? 'No invoices yet' : 'No invoices here'}
            description={views.length === 0 ? `Create your first invoice and record payments as ${terms.clients.toLowerCase()} pay.` : 'Try another status or search.'}
            action={
              views.length === 0 && (
                <Button asChild>
                  <Link to="/invoices/new">
                    <Plus /> New invoice
                  </Link>
                </Button>
              )
            }
          />
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block scrollbar-thin">
              <table className="w-full min-w-[760px] text-[13.5px]">
                <caption className="sr-only">Invoices</caption>
                <thead>
                  <tr className="border-b border-line text-left text-[12px] text-muted">
                    <th scope="col" className="py-3 pl-1 font-medium">Invoice</th>
                    <th scope="col" className="py-3 font-medium">{terms.client}</th>
                    <th scope="col" className="py-3 font-medium">Issued</th>
                    <th scope="col" className="py-3 font-medium">Due</th>
                    <th scope="col" className="py-3 font-medium">Status</th>
                    <th scope="col" className="py-3 text-right font-medium">Total</th>
                    <th scope="col" className="py-3 text-right font-medium">Balance</th>
                    <th scope="col" className="w-10"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((v) => (
                    <tr key={v.invoice.id} className="cursor-pointer border-b border-line transition-colors last:border-0 hover:bg-white/60" onClick={() => navigate(`/invoices/${v.invoice.id}`)}>
                      <td className="py-3 pl-1">
                        <Link to={`/invoices/${v.invoice.id}`} className="font-medium num hover:underline" onClick={(e) => e.stopPropagation()}>
                          {v.invoice.number}
                        </Link>
                      </td>
                      <td className="py-3">{client.get(v.invoice.clientId)?.name ?? '—'}</td>
                      <td className="py-3 text-ink-3 num">{formatDate(v.invoice.issueDate)}</td>
                      <td className={cn('py-3 num', v.status === 'overdue' ? 'text-loss' : 'text-ink-3')}>
                        {formatDate(v.invoice.dueDate)}
                        {v.outstanding > 0 && v.status !== 'draft' && <span className="block text-[11.5px] text-muted">{relativeDays(v.invoice.dueDate)}</span>}
                      </td>
                      <td className="py-3">
                        <StatusBadge status={v.status} />
                      </td>
                      <td className="py-3 text-right font-medium num">{money(v.amounts.total)}</td>
                      <td className="py-3 text-right num">{v.status === 'draft' || v.status === 'void' ? <span className="text-subtle">—</span> : v.outstanding === 0 ? <span className="text-gain">Settled</span> : money(v.outstanding)}</td>
                      <td className="py-3 pr-1 text-right" onClick={(e) => e.stopPropagation()}>
                        <RowMenu v={v} onPay={() => setPayFor(v.invoice)} onPdf={() => pdf(v)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="flex flex-col divide-y divide-line md:hidden">
              {rows.map((v) => (
                <li key={v.invoice.id} className="flex items-center gap-3 py-3">
                  <Link to={`/invoices/${v.invoice.id}`} className="min-w-0 flex-1">
                    <p className="flex items-center gap-2">
                      <span className="truncate text-[14px] font-medium">{client.get(v.invoice.clientId)?.name}</span>
                    </p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-2 text-[12px] text-muted num">
                      {v.invoice.number} · due {formatDate(v.invoice.dueDate, 'short')}
                      <StatusBadge status={v.status} className="h-5" />
                    </p>
                  </Link>
                  <span className="text-right">
                    <span className="block text-[14px] font-medium num">{money(v.amounts.total)}</span>
                    {v.outstanding > 0 && v.outstanding < v.amounts.total && <span className="text-[11.5px] text-muted num">{money(v.outstanding)} due</span>}
                  </span>
                  <RowMenu v={v} onPay={() => setPayFor(v.invoice)} onPdf={() => pdf(v)} />
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
      <RecordPaymentDialog invoice={payFor} open={!!payFor} onOpenChange={(o) => !o && setPayFor(null)} />
    </>
  )
}

function RowMenu({ v, onPay, onPdf }: { v: InvoiceView; onPay: () => void; onPdf: () => void }) {
  const navigate = useNavigate()
  return (
    <Dropdown>
      <DropdownTrigger asChild>
        <button className="grid size-8 place-items-center rounded-full text-muted hover:bg-ink/5 hover:text-ink" aria-label={`Actions for ${v.invoice.number}`}>
          <MoreHorizontal className="size-4" />
        </button>
      </DropdownTrigger>
      <DropdownContent>
        {v.outstanding > 0 && (
          <DropdownItem onSelect={onPay}>
            <Wallet /> Record payment
          </DropdownItem>
        )}
        {v.status !== 'void' && (
          <DropdownItem onSelect={() => navigate(`/invoices/${v.invoice.id}/edit`)}>
            <Pencil /> Edit
          </DropdownItem>
        )}
        <DropdownItem onSelect={onPdf}>
          <Download /> Download PDF
        </DropdownItem>
      </DropdownContent>
    </Dropdown>
  )
}
