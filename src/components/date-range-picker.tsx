import { useState } from 'react'
import { CalendarDays, Check, ChevronDown } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/input'
import { useRange } from '@/store/range'
import { formatRange, isValidISO, PRESET_LABELS, type RangePreset } from '@/lib/dates'
import { cn } from '@/lib/utils'

const PRESETS: RangePreset[] = ['this-month', 'last-month', 'last-3-months', 'last-6-months', 'this-year', 'last-12-months', 'all-time']

export function DateRangePicker({ className, compact }: { className?: string; compact?: boolean }) {
  const { preset, range, setPreset, setCustom } = useRange()
  const [open, setOpen] = useState(false)
  const [start, setStart] = useState(range.start)
  const [end, setEnd] = useState(range.end)
  const invalid = !isValidISO(start) || !isValidISO(end) || start > end

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (o) {
          setStart(range.start)
          setEnd(range.end)
        }
      }}
    >
      <PopoverTrigger asChild>
        <button
          className={cn(
            'inline-flex h-10 items-center gap-2 rounded-full bg-white/80 pl-3.5 pr-3 text-[13px] font-medium text-ink ring-1 ring-line shadow-[0_1px_2px_rgb(22_22_21/0.05)] transition hover:bg-white',
            className,
          )}
          aria-label={`Reporting period: ${PRESET_LABELS[preset]}, ${formatRange(range)}`}
        >
          <CalendarDays className="size-4 text-muted" />
          <span className={cn(compact && 'max-sm:hidden')}>{preset === 'custom' ? formatRange(range) : PRESET_LABELS[preset]}</span>
          <ChevronDown className="size-3.5 text-muted" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(340px,calc(100vw-24px))] p-2">
        <p className="eyebrow px-3 pt-2 pb-1.5">Reporting period</p>
        <ul className="grid grid-cols-2 gap-1">
          {PRESETS.map((p) => (
            <li key={p}>
              <button
                onClick={() => {
                  setPreset(p)
                  setOpen(false)
                }}
                className={cn('flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-[13px] transition hover:bg-ink/5', preset === p && 'bg-ink text-white hover:bg-ink')}
              >
                {PRESET_LABELS[p]}
                {preset === p && <Check className="size-3.5 text-sun" />}
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-2 rounded-2xl bg-ink/[0.035] p-3">
          <p className="mb-2 text-[12.5px] font-medium text-ink-3">Custom range</p>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor="range-start" className="text-[11.5px] text-muted">
                From
              </Label>
              <Input id="range-start" type="date" value={start} max={end} onChange={(e) => setStart(e.target.value)} className="h-9 px-2.5 text-[13px]" />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="range-end" className="text-[11.5px] text-muted">
                To
              </Label>
              <Input id="range-end" type="date" value={end} min={start} onChange={(e) => setEnd(e.target.value)} className="h-9 px-2.5 text-[13px]" />
            </div>
          </div>
          {invalid && <p className="mt-2 text-[12px] text-loss">Choose a valid start date on or before the end date.</p>}
          <Button
            size="sm"
            className="mt-3 w-full"
            disabled={invalid}
            onClick={() => {
              setCustom({ start, end })
              setOpen(false)
            }}
          >
            Apply custom range
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
