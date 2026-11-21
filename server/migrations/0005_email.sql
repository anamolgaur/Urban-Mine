-- Sign-in by email or phone, each with a password. One account per email, like one per phone.
ALTER TABLE app_user ADD COLUMN email TEXT;
CREATE UNIQUE INDEX app_user_email_uq ON app_user (email) WHERE email IS NOT NULL;
