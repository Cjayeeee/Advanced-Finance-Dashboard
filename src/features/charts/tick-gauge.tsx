import { useEffect, useState } from 'react'
import { useReducedMotion } from '@/hooks/use-media'

/**
 * Radial tick gauge — echoes the reference's time-tracker dial.
 * `value` 0..1 (values > 1 shown as over-limit). Optional `projected` adds hatched ticks.
 */
export function TickGauge({ value, projected, size = 200, ticks = 64, label, children, inverse }: { value: number; projected?: number | null; size?: number; ticks?: number; label: string; children?: React.ReactNode; inverse?: boolean }) {
  const reduced = useReducedMotion()
  const [shown, setShown] = useState(reduced ? value : 0)
  useEffect(() => {
    if (reduced) return setShown(value)
    const id = requestAnimationFrame(() => setShown(value))
    return () => cancelAnimationFrame(id)
  }, [value, reduced])

  const r = size / 2
  const outer = r - 4
  const inner = r - 18
  const arcR = r - 30
  const over = value > 1
  const fill = Math.min(1, shown)
  const circumference = 2 * Math.PI * arcR
  const tickColor = inverse ? 'rgb(255 255 255 / 0.22)' : 'rgb(22 22 21 / 0.18)'
  const activeTick = inverse ? '#fff' : '#161615'
  const filled = Math.round(Math.min(1, value) * ticks)
  const proj = projected ? Math.round(Math.min(1, projected) * ticks) : 0

  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }} role="img" aria-label={label}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="absolute inset-0 -rotate-90">
        {Array.from({ length: ticks }, (_, i) => {
          const a = (i / ticks) * Math.PI * 2
          const long = i % 8 === 0
          const r1 = long ? inner - 2 : inner + 2
          const isProj = i >= filled && i < proj
          return (
            <line
              key={i}
              x1={r + Math.cos(a) * r1}
              y1={r + Math.sin(a) * r1}
              x2={r + Math.cos(a) * outer}
              y2={r + Math.sin(a) * outer}
              stroke={i < filled ? activeTick : isProj ? '#e2b41c' : tickColor}
              strokeWidth={long ? 2 : 1.3}
              strokeDasharray={isProj ? '2 2' : undefined}
              strokeLinecap="round"
              style={{ transition: `stroke 0.4s ${i * 6}ms` }}
            />
          )
        })}
        <circle cx={r} cy={r} r={arcR} fill="none" stroke={inverse ? 'rgb(255 255 255 / 0.08)' : 'rgb(22 22 21 / 0.06)'} strokeWidth={10} />
        <circle
          cx={r}
          cy={r}
          r={arcR}
          fill="none"
          stroke={over ? '#b8463a' : '#f5cb3c'}
          strokeWidth={10}
          strokeLinecap="round"
          strokeDasharray={`${circumference * fill} ${circumference}`}
          style={{ transition: 'stroke-dasharray 0.9s var(--ease-out)' }}
        />
      </svg>
      <div className="relative text-center">{children}</div>
    </div>
  )
}
