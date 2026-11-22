-- Lock the migrations bookkeeping table like every other table: the public (anon) key can neither read nor change it.
-- The app's server connects as the table owner, which RLS does not restrict, so migrations still run.
ALTER TABLE schema_migrations ENABLE ROW LEVEL SECURITY;
