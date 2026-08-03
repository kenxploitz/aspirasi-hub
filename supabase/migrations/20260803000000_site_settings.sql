-- Site Settings table
CREATE TABLE IF NOT EXISTS site_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  maintenance_mode BOOLEAN DEFAULT false,
  maintenance_message TEXT DEFAULT 'Sistem sedang dalam pemeliharaan. Silakan coba lagi nanti.',
  site_name TEXT DEFAULT 'FASPIRA - Forum Aspirasi Siswa',
  school_name TEXT DEFAULT 'SMA Negeri 1 Kendal',
  max_aspiration_length INTEGER DEFAULT 2000,
  min_aspiration_length INTEGER DEFAULT 10,
  enable_ai_curhat BOOLEAN DEFAULT true,
  enable_anonymous BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Insert default settings
INSERT INTO site_settings (id) VALUES (gen_random_uuid()) ON CONFLICT DO NOTHING;

-- RLS
ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;

-- Anyone can read (for maintenance check)
CREATE POLICY "Anyone can read site_settings" ON site_settings
  FOR SELECT USING (true);

-- Only authenticated users can update
CREATE POLICY "Authenticated can update site_settings" ON site_settings
  FOR UPDATE USING (auth.role() = 'authenticated');

-- Only authenticated users can insert
CREATE POLICY "Authenticated can insert site_settings" ON site_settings
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Backups storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('backups', 'backups', false)
  ON CONFLICT (id) DO NOTHING;

-- Storage policy for backups
CREATE POLICY "Authenticated can upload backups" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'backups' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated can read backups" ON storage.objects
  FOR SELECT USING (bucket_id = 'backups' AND auth.role() = 'authenticated');
