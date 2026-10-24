import { useState } from 'react'
import { Search, SlidersHorizontal, X } from 'lucide-react'
import { useActiveWorkspace } from '@/store/app-store'
import { useTerms } from '@/hooks/use-terms'
import { useFormat } from '@/hooks/use-format'
import { Select } from '@/components/ui/select'
import { Segmented } from '@/components/ui/segmented'
import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { activeFilterCount, EMPTY_FILTER, type TxFilter } from '@/lib/filters'
import { parseMoney } from '@/lib/money'
import { cn } from '@/lib/utils'

export function FilterBar({ filter, onChange, lockType, className }: { filter: TxFilter; onChange: (f: TxFilter) => void; lockType?: 'income' | 'expense'; className?: string }) {
  const { data } = useActiveWorkspace()
  const terms = useTerms()
  const { symbol } = useFormat()
  const [moreOpen, setMoreOpen] = useState(false)
  const set = (p: Partial<TxFilter>) => onChange({ ...filter, ...p })
  const kind = lockType ?? (filter.type === 'income' || filter.type === 'expense' ? filter.type : null)
  const cats = data.categories.filter((c) => !kind || c.kind === kind)
  const count = activeFilterCount({ ...filter, type: lockType ? 'all' : filter.type })
  const advCount = [filter.accountId, filter.clientId, filter.min, filter.max].filter(Boolean).length
  const minBad = filter.min !== '' && parseMoney(filter.min) === null
  const maxBad = filter.max !== '' && parseMoney(filter.max) === null

  return (
    <div className={cn('flex flex-col gap-2 lg:flex-row lg:items-center', className)} role="search" aria-label="Filter transactions">
      <label className="relative min-w-0 flex-1 lg:max-w-80">
        <span className="sr-only">Search</span>
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
        <input
          value={filter.q}
          onChange={(e) => set({ q: e.target.value })}
          placeholder="Search description, notes, tags"
          className="h-10 w-full rounded-full bg-white/80 pl-10 pr-9 text-[13.5px] ring-1 ring-line outline-none transition focus:bg-white focus:ring-2 focus:ring-ink"
        />
        {filter.q && (
          <button onClick={() => set({ q: '' })} className="absolute right-2 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-full text-muted hover:bg-ink/5" aria-label="Clear search">
            <X className="size-3.5" />
          </button>
        )}
      </label>
      <div className="flex flex-wrap items-center gap-2">
        {!lockType && (
          <Segmented
            label="Type"
            size="sm"
            value={filter.type}
            onChange={(v) => set({ type: v, categoryId: '' })}
            options={[
              { value: 'all', label: 'All' },
              { value: 'income', label: terms.income },
              { value: 'expense', label: 'Expenses' },
              { value: 'transfer', label: 'Transfers' },
            ]}
          />
        )}
        <Select
          size="sm"
          aria-label="Category"
          className="w-auto min-w-40"
          value={filter.categoryId || 'all'}
          onValueChange={(v) => set({ categoryId: v === 'all' ? '' : v })}
          options={[{ value: 'all', label: 'All categories' }, ...cats.map((c) => ({ value: c.id, label: c.name }))]}
        />
        <Popover open={moreOpen} onOpenChange={setMoreOpen}>
          <PopoverTrigger asChild>
            <Button variant="secondary" size="sm" className="h-9">
              <SlidersHorizontal /> More filters
              {advCount > 0 && <span className="grid size-5 place-items-center rounded-full bg-ink text-[10.5px] text-white">{advCount}</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[min(340px,calc(100vw-24px))]">
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="f-account">Account or payment method</Label>
                <Select id="f-account" value={filter.accountId || 'all'} onValueChange={(v) => set({ accountId: v === 'all' ? '' : v })} options={[{ value: 'all', label: 'All accounts' }, ...data.accounts.map((a) => ({ value: a.id, label: a.name }))]} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="f-client">{terms.client}</Label>
                <Select id="f-client" value={filter.clientId || 'all'} onValueChange={(v) => set({ clientId: v === 'all' ? '' : v })} options={[{ value: 'all', label: `All ${terms.clients.toLowerCase()}` }, ...data.clients.map((c) => ({ value: c.id, label: c.name }))]} />
              </div>
              <div>
                <Label>Amount range ({symbol})</Label>
                <div className="mt-1.5 grid grid-cols-2 gap-2">
                  <Input aria-label="Minimum amount" inputMode="decimal" placeholder="Min" value={filter.min} onChange={(e) => set({ min: e.target.value })} aria-invalid={minBad || undefined} className="h-10" />
                  <Input aria-label="Maximum amount" inputMode="decimal" placeholder="Max" value={filter.max} onChange={(e) => set({ max: e.target.value })} aria-invalid={maxBad || undefined} className="h-10" />
                </div>
                {(minBad || maxBad) && <p className="mt-1 text-[12px] text-loss">Use numbers only.</p>}
              </div>
              <Button variant="ghost" size="sm" onClick={() => set({ accountId: '', clientId: '', min: '', max: '' })}>
                Reset these
              </Button>
            </div>
          </PopoverContent>
        </Popover>
        {count > 0 && (
          <Button variant="ghost" size="sm" onClick={() => onChange({ ...EMPTY_FILTER, type: lockType ?? 'all' })}>
            <X /> Clear {count}
          </Button>
        )}
      </div>
    </div>
  )
}
