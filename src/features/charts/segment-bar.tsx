import { cn } from '@/lib/utils'
import { isLight } from '@/components/category-icon'

export interface Segment {
  id: string
  value: number
  color: string
  label: string
  hatch?: boolean
}

/** Horizontal pill segments with share labels above — echoes the reference's onboarding bar. */
export function SegmentBar({ segments, className, height = 40, showLabels = true, minShare = 0.06 }: { segments: Segment[]; className?: string; height?: number; showLabels?: boolean; minShare?: number }) {
  const total = segments.reduce((s, x) => s + Math.max(0, x.value), 0)
  if (total <= 0) return <div className={cn('hatch rounded-full bg-ink/[0.04]', className)} style={{ height }} aria-hidden />
  // Merge tiny segments so labels stay legible
  const main: Segment[] = []
  let rest = 0
  for (const s of segments) {
    if (s.value / total >= minShare || main.length < 2) main.push(s)
    else rest += s.value
  }
  if (rest > 0) main.push({ id: 'rest', value: rest, color: '#d8d2c4', label: 'Other', hatch: true })
  return (
    <div className={cn('w-full', className)}>
      {showLabels && (
        <div className="mb-1.5 flex gap-1.5">
          {main.map((s) => (
            <div key={s.id} className="min-w-0 border-l border-ink/25 pl-1.5 text-[12px] text-muted num" style={{ flex: `${s.value} 1 0` }}>
              {Math.round((s.value / total) * 100)}%
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-1.5" style={{ height }} role="img" aria-label={main.map((s) => `${s.label} ${Math.round((s.value / total) * 100)}%`).join(', ')}>
        {main.map((s, i) => (
          <div
            key={s.id}
            className={cn('min-w-[6px] rounded-full transition-[flex-grow] duration-700 ease-[var(--ease-out)]', s.hatch && 'hatch')}
            style={{ flex: `${s.value} 1 0`, backgroundColor: s.color, animation: `rise 0.5s var(--ease-out) ${i * 60}ms both` }}
            title={s.label}
          >
            <span className={cn('sr-only', isLight(s.color) ? 'text-ink' : 'text-white')}>{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
