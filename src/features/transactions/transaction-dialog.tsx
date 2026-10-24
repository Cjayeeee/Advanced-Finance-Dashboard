import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Link2, Repeat, RotateCcw } from 'lucide-react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Field, Input, MoneyInput, Textarea } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Segmented } from '@/components/ui/segmented'
import { CategoryIcon } from '@/components/category-icon'
import { useActiveWorkspace } from '@/store/app-store'
import { useFormat } from '@/hooks/use-format'
import { useTerms } from '@/hooks/use-terms'
import type { Transaction, TxType } from '@/data/types'
import { parseMoney, toInputString } from '@/lib/money'
import { isValidISO, todayISO, addMonths } from '@/lib/dates'
import { invoiceAmounts, invoicePaid } from '@/lib/finance'
import { cn } from '@/lib/utils'

/* ─────────────────────────── validation ─────────────────────────── */

const MAX_MINOR = 100_000_000_000 // 1,00,00,00,000.00 — a sanity ceiling

export const txSchema = z
  .object({
    type: z.enum(['income', 'expense', 'transfer']),
    amount: z
      .string()
      .trim()
      .min(1, 'Enter an amount')
      .refine((v) => parseMoney(v) !== null, 'Use numbers only, with up to 2 decimals')
      .refine((v) => (parseMoney(v) ?? 0) > 0, 'Amount must be greater than zero')
      .refine((v) => (parseMoney(v) ?? 0) <= MAX_MINOR, 'That amount looks too large'),
    description: z.string().trim().min(1, 'Add a short description').max(120, 'Keep it under 120 characters'),
    categoryId: z.string().optional(),
    date: z.string().refine(isValidISO, 'Pick a valid date'),
    accountId: z.string().min(1, 'Choose an account'),
    toAccountId: z.string().optional(),
    clientId: z.string().optional(),
    projectId: z.string().optional(),
    notes: z.string().max(500, 'Notes are limited to 500 characters').optional(),
    tags: z.string().max(200).optional(),
    refund: z.boolean(),
    recurring: z.boolean(),
    frequency: z.enum(['weekly', 'monthly', 'quarterly', 'yearly']),
    until: z.string().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.type !== 'transfer' && !v.categoryId) ctx.addIssue({ code: 'custom', path: ['categoryId'], message: 'Choose a category' })
    if (v.type === 'transfer') {
      if (!v.toAccountId) ctx.addIssue({ code: 'custom', path: ['toAccountId'], message: 'Choose the destination account' })
      else if (v.toAccountId === v.accountId) ctx.addIssue({ code: 'custom', path: ['toAccountId'], message: 'Pick a different account than the source' })
    }
    if (v.recurring && v.until && (!isValidISO(v.until) || v.until < v.date)) ctx.addIssue({ code: 'custom', path: ['until'], message: 'End date must be after the transaction date' })
  })

export type TxFormValues = z.infer<typeof txSchema>

/* ─────────────────────────── context ─────────────────────────── */

interface OpenOptions {
  edit?: Transaction
  defaults?: Partial<TxFormValues>
}
const Ctx = createContext<{ open: (o?: OpenOptions) => void } | null>(null)

export function useTransactionDialog() {
  const c = useContext(Ctx)
  if (!c) throw new Error('useTransactionDialog outside provider')
  return c
}

export function TransactionDialogProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ open: boolean; opts: OpenOptions }>({ open: false, opts: {} })
  const open = useCallback((opts: OpenOptions = {}) => setState({ open: true, opts }), [])
  const value = useMemo(() => ({ open }), [open])
  return (
    <Ctx.Provider value={value}>
      {children}
      <Dialog open={state.open} onOpenChange={(o) => setState((s) => ({ ...s, open: o }))}>
        {state.open && <TransactionForm key={state.opts.edit?.id ?? 'new'} opts={state.opts} onDone={() => setState((s) => ({ ...s, open: false }))} />}
      </Dialog>
    </Ctx.Provider>
  )
}

/* ─────────────────────────── form ─────────────────────────── */

function toForm(t: Transaction): TxFormValues {
  return {
    type: t.type,
    amount: toInputString(t.amount),
    description: t.description,
    categoryId: t.categoryId,
    date: t.date,
    accountId: t.accountId,
    toAccountId: t.toAccountId,
    clientId: t.clientId,
    projectId: t.projectId,
    notes: t.notes ?? '',
    tags: t.tags.join(', '),
    refund: !!t.refund,
    recurring: !!t.recurring,
    frequency: t.recurring?.frequency ?? 'monthly',
    until: t.recurring?.until ?? '',
  }
}

