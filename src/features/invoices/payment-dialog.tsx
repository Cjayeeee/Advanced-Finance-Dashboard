import { useState } from 'react'
import { toast } from 'sonner'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Field, Input, MoneyInput, Textarea } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { useActiveWorkspace } from '@/store/app-store'
import { useFormat } from '@/hooks/use-format'
import type { Invoice } from '@/data/types'
import { invoiceAmounts, invoicePaid } from '@/lib/finance'
import { isValidISO, todayISO } from '@/lib/dates'
import { parseMoney, toInputString } from '@/lib/money'

/**
 * Records a payment against an invoice as ONE income transaction linked by invoiceId.
 * This is the only path by which invoice payments become revenue, so nothing is counted twice.
 */
export function RecordPaymentDialog({ invoice, open, onOpenChange }: { invoice: Invoice | null; open: boolean; onOpenChange: (v: boolean) => void }) {
  return <Dialog open={open} onOpenChange={onOpenChange}>{open && invoice && <PaymentForm invoice={invoice} onDone={() => onOpenChange(false)} />}</Dialog>
}

function PaymentForm({ invoice, onDone }: { invoice: Invoice; onDone: () => void }) {
  const { data, actions } = useActiveWorkspace()
  const { money, symbol } = useFormat()
  const total = invoiceAmounts(invoice).total
  const paid = invoicePaid(invoice.id, data.transactions)
  const balance = Math.max(0, total - paid)
  const [amount, setAmount] = useState(toInputString(balance))
  const [date, setDate] = useState(todayISO())
  const [accountId, setAccountId] = useState(data.accounts.find((a) => !a.archived && a.kind === 'bank')?.id ?? data.accounts[0]?.id ?? '')
  const [note, setNote] = useState('')
  const [touched, setTouched] = useState(false)
  const client = data.clients.find((c) => c.id === invoice.clientId)
  const minor = parseMoney(amount)
  const amountError = minor === null ? 'Enter a valid amount' : minor <= 0 ? 'Amount must be greater than zero' : minor > balance ? `That's more than the ${money(balance)} balance due` : undefined
  const dateError = !isValidISO(date) ? 'Pick a valid date' : date < invoice.issueDate ? 'Payment date is before the invoice date' : undefined
  const incomeCat = data.categories.find((c) => c.kind === 'income' && /client|services/i.test(c.name)) ?? data.categories.find((c) => c.kind === 'income')

  const submit = () => {
    setTouched(true)
    if (amountError || dateError || !accountId) return
    actions.addTransaction({
      type: 'income',
      amount: minor!,
      date,
      description: `${minor! < balance ? 'Part payment' : 'Payment'} — ${invoice.number}`,
      categoryId: incomeCat?.id,
      accountId,
      clientId: invoice.clientId,
      projectId: invoice.projectId,
      invoiceId: invoice.id,
      notes: note.trim() || undefined,
      tags: [],
    })
    toast.success(minor! >= balance ? `${invoice.number} paid in full` : 'Partial payment recorded', { description: `${money(minor!)} added to income${minor! < balance ? `, ${money(balance - minor!)} still due` : ''}.` })
    onDone()
  }

  return (
    <DialogContent
      title="Record payment"
      description={`${invoice.number} · ${client?.name ?? 'Client'}`}
      footer={
        <>
          <Button variant="ghost" onClick={onDone}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={balance === 0}>
            Record payment
          </Button>
        </>
      }
    >
      <dl className="mb-5 grid grid-cols-3 gap-2 rounded-2xl bg-ink/[0.035] p-4 text-center">
        <div>
          <dt className="text-[11.5px] text-muted">Total</dt>
          <dd className="mt-0.5 text-[14px] font-medium num">{money(total)}</dd>
        </div>
        <div>
          <dt className="text-[11.5px] text-muted">Paid</dt>
          <dd className="mt-0.5 text-[14px] font-medium num">{money(paid)}</dd>
        </div>
        <div>
          <dt className="text-[11.5px] text-muted">Balance due</dt>
          <dd className="mt-0.5 text-[14px] font-medium num">{money(balance)}</dd>
        </div>
      </dl>
      <form
        className="flex flex-col gap-4"
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <Field label="Amount received" htmlFor="pay-amount" error={touched ? amountError : undefined} hint="Record a partial amount if the client paid in instalments.">
          <MoneyInput id="pay-amount" symbol={symbol} large value={amount} onChange={(e) => setAmount(e.target.value)} aria-invalid={(touched && !!amountError) || undefined} autoFocus />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Payment date" htmlFor="pay-date" error={touched ? dateError : undefined}>
            <Input id="pay-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Deposited to" htmlFor="pay-account">
            <Select id="pay-account" value={accountId} onValueChange={setAccountId} options={data.accounts.filter((a) => !a.archived).map((a) => ({ value: a.id, label: a.name }))} />
          </Field>
        </div>
        <Field label="Reference" htmlFor="pay-note" optional>
          <Textarea id="pay-note" rows={2} placeholder="e.g. NEFT ref, cheque no." value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        <p className="text-[12px] leading-relaxed text-muted">This creates one income transaction linked to the invoice. It counts once in your income totals, and the invoice status updates automatically.</p>
      </form>
    </DialogContent>
  )
}
