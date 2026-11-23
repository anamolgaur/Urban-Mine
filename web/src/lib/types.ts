export type Lang = 'hi' | 'en' | 'bn' | 'ta' | 'te' | 'mr' | 'gu'
/** Languages the server has safety and repair content in. Other UI languages fall back to Hindi for that content. */
export type ContentLang = 'hi' | 'en'
export type L = { en: string; hi: string }
export type Role = 'worker' | 'recycler' | 'repairer' | 'auditor'
export type Approval = 'pending' | 'approved' | 'rejected'
export type User = { id: string; role: Role; name: string; phone: string | null; language: Lang; workshop_id: string | null; approval: Approval; kyc_status: string }
export type Me = { user: User; workshop: { id: string; name: string; address: string; lat: number | null; lng: number | null } | null; city: string; /** one of the shared demo accounts (sample data) */ demo?: boolean }
/** /api/me for someone who has signed in but not finished account setup yet. */
export type NeedsOnboarding = { user: null; needs_onboarding: true; phone: string | null; email?: string | null }
export type ModelRef = { id: string; type: string; brand: string; model: string }
export type Candidate = { model: ModelRef; confidence: number; matched: string[] }
export type MatchResult =
  | { kind: 'model'; best: Candidate; candidates: Candidate[] }
  | { kind: 'type_only'; reason: string; candidates: Candidate[] }
export type Grade = 'A' | 'B' | 'C' | 'D'
export type ScanResult = { scanId: string; type: string; typeConfidence: number; ocrText: string; match: MatchResult; photoHashes: string[]
  /** exact model read from text in the photos, if it is in the price list */
  resale?: { id: string; brand: string; model: string; confidence: number; matched: string } | null }
export type RateInfo = { rate: number; prev: number | null; change: number | null; updated_at: string; source: string }
export type Estimate = {
  lines: { material: string; grams: number; value: number }[]
  total: number; low: number; high: number; basis: 'model' | 'type' | 'resale'; sample: true; weight_kg: number
  condition?: { grade: Grade; factor: number }
  resale?: { model: ResaleModel | null; condition: 'good' | 'fair' | 'poor' }
  rates: Record<string, RateInfo>
}
export type RepairComparison = { recommend: 'repair' | 'recycle'; repair_cost: number; resale_if_repaired: number; recycle_value: number; net_if_repaired: number; sample: true }
export type SafetyStep = { id: string; title: string; drawing: string; instruction: string; do: string[]; dont: string[]; photo_required: boolean }
export type SafetyPack = { device_type: string; language: ContentLang; version: string; draft: boolean; reviewed_by: string | null; draft_banner: string; emergency: string; gear: string[]; steps: SafetyStep[] }
export type Flag = { kind: string; detail: string; status: string }
export type LotItem = { model_id?: string | null; type: string; qty: number }
export type LotStatus = 'open' | 'listed' | 'sold' | 'held'
export type Lot = {
  id: string; user_id: string; worker_name: string; items: LotItem[]; weight_kg: number; steps_done: number; steps_total: number
  photo_hashes: string[]; gps: { lat: number; lng: number } | null; hash: string; prev_hash: string; short_hash: string
  status: LotStatus; created_at: string; flags: Flag[]; chain_ok: boolean; sale_amount: number | null
  open_offers?: number; top_offer?: number | null
}
export type FairVerdict = 'below' | 'within' | 'above'
export type Offer = { id: string; recycler_name: string; amount: number; pickup_terms: string; expires_at: string; seconds_left: number; rating?: { avg: number; count: number } | null; fair?: { verdict: FairVerdict; low: number; high: number } | null }
export type Guide = { id: string; fault: L; device_type: string; difficulty: 'easy' | 'medium' | 'hard'; tools: L[]; steps: L[] }
export type Listing = { id: string; name: string; skills: string[]; area: string; start_price: number; hours: string; verified_count: number }
export type Diary = { problems?: string; parts?: string; minutes?: number; outcome?: 'fixed' | 'partly' | 'not_fixed'; customer_note?: string }
export type Job = { id: string; before_photo: string; after_photo: string | null; status: 'in_progress' | 'completed'; note: string | null; created_at: string | null; completed_at: string | null
  device_type: string | null; guide_id: string | null; gear_checked: string[]; steps_done: number[]; during_photos: string[]; diary: Diary }
export type Gear = { id: string; required: boolean; en: string; hi: string }

export type ResaleModel = { id: string; type: string; brand: string; model: string; good: number; source: string }
