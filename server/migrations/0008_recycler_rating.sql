-- After a sale, the worker rates the recycler's pickup (1 to 5 stars, an optional note). One rating per sold lot.
CREATE TABLE recycler_rating (
  lot_id TEXT PRIMARY KEY REFERENCES lot(id),
  worker_id TEXT NOT NULL REFERENCES app_user(id),
  recycler_id TEXT NOT NULL REFERENCES app_user(id),
  stars INTEGER NOT NULL CHECK (stars BETWEEN 1 AND 5),
  note TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX recycler_rating_recycler ON recycler_rating (recycler_id);
ALTER TABLE recycler_rating ENABLE ROW LEVEL SECURITY;
