// ============================================================
// Shared CORS Configuration — RESTRICTED ORIGINS
// Fix for: CORS Origin Reflection (CVSS 7.5)
// ============================================================

const ALLOWED_ORIGINS = [
  "https://www.faspira.my.id",
  "https://faspira.my.id",
  "http://localhost:5173",   // Vite dev
  "http://localhost:8080",   // Vite dev alt port
  "http://localhost:3000",   // Local testing
];

export function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowedOrigin = origin && ALLOWED_ORIGINS.includes(origin)
    ? origin
    : ALLOWED_ORIGINS[0]; // Default to production

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

export function handleCors(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    const origin = req.headers.get("Origin");
    return new Response(null, {
      status: 204,
      headers: getCorsHeaders(origin),
    });
  }
  return null;
}
