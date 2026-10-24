import { useMemo, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { ArrowLeft, Eye, GripVertical, Plus, Send, Trash2, UserPlus } from 'lucide-react'
import { useActiveWorkspace, useApp } from '@/store/app-store'
import { useFormat } from '@/hooks/use-format'
import { useTerms } from '@/hooks/use-terms'
import { useMedia } from '@/hooks/use-media'
import { Button } from '@/components/ui/button'
import { Field, Input, Textarea, fieldBase } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Segmented } from '@/components/ui/segmented'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { InvoicePaper } from '@/features/invoices/invoice-paper'
import { ClientDialog } from '@/features/clients/client-dialog'
import { nextInvoiceNumber } from '@/features/invoices/utils'
import type { Invoice } from '@/data/types'
import { addDays, isValidISO, todayISO } from '@/lib/dates'
import { invoiceAmounts, invoicePaid, lineTotal } from '@/lib/finance'
import { parseMoney, toInputString } from '@/lib/money'
import { uid } from '@/lib/id'
import { cn } from '@/lib/utils'

const qtyOk = (v: string) => /^\d+(\.\d{1,2})?$/.test(v.trim()) && Number(v) > 0 && Number(v) <= 100000
const pctOk = (v: string) => /^\d+(\.\d{1,2})?$/.test(v.trim()) && Number(v) >= 0 && Number(v) <= 100

const schema = z
  .object({
    clientId: z.string().min(1, 'Choose who this invoice is for'),
    projectId: z.string().optional(),
    number: z.string().trim().min(1, 'Invoice number is required').max(30),
    issueDate: z.string().refine(isValidISO, 'Pick a valid date'),
    dueDate: z.string().refine(isValidISO, 'Pick a valid date'),
    lines: z
      .array(
        z.object({
          id: z.string(),
          description: z.string().trim().min(1, 'Describe the item').max(200),
          quantity: z.string().refine(qtyOk, 'Qty > 0, up to 2 decimals'),
          rate: z
            .string()
            .refine((v) => parseMoney(v) !== null, 'Enter a valid rate')
            .refine((v) => (parseMoney(v) ?? -1) >= 0, 'Rate cannot be negative'),
        }),
      )
      .min(1, 'Add at least one line item'),
    discountType: z.enum(['percent', 'fixed']),
    discountValue: z.string(),
    taxRate: z.string().refine((v) => v.trim() === '' || pctOk(v), 'Use 0–100, up to 2 decimals'),
    taxLabel: z.string().max(40),
    notes: z.string().max(1000),
    terms: z.string().max(1000),
  })
  .superRefine((v, ctx) => {
    if (isValidISO(v.issueDate) && isValidISO(v.dueDate) && v.dueDate < v.issueDate) ctx.addIssue({ code: 'custom', path: ['dueDate'], message: 'Due date must be on or after the issue date' })
    if (v.discountValue.trim() !== '') {
      if (v.discountType === 'percent' && !pctOk(v.discountValue)) ctx.addIssue({ code: 'custom', path: ['discountValue'], message: 'Use 0–100%' })
      if (v.discountType === 'fixed' && (parseMoney(v.discountValue) ?? -1) < 0) ctx.addIssue({ code: 'custom', path: ['discountValue'], message: 'Enter a valid amount' })
    }
  })

type Values = z.infer<typeof schema>

