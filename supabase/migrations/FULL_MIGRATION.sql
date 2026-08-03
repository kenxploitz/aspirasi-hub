-- ============================================================
-- FASPIRA FULL MIGRATION (Fixed)
-- Date: 2026-07-29
-- Jalankan SEKALIGES di Supabase SQL Editor
-- ============================================================

-- ============================================================
-- 0. FIX ENUM: Drop old enum if exists, use TEXT instead
-- ============================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'aspiration_status') THEN
    -- Hapus default dulu sebelum ganti tipe
    ALTER TABLE public.aspirations ALTER COLUMN status DROP DEFAULT;
    ALTER TABLE public.aspirations ALTER COLUMN status TYPE text;
    DROP TYPE aspiration_status;
  END IF;
END $$;

-- Also fix app_role enum: add 'developer' if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'developer' AND enumtypid = 'app_role'::regtype) THEN
    ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'developer';
  END IF;
END $$;

-- ============================================================
-- 1. ASPIRATIONS TABLE — RLS + Status
-- ============================================================

-- Migrate old status values
UPDATE public.aspirations SET status = 'belum_ditanggapi' WHERE status = 'pending';
UPDATE public.aspirations SET status = 'belum_ditanggapi' WHERE status NOT IN ('belum_ditanggapi', 'sudah_ditanggapi');

-- Set default
ALTER TABLE public.aspirations ALTER COLUMN status SET DEFAULT 'belum_ditanggapi';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_aspirations_status ON public.aspirations(status);
CREATE INDEX IF NOT EXISTS idx_aspirations_created_at ON public.aspirations(created_at DESC);

-- Drop ALL existing policies on aspirations
DROP POLICY IF EXISTS "Anyone can insert aspirations" ON public.aspirations;
DROP POLICY IF EXISTS "Admins can view all aspirations" ON public.aspirations;
DROP POLICY IF EXISTS "Admins can update aspirations" ON public.aspirations;
DROP POLICY IF EXISTS "Admins can delete aspirations" ON public.aspirations;
DROP POLICY IF EXISTS "Public can insert validated aspirations" ON public.aspirations;
DROP POLICY IF EXISTS "Only admins can read aspirations" ON public.aspirations;
DROP POLICY IF EXISTS "Only admins can update aspirations" ON public.aspirations;
DROP POLICY IF EXISTS "Only superadmins can delete aspirations" ON public.aspirations;
DROP POLICY IF EXISTS "Only admins can delete aspirations" ON public.aspirations;

-- INSERT: Public can submit (validated by trigger)
CREATE POLICY "Public can insert validated aspirations"
ON public.aspirations FOR INSERT
WITH CHECK (
  student_name IS NOT NULL AND length(student_name) BETWEEN 1 AND 100
  AND content IS NOT NULL AND length(content) BETWEEN 10 AND 2000
  AND status = 'pending'
  AND (student_class IS NULL OR length(student_class) <= 50)
);

-- SELECT: Admin/Developer only
CREATE POLICY "Only admins can read aspirations"
ON public.aspirations FOR SELECT
USING (
  auth.uid() IS NOT NULL AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'developer'::app_role)
  )
);

-- UPDATE: Admin/Developer only
CREATE POLICY "Only admins can update aspirations"
ON public.aspirations FOR UPDATE
USING (
  auth.uid() IS NOT NULL AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'developer'::app_role)
  )
);

-- DELETE: Admin/Developer only
CREATE POLICY "Only admins can delete aspirations"
ON public.aspirations FOR DELETE
USING (
  auth.uid() IS NOT NULL AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'developer'::app_role)
  )
);

-- ============================================================
-- 2. AUTO-STATUS TRIGGER
-- ============================================================

CREATE OR REPLACE FUNCTION public.set_aspiration_status_on_comment_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.aspirations SET status = 'sudah_ditanggapi', updated_at = now() WHERE id = NEW.aspiration_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_comment_insert_set_status ON public.comments;
CREATE TRIGGER on_comment_insert_set_status
  AFTER INSERT ON public.comments FOR EACH ROW
  EXECUTE FUNCTION public.set_aspiration_status_on_comment_insert();

CREATE OR REPLACE FUNCTION public.set_aspiration_status_on_comment_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE remaining integer;
BEGIN
  SELECT COUNT(*) INTO remaining FROM public.comments WHERE aspiration_id = OLD.aspiration_id;
  IF remaining = 0 THEN
    UPDATE public.aspirations SET status = 'belum_ditanggapi', updated_at = now() WHERE id = OLD.aspiration_id;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS on_comment_delete_set_status ON public.comments;
CREATE TRIGGER on_comment_delete_set_status
  AFTER DELETE ON public.comments FOR EACH ROW
  EXECUTE FUNCTION public.set_aspiration_status_on_comment_delete();

