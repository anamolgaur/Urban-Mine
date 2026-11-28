import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import type { Estimate, Grade, Lot, ScanResult } from './types.ts'

/** Everything the worker is in the middle of: from the first photo to the created lot. */
export type Flow = {
  hint: string | null
  images: (string | null)[]
  labelText: string
  scan: ScanResult | null
  type: string | null
  modelId: string | null
  qty: number
  works: boolean | null
  /** Working devices: which listed model (resale table), its wear, or the worker's own price if not listed. */
  resaleId: string | null
  looks: Record<string, { id: string; brand: string; p: number }[]> // per type (phone, laptop): model guesses from how it looks (on-device)
  wear: 'good' | 'fair' | 'poor'
  customPrice: number | null
  /** Working phone or laptop not in the list: a rough band from "tier:age:brand" (e.g. "mid:mid:Vivo"). */
  band: string | null
  /** Dead phone or laptop: its price tier when new, for the parts value (keypad, budget, mid, flagship / basic, business, premium). */
  tier: string | null
  estimate: Estimate | null
  done: Record<string, string | true> // safety step id -> photo hash (or true when no photo was needed)
  extraHashes: string[]
  lot: Lot | null
  /** Condition grade: the worker's own, or an AI suggestion from the photos (`aiGrade`) they may have changed. */
  condition: { grade: Grade; issues: string[]; confidence: number; source: 'ai' | 'worker'; aiGrade: Grade | null } | null
}
export const emptyFlow: Flow = { hint: null, images: [null, null, null, null], labelText: '', scan: null, type: null, modelId: null, qty: 1, works: null, resaleId: null, looks: {}, wear: 'good', customPrice: null, band: null, tier: null, estimate: null, done: {}, extraHashes: [], lot: null, condition: null }

type Ctx = { flow: Flow; patch: (p: Partial<Flow>) => void; setImage: (i: number, url: string) => void; reset: () => void }
const FlowCtx = createContext<Ctx>({ flow: emptyFlow, patch: () => {}, setImage: () => {}, reset: () => {} })
export const useFlow = () => useContext(FlowCtx)

export function FlowProvider({ children }: { children: ReactNode }) {
  const [flow, setFlow] = useState<Flow>(emptyFlow)
  const patch = useCallback((p: Partial<Flow>) => setFlow((f) => ({ ...f, ...p })), [])
  const setImage = useCallback((i: number, url: string) => setFlow((f) => ({ ...f, images: f.images.map((x, j) => (j === i ? url : x)) })), [])
  const reset = useCallback(() => setFlow(emptyFlow), [])
  const value = useMemo(() => ({ flow, patch, setImage, reset }), [flow, patch, setImage, reset])
  return <FlowCtx.Provider value={value}>{children}</FlowCtx.Provider>
}
