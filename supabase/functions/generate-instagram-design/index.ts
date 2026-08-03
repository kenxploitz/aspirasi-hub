import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";

function escapeXML(str: string) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function wrapText(text: string, maxChars: number) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const w of words) {
    const next = current ? current + " " + w : w;
    if (next.length > maxChars) {
      if (current) lines.push(current);
      if (w.length > maxChars) {
        const chunks = w.match(new RegExp(`.{1,${maxChars}}`, "g")) || [w];
        lines.push(...chunks.slice(0, -1));
        current = chunks[chunks.length - 1];
      } else {
        current = w;
      }
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines;
}

serve(async (req) => {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const origin = req.headers.get("Origin");
  const corsHeaders = getCorsHeaders(origin);

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: req.headers.get("Authorization") || "" } } }
    );

    const { aspirationId } = await req.json();
    if (!aspirationId) throw new Error("aspirationId is required");

    const { data: aspiration, error } = await supabase
      .from("aspirations")
      .select("id, content, created_at")
      .eq("id", aspirationId)
      .single();

    if (error) throw error;
    if (!aspiration?.content) throw new Error("Aspiration not found or empty");

    // Format date in Indonesian
    const dateObj = new Date(aspiration.created_at);
    const formattedDate = dateObj.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    const raw = String(aspiration.content).trim();
    const safe = escapeXML(raw);

    // Dynamic font size and responsive text wrapping
    let fontSize = 36;
    if (safe.length > 500) fontSize = 24;
    else if (safe.length > 360) fontSize = 28;
    else if (safe.length > 220) fontSize = 32;
    else if (safe.length > 120) fontSize = 34;

    // Calculate max characters per line for better centering
    const maxChars = Math.max(25, Math.floor(700 / (fontSize * 0.48)));
    let lines = wrapText(safe, maxChars);

    // Limit lines to fit in card
    const maxLines = 16;
    if (lines.length > maxLines) {
      lines = lines.slice(0, maxLines);
      const last = lines[lines.length - 1];
      lines[lines.length - 1] = last.replace(/\.*$/, "").slice(0, Math.max(0, maxChars - 3)) + "...";
    }

    const lineHeight = Math.floor(fontSize * 1.5);
    const contentHeight = lineHeight * lines.length;
    // Center vertically in available space (between header at 210 and footer at 870)
    const availableHeight = 870 - 210;
    const startY = 210 + Math.floor((availableHeight - contentHeight) / 2) + lineHeight;

    const tspans = lines
      .map((line, i) => `<tspan x="540" dy="${i === 0 ? 0 : lineHeight}" xml:space="preserve">${line}</tspan>`)
      .join("");

    // Clean centered design like reference
    const svg = `
      <svg width="1080" height="1080" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:rgb(99, 102, 241);stop-opacity:1" />
            <stop offset="50%" style="stop-color:rgb(139, 92, 246);stop-opacity:1" />
            <stop offset="100%" style="stop-color:rgb(168, 85, 247);stop-opacity:1" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
          <filter id="shadow">
            <feDropShadow dx="0" dy="8" stdDeviation="12" flood-opacity="0.25"/>
          </filter>
        </defs>
        
        <!-- Background with gradient -->
        <rect width="1080" height="1080" fill="url(#bgGradient)"/>
        
        <!-- Decorative elements -->
        <circle cx="150" cy="150" r="200" fill="white" opacity="0.08"/>
        <circle cx="930" cy="930" r="250" fill="white" opacity="0.08"/>
        <circle cx="900" cy="180" r="120" fill="white" opacity="0.05"/>
        <circle cx="180" cy="900" r="150" fill="white" opacity="0.05"/>
        
        <!-- Main content card -->
        <rect x="90" y="90" width="900" height="900" rx="40" fill="white" filter="url(#shadow)" opacity="0.98"/>
        
        <!-- Decorative top accent -->
        <rect x="90" y="90" width="900" height="8" rx="40" fill="url(#bgGradient)"/>
        
        <!-- Header -->
        <text x="540" y="180" font-family="Arial, sans-serif" font-size="42" font-weight="bold" text-anchor="middle" fill="#6366F1" filter="url(#glow)">
          Aspirasi Siswa
        </text>
        
        <!-- Decorative line -->
        <line x1="240" y1="210" x2="840" y2="210" stroke="#A78BFA" stroke-width="2" opacity="0.5"/>
        
        <!-- Content text - centered and responsive -->
        <text x="540" y="${startY}" 
          text-anchor="middle" 
          font-family="Arial, sans-serif"
          font-size="${fontSize}" 
          fill="#1F2937" 
          font-weight="500">
          ${tspans}
        </text>
        
        <!-- Decorative bottom line -->
        <line x1="240" y1="870" x2="840" y2="870" stroke="#A78BFA" stroke-width="2" opacity="0.5"/>
        
        <!-- Footer with date -->
        <text x="540" y="940" font-family="Arial, sans-serif" font-size="26" text-anchor="middle" fill="#6366F1" font-weight="500">
          📅 ${escapeXML(formattedDate)}
        </text>
      </svg>
    `;

    return new Response(svg, {
      headers: { ...corsHeaders, "Content-Type": "image/svg+xml" },
    });
  } catch (error: any) {
    console.error("generate-instagram-design error:", error);
    // Don't leak internal error details (JWT verification, etc.)
    return new Response(
      JSON.stringify({ error: "Gagal membuat desain. Silakan coba lagi." }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
