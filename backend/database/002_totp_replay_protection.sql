ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS totp_last_counter bigint;
