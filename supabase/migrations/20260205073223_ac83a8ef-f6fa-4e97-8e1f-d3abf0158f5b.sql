-- Enable pgcrypto extension for encryption
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Add new encrypted columns to store tokens securely
ALTER TABLE google_drive_tokens 
ADD COLUMN IF NOT EXISTS access_token_encrypted bytea,
ADD COLUMN IF NOT EXISTS refresh_token_encrypted bytea;

-- Create encryption function using pgcrypto with a secret key from vault
-- The key will be retrieved from Supabase secrets at runtime
CREATE OR REPLACE FUNCTION encrypt_token(plain_token text, encryption_key text)
RETURNS bytea
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF plain_token IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN pgp_sym_encrypt(plain_token, encryption_key);
END;
$$;

-- Create decryption function
CREATE OR REPLACE FUNCTION decrypt_token(encrypted_token bytea, encryption_key text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF encrypted_token IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN pgp_sym_decrypt(encrypted_token, encryption_key);
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$;