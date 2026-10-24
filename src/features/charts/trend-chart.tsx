import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell } from 'recharts'
import { useFormat } from '@/hooks/use-format'
import { useReducedMotion } from '@/hooks/use-media'
import { Lollipop } from './lollipop'

export interface TrendPoint {
  key: string
  label: string
  fullLabel: string
  value: number
  future?: boolean
}

/** Single-series monthly lollipop trend; highlights the latest/selected bar in sunflower like the reference. */
export function TrendChart({ points, color = '#161615', highlight = '#f5cb3c', target, targetLabel = 'Target', height = 240, seriesLabel }: { points: TrendPoint[]; color?: string; highlight?: string; target?: number; targetLabel?: string; height?: number; seriesLabel: string }) {
  const { compact, money } = useFormat()
  const reduced = useReducedMotion()
  const data = points.map((p) => ({ ...p, v: p.value / 100 }))
  const lastReal = [...points].reverse().findIndex((p) => !p.future)
  const hi = lastReal >= 0 ? points.length - 1 - lastReal : -1
  const avg = points.filter((p) => !p.future).reduce((s, p) => s + p.value, 0) / Math.max(1, points.filter((p) => !p.future).length)
  return (
    <figure>
      <div style={{ height }} className="-ml-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 22, right: 6, left: 0, bottom: 0 }} barCategoryGap="30%">
            <CartesianGrid vertical={false} stroke="rgb(22 22 21 / 0.07)" strokeDasharray="3 5" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11.5, fill: '#77756f' }} dy={6} interval={0} />
            <YAxis tickLine={false} axisLine={false} width={56} tick={{ fontSize: 11.5, fill: '#a3a19a' }} tickFormatter={(v: number) => compact(v * 100)} />
            {target ? <ReferenceLine y={target / 100} stroke="#e2b41c" strokeDasharray="5 4" label={{ value: targetLabel, position: 'insideTopRight', fontSize: 11, fill: '#77756f' }} /> : null}
            <Tooltip
              cursor={{ fill: 'rgb(22 22 21 / 0.04)', radius: 12 }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const p = payload[0].payload as (typeof data)[number]
                return (
                  <div className="rounded-2xl bg-ink px-3.5 py-2.5 text-white shadow-[var(--shadow-ink)]">
                    <p className="text-[12px] text-white/60">{p.fullLabel}</p>
                    <p className="mt-1 text-[14px] font-medium num">
                      {seriesLabel}: {money(p.value)}
                    </p>
                    {target ? <p className="text-[12px] text-white/60 num">{Math.round((p.value / target) * 100)}% of {targetLabel.toLowerCase()}</p> : null}
                  </div>
                )
              }}
            />
            <Bar dataKey="v" shape={<Lollipop stem={8} />} isAnimationActive={!reduced} animationDuration={650}>
              {data.map((p, i) => (
                <Cell key={p.key} fill={i === hi ? highlight : color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="sr-only">
        {seriesLabel} by month. Average {money(Math.round(avg))}. {points.map((p) => `${p.fullLabel}: ${money(p.value)}`).join('; ')}
      </figcaption>
    </figure>
  )
}
