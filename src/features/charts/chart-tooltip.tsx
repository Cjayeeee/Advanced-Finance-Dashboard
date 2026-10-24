import { useFormat } from '@/hooks/use-format'

export interface TooltipRow {
  label: string
  value: number
  color: string
  hatch?: boolean
}

export function ChartTooltipCard({ title, rows, footer }: { title: string; rows: TooltipRow[]; footer?: React.ReactNode }) {
  const { money } = useFormat()
  return (
    <div className="min-w-48 rounded-2xl bg-ink px-3.5 py-3 text-white shadow-[var(--shadow-ink)]">
      <p className="mb-2 text-[12px] text-white/60">{title}</p>
      <ul className="flex flex-col gap-1.5">
        {rows.map((r) => (
          <li key={r.label} className="flex items-center gap-2 text-[13px]">
            <span className="size-2.5 rounded-full" style={{ background: r.color }} />
            <span className="text-white/75">{r.label}</span>
            <span className="ml-auto pl-4 font-medium num">{money(r.value)}</span>
          </li>
        ))}
      </ul>
      {footer && <div className="mt-2 border-t border-white/10 pt-2 text-[12.5px]">{footer}</div>}
    </div>
  )
}
