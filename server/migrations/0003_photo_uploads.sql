-- Who uploaded which photo. A photo can be viewed by the people who uploaded it even before it is attached to a lot
-- (for example the proof photo taken during a safety step). Several people may upload identical bytes, so the key is (hash, user).
CREATE TABLE photo_upload (
  hash TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES app_user(id),
  created_at TEXT NOT NULL,
  PRIMARY KEY (hash, user_id)
);
CREATE INDEX photo_upload_user ON photo_upload (user_id);
ALTER TABLE photo_upload ENABLE ROW LEVEL SECURITY;
