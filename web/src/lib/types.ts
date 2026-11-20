export type Lang = 'hi' | 'en'
export type L = { en: string; hi: string }
export type Role = 'worker' | 'recycler' | 'repairer' | 'auditor'
export type User = { id: string; role: Role; name: string; phone: string | null; language: Lang; workshop_id: string | null }
export type Me = { user: User; workshop: { id: string; name: string; address: string; lat: number; lng: number } | null; city: string }
export type ModelRef = { id: string; type: string; brand: string; model: string }
export type Candidate = { model: ModelRef; confidence: number; matched: string[] }
export type MatchResult =
  | { kind: 'model'; best: Candidate; candidates: Candidate[] }
  | { kind: 'type_only'; reason: string; candidates: Candidate[] }
export type ScanResult = { scanId: string; type: string; typeConfidence: number; ocrText: string; match: MatchResult; photoHashes: string[] }
export type RateInfo = { rate: number; prev: number | null; change: number | null; updated_at: string; source: string }
export type Estimate = {
  lines: { material: string; grams: number; value: number }[]
  total: number; low: number; high: number; basis: 'model' | 'type'; sample: true; weight_kg: number
  rates: Record<string, RateInfo>
}
export type RepairComparison = { recommend: 'repair' | 'recycle'; repair_cost: number; resale_if_repaired: number; recycle_value: number; net_if_repaired: number; sample: true }
export type SafetyStep = { id: string; title: string; drawing: string; instruction: string; do: string[]; dont: string[]; photo_required: boolean }
export type SafetyPack = { device_type: string; language: Lang; version: string; draft: boolean; reviewed_by: string | null; draft_banner: string; emergency: string; gear: string[]; steps: SafetyStep[] }
export type Flag = { kind: string; detail: string; status: string }
export type LotItem = { model_id?: string | null; type: string; qty: number }
export type LotStatus = 'open' | 'listed' | 'sold' | 'held'
export type Lot = {
  id: string; user_id: string; worker_name: string; items: LotItem[]; weight_kg: number; steps_done: number; steps_total: number
  photo_hashes: string[]; gps: { lat: number; lng: number } | null; hash: string; prev_hash: string; short_hash: string
  status: LotStatus; created_at: string; flags: Flag[]; chain_ok: boolean
}
export type Offer = { id: string; recycler_name: string; amount: number; pickup_terms: string; expires_at: string; seconds_left: number }
export type Guide = { id: string; fault: L; device_type: string; difficulty: 'easy' | 'medium' | 'hard'; tools: L[]; steps: L[] }
export type Listing = { id: string; name: string; skills: string[]; area: string; start_price: number; hours: string; verified_count: number }
