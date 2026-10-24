import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'
import { formatPct } from '@/lib/money'
import { cn } from '@/lib/utils'

/**
 * Change indicator. `goodWhenUp` flips colouring for expenses (up = bad).
 */
export function Trend({ pct, goodWhenUp = true, className, inverse, label }: { pct: number | null; goodWhenUp?: boolean; className?: string; inverse?: boolean; label?: string }) {
  if (pct === null) return <span className={cn('text-[12px] text-subtle', className)}>No prior data</span>
  const flat = Math.abs(pct) < 0.5
  const up = pct > 0
  const good = flat ? null : up === goodWhenUp
  const Icon = flat ? Minus : up ? ArrowUpRight : ArrowDownRight
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center gap-0.5 rounded-full pl-1.5 pr-2 text-[12px] font-medium num',
        good === null && (inverse ? 'bg-white/10 text-white/80' : 'bg-ink/[0.06] text-ink-3'),
        good === true && (inverse ? 'bg-sun text-ink' : 'bg-gain-soft text-gain'),
        good === false && (inverse ? 'bg-white/15 text-white' : 'bg-loss-soft text-loss'),
        className,
      )}
      title={label}
    >
      <Icon className="size-3.5" strokeWidth={2.2} />
      {formatPct(pct)}
      {label && <span className="sr-only"> {label}</span>}
    </span>
  )
}
