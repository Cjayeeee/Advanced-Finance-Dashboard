import { useMemo, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowLeft, Ban, Copy, Download, FileCheck2, MoreHorizontal, Pencil, Send, Trash2, Undo2, Wallet } from 'lucide-react'
import { useActiveWorkspace, useApp } from '@/store/app-store'
import { useFormat } from '@/hooks/use-format'
import { useLookups } from '@/hooks/use-lookups'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/alert-dialog'
import { Dropdown, DropdownContent, DropdownItem, DropdownSeparator, DropdownTrigger } from '@/components/ui/dropdown'
import { Switch } from '@/components/ui/switch'
import { MoneyFigure } from '@/components/money'
import { InvoicePaper } from '@/features/invoices/invoice-paper'
import { StatusBadge } from '@/features/invoices/status-badge'
import { RecordPaymentDialog } from '@/features/invoices/payment-dialog'
import { nextInvoiceNumber } from '@/features/invoices/utils'
import { useTransactionDialog } from '@/features/transactions/transaction-dialog'
import { useDeleteTransactions } from '@/features/transactions/transaction-table'
import { invoicePayments, invoiceViews } from '@/lib/finance'
import { addDays, daysBetween, formatDate, relativeDays, todayISO } from '@/lib/dates'
import { downloadInvoicePDF } from '@/lib/pdf'
import { uid } from '@/lib/id'
import { cn } from '@/lib/utils'

