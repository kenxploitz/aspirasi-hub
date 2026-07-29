import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";

serve(async (req) => {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const origin = req.headers.get("Origin");
  const corsHeaders = getCorsHeaders(origin);

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { type, aspirationId } = await req.json();

    if (type === 'design' && aspirationId) {
      // Generate Instagram design for single aspiration
      const { data: aspiration, error } = await supabaseClient
        .from('aspirations')
        .select('*')
        .eq('id', aspirationId)
        .single();

      if (error) throw error;

      const date = new Date(aspiration.created_at).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });

      // Create SVG design for Instagram (1080x1350 - Instagram portrait)
      const contentPreview = aspiration.content.length > 250 
        ? aspiration.content.substring(0, 250) + '...' 
        : aspiration.content;

      // Prepare safe wrapped text (avoid foreignObject for wider support)
      const escapeXml = (s: string) => s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

      const wrapText = (text: string, maxChars = 40) => {
        const words = text.split(/\s+/);
        const lines: string[] = [];
        let line = '';
        for (const w of words) {
          if ((line + (line ? ' ' : '') + w).length <= maxChars) {
            line = line ? line + ' ' + w : w;
          } else {
            if (line) lines.push(line);
            line = w;
          }
        }
        if (line) lines.push(line);
        return lines.slice(0, 12); // cap lines to fit the card
      };

      const wrappedLines = wrapText(contentPreview, 40).map(escapeXml);
      const tspans = wrappedLines
        .map((ln, i) => `<tspan x="140" dy="${i === 0 ? 0 : 38}">${ln}</tspan>`) 
        .join('');

      const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1080" height="1350" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#3B82F6;stop-opacity:1" />
      <stop offset="50%" style="stop-color:#8B5CF6;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#EC4899;stop-opacity:1" />
    </linearGradient>
    <filter id="shadow">
      <feDropShadow dx="0" dy="8" stdDeviation="12" flood-opacity="0.4"/>
    </filter>
  </defs>
  
  <!-- Background -->
  <rect width="1080" height="1350" fill="url(#bgGradient)"/>
  
  <!-- Decorative elements -->
  <circle cx="150" cy="150" r="200" fill="white" opacity="0.08"/>
  <circle cx="930" cy="200" r="150" fill="white" opacity="0.08"/>
  <circle cx="100" cy="1200" r="180" fill="white" opacity="0.08"/>
  <circle cx="950" cy="1100" r="220" fill="white" opacity="0.08"/>
  
  <!-- Main content card -->
  <rect x="60" y="100" width="960" height="1150" rx="40" fill="white" filter="url(#shadow)"/>
  
  <!-- Header section -->
  <rect x="60" y="100" width="960" height="180" rx="40" fill="#1E293B" fill-opacity="0.95"/>
  <text x="540" y="200" font-family="Arial, sans-serif" font-size="56" font-weight="bold" text-anchor="middle" fill="white">
    Portal Aspirasi
  </text>
  <text x="540" y="245" font-family="Arial, sans-serif" font-size="36" text-anchor="middle" fill="#94A3B8">
    Suara Siswa
  </text>
  
  <!-- Student info section -->
  <rect x="100" y="320" width="880" height="180" rx="20" fill="#F1F5F9"/>
  
  <text x="140" y="380" font-family="Arial, sans-serif" font-size="32" font-weight="600" fill="#1E293B">
    👤 ${aspiration.student_name.replace(/[<>&"']/g, '')}
  </text>
  
  <text x="140" y="430" font-family="Arial, sans-serif" font-size="28" fill="#64748B">
    🎓 ${(aspiration.student_class || 'Anonim').replace(/[<>&"']/g, '')}
  </text>
  
  <text x="140" y="475" font-family="Arial, sans-serif" font-size="26" fill="#94A3B8">
    📅 ${date}
  </text>
  
  <!-- Content section -->
  <rect x="100" y="540" width="880" height="580" rx="20" fill="#FAFAFA"/>
  
  <!-- Wrapped text without foreignObject for broad renderer support -->
  <text x="140" y="610" font-family="Arial, sans-serif" font-size="28" fill="#1E293B" xml:space="preserve">
    ${tspans}
  </text>
  
  <!-- Footer -->
  <rect x="100" y="1160" width="880" height="70" rx="15" fill="#F1F5F9"/>
  <text x="540" y="1205" font-family="Arial, sans-serif" font-size="24" font-weight="600" text-anchor="middle" fill="#64748B">
    ✨ Terima kasih atas aspirasi Anda! ✨
  </text>
</svg>`;

      // Return SVG directly to avoid platform bundling issues
      return new Response(svg, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'image/svg+xml',
          'Content-Disposition': `attachment; filename="aspirasi-design-${aspiration.student_name.replace(/\s/g, '-')}-${new Date().toISOString().split('T')[0]}.svg"`,
        },
      });
    } else if (type === 'all') {
      // Download all aspirations as CSV
      const { data: aspirations, error } = await supabaseClient
        .from('aspirations')
        .select(`
          *,
          comments (
            comment_text,
            created_at
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Generate CSV matching PDF format exactly
      let csv = 'No,Nama Siswa,Kelas,Isi Aspirasi,Tanggal,Status,Jumlah Komentar\n';
      
      aspirations.forEach((asp, index) => {
        const date = new Date(asp.created_at).toLocaleDateString('id-ID', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        });
        const escapedContent = `"${asp.content.replace(/"/g, '""')}"`;
        const kelas = asp.student_class || '-';
        const commentCount = asp.comments?.length || 0;
        
        csv += `${index + 1},${asp.student_name},${kelas},${escapedContent},${date},${asp.status.toUpperCase()},${commentCount}\n`;
      });

      return new Response(csv, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="aspirasi-rekap-${new Date().toISOString().split('T')[0]}.csv"`,
        },
      });
    } else if (type === 'single' && aspirationId) {
      // Download single aspiration as formatted text/PDF
      const { data: aspiration, error } = await supabaseClient
        .from('aspirations')
        .select(`
          *,
          comments (
            comment_text,
            created_at
          )
        `)
        .eq('id', aspirationId)
        .single();

      if (error) throw error;

      // Generate formatted document
      const date = new Date(aspiration.created_at).toLocaleString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

      let document = `
╔════════════════════════════════════════════════════════════╗
║           FORUM ASPIRASI SISWA - DETAIL ASPIRASI           ║
╚════════════════════════════════════════════════════════════╝

───────────────────────────────────────────────────────────────
INFORMASI SISWA
───────────────────────────────────────────────────────────────

Nama          : ${aspiration.student_name}
Kelas         : ${aspiration.student_class || '-'}
Tanggal       : ${date}
Status        : ${aspiration.status}

───────────────────────────────────────────────────────────────
ISI ASPIRASI
───────────────────────────────────────────────────────────────

${aspiration.content}

`;

      if (aspiration.comments && aspiration.comments.length > 0) {
        document += `
───────────────────────────────────────────────────────────────
KOMENTAR ADMIN (${aspiration.comments.length})
───────────────────────────────────────────────────────────────

`;
        aspiration.comments.forEach((comment: any, index: number) => {
          const commentDate = new Date(comment.created_at).toLocaleString('id-ID', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          });
          document += `${index + 1}. [${commentDate}]
   ${comment.comment_text}

`;
        });
      }

      document += `
───────────────────────────────────────────────────────────────
Dokumen ini dihasilkan secara otomatis oleh Portal Aspirasi
Tanggal Unduh: ${new Date().toLocaleString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })}
───────────────────────────────────────────────────────────────
`;

      return new Response(document, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/plain; charset=utf-8',
          'Content-Disposition': `attachment; filename="aspirasi-${aspiration.student_name}-${new Date(aspiration.created_at).toISOString().split('T')[0]}.txt"`,
        },
      });
    }

    throw new Error('Invalid request type');
  } catch (error) {
    console.error('Error in download-aspirations:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
