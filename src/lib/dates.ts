/** Local-calendar date helpers operating on ISO `YYYY-MM-DD` strings. */

export interface DateRange {
  start: string
  end: string
}

export type RangePreset =
  | 'this-month'
  | 'last-month'
  | 'last-3-months'
  | 'last-6-months'
  | 'this-year'
  | 'last-12-months'
  | 'all-time'
  | 'custom'

export type Granularity = 'day' | 'week' | 'month' | 'year'

export const PRESET_LABELS: Record<RangePreset, string> = {
  'this-month': 'This month',
  'last-month': 'Last month',
  'last-3-months': 'Last 3 months',
  'last-6-months': 'Last 6 months',
  'this-year': 'This year',
  'last-12-months': 'Last 12 months',
  'all-time': 'All time',
  custom: 'Custom range',
}

const pad = (n: number) => String(n).padStart(2, '0')

export function toISO(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function parseISO(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function todayISO(): string {
  return toISO(new Date())
}

export function isValidISO(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const d = parseISO(s)
  return toISO(d) === s
}

export function addDays(s: string, n: number): string {
  const d = parseISO(s)
  d.setDate(d.getDate() + n)
  return toISO(d)
}

/** Adds months, clamping the day to the end of the target month (Jan 31 + 1m → Feb 28). */
export function addMonths(s: string, n: number): string {
  const d = parseISO(s)
  const day = d.getDate()
  const t = new Date(d.getFullYear(), d.getMonth() + n, 1)
  const last = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate()
  t.setDate(Math.min(day, last))
  return toISO(t)
}

export function startOfMonth(s: string): string {
  return s.slice(0, 8) + '01'
}
export function endOfMonth(s: string): string {
  const d = parseISO(s)
  return toISO(new Date(d.getFullYear(), d.getMonth() + 1, 0))
}
export function startOfYear(s: string): string {
  return s.slice(0, 4) + '-01-01'
}
export function endOfYear(s: string): string {
  return s.slice(0, 4) + '-12-31'
}
export function startOfWeek(s: string, weekStartsOn: 0 | 1 = 1): string {
  const d = parseISO(s)
  const diff = (d.getDay() - weekStartsOn + 7) % 7
  return addDays(s, -diff)
}

/** Inclusive day count. */
export function daysBetween(start: string, end: string): number {
  const ms = parseISO(end).getTime() - parseISO(start).getTime()
  return Math.round(ms / 86400000) + 1
}

export function inRange(date: string, r: DateRange): boolean {
  return date >= r.start && date <= r.end
}

export function monthKey(s: string) {
  return s.slice(0, 7)
}

export function presetRange(preset: RangePreset, today = todayISO(), earliest?: string): DateRange {
  switch (preset) {
    case 'this-month':
      return { start: startOfMonth(today), end: endOfMonth(today) }
    case 'last-month': {
      const p = addMonths(startOfMonth(today), -1)
      return { start: p, end: endOfMonth(p) }
    }
    case 'last-3-months':
      return { start: addMonths(startOfMonth(today), -2), end: endOfMonth(today) }
    case 'last-6-months':
      return { start: addMonths(startOfMonth(today), -5), end: endOfMonth(today) }
    case 'this-year':
      return { start: startOfYear(today), end: endOfYear(today) }
    case 'last-12-months':
      return { start: addMonths(startOfMonth(today), -11), end: endOfMonth(today) }
    case 'all-time':
      return { start: earliest ?? addMonths(startOfMonth(today), -11), end: endOfMonth(today) }
    case 'custom':
      return { start: startOfMonth(today), end: today }
  }
}

/**
 * The equivalent previous period used for comparisons. Calendar-aligned ranges
 * (whole months / years) shift by the same number of months; anything else
 * shifts back by its own length in days.
 */
export function previousRange(r: DateRange): DateRange {
  const wholeMonths = r.start === startOfMonth(r.start) && r.end === endOfMonth(r.end)
  if (wholeMonths) {
    const months =
      (parseISO(r.end).getFullYear() - parseISO(r.start).getFullYear()) * 12 +
      parseISO(r.end).getMonth() -
      parseISO(r.start).getMonth() +
      1
    const start = addMonths(r.start, -months)
    return { start, end: endOfMonth(addMonths(r.start, -1)) }
  }
  const len = daysBetween(r.start, r.end)
  return { start: addDays(r.start, -len), end: addDays(r.start, -1) }
}

export function autoGranularity(r: DateRange): Granularity {
  const days = daysBetween(r.start, r.end)
  if (days <= 31) return 'day'
  if (days <= 120) return 'week'
  if (days <= 800) return 'month'
  return 'year'
}

/** Which granularities make sense for a range (avoid 900 daily bars or a single yearly bar). */
export function allowedGranularities(r: DateRange): Granularity[] {
  const days = daysBetween(r.start, r.end)
  const out: Granularity[] = []
  if (days <= 93) out.push('day')
  if (days >= 14 && days <= 400) out.push('week')
  if (days >= 45) out.push('month')
  if (days >= 365) out.push('year')
  if (out.length === 0) out.push('day')
  return out
}

export interface Bucket {
  key: string
  start: string
  end: string
  label: string
  fullLabel: string
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function buckets(r: DateRange, g: Granularity, weekStartsOn: 0 | 1 = 1): Bucket[] {
  const out: Bucket[] = []
  let cursor =
    g === 'day' ? r.start : g === 'week' ? startOfWeek(r.start, weekStartsOn) : g === 'month' ? startOfMonth(r.start) : startOfYear(r.start)
  let guard = 0
  while (cursor <= r.end && guard++ < 1500) {
    let end: string
    if (g === 'day') end = cursor
    else if (g === 'week') end = addDays(cursor, 6)
    else if (g === 'month') end = endOfMonth(cursor)
    else end = endOfYear(cursor)
    const s = cursor < r.start ? r.start : cursor
    const e = end > r.end ? r.end : end
    const d = parseISO(cursor)
    let label: string
    let fullLabel: string
    if (g === 'day') {
      label = String(d.getDate())
      fullLabel = formatDate(cursor, 'long')
    } else if (g === 'week') {
      label = `${parseISO(s).getDate()} ${MONTHS[parseISO(s).getMonth()]}`
      fullLabel = `Week of ${formatDate(s, 'medium')} – ${formatDate(e, 'medium')}`
    } else if (g === 'month') {
      label = MONTHS[d.getMonth()]
      fullLabel = `${MONTHS[d.getMonth()]} ${d.getFullYear()}`
    } else {
      label = String(d.getFullYear())
      fullLabel = String(d.getFullYear())
    }
    out.push({ key: cursor, start: s, end: e, label, fullLabel })
    cursor = addDays(end, 1)
  }
  return out
}

export function formatDate(s: string, style: 'short' | 'medium' | 'long' = 'medium'): string {
  if (!s) return ''
  const d = parseISO(s)
  if (style === 'short') return `${d.getDate()} ${MONTHS[d.getMonth()]}`
  if (style === 'medium') return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })
}

export function formatRange(r: DateRange): string {
  const a = parseISO(r.start)
  const b = parseISO(r.end)
  if (r.start === startOfMonth(r.start) && r.end === endOfMonth(r.start)) return `${MONTHS[a.getMonth()]} ${a.getFullYear()}`
  if (a.getFullYear() === b.getFullYear()) return `${formatDate(r.start, 'short')} – ${formatDate(r.end, 'medium')}`
  return `${formatDate(r.start, 'medium')} – ${formatDate(r.end, 'medium')}`
}

export function monthLabel(key: string) {
  const [y, m] = key.split('-').map(Number)
  return `${MONTHS[m - 1]} ${y}`
}

export function relativeDays(date: string, today = todayISO()): string {
  const diff = daysBetween(today, date) - 1
  if (diff === 0) return 'today'
  if (diff === 1) return 'tomorrow'
  if (diff === -1) return 'yesterday'
  if (diff > 0) return `in ${diff} days`
  return `${-diff} days ago`
}

/** Next occurrence after `date` for a recurrence frequency. */
export function nextOccurrence(date: string, frequency: 'weekly' | 'monthly' | 'quarterly' | 'yearly'): string {
  switch (frequency) {
    case 'weekly':
      return addDays(date, 7)
    case 'monthly':
      return addMonths(date, 1)
    case 'quarterly':
      return addMonths(date, 3)
    case 'yearly':
      return addMonths(date, 12)
  }
}
