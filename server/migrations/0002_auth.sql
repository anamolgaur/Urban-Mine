-- Phone sign-in (Supabase Auth) and onboarding.
-- auth_id: the Supabase auth user this account belongs to. NULL for sample/demo users and for pre-provisioned accounts (e.g. an auditor) that attach themselves at first sign-in by phone number.
-- approval: workers are approved on sign-up; recyclers and repairers wait for an auditor.
-- kyc_status: always 'simulated' in this prototype. No Aadhaar or PAN is ever stored.
ALTER TABLE app_user ADD COLUMN auth_id TEXT UNIQUE;
ALTER TABLE app_user ADD COLUMN approval TEXT NOT NULL DEFAULT 'approved' CHECK (approval IN ('pending','approved','rejected'));
ALTER TABLE app_user ADD COLUMN kyc_status TEXT NOT NULL DEFAULT 'simulated' CHECK (kyc_status IN ('simulated'));
ALTER TABLE app_user ADD COLUMN consented_at TEXT;
ALTER TABLE app_user ADD COLUMN created_at TEXT;
-- one account per phone number (the deleted-user placeholder has no phone)
CREATE UNIQUE INDEX app_user_phone_uq ON app_user (phone) WHERE phone IS NOT NULL;
-- a new worker may not have given a precise location yet
ALTER TABLE workshop ALTER COLUMN lat DROP NOT NULL;
ALTER TABLE workshop ALTER COLUMN lng DROP NOT NULL;
