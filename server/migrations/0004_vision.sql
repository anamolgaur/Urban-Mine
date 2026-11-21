-- Photo-based condition check.
-- vision_consent_at: when the worker agreed that device photos may be sent to an AI service. NULL = not agreed (nothing is ever sent).
ALTER TABLE app_user ADD COLUMN vision_consent_at TEXT;

-- One stored answer per set of photos (+ device + assessor), so the same photos are never sent twice.
-- set_hash is a SHA-256 of the photo hashes, so it holds nothing personal.
CREATE TABLE condition_assessment (
  set_hash TEXT PRIMARY KEY,
  result_json TEXT NOT NULL,
  assessor TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- Calls to the AI service per person per day (for the daily limit).
CREATE TABLE vision_usage (
  user_id TEXT NOT NULL REFERENCES app_user(id),
  day TEXT NOT NULL,
  n INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day)
);

ALTER TABLE condition_assessment ENABLE ROW LEVEL SECURITY;
ALTER TABLE vision_usage ENABLE ROW LEVEL SECURITY;
