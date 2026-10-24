import { cn } from '@/lib/utils'

/** Pill segmented control (radio group semantics). */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
  size = 'md',
  label,
  inverse,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: React.ReactNode; disabled?: boolean }[]
  className?: string
  size?: 'sm' | 'md'
  label: string
  inverse?: boolean
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn('inline-flex items-center gap-0.5 rounded-full p-1', inverse ? 'bg-white/10' : 'bg-ink/[0.05]', className)}>
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            role="radio"
            aria-checked={active}
            disabled={o.disabled}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => {
              if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
              e.preventDefault()
              const enabled = options.filter((x) => !x.disabled)
              const i = enabled.findIndex((x) => x.value === value)
              const next = enabled[(i + (e.key === 'ArrowRight' ? 1 : enabled.length - 1)) % enabled.length]
              onChange(next.value)
              const parent = e.currentTarget.parentElement
              requestAnimationFrame(() => (parent?.querySelector('[aria-checked=true]') as HTMLElement | null)?.focus())
            }}
            tabIndex={active ? 0 : -1}
            className={cn(
              'rounded-full font-medium transition-all duration-200 ease-[var(--ease-out)] disabled:opacity-35',
              size === 'sm' ? 'h-7 px-3 text-[12.5px]' : 'h-8 px-3.5 text-[13px]',
              active
                ? inverse
                  ? 'bg-white text-ink shadow-sm'
                  : 'bg-ink text-white shadow-[0_4px_12px_-6px_rgb(22_22_21/0.7)]'
                : inverse
                  ? 'text-white/70 hover:text-white'
                  : 'text-muted hover:text-ink',
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
