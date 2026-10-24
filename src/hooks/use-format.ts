import { useCallback, useMemo } from 'react'
import { useActiveWorkspace } from '@/store/app-store'
import { formatMoney, CURRENCIES, type MoneyFormatOptions } from '@/lib/money'

export function useFormat() {
  const { ws } = useActiveWorkspace()
  const money = useCallback((minor: number, opts?: MoneyFormatOptions) => formatMoney(minor, ws.currency, ws.locale, opts), [ws.currency, ws.locale])
  const compact = useCallback((minor: number) => formatMoney(minor, ws.currency, ws.locale, { compact: true }), [ws.currency, ws.locale])
  return useMemo(() => ({ money, compact, symbol: CURRENCIES[ws.currency].symbol, currency: ws.currency, locale: ws.locale }), [money, compact, ws.currency, ws.locale])
}
