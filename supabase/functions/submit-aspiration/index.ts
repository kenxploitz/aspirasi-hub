// ============================================================
// Secure Aspiration Submission Edge Function
// Server-side rate limiting, validation, spam detection
// Fixes: Race Condition, No Rate Limiting, Spam Protection
// ============================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";

// In-memory rate limiter (per Edge Function instance)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const RATE_LIMIT_MAX = 5; // max 5 submissions per window

const SPAM_PATTERNS = [
  /buy\s*now/i,
  /click\s*here/i,
  /free\s*money/i,
  /casino/i,
  /viagra/i,
  /porn/i,
  /\bxxx\b/i,
  /bitcoin.*invest/i,
  /whatsapp.*\d{10,}/i,
  /telegram.*@/i,
  /wa\.me\/\d+/i,
  /bit\.ly/i,
  /t\.co\//i,
  /tinyurl/i,
];

function getClientFingerprint(req: Request): string {
  // Use multiple signals for fingerprinting
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || req.headers.get("x-real-ip")
    || "unknown";
  const ua = req.headers.get("user-agent") || "unknown";
  // Simple hash of IP + User-Agent
  return `${ip}::${ua.substring(0, 50)}`;
}

function checkRateLimit(fingerprint: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(fingerprint);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(fingerprint, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true };
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return { allowed: false, retryAfter };
  }

  entry.count++;
  return { allowed: true };
}

function detectSpam(content: string): boolean {
  return SPAM_PATTERNS.some((pattern) => pattern.test(content));
}

function sanitizeInput(input: string): string {
  return input
    .replace(/[<>]/g, "") // Remove angle brackets
    .replace(/javascript:/gi, "") // Remove javascript: protocol
    .replace(/on\w+\s*=/gi, "") // Remove event handlers
    .replace(/\s+/g, " ") // Normalize whitespace
    .trim();
}

serve(async (req) => {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const origin = req.headers.get("Origin");
  const corsHeaders = getCorsHeaders(origin);

  try {
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use service role key for server-side insert (bypasses RLS).
    // HARUS dibuat SEBELUM dipakai di query rate-limit di bawah — sebelumnya
    // supabaseAdmin dipakai duluan di sini padahal baru dideklarasikan jauh di
    // bawah (setelah honeypot/validasi), menyebabkan ReferenceError -> HTTP 500
    // pada SETIAP request, sebelum sempat sampai ke proses insert.
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SERVICE_ROLE_KEY") ?? ""
    );

    // Fingerprint client untuk audit log (IP + User-Agent). Sebelumnya
    // variabel `fingerprint` dipakai di bawah tanpa pernah didefinisikan —
    // ReferenceError kedua yang juga menyebabkan 500.
    const fingerprint = getClientFingerprint(req);

    // Rate limiting — database-based (stateless edge function compatible)
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();

    // Use audit_log to track IP-based rate limiting
    const { data: recentLogs } = await supabaseAdmin
      .from("audit_log")
      .select("id", { count: "exact" })
      .eq("action", "INSERT")
      .eq("table_name", "aspirations")
      .gte("created_at", tenMinutesAgo)
      .limit(20);

    const recentCount = recentLogs?.length || 0;
    if (recentCount >= 10) {
      return new Response(
        JSON.stringify({
          error: "Terlalu banyak percobaan. Silakan tunggu beberapa menit lagi.",
          retryAfter: 600,
        }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
            "Retry-After": "600",
          },
        }
      );
    }

    // Parse body
    const body = await req.json();
    const { student_name, student_class, content, honeypot } = body;

    // Honeypot check — if filled, it's a bot
    if (honeypot) {
      // Return success to fool the bot, but don't actually insert
      return new Response(
        JSON.stringify({ success: true, message: "Aspirasi berhasil dikirim." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate required fields
    if (!content || typeof content !== "string") {
      return new Response(
        JSON.stringify({ error: "Aspirasi wajib diisi." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Sanitize inputs
    const sanitizedName = student_name ? sanitizeInput(String(student_name)) : "Anonim";
    const sanitizedClass = student_class ? sanitizeInput(String(student_class)) : null;
    const sanitizedContent = sanitizeInput(String(content));

    // Validate lengths
    if (sanitizedContent.length < 10) {
      return new Response(
        JSON.stringify({ error: "Aspirasi minimal 10 karakter." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (sanitizedContent.length > 2000) {
      return new Response(
        JSON.stringify({ error: "Aspirasi maksimal 2000 karakter." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (sanitizedName.length > 100) {
      return new Response(
        JSON.stringify({ error: "Nama terlalu panjang." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Spam detection
    if (detectSpam(sanitizedContent) || detectSpam(sanitizedName)) {
      // Return success to fool bots
      return new Response(
        JSON.stringify({ success: true, message: "Aspirasi berhasil dikirim." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check for duplicate content from same name in last hour
    const { data: duplicates } = await supabaseAdmin
      .from("aspirations")
      .select("id")
      .eq("student_name", sanitizedName)
      .eq("content", sanitizedContent)
      .gte("created_at", new Date(Date.now() - 3600000).toISOString())
      .limit(1);

    if (duplicates && duplicates.length > 0) {
      return new Response(
        JSON.stringify({ error: "Aspirasi yang sama sudah dikirim sebelumnya." }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Insert aspiration
    const { data, error } = await supabaseAdmin
      .from("aspirations")
      .insert({
        student_name: sanitizedName,
        student_class: sanitizedClass,
        content: sanitizedContent,
        status: "pending",
      })
      .select("id")
      .single();

    if (error) {
      console.error("Insert error:", error);
      return new Response(
        JSON.stringify({ error: "Gagal mengirim aspirasi. Silakan coba lagi." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Log submission for audit
    await supabaseAdmin.from("audit_log").insert({
      action: "INSERT",
      table_name: "aspirations",
      record_id: data.id,
      ip_address: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
      details: {
        student_name: sanitizedName,
        content_length: sanitizedContent.length,
        fingerprint: fingerprint.substring(0, 20), // partial for privacy
      },
    });

    return new Response(
      JSON.stringify({ success: true, id: data.id, message: "Aspirasi berhasil dikirim!" }),
      { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("submit-aspiration error:", error);
    return new Response(
      JSON.stringify({ error: "Terjadi kesalahan internal." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
