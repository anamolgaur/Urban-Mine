-- Phone numbers and emails an auditor removed (fake or abusive accounts). They cannot set up a new account.
CREATE TABLE banned_identity (
  kind TEXT NOT NULL CHECK (kind IN ('phone','email')),
  value TEXT NOT NULL,
  reason TEXT,
  banned_by TEXT,
  created_at TEXT NOT NULL,
  PRIMARY KEY (kind, value)
);
ALTER TABLE banned_identity ENABLE ROW LEVEL SECURITY;
