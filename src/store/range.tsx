import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { presetRange, todayISO, type DateRange, type RangePreset } from '@/lib/dates'
import { readJSON, writeJSON } from './storage'

interface RangeCtx {
  preset: RangePreset
  range: DateRange
  setPreset: (p: RangePreset) => void
  setCustom: (r: DateRange) => void
}

const Ctx = createContext<RangeCtx | null>(null)

export function RangeProvider({ children, earliest }: { children: ReactNode; earliest?: string }) {
  const saved = readJSON<{ preset: RangePreset; custom?: DateRange }>('ui:range', { preset: 'this-month' })
  const [preset, setPresetState] = useState<RangePreset>(saved.preset)
  const [custom, setCustomState] = useState<DateRange | undefined>(saved.custom)

  useEffect(() => {
    writeJSON('ui:range', { preset, custom })
  }, [preset, custom])

  const value = useMemo<RangeCtx>(() => {
    const range = preset === 'custom' && custom ? custom : presetRange(preset, todayISO(), earliest)
    return {
      preset,
      range,
      setPreset: (p) => setPresetState(p),
      setCustom: (r) => {
        setCustomState(r)
        setPresetState('custom')
      },
    }
  }, [preset, custom, earliest])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useRange() {
  const c = useContext(Ctx)
  if (!c) throw new Error('useRange outside RangeProvider')
  return c
}
