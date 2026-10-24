import type { Currency, NumberLocale } from '@/data/types'

export const CURRENCIES: Record<Currency, { symbol: string; name: string; defaultLocale: NumberLocale }> = {
  INR: { symbol: '₹', name: 'Indian Rupee', defaultLocale: 'en-IN' },
  USD: { symbol: '$', name: 'US Dollar', defaultLocale: 'en-US' },
  EUR: { symbol: '€', name: 'Euro', defaultLocale: 'de-DE' },
  GBP: { symbol: '£', name: 'British Pound', defaultLocale: 'en-GB' },
}

export const LOCALES: { value: NumberLocale; label: string; sample: string }[] = [
  { value: 'en-IN', label: 'Indian (lakh, crore)', sample: '12,34,567.89' },
  { value: 'en-US', label: 'International', sample: '1,234,567.89' },
  { value: 'en-GB', label: 'British', sample: '1,234,567.89' },
  { value: 'de-DE', label: 'European', sample: '1.234.567,89' },
]

const fmtCache = new Map<string, Intl.NumberFormat>()
function nf(locale: string, opts: Intl.NumberFormatOptions) {
  const key = locale + JSON.stringify(opts)
  let f = fmtCache.get(key)
  if (!f) {
    f = new Intl.NumberFormat(locale, opts)
    fmtCache.set(key, f)
  }
  return f
}

export interface MoneyFormatOptions {
  /** Drop paise/cents when the value is a whole number. Default: true. */
  trimZeros?: boolean
  /** Always show decimals. */
  decimals?: boolean
  /** Compact notation: ₹1.2L / $1.2M. */
  compact?: boolean
  /** Prefix + for positive values. */
  signed?: boolean
}

/**
 * Format an integer minor-unit amount. The division by 100 happens only at the
 * display boundary, so stored values never accumulate float error.
 */
export function formatMoney(
  minor: number,
  currency: Currency,
  locale: NumberLocale,
  opts: MoneyFormatOptions = {},
): string {
  const { trimZeros = true, decimals = false, compact = false, signed = false } = opts
  const major = minor / 100
  const sign = minor < 0 ? '−' : signed && minor > 0 ? '+' : ''
  const abs = Math.abs(major)
  const symbol = CURRENCIES[currency].symbol

  if (compact && abs >= 1000) {
    return sign + symbol + compactNumber(abs, locale, currency)
  }
  const whole = Number.isInteger(abs)
  const digits = decimals || !(trimZeros && whole) ? 2 : 0
  const body = nf(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(abs)
  return sign + symbol + body
}

function compactNumber(abs: number, locale: NumberLocale, currency: Currency) {
  if (locale === 'en-IN' && currency === 'INR') {
    if (abs >= 1e7) return trim(abs / 1e7) + 'Cr'
    if (abs >= 1e5) return trim(abs / 1e5) + 'L'
    return trim(abs / 1e3) + 'K'
  }
  return nf(locale, { notation: 'compact', maximumFractionDigits: 1 }).format(abs)
}
function trim(n: number) {
  return (Math.round(n * 10) / 10).toString()
}

/** Split for display, so numerals and the symbol can be styled separately. */
export function moneyParts(minor: number, currency: Currency, locale: NumberLocale) {
  const abs = Math.abs(minor)
  const major = Math.trunc(abs / 100)
  const frac = abs % 100
  return {
    negative: minor < 0,
    symbol: CURRENCIES[currency].symbol,
    whole: nf(locale, { maximumFractionDigits: 0 }).format(major),
    fraction: frac === 0 ? '' : (locale === 'de-DE' ? ',' : '.') + String(frac).padStart(2, '0'),
  }
}

/**
 * Parse user input into minor units using string arithmetic (no float multiply).
 * Accepts "1,250.5", "1250", "₹ 1,250.50". Returns null for invalid input.
 */
export function parseMoney(input: string | number | undefined | null): number | null {
  if (input === undefined || input === null) return null
  let s = String(input).trim().replace(/[₹$€£\s,]/g, '')
  if (s === '') return null
  if (!/^-?\d*(\.\d{0,2})?$/.test(s)) return null
  const neg = s.startsWith('-')
  if (neg) s = s.slice(1)
  const [w = '0', f = ''] = s.split('.')
  if (w === '' && f === '') return null
  const minor = Number(w || '0') * 100 + Number((f + '00').slice(0, 2))
  if (!Number.isSafeInteger(minor)) return null
  return neg ? -minor : minor
}

/** Minor → plain editable string, e.g. 125050 → "1250.50". */
export function toInputString(minor: number): string {
  const neg = minor < 0
  const abs = Math.abs(minor)
  const s = `${Math.trunc(abs / 100)}${abs % 100 ? '.' + String(abs % 100).padStart(2, '0') : ''}`
  return neg ? '-' + s : s
}

/** Integer-safe percent of a minor amount, rounded half-up to the nearest minor unit. */
export function percentOf(minor: number, percent: number): number {
  // percent may have 2 decimals → scale to integer basis points
  const bp = Math.round(percent * 100)
  return Math.round((minor * bp) / 10000)
}

export function sum(values: number[]): number {
  let t = 0
  for (const v of values) t += v
  return t
}

/** Safe percentage change; returns null when the base is zero. */
export function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null
  return ((current - previous) / Math.abs(previous)) * 100
}

export function formatPct(p: number | null, digits = 1): string {
  if (p === null || !Number.isFinite(p)) return '—'
  const r = Math.abs(p) < 0.05 ? 0 : p
  return `${r > 0 ? '+' : r < 0 ? '−' : ''}${Math.abs(r).toFixed(digits)}%`
}
