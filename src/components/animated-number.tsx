import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from '@/hooks/use-media'

/** Tweens between integer values; renders via a formatter so currency formatting stays exact at rest. */
export function AnimatedNumber({ value, format, duration = 650, className, label }: { value: number; format: (n: number) => string; duration?: number; className?: string; label?: string }) {
  const reduced = useReducedMotion()
  const [display, setDisplay] = useState(value)
  const from = useRef(value)
  const raf = useRef(0)

  useEffect(() => {
    if (reduced) {
      setDisplay(value)
      from.current = value
      return
    }
    const start = performance.now()
    const a = from.current
    const b = value
    if (a === b) return
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      const e = 1 - Math.pow(1 - t, 4)
      const v = t === 1 ? b : Math.round(a + (b - a) * e)
      setDisplay(v)
      if (t < 1) raf.current = requestAnimationFrame(tick)
      else from.current = b
    }
    raf.current = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf.current)
      from.current = b
    }
  }, [value, duration, reduced])

  return (
    <span className={className} role="text" aria-label={label ?? format(value)}>
      <span aria-hidden>{format(display)}</span>
    </span>
  )
}
