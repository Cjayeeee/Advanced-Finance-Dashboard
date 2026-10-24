import { moneyParts } from '@/lib/money'
import { useFormat } from '@/hooks/use-format'
import { AnimatedNumber } from './animated-number'
import { cn } from '@/lib/utils'

/** Hero money figure: light numerals, smaller symbol & fraction. */
export function MoneyFigure({ value, className, animate = true, showFraction = false }: { value: number; className?: string; animate?: boolean; showFraction?: boolean }) {
  const { currency, locale, money } = useFormat()
  // Show paise/cents only when the value actually has them, so whole amounts stay clean.
  const frac = showFraction || value % 100 !== 0
  const render = (n: number) => {
    const p = moneyParts(n, currency, locale)
    return `${p.negative ? '−' : ''}${p.symbol}${p.whole}${frac ? p.fraction || (locale === 'de-DE' ? ',00' : '.00') : ''}`
  }
  if (!animate) return <span className={cn('figure', className)} aria-label={money(value)}>{render(value)}</span>
  return <AnimatedNumber value={value} format={render} label={money(value)} className={cn('figure', className)} />
}

/** Inline signed amount for tables. */
export function Amount({ value, kind, className, signed = true }: { value: number; kind: 'in' | 'out' | 'neutral'; className?: string; signed?: boolean }) {
  const { money } = useFormat()
  const abs = Math.abs(value)
  const prefix = !signed || kind === 'neutral' ? '' : kind === 'in' ? '+' : '−'
  return <span className={cn('num whitespace-nowrap font-medium', kind === 'in' && 'text-gain', kind === 'neutral' && 'text-muted', className)}>{prefix + money(abs, { decimals: abs % 100 !== 0 })}</span>
}