function toInvoice(v: Partial<Values>, base: Partial<Invoice>): Invoice {
  const disc = v.discountType === 'fixed' ? (parseMoney(v.discountValue ?? '') ?? 0) : Number(v.discountValue) || 0
  return {
    id: base.id ?? 'preview',
    number: v.number ?? '',
    clientId: v.clientId ?? '',
    projectId: v.projectId || undefined,
    issueDate: isValidISO(v.issueDate ?? '') ? v.issueDate! : todayISO(),
    dueDate: isValidISO(v.dueDate ?? '') ? v.dueDate! : todayISO(),
    lines: (v.lines ?? []).map((l) => ({ id: l.id, description: l.description ?? '', quantity: qtyOk(l.quantity ?? '') ? Number(l.quantity) : 0, rate: Math.max(0, parseMoney(l.rate ?? '') ?? 0) })),
    discount: { type: v.discountType ?? 'percent', value: Math.max(0, disc) },
    taxRate: pctOk(v.taxRate ?? '') ? Number(v.taxRate) : 0,
    taxLabel: v.taxLabel ?? '',
    notes: v.notes?.trim() || undefined,
    terms: v.terms?.trim() || undefined,
    state: base.state ?? 'draft',
    issuedAt: base.issuedAt,
    createdAt: base.createdAt ?? new Date().toISOString(),
  }
}

export default function InvoiceEditorPage() {
  const { id } = useParams()
  const { data } = useActiveWorkspace()
  const existing = id ? data.invoices.find((i) => i.id === id) : undefined
  if (id && !existing) return <Navigate to="/invoices" replace />
  return <Editor key={id ?? 'new'} existing={existing} />
}

