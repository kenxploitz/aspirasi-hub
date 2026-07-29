-- ============================================================
-- FASPIRA Feature Migration: Auto-Status + AI Settings
-- Date: 2026-07-29
-- ============================================================

-- ============================================================
-- 1. STATUS COLUMN: Auto-status berdasarkan komentar
-- ============================================================

-- Migrasi data lama: 'pending' → 'belum_ditanggapi'
UPDATE public.aspirations
SET status = 'belum_ditanggapi'
WHERE status = 'pending';

-- Ubah default status
ALTER TABLE public.aspirations
ALTER COLUMN status SET DEFAULT 'belum_ditanggapi';

-- Index untuk performa filter status
CREATE INDEX IF NOT EXISTS idx_aspirations_status ON public.aspirations(status);
CREATE INDEX IF NOT EXISTS idx_aspirations_created_at ON public.aspirations(created_at DESC);

-- Trigger: Setelah komentar ditambahkan → status jadi 'sudah_ditanggapi'
CREATE OR REPLACE FUNCTION public.set_aspiration_status_on_comment_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.aspirations
  SET status = 'sudah_ditanggapi', updated_at = now()
  WHERE id = NEW.aspiration_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_comment_insert_set_status ON public.comments;
CREATE TRIGGER on_comment_insert_set_status
  AFTER INSERT ON public.comments
  FOR EACH ROW
  EXECUTE FUNCTION public.set_aspiration_status_on_comment_insert();

-- Trigger: Setelah komentar dihapus → cek apakah masih ada komentar lain
CREATE OR REPLACE FUNCTION public.set_aspiration_status_on_comment_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  remaining_count integer;
BEGIN
  SELECT COUNT(*) INTO remaining_count
  FROM public.comments
  WHERE aspiration_id = OLD.aspiration_id;

  IF remaining_count = 0 THEN
    UPDATE public.aspirations
    SET status = 'belum_ditanggapi', updated_at = now()
    WHERE id = OLD.aspiration_id;
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS on_comment_delete_set_status ON public.comments;
CREATE TRIGGER on_comment_delete_set_status
  AFTER DELETE ON public.comments
  FOR EACH ROW
  EXECUTE FUNCTION public.set_aspiration_status_on_comment_delete();

-- ============================================================
-- 2. AI SETTINGS TABLE — Superadmin only
-- ============================================================

CREATE TABLE IF NOT EXISTS public.ai_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_name text NOT NULL DEFAULT 'custom',
  base_url text NOT NULL,
  api_key text NOT NULL,
  model text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  updated_by uuid REFERENCES auth.users(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_settings ENABLE ROW LEVEL SECURITY;

-- Hanya superadmin yang bisa manage ai_settings
DROP POLICY IF EXISTS "Superadmin manage ai_settings" ON public.ai_settings;
CREATE POLICY "Superadmin manage ai_settings"
ON public.ai_settings
FOR ALL
USING (
  auth.uid() IS NOT NULL
  AND public.has_role(auth.uid(), 'superadmin'::app_role)
);

-- ============================================================
-- 3. AI CHAT RATE LIMIT TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.ai_chat_rate_limit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text NOT NULL,
  window_start timestamptz NOT NULL DEFAULT now(),
  request_count integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_chat_rate_limit ENABLE ROW LEVEL SECURITY;

-- Public can insert (for rate limiting checks)
DROP POLICY IF EXISTS "Public can insert rate limit" ON public.ai_chat_rate_limit;
CREATE POLICY "Public can insert rate limit"
ON public.ai_chat_rate_limit
FOR INSERT
WITH CHECK (true);

-- Only service role can read (edge functions)
DROP POLICY IF EXISTS "Service role read rate limit" ON public.ai_chat_rate_limit;
CREATE POLICY "Service role read rate limit"
ON public.ai_chat_rate_limit
FOR SELECT
USING (true);

-- ============================================================
-- 4. SCHOOL SETTINGS TABLE (untuk nama sekolah di laporan)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.school_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_name text NOT NULL DEFAULT 'SMA Negeri 1 Kendal',
  school_address text,
  school_logo_url text,
  updated_by uuid REFERENCES auth.users(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.school_settings ENABLE ROW LEVEL SECURITY;

-- Semua admin bisa baca
DROP POLICY IF EXISTS "Admins can read school settings" ON public.school_settings;
CREATE POLICY "Admins can read school settings"
ON public.school_settings
FOR SELECT
USING (
  auth.uid() IS NOT NULL
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'superadmin'::app_role)
  )
);

-- Hanya superadmin bisa update
DROP POLICY IF EXISTS "Superadmin can update school settings" ON public.school_settings;
CREATE POLICY "Superadmin can update school settings"
ON public.school_settings
FOR ALL
USING (
  auth.uid() IS NOT NULL
  AND public.has_role(auth.uid(), 'superadmin'::app_role)
);

-- Insert default school settings
INSERT INTO public.school_settings (school_name)
VALUES ('SMA Negeri 1 Kendal')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 5. GRANT PERMISSIONS
-- ============================================================

GRANT ALL ON public.ai_settings TO authenticated;
GRANT ALL ON public.ai_chat_rate_limit TO authenticated;
GRANT ALL ON public.school_settings TO authenticated;
GRANT INSERT ON public.ai_chat_rate_limit TO anon;
