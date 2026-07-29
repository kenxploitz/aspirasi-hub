# FASPIRA Security Fix — Deployment Guide
## Step-by-Step Manual Configuration di Supabase Dashboard

> **Tanggal:** 2026-07-29
> **Target:** https://fsspteutxmjrjoyplrll.supabase.co
> **Project Ref:** fsspteutxmjrjoyplrll

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Jalankan Migration SQL](#2-jalankan-migration-sql)
3. [Deploy Edge Functions](#3-deploy-edge-functions)
4. [Set Environment Variable SUPABASE_SERVICE_ROLE_KEY](#4-set-environment-variable-supabase_service_role_key)
5. [Enable Leaked Password Protection](#5-enable-leaked-password-protection)
6. [Set OTP Expiry ke 600 Detik](#6-set-otp-expiry-ke-600-detik)
7. [Update CORS Allowed Origins](#7-update-cors-allowed-origins)
8. [Rotate Anon Key (Opsional tapi Direkomendasikan)](#8-rotate-anon-key-opsional-tapi-direkomendasikan)
9. [Deploy Frontend ke Vercel](#9-deploy-frontend-ke-vercel)
10. [Verifikasi Semua Fix](#10-verifikasi-semua-fix)

---

## 1. Prerequisites

Pastikan lo punya akses ke:

- **Supabase Dashboard:** https://supabase.com/dashboard/project/fsspteutxmjrjoyplrll
- **Vercel Dashboard:** https://vercel.com/dashboard
- **Supabase CLI** terinstall (untuk deploy Edge Functions):
  ```bash
  # Install Supabase CLI
  npm install -g supabase
  
  # Atau pakai brew (macOS)
  brew install supabase/tap/supabase
  
  # Atau pakai scoop (Windows)
  scoop install supabase
  ```

- **Login ke Supabase CLI:**
  ```bash
  supabase login
  ```

---

## 2. Jalankan Migration SQL

### Kenapa?
RLS policies yang lama membolehkan anonymous user untuk:
- **SELECT** (baca 421+ data aspirasi siswa)
- **INSERT** (kirim aspirasi tanpa batasan)
- **DELETE** (hapus aspirasi siapa saja)

Migration ini akan:
- Drop semua policy lama
- Buat policy baru yang ketat
- Tambah rate limiting trigger
- Buat audit log table
- Revoke permissions dari anon role

### Step-by-Step:

#### 2.1. Buka Supabase SQL Editor
1. Login ke **Supabase Dashboard**: https://supabase.com/dashboard/project/fsspteutxmjrjoyplrll
2. Klik menu **SQL Editor** di sidebar kiri (icon database)
3. Klik **New Query** (tombol + di kiri atas)

#### 2.2. Copy Migration SQL
1. Buka file: `supabase/migrations/20260729000000_security_fix_rls_policies.sql`
2. Copy **SELURUH** isi file (Ctrl+A, Ctrl+C)
3. Paste ke SQL Editor di Supabase Dashboard

#### 2.3. Execute SQL
1. Klik tombol **Run** (atau tekan Ctrl+Enter)
2. Tunggu sampai muncul pesan **"Success"**
3. Kalau ada error, cek bagian mana yang gagal dan copy-paste ulang bagian tersebut

#### 2.4. Verifikasi RLS Sudah Aktif
1. Klik menu **Table Editor** di sidebar
2. Klik tabel **aspirations**
3. Klik tab **Authentication** (icon gembok)
4. Pastikan **Row Level Security** = `Enabled`
5. Klik **View Policies** — pastikan policy baru sudah muncul:
   - `Public can insert validated aspirations` (INSERT)
   - `Only admins can read aspirations` (SELECT)
   - `Only admins can update aspirations` (UPDATE)
   - `Only superadmins can delete aspirations` (DELETE)

#### 2.5. Verifikasi Tabel audit_log
1. Klik menu **Table Editor**
2. Cari tabel **audit_log** — harusnya sudah ada
3. Klik tab **Authentication** — pastikan RLS enabled

---

## 3. Deploy Edge Functions

### Kenapa?
Edge Function `submit-aspiration` adalah server-side proxy yang menambahkan:
- **Rate limiting** (5 request per 10 menit per IP)
- **Honeypot detection** (bot trap)
- **Spam keyword filtering**
- **Duplicate content detection**
- **Input sanitization** di server-side
- **Audit logging**

### Step-by-Step:

#### 3.1. Pastikan Supabase CLI Terinstall
```bash
supabase --version
# Harusnya output versi, contoh: 1.x.x
```

#### 3.2. Login ke Supabase
```bash
supabase login
# Browser akan terbuka, login dengan akun Supabase lo
```

#### 3.3. Link ke Project
```bash
cd /home/keandra/Pictures/kenxploit
supabase link --project-ref fsspteutxmjrjoyplrll
```

#### 3.4. Deploy Edge Function submit-aspiration
```bash
supabase functions deploy submit-aspiration
```

Output yang diharapkan:
```
Deploying function submit-aspiration...
Function submit-aspiration deployed successfully.
```

#### 3.5. Deploy Edge Functions Lainnya (yang sudah di-update CORS-nya)
```bash
supabase functions deploy download-aspirations
supabase functions deploy generate-instagram-design
```

#### 3.6. Verifikasi Edge Functions
1. Buka Supabase Dashboard
2. Klik menu **Edge Functions** di sidebar
3. Pastikan 3 functions muncul:
   - `submit-aspiration`
   - `download-aspirations`
   - `generate-instagram-design`

---

## 4. Set Environment Variable SUPABASE_SERVICE_ROLE_KEY

### Kenapa?
Edge Function `submit-aspiration` butuh **service_role key** untuk bypass RLS saat insert data. Ini aman karena:
- Service role key **hanya ada di server** (Edge Function), bukan di client
- Client tetap pakai anon key yang dibatasi RLS

### Step-by-Step:

#### 4.1. Ambil Service Role Key
1. Buka Supabase Dashboard
2. Klik menu **Project Settings** (icon gear di kiri bawah)
3. Klik **API** di sidebar kiri
4. Scroll ke bagian **Project API keys**
5. Cari **service_role** key (warna merah/hijau)
6. Klik **Copy** di sebelah kanan key

> ⚠️ **PERINGATAN:** Service role key punya akses FULL ke database. JANGAN pernah expose di client-side code!

#### 4.2. Set di Edge Function Settings
1. Buka Supabase Dashboard
2. Klik menu **Edge Functions** di sidebar
3. Klik function **submit-aspiration**
4. Klik tab **Settings** (atau **Environment Variables**)
5. Klik **Add new secret**
6. Isi:
   - **Name:** `SUPABASE_SERVICE_ROLE_KEY`
   - **Value:** (paste service_role key yang sudah di-copy)
7. Klik **Save**

#### 4.3. Verifikasi
1. Coba test Edge Function:
   ```bash
   curl -X POST "https://fsspteutxmjrjoyplrll.supabase.co/functions/v1/submit-aspiration" \
     -H "Content-Type: application/json" \
     -d '{"student_name":"Test","content":"Test aspirasi untuk verifikasi","honeypot":""}'
   ```
2. Harusnya return: `{"success":true,"id":"...","message":"Aspirasi berhasil dikirim!"}`

---

## 5. Enable Leaked Password Protection

### Kenapa?
Fitur ini mengecek password yang dimasukkan user terhadap database password yang bocor (dari HaveIBeenPwned). Kalau password user pernah bocor, Supabase akan menolak login.

### Step-by-Step:

1. Buka Supabase Dashboard
2. Klik menu **Authentication** di sidebar
3. Klik **Settings** (tab di bagian atas)
4. Scroll ke bagian **Security and Protection**
5. Cari opsi **Leaked Password Protection**
6. **Toggle ON** / Aktifkan
7. Klik **Save** kalau ada tombol save

> Catatan: Fitur ini butuh plan **Pro** atau lebih tinggi di Supabase. Kalau pakai Free plan, skip step ini.

---

## 6. Set OTP Expiry ke 600 Detik

### Kenapa?
Default OTP expiry di Supabase adalah 3600 detik (1 jam). Ini terlalu lama — kalau OTP bocor, attacker punya 1 jam untuk pakai. 600 detik (10 menit) lebih aman.

### Step-by-Step:

1. Buka Supabase Dashboard
2. Klik menu **Authentication** di sidebar
3. Klik **Settings** (tab di bagian atas)
4. Scroll ke bagian **Email Auth**
5. Cari **OTP Expiry Duration**
6. Ubah dari `3600` ke `600`
7. Klik **Save**

---

## 7. Update CORS Allowed Origins

### Kenapa?
CORS yang lama memantulkan (reflect) origin apapun — artinya website mana saja bisa buat request ke API Supabase lo. Ini berbahaya karena attacker bisa curi data dari browser korban.

### Step-by-Step:

#### 7.1. Update di Supabase Dashboard
1. Buka Supabase Dashboard
2. Klik menu **Project Settings** (icon gear)
3. Klik **API** di sidebar kiri
4. Scroll ke bagian **CORS Configuration** (atau **API Settings**)
5. Cari **Allowed Origins**
6. Hapus semua origin yang ada (terutama `*`)
7. Tambahkan origin berikut (satu per satu):
   ```
   https://www.faspira.my.id
   https://faspira.my.id
   http://localhost:5173
   http://localhost:8080
   ```
8. Klik **Save**

#### 7.2. Verifikasi CORS
Test dari terminal:
```bash
# Test dari origin yang diizinkan (harus berhasil)
curl -sk -I "https://fsspteutxmjrjoyplrll.supabase.co/rest/v1/aspirations?select=count" \
  -H "Origin: https://www.faspira.my.id" \
  -H "apikey: <ANON_KEY>"
# Harusnya: access-control-allow-origin: https://www.faspira.my.id

# Test dari origin yang TIDAK diizinkan (harusnya gagal atau tidak reflect)
curl -sk -I "https://fsspteutxmjrjoyplrll.supabase.co/rest/v1/aspirations?select=count" \
  -H "Origin: https://evil.com" \
  -H "apikey: <ANON_KEY>"
# Harusnya: TIDAK ada header access-control-allow-origin, atau origin tidak di-reflect
```

---

## 8. Rotate Anon Key (Opsional tapi Direkomendasikan)

### Kenapa?
Anon key yang lama sudah expose di JavaScript bundle publik. Siapapun bisa pakai key ini untuk akses Supabase API langsung. Rotate key akan membuat key lama tidak berlaku.

### ⚠️ PERINGATAN
Rotating anon key akan **MENGHENTIKAN** semua client yang pakai key lama. Pastikan lo sudah update `.env` di project dan redeploy frontend SEBELUM rotate.

### Step-by-Step:

#### 8.1. Generate Anon Key Baru
1. Buka Supabase Dashboard
2. Klik menu **Project Settings** (icon gear)
3. Klik **API** di sidebar kiri
4. Scroll ke bagian **Project API keys**
5. Cari **anon** / **publishable** key
6. Klik **Rotate** atau **Generate New Key**
7. **Copy** key baru

> Catatan: Tidak semua plan Supabase support key rotation. Kalau tidak ada tombol rotate, lo perlu buat API key baru.

#### 8.2. Update Environment Variables
1. Update file `.env` di project lokal:
   ```env
   VITE_SUPABASE_PUBLISHABLE_KEY="sb_publishable_KEY_BARU"
   ```
2. Update di **Vercel Dashboard**:
   - Buka https://vercel.com/dashboard
   - Klik project **aspirasi-hub**
   - Klik **Settings** → **Environment Variables**
   - Edit `VITE_SUPABASE_PUBLISHABLE_KEY` dengan key baru
   - Klik **Save**

#### 8.3. Redeploy Frontend
```bash
cd /home/keandra/Pictures/kenxploit
git add -A
git commit -m "fix: security hardening - RLS, CORS, rate limiting, sanitization"
git push origin main
```
Vercel akan auto-deploy kalau sudah connected ke GitHub.

#### 8.4. Verifikasi
1. Buka https://www.faspira.my.id
2. Pastikan aplikasi berjalan normal
3. Coba submit aspirasi — harusnya berhasil
4. Coba akses Supabase API dengan key lama — harusnya gagal

---

## 9. Deploy Frontend ke Vercel

### Step-by-Step:

#### 9.1. Install Dependencies Baru
```bash
cd /home/keandra/Pictures/kenxploit
npm install
```

#### 9.2. Build dan Test Lokal
```bash
npm run build
# Pastikan tidak ada error

npm run preview
# Buka http://localhost:4173, pastikan aplikasi jalan
```

#### 9.3. Push ke GitHub
```bash
git add -A
git status  # Review perubahan
git commit -m "fix: comprehensive security hardening

- Fix RLS policies: block anon DELETE/UPDATE, validate INSERT
- Add Edge Function submit-aspiration with rate limiting
- Add security headers (CSP, X-Frame-Options, etc)
- Fix CORS: restrict to faspira.my.id only
- Add DOMPurify for content sanitization
- Add honeypot + client-side spam detection
- Remove hardcoded superadmin emails from frontend
- Remove hidden admin login link from footer
- Sanitize PDF generation content
- Add .env.example, fix .gitignore
- Update supabase config"

git push origin main
```

#### 9.4. Verifikasi Deployment
1. Buka https://vercel.com/dashboard
2. Klik project — pastikan deployment **Succeeded**
3. Buka https://www.faspira.my.id
4. Test semua fitur:
   - Landing page
   - Submit aspirasi
   - Admin login
   - Admin dashboard
   - Download PDF
   - Statistics page

---

## 10. Verifikasi Semua Fix

### Checklist Verifikasi

#### A. RLS Policy Test (pakai Supabase REST API)
```bash
ANON_KEY="<ANON_KEY_BARU>"

# Test 1: SELECT harusnya GAGAL (403/empty)
curl -sk "https://fsspteutxmjrjoyplrll.supabase.co/rest/v1/aspirations?select=*&limit=1" \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $ANON_KEY"
# Expected: [] (empty array — RLS blocks)

# Test 2: INSERT harusnya BERHASIL (lewat Edge Function)
curl -X POST "https://fsspteutxmjrjoyplrll.supabase.co/functions/v1/submit-aspiration" \
  -H "Content-Type: application/json" \
  -d '{"student_name":"Test User","content":"Test aspirasi untuk verifikasi keamanan","honeypot":""}'
# Expected: {"success":true,"id":"...","message":"Aspirasi berhasil dikirim!"}

# Test 3: DELETE harusnya GAGAL
curl -sk "https://fsspteutxmjrjoyplrll.supabase.co/rest/v1/aspirations?id=eq.test" \
  -X DELETE \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $ANON_KEY"
# Expected: Error atau empty (RLS blocks)

# Test 4: Rate limiting test
for i in {1..10}; do
  curl -s -o /dev/null -w "Request $i: HTTP %{http_code}\n" \
    -X POST "https://fsspteutxmjrjoyplrll.supabase.co/functions/v1/submit-aspiration" \
    -H "Content-Type: application/json" \
    -d "{\"student_name\":\"Spam $i\",\"content\":\"Spam content test $i\",\"honeypot\":\"\"}"
done
# Expected: Request 1-5 = 201/200, Request 6+ = 429 (rate limited)
```

#### B. Security Headers Test
```bash
curl -sk -I "https://www.faspira.my.id" | grep -i "x-frame-options\|x-content-type\|content-security-policy\|referrer-policy\|permissions-policy"
# Expected: Semua header muncul
```

#### C. CORS Test
```bash
# Test origin yang diizinkan
curl -sk -I "https://fsspteutxmjrjoyplrll.supabase.co/rest/v1/aspirations" \
  -H "Origin: https://www.faspira.my.id" \
  -H "apikey: $ANON_KEY"
# Expected: access-control-allow-origin: https://www.faspira.my.id

# Test origin yang TIDAK diizinkan
curl -sk -I "https://fsspteutxmjrjoyplrll.supabase.co/rest/v1/aspirations" \
  -H "Origin: https://evil.com" \
  -H "apikey: $ANON_KEY"
# Expected: Tidak ada access-control-allow-origin header
```

#### D. Honeypot Test
```bash
# Bot mengisi honeypot — harusnya "berhasil" tapi tidak insert
curl -X POST "https://fsspteutxmjrjoyplrll.supabase.co/functions/v1/submit-aspiration" \
  -H "Content-Type: application/json" \
  -d '{"student_name":"Bot","content":"Bot content here","honeypot":"http://spam.com"}'
# Expected: {"success":true,...} — tapi data TIDAK masuk ke database
```

#### E. Spam Detection Test
```bash
# Spam keywords harusnya ditolak
curl -X POST "https://fsspteutxmjrjoyplrll.supabase.co/functions/v1/submit-aspiration" \
  -H "Content-Type: application/json" \
  -d '{"student_name":"Spammer","content":"buy now click here free money casino","honeypot":""}'
# Expected: {"success":true,...} — tapi data TIDAK masuk (dibalikin success untuk fool bot)
```

---

## Troubleshooting

### Error: "new row violates row-level security policy"
- **Penyebab:** RLS policy terlalu ketat
- **Fix:** Pastikan INSERT policy membolehkan `status = 'pending'`

### Edge Function return 500
- **Penyebab:** `SUPABASE_SERVICE_ROLE_KEY` belum di-set
- **Fix:** Ulangi Step 4

### CORS error di browser
- **Penyebab:** Origin belum ditambahkan di Supabase CORS settings
- **Fix:** Ulangi Step 7

### Frontend tidak bisa akses setelah rotate key
- **Penyebab:** Key baru belum di-update di environment variables
- **Fix:** Update `.env` dan redeploy

### Rate limit terlalu ketat
- **Penyebab:** IP lo kena rate limit saat testing
- **Fix:** Tunggu 10 menit, atau ubah `RATE_LIMIT_MAX` di Edge Function

---

## Summary Perubahan

| Component | Before | After |
|-----------|--------|-------|
| **RLS SELECT aspirations** | Public (anyone can read) | Admin only |
| **RLS DELETE aspirations** | Public (anyone can delete) | Superadmin only |
| **RLS INSERT aspirations** | Public (unvalidated) | Public (validated + rate limited) |
| **CORS** | `*` (reflect any origin) | Whitelist faspira.my.id only |
| **Security Headers** | None | CSP, X-Frame-Options, etc. |
| **Rate Limiting** | None | 5 per 10 min (server-side) |
| **Spam Protection** | None | Honeypot + keyword filter |
| **Input Sanitization** | Client only | Client + Server (DOMPurify) |
| **Admin Email Exposure** | Hardcoded in JS | Server-side only |
| **PDF Sanitization** | None | HTML entity encoding |
| **Audit Logging** | None | audit_log table |