export default function InvoiceDetailPage() {
  const { id } = useParams()
  const { ws, data, actions } = useActiveWorkspace()
  const { user } = useApp()
  const { money } = useFormat()
  const { acc } = useLookups()
  const navigate = useNavigate()
  const txDialog = useTransactionDialog()
  const del = useDeleteTransactions()
  const [payOpen, setPayOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [keepPayments, setKeepPayments] = useState(true)
  const [confirmVoid, setConfirmVoid] = useState(false)

  const inv = data.invoices.find((i) => i.id === id)
  const view = useMemo(() => (inv ? invoiceViews([inv], data.transactions)[0] : null), [inv, data.transactions])
  const payments = useMemo(() => (inv ? invoicePayments(inv.id, data.transactions) : []), [inv, data.transactions])
  if (!inv || !view) return <Navigate to="/invoices" replace />
  const client = data.clients.find((c) => c.id === inv.clientId)
  const today = todayISO()
  const pctPaid = view.amounts.total > 0 ? Math.min(1, view.paid / view.amounts.total) : 0

  const pdf = async () => {
    try {
      await downloadInvoicePDF(inv, ws, client, user?.name ?? ws.name, ws.businessEmail ?? user?.email, view.paid)
      toast.success('PDF downloaded', { description: 'Attach it to an email to send it to your client.' })
    } catch {
      toast.error("Couldn't generate the PDF")
    }
  }

  const duplicate = () => {
    const copy = { ...inv, id: uid('inv'), number: nextInvoiceNumber(ws.invoicePrefix, data.invoices), issueDate: today, dueDate: addDays(today, daysBetween(inv.issueDate, inv.dueDate) - 1), state: 'draft' as const, issuedAt: undefined, createdAt: new Date().toISOString(), lines: inv.lines.map((l) => ({ ...l, id: uid('l') })) }
    actions.saveInvoice(copy)
    toast.success(`Duplicated as ${copy.number}`)
    navigate(`/invoices/${copy.id}/edit`)
  }

  const timeline = [
    { date: inv.createdAt.slice(0, 10), label: 'Created', tone: 'muted' as const },
    ...(inv.issuedAt ? [{ date: inv.issuedAt, label: 'Marked as sent', tone: 'muted' as const }] : []),
    ...payments.map((p) => ({ date: p.date, label: `${p.refund ? 'Refund' : 'Payment'} of ${money(p.amount)}`, tone: 'gain' as const })),
    ...(view.status !== 'draft' && view.status !== 'void' ? [{ date: inv.dueDate, label: view.status === 'paid' ? 'Due date' : inv.dueDate < today ? `Due date passed (${daysBetween(inv.dueDate, today) - 1} days ago)` : `Due ${relativeDays(inv.dueDate)}`, tone: (view.status === 'overdue' ? 'loss' : 'muted') as 'loss' | 'muted' }] : []),
  ].sort((a, b) => (a.date < b.date ? -1 : 1))

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <Link to="/invoices" className="mb-3 inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-ink">
            <ArrowLeft className="size-3.5" /> Invoices
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-[34px] font-light tracking-[-0.03em] sm:text-[44px] num">{inv.number}</h1>
            <StatusBadge status={view.status} className="h-7 px-3 text-[12.5px]" />
          </div>
          <p className="mt-1 text-[14px] text-muted">
            {client?.name} · issued {formatDate(inv.issueDate)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {inv.state === 'draft' && (
            <Button
              variant="sun"
              onClick={() => {
                actions.saveInvoice({ ...inv, state: 'issued', issuedAt: today })
                toast.success('Marked as sent', { description: 'Monetra does not email invoices. Download the PDF and send it yourself.' })
              }}
            >
              <Send /> Mark as sent
            </Button>
          )}
          {view.outstanding > 0 && (
            <Button onClick={() => setPayOpen(true)}>
              <Wallet /> Record payment
            </Button>
          )}
          <Button variant="secondary" onClick={pdf}>
            <Download /> PDF
          </Button>
          <Dropdown>
            <DropdownTrigger asChild>
              <Button variant="secondary" size="icon" aria-label="More invoice actions">
                <MoreHorizontal />
              </Button>
            </DropdownTrigger>
            <DropdownContent>
              {inv.state !== 'void' && (
                <DropdownItem onSelect={() => navigate(`/invoices/${inv.id}/edit`)}>
                  <Pencil /> Edit
                </DropdownItem>
              )}
              <DropdownItem onSelect={duplicate}>
                <Copy /> Duplicate
              </DropdownItem>
              {inv.state === 'issued' && view.paid === 0 && (
                <DropdownItem onSelect={() => (actions.saveInvoice({ ...inv, state: 'draft', issuedAt: undefined }), toast('Moved back to draft'))}>
                  <Undo2 /> Revert to draft
                </DropdownItem>
              )}
              {inv.state === 'issued' && (
                <DropdownItem onSelect={() => setConfirmVoid(true)}>
                  <Ban /> Void invoice
                </DropdownItem>
              )}
              {inv.state === 'void' && (
                <DropdownItem onSelect={() => (actions.saveInvoice({ ...inv, state: 'issued' }), toast('Invoice restored'))}>
                  <FileCheck2 /> Restore
                </DropdownItem>
              )}
              <DropdownSeparator />
              <DropdownItem destructive onSelect={() => setConfirmDelete(true)}>
                <Trash2 /> Delete
              </DropdownItem>
            </DropdownContent>
          </Dropdown>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px] [&>*]:min-w-0">
        <InvoicePaper invoice={inv} client={client} ws={ws} fromName={user?.name ?? ws.name} fromEmail={ws.businessEmail ?? user?.email} paid={view.paid} />

        <aside className="flex flex-col gap-4">
          <section className="tile-ink p-6" aria-labelledby="bal">
            <p id="bal" className="text-[13px] text-white/70">
              {view.status === 'paid' ? 'Paid in full' : view.status === 'draft' ? 'Draft total' : view.status === 'void' ? 'Voided' : 'Balance due'}
            </p>
            <MoneyFigure value={view.status === 'paid' || view.status === 'draft' || view.status === 'void' ? view.amounts.total : view.outstanding} className="mt-3 block text-[44px]" />
            <div className="mt-5 h-2.5 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-sun transition-[width] duration-700" style={{ width: `${pctPaid * 100}%` }} />
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-[12.5px]">
              <div>
                <dt className="text-white/50">Paid</dt>
                <dd className="num">{money(view.paid)}</dd>
              </div>
              <div className="text-right">
                <dt className="text-white/50">Invoice total</dt>
                <dd className="num">{money(view.amounts.total)}</dd>
              </div>
            </dl>
            {view.status === 'draft' && <p className="mt-4 text-[12px] text-white/50">Drafts aren't counted in receivables. Mark it as sent once you've delivered it to your client.</p>}
          </section>

          <section className="tile p-5" aria-labelledby="ph">
            <h2 id="ph" className="font-display text-[18px]">
              Payment history
            </h2>
            <p className="mb-3 text-[12px] text-muted">Each payment is a linked income transaction, so it's counted exactly once.</p>
            {payments.length === 0 ? (
              <p className="rounded-2xl bg-ink/[0.03] p-4 text-center text-[13px] text-muted">No payments recorded yet.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-line">
                {payments.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 py-2.5">
                    <span className="grid size-8 place-items-center rounded-full bg-gain-soft text-gain">
                      <Wallet className="size-3.5" />
                    </span>
                    <button className="min-w-0 flex-1 text-left" onClick={() => txDialog.open({ edit: p })}>
                      <span className="block text-[13.5px] font-medium num">{money(p.amount)}</span>
                      <span className="block truncate text-[12px] text-muted">
                        {formatDate(p.date)} · {acc.get(p.accountId)?.name}
                      </span>
                    </button>
                    <button onClick={() => del.request([p.id])} className="grid size-8 place-items-center rounded-full text-muted hover:bg-loss-soft hover:text-loss" aria-label={`Delete payment of ${money(p.amount)}`}>
                      <Trash2 className="size-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {view.outstanding > 0 && (
              <Button variant="secondary" size="sm" className="mt-3 w-full" onClick={() => setPayOpen(true)}>
                <Wallet /> Record a payment
              </Button>
            )}
          </section>

          <section className="tile p-5" aria-labelledby="tl">
            <h2 id="tl" className="mb-3 font-display text-[18px]">
              Timeline
            </h2>
            <ol className="relative ml-1.5 flex flex-col gap-3 border-l border-line pl-5">
              {timeline.map((e, i) => (
                <li key={i} className="relative text-[13px]">
                  <span className={cn('absolute -left-[26px] top-1 size-2.5 rounded-full ring-4 ring-paper', e.tone === 'gain' ? 'bg-gain' : e.tone === 'loss' ? 'bg-loss' : 'bg-ink/30')} />
                  <p>{e.label}</p>
                  <p className="text-[11.5px] text-muted num">{formatDate(e.date)}</p>
                </li>
              ))}
            </ol>
          </section>
        </aside>
      </div>

      <RecordPaymentDialog invoice={inv} open={payOpen} onOpenChange={setPayOpen} />
      <ConfirmDialog
        open={confirmVoid}
        onOpenChange={setConfirmVoid}
        title={`Void ${inv.number}?`}
        description="A voided invoice stays on record but is excluded from receivables. Payments already recorded remain as income."
        confirmLabel="Void invoice"
        onConfirm={() => (actions.saveInvoice({ ...inv, state: 'void' }), toast('Invoice voided'))}
      />
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete ${inv.number}?`}
        description="This permanently removes the invoice."
        onConfirm={() => {
          actions.deleteInvoice(inv.id, keepPayments)
          toast.success('Invoice deleted')
          navigate('/invoices')
        }}
      >
        {payments.length > 0 && (
          <label className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-ink/[0.04] p-3 text-[13px]">
            <span>
              Keep {payments.length} payment record{payments.length > 1 ? 's' : ''} as income
              <span className="block text-[12px] text-muted">Recommended. The money was actually received.</span>
            </span>
            <Switch checked={keepPayments} onCheckedChange={setKeepPayments} aria-label="Keep payments" />
          </label>
        )}
      </ConfirmDialog>
      {del.dialog}
    </>
  )
}