-- ============================================================
-- 3. COMMENTS TABLE — RLS
-- ============================================================

DROP POLICY IF EXISTS "Admins can view all comments" ON public.comments;
DROP POLICY IF EXISTS "Admins can insert comments" ON public.comments;
DROP POLICY IF EXISTS "Admins can update own comments" ON public.comments;
DROP POLICY IF EXISTS "Admins can delete own comments" ON public.comments;
DROP POLICY IF EXISTS "Only admins can read comments" ON public.comments;
DROP POLICY IF EXISTS "Only admins can insert comments" ON public.comments;
DROP POLICY IF EXISTS "Only admins can update own comments" ON public.comments;
DROP POLICY IF EXISTS "Admins can delete own comments superadmin all" ON public.comments;

CREATE POLICY "Only admins can read comments" ON public.comments FOR SELECT
USING (auth.uid() IS NOT NULL AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'developer')));

CREATE POLICY "Only admins can insert comments" ON public.comments FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL AND admin_id = auth.uid() AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'developer')));

CREATE POLICY "Only admins can update own comments" ON public.comments FOR UPDATE
USING (auth.uid() IS NOT NULL AND admin_id = auth.uid() AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'developer')));

CREATE POLICY "Only admins can delete comments" ON public.comments FOR DELETE
USING (auth.uid() IS NOT NULL AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'developer')));

-- ============================================================
-- 4. PROFILES TABLE — RLS
-- ============================================================

DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Superadmin can update profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Superadmins can delete profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile only" ON public.profiles;

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Developers can delete profiles" ON public.profiles FOR DELETE
USING (auth.uid() IS NOT NULL AND public.has_role(auth.uid(), 'developer'));

-- ============================================================
-- 5. USER_ROLES TABLE — RLS
-- ============================================================

DROP POLICY IF EXISTS "Admins can view roles" ON public.user_roles;
DROP POLICY IF EXISTS "Superadmin can manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Superadmins can insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Superadmins can update roles" ON public.user_roles;
DROP POLICY IF EXISTS "Superadmins can delete roles" ON public.user_roles;
DROP POLICY IF EXISTS "Only superadmins can view roles" ON public.user_roles;
DROP POLICY IF EXISTS "Only superadmins can insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Only superadmins can update roles" ON public.user_roles;
DROP POLICY IF EXISTS "Only superadmins can delete roles" ON public.user_roles;

CREATE POLICY "Only developers can view roles" ON public.user_roles FOR SELECT
USING (auth.uid() IS NOT NULL AND public.has_role(auth.uid(), 'developer'));

CREATE POLICY "Only developers can insert roles" ON public.user_roles FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL AND public.has_role(auth.uid(), 'developer'));

CREATE POLICY "Only developers can update roles" ON public.user_roles FOR UPDATE
USING (auth.uid() IS NOT NULL AND public.has_role(auth.uid(), 'developer'));

CREATE POLICY "Only developers can delete roles" ON public.user_roles FOR DELETE
USING (auth.uid() IS NOT NULL AND public.has_role(auth.uid(), 'developer'));

-- ============================================================
-- 6. ADMIN_EMAILS TABLE — RLS
-- ============================================================

DROP POLICY IF EXISTS "Superadmins can view admin emails" ON public.admin_emails;
DROP POLICY IF EXISTS "Superadmins can insert admin emails" ON public.admin_emails;
DROP POLICY IF EXISTS "Superadmins can delete admin emails" ON public.admin_emails;
DROP POLICY IF EXISTS "Admins can view admin emails" ON public.admin_emails;
DROP POLICY IF EXISTS "Only superadmins can view admin emails" ON public.admin_emails;
DROP POLICY IF EXISTS "Only superadmins can insert admin emails" ON public.admin_emails;
DROP POLICY IF EXISTS "Only superadmins can delete admin emails" ON public.admin_emails;

CREATE POLICY "Only developers can view admin emails" ON public.admin_emails FOR SELECT
USING (auth.uid() IS NOT NULL AND public.has_role(auth.uid(), 'developer'));

CREATE POLICY "Only developers can insert admin emails" ON public.admin_emails FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL AND public.has_role(auth.uid(), 'developer'));

CREATE POLICY "Only developers can delete admin emails" ON public.admin_emails FOR DELETE
USING (auth.uid() IS NOT NULL AND public.has_role(auth.uid(), 'developer'));

-- ============================================================
-- 7. RATE LIMITING TRIGGER
-- ============================================================

