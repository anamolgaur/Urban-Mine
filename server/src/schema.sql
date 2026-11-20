-- Urban Mine schema (SQLite). Arrays/objects are stored as JSON text.
-- ALL SEEDED VALUES ARE SAMPLE DATA.
PRAGMA foreign_keys = ON;

CREATE TABLE workshop (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, address TEXT NOT NULL, lat REAL NOT NULL, lng REAL NOT NULL
);
CREATE TABLE user (
  id TEXT PRIMARY KEY,
  role TEXT NOT NULL CHECK (role IN ('worker','recycler','repairer','auditor')),
  name TEXT NOT NULL, phone TEXT, language TEXT NOT NULL DEFAULT 'hi' CHECK (language IN ('hi','en')),
  workshop_id TEXT REFERENCES workshop(id)
);
CREATE TABLE device_model (
  id TEXT PRIMARY KEY, type TEXT NOT NULL, brand TEXT NOT NULL, model TEXT NOT NULL,
  label_patterns TEXT NOT NULL,          -- JSON string[] of lowercase regex sources
  weight_kg REAL NOT NULL,
  composition_json TEXT NOT NULL,        -- JSON {material: grams}
  repair_notes TEXT
);
CREATE TABLE scan (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES user(id),
  type_pred TEXT, type_conf REAL, model_id TEXT REFERENCES device_model(id), model_conf REAL,
  photos TEXT NOT NULL DEFAULT '[]', ocr_text TEXT, created_at TEXT NOT NULL
);
CREATE TABLE lot (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES user(id),
  items TEXT NOT NULL, weight_kg REAL NOT NULL, steps_done INTEGER NOT NULL, steps_total INTEGER NOT NULL,
  photo_hashes TEXT NOT NULL DEFAULT '[]', gps TEXT,
  prev_hash TEXT NOT NULL, hash TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','listed','sold','held')),
  held_from TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE bid (
  id TEXT PRIMARY KEY, lot_id TEXT NOT NULL REFERENCES lot(id), recycler_id TEXT NOT NULL REFERENCES user(id),
  amount REAL NOT NULL, pickup_terms TEXT, expires_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','accepted','rejected','expired'))
);
CREATE TABLE rate (
  material TEXT NOT NULL, city TEXT NOT NULL, rate_per_kg REAL NOT NULL, updated_at TEXT NOT NULL, source TEXT NOT NULL,
  PRIMARY KEY (material, city)
);
CREATE TABLE rate_history (  -- daily snapshots, powers "change vs yesterday" and the price-history stretch goal
  material TEXT NOT NULL, city TEXT NOT NULL, day TEXT NOT NULL, rate_per_kg REAL NOT NULL,
  PRIMARY KEY (material, city, day)
);
CREATE TABLE safety_pack (
  device_type TEXT NOT NULL, language TEXT NOT NULL, steps_json TEXT NOT NULL, version TEXT NOT NULL, reviewed_by TEXT,
  PRIMARY KEY (device_type, language)
);
CREATE TABLE repair_guide (
  id TEXT PRIMARY KEY, fault TEXT NOT NULL, device_type TEXT NOT NULL,
  difficulty TEXT NOT NULL CHECK (difficulty IN ('easy','medium','hard')),
  tools TEXT NOT NULL, steps_json TEXT NOT NULL
);
CREATE TABLE repairer_listing (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES user(id), skills TEXT NOT NULL, area TEXT NOT NULL,
  start_price REAL NOT NULL, hours TEXT, verified_count INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE repair_job (
  id TEXT PRIMARY KEY, listing_id TEXT NOT NULL REFERENCES repairer_listing(id),
  before_photo TEXT, after_photo TEXT, status TEXT NOT NULL DEFAULT 'requested',
  note TEXT, created_at TEXT, completed_at TEXT
);
CREATE TABLE flag (
  id TEXT PRIMARY KEY, lot_id TEXT NOT NULL REFERENCES lot(id), kind TEXT NOT NULL, detail TEXT, status TEXT NOT NULL DEFAULT 'open'
);
CREATE TABLE feedback (
  id TEXT PRIMARY KEY, scan_id TEXT NOT NULL REFERENCES scan(id), field TEXT NOT NULL, predicted TEXT, corrected TEXT
);
