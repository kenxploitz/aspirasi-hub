-- ============================================================
-- AI Settings: Insert default configuration
-- Date: 2026-07-29
-- ============================================================

-- Insert AI settings (only if not exists)
INSERT INTO public.ai_settings (provider_name, base_url, api_key, model, is_active)
VALUES (
  'farouter',
  'https://api.farouter.tech/v1',
  'sk-1cbb367417323793736b2b2dc78f81a537c12dbd1420f873',
  'gpt-4o-mini',
  true
)
ON CONFLICT DO NOTHING;