CREATE OR REPLACE FUNCTION public.check_aspiration_rate_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE recent_count integer; dup_count integer;
BEGIN
  SELECT COUNT(*) INTO recent_count FROM public.aspirations WHERE student_name = NEW.student_name AND created_at > now() - interval '10 minutes';
  IF recent_count >= 5 THEN RAISE EXCEPTION 'Rate limit exceeded.' USING ERRCODE = 'check_violation'; END IF;

  SELECT COUNT(*) INTO dup_count FROM public.aspirations WHERE student_name = NEW.student_name AND content = NEW.content AND created_at > now() - interval '1 hour';
  IF dup_count > 0 THEN RAISE EXCEPTION 'Duplicate aspiration.' USING ERRCODE = 'check_violation'; END IF;

  NEW.student_name := trim(NEW.student_name);
  NEW.content := trim(NEW.content);
  IF NEW.student_class IS NOT NULL THEN NEW.student_class := trim(NEW.student_class); END IF;
  NEW.status := 'pending';
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS check_aspiration_rate_limit_trigger ON public.aspirations;
CREATE TRIGGER check_aspiration_rate_limit_trigger
  BEFORE INSERT ON public.aspirations FOR EACH ROW
  EXECUTE FUNCTION public.check_aspiration_rate_limit();

-- ============================================================
-- 8. AUDIT LOG TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL,
  table_name text NOT NULL,
  record_id uuid,
  user_id uuid,
  ip_address inet,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Only developers can view audit logs" ON public.audit_log;
DROP POLICY IF EXISTS "System can insert audit logs" ON public.audit_log;

CREATE POLICY "Only developers can view audit logs" ON public.audit_log FOR SELECT
USING (auth.uid() IS NOT NULL AND public.has_role(auth.uid(), 'developer'));
CREATE POLICY "System can insert audit logs" ON public.audit_log FOR INSERT WITH CHECK (true);

-- ============================================================
-- 9. AI SETTINGS TABLE
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

DROP POLICY IF EXISTS "Superadmin manage ai_settings" ON public.ai_settings;
DROP POLICY IF EXISTS "Developer manage ai_settings" ON public.ai_settings;

CREATE POLICY "Developer manage ai_settings" ON public.ai_settings FOR ALL
USING (auth.uid() IS NOT NULL AND public.has_role(auth.uid(), 'developer'));

-- Insert default AI settings
INSERT INTO public.ai_settings (provider_name, base_url, api_key, model, is_active)
VALUES ('farouter', 'https://api.farouter.tech/v1', 'sk-1cbb367417323793736b2b2dc78f81a537c12dbd1420f873', 'gpt-4o-mini', true)
ON CONFLICT DO NOTHING;

-- ============================================================
-- 10. AI CHAT RATE LIMIT TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.ai_chat_rate_limit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text NOT NULL,
  window_start timestamptz NOT NULL DEFAULT now(),
  request_count integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ai_chat_rate_limit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can insert rate limit" ON public.ai_chat_rate_limit;
DROP POLICY IF EXISTS "Service role read rate limit" ON public.ai_chat_rate_limit;

CREATE POLICY "Public can insert rate limit" ON public.ai_chat_rate_limit FOR INSERT WITH CHECK (true);
CREATE POLICY "Service role read rate limit" ON public.ai_chat_rate_limit FOR SELECT USING (true);

-- ============================================================
-- 11. SCHOOL SETTINGS TABLE
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

DROP POLICY IF EXISTS "Admins can read school settings" ON public.school_settings;
DROP POLICY IF EXISTS "Superadmin can update school settings" ON public.school_settings;
DROP POLICY IF EXISTS "Developers can manage school settings" ON public.school_settings;

CREATE POLICY "Admins can read school settings" ON public.school_settings FOR SELECT
USING (auth.uid() IS NOT NULL AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'developer')));

CREATE POLICY "Developers can manage school settings" ON public.school_settings FOR ALL
USING (auth.uid() IS NOT NULL AND public.has_role(auth.uid(), 'developer'));

INSERT INTO public.school_settings (school_name) VALUES ('SMA Negeri 1 Kendal') ON CONFLICT DO NOTHING;

-- ============================================================
-- 12. GRANT PERMISSIONS
-- ============================================================

REVOKE ALL ON public.aspirations FROM anon;
REVOKE ALL ON public.comments FROM anon;
REVOKE ALL ON public.profiles FROM anon;
REVOKE ALL ON public.user_roles FROM anon;
REVOKE ALL ON public.admin_emails FROM anon;

GRANT INSERT ON public.aspirations TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.aspirations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_emails TO authenticated;
GRANT ALL ON public.ai_settings TO authenticated;
GRANT ALL ON public.ai_chat_rate_limit TO authenticated;
GRANT ALL ON public.school_settings TO authenticated;
GRANT INSERT ON public.ai_chat_rate_limit TO anon;

-- ============================================================
-- 13. DEVELOPER ROLE: kenxfear@gmail.com
-- ============================================================

-- Insert developer role for kenxfear@gmail.com (will work when user signs up)
-- This is handled by the app logic: if email = kenxfear@gmail.com, auto-assign developer role
