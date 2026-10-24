import { useState } from 'react'
import { toast } from 'sonner'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/input'
import { Segmented } from '@/components/ui/segmented'
import { CategoryIcon, ICONS } from '@/components/category-icon'
import { CATEGORY_COLORS, CATEGORY_ICONS } from '@/data/defaults'
import type { Category, CategoryKind } from '@/data/types'
import { useActiveWorkspace } from '@/store/app-store'
import { uid } from '@/lib/id'
import { cn } from '@/lib/utils'

export function CategoryDialog({ open, onOpenChange, editing, defaultKind = 'expense' }: { open: boolean; onOpenChange: (v: boolean) => void; editing?: Category | null; defaultKind?: CategoryKind }) {
  return <Dialog open={open} onOpenChange={onOpenChange}>{open && <CategoryForm editing={editing ?? null} defaultKind={defaultKind} onDone={() => onOpenChange(false)} />}</Dialog>
}

function CategoryForm({ editing, defaultKind, onDone }: { editing: Category | null; defaultKind: CategoryKind; onDone: () => void }) {
  const { data, actions } = useActiveWorkspace()
  const [name, setName] = useState(editing?.name ?? '')
  const [kind, setKind] = useState<CategoryKind>(editing?.kind ?? defaultKind)
  const [color, setColor] = useState(editing?.color ?? CATEGORY_COLORS[2])
  const [icon, setIcon] = useState(editing?.icon ?? 'circle-ellipsis')
  const [touched, setTouched] = useState(false)
  const dup = data.categories.some((c) => c.id !== editing?.id && c.kind === kind && c.name.trim().toLowerCase() === name.trim().toLowerCase())
  const error = !name.trim() ? 'Name the category' : name.length > 40 ? 'Keep it under 40 characters' : dup ? 'A category with this name already exists' : undefined
  const inUse = editing ? data.transactions.some((t) => t.categoryId === editing.id) : false

  const save = () => {
    setTouched(true)
    if (error) return
    actions.saveCategory({ id: editing?.id ?? uid('cat'), name: name.trim(), kind, color, icon, system: editing?.system })
    toast.success(editing ? 'Category updated' : 'Category created')
    onDone()
  }

  return (
    <DialogContent
      title={editing ? 'Edit category' : 'New category'}
      description="Categories are shared by transactions, budgets and reports."
      footer={
        <>
          <Button variant="ghost" onClick={onDone}>
            Cancel
          </Button>
          <Button onClick={save}>{editing ? 'Save' : 'Create category'}</Button>
        </>
      }
    >
      <form
        className="flex flex-col gap-5"
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          save()
        }}
      >
        <div className="flex items-center gap-4 rounded-2xl bg-ink/[0.035] p-4">
          <CategoryIcon icon={icon} color={color} size="lg" />
          <div>
            <p className="font-medium">{name || 'Category name'}</p>
            <p className="text-[12px] capitalize text-muted">{kind}</p>
          </div>
        </div>
        <Segmented label="Kind" value={kind} onChange={(v) => !inUse && setKind(v)} options={[{ value: 'expense', label: 'Expense', disabled: inUse && kind !== 'expense' }, { value: 'income', label: 'Income', disabled: inUse && kind !== 'income' }]} />
        <Field label="Name" htmlFor="cat-name" error={touched ? error : undefined}>
          <Input id="cat-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} aria-invalid={(touched && !!error) || undefined} />
        </Field>
        <fieldset>
          <legend className="mb-2 text-[13px] font-medium text-ink-3">Colour</legend>
          <div className="flex flex-wrap gap-2">
            {CATEGORY_COLORS.map((c) => (
              <button key={c} type="button" onClick={() => setColor(c)} className={cn('size-9 rounded-full ring-offset-2 ring-offset-paper transition', color === c ? 'ring-2 ring-ink' : 'ring-1 ring-line')} style={{ backgroundColor: c }} aria-label={`Colour ${c}`} aria-pressed={color === c} />
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="mb-2 text-[13px] font-medium text-ink-3">Icon</legend>
          <div className="grid grid-cols-6 gap-2 sm:grid-cols-9">
            {CATEGORY_ICONS.map((i) => {
              const I = ICONS[i]
              return (
                <button key={i} type="button" onClick={() => setIcon(i)} className={cn('grid aspect-square place-items-center rounded-2xl transition', icon === i ? 'bg-ink text-sun' : 'bg-white/70 text-ink-3 ring-1 ring-line hover:bg-white')} aria-label={i.replace(/-/g, ' ')} aria-pressed={icon === i}>
                  <I className="size-[18px]" />
                </button>
              )
            })}
          </div>
        </fieldset>
      </form>
    </DialogContent>
  )
}
