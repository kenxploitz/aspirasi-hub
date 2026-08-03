# FASPIRA — Deploy Checklist (Quick)

## 1. Supabase SQL Editor
Copy-paste isi file ini, jalankan sekaligus:
- `supabase/migrations/FULL_MIGRATION.sql`

## 2. Ambil Service Role Key
Supabase Dashboard → Project Settings → API → `service_role` key → Copy

## 3. Deploy Edge Functions
```bash
supabase link --project-ref fsspteutxmjrjoyplrll
supabase functions deploy submit-aspiration
supabase functions deploy ai-settings
supabase functions deploy ai-admin-agent
supabase functions deploy ai-client-chat
supabase functions deploy download-aspirations
supabase functions deploy generate-instagram-design
```

## 4. Set Service Role Key di Edge Functions
Supabase Dashboard → Edge Functions → Settings → Add Secret:
- Name: `SUPABASE_SERVICE_ROLE_KEY`
- Value: (paste service role key dari step 2)

Lakukan untuk semua edge function yang butuh (submit-aspiration, ai-settings, ai-admin-agent).

## 5. Supabase Auth Settings
- Dashboard → Authentication → Settings
- **Leaked Password Protection**: ON
- **OTP Expiry**: ubah ke `600`

## 6. Supabase CORS
- Dashboard → Project Settings → API
- Allowed Origins: tambah `https://www.faspira.my.id`, `https://faspira.my.id`

## 7. Vercel
Import `.env`:
```
VITE_SUPABASE_PROJECT_ID=fsspteutxmjrjoyplrll
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_0gv88uTE8qSQv_MUW40GwQ_GBWkM5Ls
VITE_SUPABASE_URL=https://fsspteutxmjrjoyplrll.supabase.co
```

## 8. Verifikasi
```bash
# Test Edge Function submit
curl -X POST "https://fsspteutxmjrjoyplrll.supabase.co/functions/v1/submit-aspiration" \
  -H "Content-Type: application/json" \
  -d '{"student_name":"Test","content":"Test verifikasi aspirasi","honeypot":""}'
# Expected: {"success":true,"id":"..."}

# Test RLS (harusnya empty)
curl -sk "https://fsspteutxmjrjoyplrll.supabase.co/rest/v1/aspirations?select=*&limit=1" \
  -H "apikey: sb_publishable_0gv88uTE8qSQv_MUW40GwQ_GBWkM5Ls" \
  -H "Authorization: Bearer sb_publishable_0gv88uTE8qSQv_MUW40GwQ_GBWkM5Ls"
# Expected: []
```
