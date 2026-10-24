import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Field, Input, Textarea } from '@/components/ui/input'
import { useActiveWorkspace } from '@/store/app-store'
import { useTerms } from '@/hooks/use-terms'
import type { Client } from '@/data/types'
import { uid } from '@/lib/id'

const schema = z.object({
  name: z.string().trim().min(1, 'Enter a name').max(80),
  email: z.union([z.literal(''), z.string().trim().email('Enter a valid email')]),
  address: z.string().max(240).optional(),
  taxId: z.string().max(30).optional(),
})

export function ClientDialog({ open, onOpenChange, editing, onSaved }: { open: boolean; onOpenChange: (v: boolean) => void; editing?: Client | null; onSaved?: (c: Client) => void }) {
  return <Dialog open={open} onOpenChange={onOpenChange}>{open && <ClientForm editing={editing ?? null} onDone={(c) => (onOpenChange(false), c && onSaved?.(c))} />}</Dialog>
}

function ClientForm({ editing, onDone }: { editing: Client | null; onDone: (c?: Client) => void }) {
  const { data, actions } = useActiveWorkspace()
  const terms = useTerms()
  const { register, handleSubmit, formState, setError } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { name: editing?.name ?? '', email: editing?.email ?? '', address: editing?.address ?? '', taxId: editing?.taxId ?? '' },
  })
  const e = formState.errors
  return (
    <DialogContent
      title={editing ? `Edit ${terms.client.toLowerCase()}` : `New ${terms.client.toLowerCase()}`}
      description="Details appear on invoices you create."
      footer={
        <>
          <Button variant="ghost" onClick={() => onDone()}>
            Cancel
          </Button>
          <Button type="submit" form="client-form">
            {editing ? 'Save' : `Add ${terms.client.toLowerCase()}`}
          </Button>
        </>
      }
    >
      <form
        id="client-form"
        noValidate
        className="flex flex-col gap-4"
        onSubmit={handleSubmit((v) => {
          if (data.clients.some((c) => c.id !== editing?.id && c.name.toLowerCase() === v.name.trim().toLowerCase())) {
            setError('name', { message: `A ${terms.client.toLowerCase()} with this name already exists` })
            return
          }
          const c: Client = { id: editing?.id ?? uid('cl'), name: v.name.trim(), email: v.email || undefined, address: v.address?.trim() || undefined, taxId: v.taxId?.trim() || undefined }
          actions.saveClient(c)
          toast.success(editing ? `${terms.client} updated` : `${terms.client} added`)
          onDone(c)
        })}
      >
        <Field label="Name" htmlFor="cl-name" error={e.name?.message}>
          <Input id="cl-name" autoFocus {...register('name')} aria-invalid={!!e.name || undefined} />
        </Field>
        <Field label="Billing email" htmlFor="cl-email" optional error={e.email?.message}>
          <Input id="cl-email" type="email" {...register('email')} aria-invalid={!!e.email || undefined} />
        </Field>
        <Field label="Address" htmlFor="cl-address" optional>
          <Textarea id="cl-address" rows={2} {...register('address')} />
        </Field>
        <Field label="Tax ID (GSTIN / VAT)" htmlFor="cl-tax" optional>
          <Input id="cl-tax" {...register('taxId')} />
        </Field>
      </form>
    </DialogContent>
  )
}