function Editor({ existing }: { existing?: Invoice }) {
  const { ws, data, actions } = useActiveWorkspace()
  const { user } = useApp()
  const { money, symbol } = useFormat()
  const terms = useTerms()
  const navigate = useNavigate()
  const wide = useMedia('(min-width: 1280px)')
  const [clientOpen, setClientOpen] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const paid = existing ? invoicePaid(existing.id, data.transactions) : 0

  const defaults: Values = existing
    ? {
        clientId: existing.clientId,
        projectId: existing.projectId,
        number: existing.number,
        issueDate: existing.issueDate,
        dueDate: existing.dueDate,
        lines: existing.lines.map((l) => ({ id: l.id, description: l.description, quantity: String(l.quantity), rate: toInputString(l.rate) })),
        discountType: existing.discount.type,
        discountValue: existing.discount.value ? (existing.discount.type === 'fixed' ? toInputString(existing.discount.value) : String(existing.discount.value)) : '',
        taxRate: String(existing.taxRate),
        taxLabel: existing.taxLabel,
        notes: existing.notes ?? '',
        terms: existing.terms ?? '',
      }
    : {
        clientId: '',
        projectId: undefined,
        number: nextInvoiceNumber(ws.invoicePrefix, data.invoices),
        issueDate: todayISO(),
        dueDate: addDays(todayISO(), 15),
        lines: [{ id: uid('l'), description: '', quantity: '1', rate: '' }],
        discountType: 'percent',
        discountValue: '',
        taxRate: String(ws.defaultTaxRate),
        taxLabel: ws.defaultTaxLabel,
        notes: '',
        terms: ws.defaultTerms,
      }

  const { register, control, handleSubmit, setValue, getValues, setError, formState } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: defaults, mode: 'onTouched' })
  const { fields, append, remove } = useFieldArray({ control, name: 'lines' })
  const watched = useWatch({ control }) as Partial<Values>
  const preview = useMemo(() => toInvoice(watched, existing ?? {}), [watched, existing])
  const amounts = invoiceAmounts(preview)
  const client = data.clients.find((c) => c.id === watched.clientId)
  const projects = data.projects.filter((p) => p.clientId === watched.clientId)
  const e = formState.errors

  const save = (state: Invoice['state']) =>
    handleSubmit((v) => {
      if (data.invoices.some((i) => i.id !== existing?.id && i.number.trim().toLowerCase() === v.number.trim().toLowerCase())) {
        setError('number', { message: 'Another invoice already uses this number' })
        return
      }
      const inv = toInvoice(v, existing ?? {})
      const total = invoiceAmounts(inv).total
      if (total <= 0) {
        toast.error('Invoice total must be greater than zero')
        return
      }
      if (paid > total) {
        toast.error(`Total can't be less than the ${money(paid)} already paid`, { description: 'Remove or edit payments first.' })
        return
      }
      const final: Invoice = { ...inv, id: existing?.id ?? uid('inv'), state, issuedAt: state === 'issued' ? (existing?.issuedAt ?? todayISO()) : undefined, createdAt: existing?.createdAt ?? new Date().toISOString() }
      actions.saveInvoice(final)
      toast.success(existing ? 'Invoice saved' : state === 'draft' ? 'Draft saved' : 'Invoice marked as sent', {
        description: state === 'issued' && existing?.state !== 'issued' ? 'Download the PDF and send it to your client. Monetra does not email invoices.' : undefined,
      })
      navigate(`/invoices/${final.id}`)
    })()

  const setTermsDays = (days: number) => {
    const issue = getValues('issueDate')
    if (isValidISO(issue)) setValue('dueDate', addDays(issue, days), { shouldValidate: true })
  }

  const paper = <InvoicePaper invoice={preview} client={client} ws={ws} fromName={user?.name ?? ws.name} fromEmail={ws.businessEmail ?? user?.email} paid={paid} />

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link to={existing ? `/invoices/${existing.id}` : '/invoices'} className="mb-3 inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-ink">
            <ArrowLeft className="size-3.5" /> {existing ? existing.number : 'Invoices'}
          </Link>
          <h1 className="font-display text-[34px] font-light tracking-[-0.03em] sm:text-[44px]">{existing ? 'Edit invoice' : 'New invoice'}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {!wide && (
            <Button variant="secondary" onClick={() => setPreviewOpen(true)}>
              <Eye /> Preview
            </Button>
          )}
          {(!existing || existing.state === 'draft') && (
            <Button variant="secondary" onClick={() => save('draft')}>
              Save draft
            </Button>
          )}
          <Button onClick={() => save(existing && existing.state !== 'draft' ? existing.state : 'issued')}>
            {existing && existing.state !== 'draft' ? (
              'Save changes'
            ) : (
              <>
                <Send /> Save & mark as sent
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] [&>*]:min-w-0">
        <form noValidate className="flex flex-col gap-4" onSubmit={(ev) => ev.preventDefault()}>
          <section className="tile p-5 sm:p-6" aria-labelledby="inv-who">
            <h2 id="inv-who" className="mb-4 font-display text-[18px]">
              Details
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={terms.client} htmlFor="inv-client" error={e.clientId?.message} className="sm:col-span-2">
                <div className="flex gap-2">
                  <Controller
                    control={control}
                    name="clientId"
                    render={({ field }) => (
                      <Select
                        id="inv-client"
                        className="flex-1"
                        value={field.value}
                        onValueChange={(v) => {
                          field.onChange(v)
                          setValue('projectId', undefined)
                        }}
                        invalid={!!e.clientId}
                        placeholder={data.clients.length ? `Choose ${terms.client.toLowerCase()}` : `No ${terms.clients.toLowerCase()} yet`}
                        options={data.clients.map((c) => ({ value: c.id, label: c.name }))}
                      />
                    )}
                  />
                  <Button type="button" variant="secondary" className="h-11" onClick={() => setClientOpen(true)}>
                    <UserPlus /> <span className="max-sm:hidden">New</span>
                  </Button>
                </div>
              </Field>
              {projects.length > 0 && (
                <Field label="Project" htmlFor="inv-project" optional className="sm:col-span-2">
                  <Controller control={control} name="projectId" render={({ field }) => <Select id="inv-project" value={field.value ?? 'none'} onValueChange={(v) => field.onChange(v === 'none' ? undefined : v)} options={[{ value: 'none', label: 'No project' }, ...projects.map((p) => ({ value: p.id, label: p.name }))]} />} />
                </Field>
              )}
              <Field label="Invoice number" htmlFor="inv-number" error={e.number?.message}>
                <Input id="inv-number" {...register('number')} aria-invalid={!!e.number || undefined} />
              </Field>
              <Field label="Issue date" htmlFor="inv-issue" error={e.issueDate?.message}>
                <Input id="inv-issue" type="date" {...register('issueDate')} />
              </Field>
              <Field label="Due date" htmlFor="inv-due" error={e.dueDate?.message} className="sm:col-span-2">
                <div className="flex flex-wrap gap-2">
                  <Input id="inv-due" type="date" className="w-auto flex-1" {...register('dueDate')} aria-invalid={!!e.dueDate || undefined} />
                  {[7, 15, 30, 45].map((d) => (
                    <Button key={d} type="button" variant="outline" size="sm" className="h-11" onClick={() => setTermsDays(d)}>
                      Net {d}
                    </Button>
                  ))}
                </div>
              </Field>
            </div>
          </section>

          <section className="tile p-5 sm:p-6" aria-labelledby="inv-lines">
            <div className="mb-3 flex items-center justify-between">
              <h2 id="inv-lines" className="font-display text-[18px]">
                Line items
              </h2>
              <span className="text-[12.5px] text-muted">{fields.length} items</span>
            </div>
            <div className="hidden grid-cols-[1fr_80px_130px_110px_36px] gap-2 px-1 pb-1.5 text-[11.5px] text-muted sm:grid">
              <span className="pl-6">Description</span>
              <span>Qty</span>
              <span>Rate ({symbol})</span>
              <span className="text-right">Amount</span>
              <span />
            </div>
            <ul className="flex flex-col gap-3 sm:gap-2">
              {fields.map((f, i) => {
                const le = e.lines?.[i]
                const l = watched.lines?.[i]
                const amt = lineTotal(qtyOk(l?.quantity ?? '') ? Number(l?.quantity) : 0, Math.max(0, parseMoney(l?.rate ?? '') ?? 0))
                return (
                  <li key={f.id} className="grid grid-cols-[1fr_1fr] gap-2 rounded-2xl bg-ink/[0.025] p-3 sm:grid-cols-[1fr_80px_130px_110px_36px] sm:items-start sm:bg-transparent sm:p-0 animate-rise">
                    <div className="col-span-2 flex items-start gap-1 sm:col-span-1">
                      <GripVertical className="mt-3.5 hidden size-4 shrink-0 text-subtle sm:block" aria-hidden />
                      <div className="flex-1">
                        <input aria-label={`Line ${i + 1} description`} placeholder="e.g. Landing page design" className={cn(fieldBase, 'h-11')} {...register(`lines.${i}.description`)} aria-invalid={!!le?.description || undefined} />
                        {le?.description && <p className="mt-1 text-[12px] text-loss">{le.description.message}</p>}
                      </div>
                    </div>
                    <div>
                      <input aria-label={`Line ${i + 1} quantity`} inputMode="decimal" className={cn(fieldBase, 'h-11 num')} {...register(`lines.${i}.quantity`)} aria-invalid={!!le?.quantity || undefined} />
                      {le?.quantity && <p className="mt-1 text-[12px] text-loss">{le.quantity.message}</p>}
                    </div>
                    <div>
                      <input aria-label={`Line ${i + 1} rate`} inputMode="decimal" placeholder="0.00" className={cn(fieldBase, 'h-11 num')} {...register(`lines.${i}.rate`)} aria-invalid={!!le?.rate || undefined} />
                      {le?.rate && <p className="mt-1 text-[12px] text-loss">{le.rate.message}</p>}
                    </div>
                    <p className="flex h-11 items-center text-[14px] font-medium num sm:justify-end">{money(amt, { decimals: true })}</p>
                    <button type="button" onClick={() => remove(i)} disabled={fields.length === 1} className="grid size-9 place-items-center justify-self-end rounded-full text-muted transition hover:bg-loss-soft hover:text-loss disabled:opacity-30 sm:mt-1" aria-label={`Remove line ${i + 1}`}>
                      <Trash2 className="size-4" />
                    </button>
                  </li>
                )
              })}
            </ul>
            {typeof e.lines?.message === 'string' && <p className="mt-2 text-[12px] text-loss">{e.lines.message}</p>}
            <Button type="button" variant="ghost" size="sm" className="mt-3" onClick={() => append({ id: uid('l'), description: '', quantity: '1', rate: '' })}>
              <Plus /> Add line
            </Button>

            <div className="mt-5 grid gap-4 border-t border-line pt-5 sm:grid-cols-2">
              <div className="flex flex-col gap-4">
                <Field label="Discount" htmlFor="inv-disc" optional error={e.discountValue?.message}>
                  <div className="flex gap-2">
                    <Controller control={control} name="discountType" render={({ field }) => <Segmented label="Discount type" size="sm" className="h-11 shrink-0" value={field.value} onChange={(v) => (field.onChange(v), setValue('discountValue', ''))} options={[{ value: 'percent', label: '%' }, { value: 'fixed', label: symbol }]} />} />
                    <Input id="inv-disc" inputMode="decimal" placeholder="0" {...register('discountValue')} aria-invalid={!!e.discountValue || undefined} />
                  </div>
                </Field>
                <div className="grid grid-cols-[1fr_96px] gap-2">
                  <Field label="Tax label" htmlFor="inv-taxlabel">
                    <Input id="inv-taxlabel" placeholder="GST" {...register('taxLabel')} />
                  </Field>
                  <Field label="Rate %" htmlFor="inv-tax" error={e.taxRate?.message}>
                    <Input id="inv-tax" inputMode="decimal" {...register('taxRate')} aria-invalid={!!e.taxRate || undefined} />
                  </Field>
                </div>
              </div>
              <dl className="flex flex-col gap-2 rounded-2xl bg-ink p-5 text-white">
                <div className="flex justify-between text-[13px] text-white/65">
                  <dt>Subtotal</dt>
                  <dd className="num">{money(amounts.subtotal, { decimals: true })}</dd>
                </div>
                <div className="flex justify-between text-[13px] text-white/65">
                  <dt>Discount</dt>
                  <dd className="num">−{money(amounts.discount, { decimals: true })}</dd>
                </div>
                <div className="flex justify-between text-[13px] text-white/65">
                  <dt>{preview.taxLabel || 'Tax'}</dt>
                  <dd className="num">{money(amounts.tax, { decimals: true })}</dd>
                </div>
                <div className="mt-auto flex items-end justify-between border-t border-white/15 pt-3">
                  <dt className="text-[13px]">Total</dt>
                  <dd className="figure text-[30px] text-sun">{money(amounts.total, { decimals: true })}</dd>
                </div>
                {paid > 0 && <p className="text-[11.5px] text-white/50">{money(paid)} already paid on this invoice</p>}
              </dl>
            </div>
          </section>

          <section className="tile grid gap-4 p-5 sm:grid-cols-2 sm:p-6" aria-label="Notes and terms">
            <Field label="Notes to client" htmlFor="inv-notes" optional>
              <Textarea id="inv-notes" rows={3} placeholder="Thank you for your business!" {...register('notes')} />
            </Field>
            <Field label="Payment terms" htmlFor="inv-terms" optional>
              <Textarea id="inv-terms" rows={3} {...register('terms')} />
            </Field>
          </section>
        </form>

        {wide && (
          <aside className="sticky top-24 self-start" aria-label="Live preview">
            <p className="eyebrow mb-2 flex items-center gap-2">
              <span className="size-1.5 animate-pulse rounded-full bg-sun-deep" /> Live preview
            </p>
            {paper}
          </aside>
        )}
      </div>

      <ClientDialog open={clientOpen} onOpenChange={setClientOpen} onSaved={(c) => setValue('clientId', c.id, { shouldValidate: true })} />
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent title="Preview" className="sm:w-[min(820px,calc(100vw-32px))]">
          {paper}
        </DialogContent>
      </Dialog>
    </>
  )
}