function TransactionForm({ opts, onDone }: { opts: OpenOptions; onDone: () => void }) {
  const { data, actions } = useActiveWorkspace()
  const { symbol, money } = useFormat()
  const terms = useTerms()
  const editing = opts.edit
  const linkedInvoice = editing?.invoiceId ? data.invoices.find((i) => i.id === editing.invoiceId) : undefined
  const activeAccounts = data.accounts.filter((a) => !a.archived || a.id === editing?.accountId || a.id === editing?.toAccountId)

  const defaults: TxFormValues = editing
    ? toForm(editing)
    : {
        type: 'expense',
        amount: '',
        description: '',
        categoryId: undefined,
        date: todayISO(),
        accountId: activeAccounts[0]?.id ?? '',
        toAccountId: undefined,
        clientId: undefined,
        projectId: undefined,
        notes: '',
        tags: '',
        refund: false,
        recurring: false,
        frequency: 'monthly',
        until: '',
        ...opts.defaults,
      }

  const {
    register,
    control,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<TxFormValues>({ resolver: zodResolver(txSchema), defaultValues: defaults, mode: 'onTouched' })

  const type = useWatch({ control, name: 'type' })
  const recurring = useWatch({ control, name: 'recurring' })
  const clientId = useWatch({ control, name: 'clientId' })
  const amountStr = useWatch({ control, name: 'amount' })

  // Keep category consistent with type
  useEffect(() => {
    const current = data.categories.find((c) => c.id === defaults.categoryId)
    if (type === 'transfer') setValue('categoryId', undefined)
    else if (!current || current.kind !== type) setValue('categoryId', undefined)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type])

  const cats = data.categories.filter((c) => c.kind === type)
  const projects = data.projects.filter((p) => !clientId || p.clientId === clientId)

  // Overpayment guard for invoice-linked payments
  let invoiceHint: string | undefined
  if (linkedInvoice) {
    const total = invoiceAmounts(linkedInvoice).total
    const otherPaid = invoicePaid(linkedInvoice.id, data.transactions.filter((t) => t.id !== editing!.id))
    invoiceHint = `Invoice ${linkedInvoice.number}: ${money(total)} total, ${money(otherPaid)} paid by other records.`
    const a = parseMoney(amountStr)
    if (a !== null && a + otherPaid > total) invoiceHint = `This would overpay ${linkedInvoice.number} by ${money(a + otherPaid - total)}.`
  }

  const onSubmit = (v: TxFormValues) => {
    const amount = parseMoney(v.amount)!
    if (linkedInvoice) {
      const total = invoiceAmounts(linkedInvoice).total
      const otherPaid = invoicePaid(linkedInvoice.id, data.transactions.filter((t) => t.id !== editing!.id))
      if (amount + otherPaid > total) {
        toast.error('Payment exceeds the invoice balance', { description: 'Lower the amount, or edit the invoice first.' })
        return
      }
    }
    const record: Omit<Transaction, 'id' | 'createdAt'> = {
      type: v.type as TxType,
      amount,
      description: v.description.trim(),
      date: v.date,
      accountId: v.accountId,
      categoryId: v.type === 'transfer' ? undefined : v.categoryId,
      toAccountId: v.type === 'transfer' ? v.toAccountId : undefined,
      clientId: v.type === 'transfer' ? undefined : v.clientId || undefined,
      projectId: v.type === 'transfer' ? undefined : v.projectId || undefined,
      notes: v.notes?.trim() || undefined,
      tags: (v.tags ?? '')
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean)
        .slice(0, 8),
      refund: v.type !== 'transfer' && v.refund ? true : undefined,
      recurring: v.recurring && v.type !== 'transfer' ? { frequency: v.frequency, until: v.until || undefined } : undefined,
      invoiceId: editing?.invoiceId,
    }
    try {
      if (editing) {
        actions.updateTransaction(editing.id, record)
        toast.success('Transaction updated')
      } else {
        actions.addTransaction(record)
        toast.success(v.type === 'transfer' ? 'Transfer recorded' : v.type === 'income' ? `${terms.income} recorded` : 'Expense recorded', {
          description: `${record.description} · ${money(amount)}`,
        })
      }
      onDone()
    } catch {
      toast.error("Couldn't save this transaction", { description: 'Please try again.' })
    }
  }

  const err = (k: keyof TxFormValues) => errors[k]?.message as string | undefined
  const aria = (k: keyof TxFormValues) => ({ 'aria-invalid': !!errors[k] || undefined, 'aria-describedby': errors[k] ? `tx-${k}-error` : undefined })

  return (
    <DialogContent
      title={editing ? 'Edit transaction' : 'New transaction'}
      description={editing ? 'Changes update every report immediately.' : 'Record money in, money out, or a move between your accounts.'}
      footer={
        <>
          <Button variant="ghost" onClick={onDone}>
            Cancel
          </Button>
          <Button type="submit" form="tx-form" disabled={isSubmitting}>
            {editing ? 'Save changes' : 'Add transaction'}
          </Button>
        </>
      }
    >
      <form id="tx-form" onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <Controller
          control={control}
          name="type"
          render={({ field }) => (
            <Segmented
              label="Transaction type"
              value={field.value}
              onChange={field.onChange}
              className="w-full [&>button]:flex-1"
              options={[
                { value: 'expense', label: <span className="inline-flex items-center gap-1.5"><ArrowUpRight className="size-3.5" />Expense</span>, disabled: !!linkedInvoice },
                { value: 'income', label: <span className="inline-flex items-center gap-1.5"><ArrowDownLeft className="size-3.5" />{terms.income}</span> },
                { value: 'transfer', label: <span className="inline-flex items-center gap-1.5"><ArrowLeftRight className="size-3.5" />Transfer</span>, disabled: !!linkedInvoice },
              ]}
            />
          )}
        />

        {linkedInvoice && (
          <div className="flex items-start gap-2.5 rounded-2xl bg-sun-wash p-3 text-[12.5px] text-ink-3 ring-1 ring-sun/40">
            <Link2 className="mt-0.5 size-4 shrink-0" />
            <span>
              This is a payment against <strong className="font-medium text-ink">{linkedInvoice.number}</strong>. It counts as {terms.incomeLower} once, and the invoice balance updates from it. {invoiceHint}
            </span>
          </div>
        )}

        <Field label="Amount" htmlFor="tx-amount" error={err('amount')}>
          <MoneyInput id="tx-amount" symbol={symbol} large placeholder="0.00" autoFocus={!editing} {...register('amount')} {...aria('amount')} />
        </Field>

        <Field label="Description" htmlFor="tx-description" error={err('description')}>
          <Input id="tx-description" placeholder={type === 'income' ? 'e.g. Payment for website redesign' : type === 'transfer' ? 'e.g. Card bill payment' : 'e.g. Figma subscription'} {...register('description')} {...aria('description')} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          {type !== 'transfer' ? (
            <Field label="Category" htmlFor="tx-categoryId" error={err('categoryId')}>
              <Controller
                control={control}
                name="categoryId"
                render={({ field }) => (
                  <Select
                    id="tx-categoryId"
                    value={field.value}
                    onValueChange={field.onChange}
                    invalid={!!errors.categoryId}
                    placeholder="Choose category"
                    options={cats.map((c) => ({
                      value: c.id,
                      label: (
                        <span className="flex items-center gap-2">
                          <CategoryIcon icon={c.icon} color={c.color} size="sm" className="size-5 [&_svg]:size-3" />
                          {c.name}
                        </span>
                      ),
                    }))}
                  />
                )}
              />
            </Field>
          ) : (
            <div className="hidden sm:block" />
          )}
          <Field label="Date" htmlFor="tx-date" error={err('date')}>
            <Input id="tx-date" type="date" {...register('date')} {...aria('date')} />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={type === 'transfer' ? 'From account' : type === 'income' ? 'Deposited to' : 'Paid from'} htmlFor="tx-accountId" error={err('accountId')}>
            <Controller
              control={control}
              name="accountId"
              render={({ field }) => <Select id="tx-accountId" value={field.value} onValueChange={field.onChange} invalid={!!errors.accountId} options={activeAccounts.map((a) => ({ value: a.id, label: a.name, hint: a.kind }))} />}
            />
          </Field>
          {type === 'transfer' ? (
            <Field label="To account" htmlFor="tx-toAccountId" error={err('toAccountId')}>
              <Controller
                control={control}
                name="toAccountId"
                render={({ field }) => <Select id="tx-toAccountId" value={field.value} onValueChange={field.onChange} invalid={!!errors.toAccountId} placeholder="Choose account" options={activeAccounts.map((a) => ({ value: a.id, label: a.name, hint: a.kind }))} />}
              />
            </Field>
          ) : (
            <Field label={terms.client} htmlFor="tx-clientId" optional>
              <Controller
                control={control}
                name="clientId"
                render={({ field }) => (
                  <Select
                    id="tx-clientId"
                    value={field.value ?? 'none'}
                    onValueChange={(v) => {
                      field.onChange(v === 'none' ? undefined : v)
                      setValue('projectId', undefined)
                    }}
                    disabled={!!linkedInvoice}
                    options={[{ value: 'none', label: `No ${terms.client.toLowerCase()}` }, ...data.clients.map((c) => ({ value: c.id, label: c.name }))]}
                  />
                )}
              />
            </Field>
          )}
        </div>

        {type === 'transfer' && (
          <p className="-mt-1 rounded-2xl bg-ink/[0.04] px-3.5 py-2.5 text-[12.5px] text-muted">
            Transfers move money between your own accounts. They change account balances but are never counted as {terms.incomeLower} or expenses.
          </p>
        )}

        {type !== 'transfer' && projects.length > 0 && (
          <Field label="Project" htmlFor="tx-projectId" optional>
            <Controller
              control={control}
              name="projectId"
              render={({ field }) => (
                <Select id="tx-projectId" value={field.value ?? 'none'} onValueChange={(v) => field.onChange(v === 'none' ? undefined : v)} options={[{ value: 'none', label: 'No project' }, ...projects.map((p) => ({ value: p.id, label: p.name }))]} />
              )}
            />
          </Field>
        )}

        {type !== 'transfer' && (
          <div className="flex flex-col gap-3 rounded-2xl bg-ink/[0.035] p-4">
            <Controller
              control={control}
              name="refund"
              render={({ field }) => (
                <label className={cn('flex items-center justify-between gap-3', linkedInvoice && 'opacity-50')}>
                  <span className="flex items-center gap-2.5 text-[13.5px]">
                    <RotateCcw className="size-4 text-muted" />
                    <span>
                      This is a refund
                      <span className="block text-[12px] text-muted">{type === 'expense' ? 'Money returned to you, which reduces spending in this category.' : `Money returned to a ${terms.client.toLowerCase()}, which reduces ${terms.incomeLower}.`}</span>
                    </span>
                  </span>
                  <Switch checked={field.value} onCheckedChange={field.onChange} disabled={!!linkedInvoice} aria-label="Refund" />
                </label>
              )}
            />
            <div className="h-px bg-line" />
            <Controller
              control={control}
              name="recurring"
              render={({ field }) => (
                <label className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2.5 text-[13.5px]">
                    <Repeat className="size-4 text-muted" />
                    <span>
                      Recurring
                      <span className="block text-[12px] text-muted">Shows in the recurring list with its next due date. Future entries are not created automatically.</span>
                    </span>
                  </span>
                  <Switch checked={field.value} onCheckedChange={field.onChange} aria-label="Recurring" />
                </label>
              )}
            />
            {recurring && (
              <div className="grid gap-3 animate-rise sm:grid-cols-2">
                <Field label="Repeats" htmlFor="tx-frequency">
                  <Controller
                    control={control}
                    name="frequency"
                    render={({ field }) => (
                      <Select
                        id="tx-frequency"
                        value={field.value}
                        onValueChange={field.onChange}
                        options={[
                          { value: 'weekly', label: 'Weekly' },
                          { value: 'monthly', label: 'Monthly' },
                          { value: 'quarterly', label: 'Quarterly' },
                          { value: 'yearly', label: 'Yearly' },
                        ]}
                      />
                    )}
                  />
                </Field>
                <Field label="Ends" htmlFor="tx-until" optional error={err('until')}>
                  <Input id="tx-until" type="date" min={addMonths(todayISO(), 0)} {...register('until')} {...aria('until')} />
                </Field>
              </div>
            )}
          </div>
        )}

        <Field label="Tags" htmlFor="tx-tags" optional hint="Separate with commas, e.g. tools, q4">
          <Input id="tx-tags" placeholder="tools, client-billable" {...register('tags')} />
        </Field>
        <Field label="Notes" htmlFor="tx-notes" optional error={err('notes')}>
          <Textarea id="tx-notes" rows={2} placeholder="Anything you'll want to remember later" {...register('notes')} {...aria('notes')} />
        </Field>
      </form>
    </DialogContent>
  )
}
