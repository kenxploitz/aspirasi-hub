// AI Admin Agent Edge Function — Tool-calling based assistant
// Bisa: cari, hitung statistik, lihat detail lengkap, kelompokkan topik,
// tandai status, ubah filter/pilihan, ekspor 4 format, dan usul hapus (tetap
// perlu konfirmasi manusia di UI — agent TIDAK PERNAH menghapus langsung).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";

const SYSTEM_PROMPT = `Kamu adalah asisten AI internal yang SANGAT PINTAR dan PROAKTIF untuk admin sekolah SMA Negeri 1 Kendal. Kamu mengelola aspirasi siswa di aplikasi FASPIRA.

KEPRIBADIAN:
- Kamu cerdas, analitis, dan proaktif — jangan menunggu instruksi, tawarkan insight
- Gunakan bahasa Indonesia yang profesional tapi ramah
- Selalu berikan analisis dan rekomendasi berdasarkan data
- Gunakan emoji yang tepat untuk membuat respons lebih hidup
- Format respons dengan markdown: **bold**, bullet, tabel, heading

KONTEKS:
- Tahun: 2026. "april ke juni" = 2026-04-01 sampai 2026-06-30
- Sekolah: SMA Negeri 1 Kendal
- Data: nama siswa (bisa anonim), kelas, isi aspirasi, status (belum_ditanggapi/sudah_ditanggapi)

KEMAMPUAN (tools):
1. search_aspirations — cari/filter data (SELALU limit 100+)
2. get_statistics — hitung statistik lengkap
3. get_aspiration_details — ambil detail lengkap per ID
4. cluster_topics — kelompokkan berdasarkan topik (analisis otomatis)
5. select_aspirations — centang di dashboard
6. mark_aspirations_status — ubah status
7. apply_filters — terapkan filter dashboard
8. trigger_export — download PDF/Word/Excel/PPTX
9. delete_aspirations — usulkan hapus (perlu konfirmasi admin)
10. tag_aspirations — beri tag/label
11. remove_tags — hapus tag
12. get_tags — lihat daftar tag

STRATEGI RESPONS:
1. SELALU panggil tools untuk eksekusi — jangan cuma jawab teks
2. Setelah eksekusi, berikan:
   - Ringkasan hasil dengan angka spesifik
   - Insight/pola yang menarik
   - Rekomendasi tindakan selanjutnya
   - Pertanyaan follow-up yang relevan
3. Gunakan tabel markdown untuk data terstruktur
4. Kelompokkan topik secara OTOMATIS saat user minta analisis
5. Tawarkan ekspor setelah pencarian/analisis
6. Jangan pernah mengarang data

CONTOH RESPONS YANG BAIK:
"Saya menemukan **47 aspirasi** tentang kantin sekolah. Berikut analisisnya:

| Topik | Jumlah | Status |
|-------|--------|--------|
| Harga makanan | 23 | 12 belum ditanggapi |
| Kebersihan | 15 | 8 belum ditanggapi |
| Variasi menu | 9 | 5 belum ditanggapi |

🔍 **Insight:** Mayoritas keluhan soal harga makanan. Ini bisa jadi prioritas utama.

💡 **Rekomendasi:** 
- Tandai 25 aspirasi belum ditanggapi sebagai 'sudah ditanggapi'?
- Export laporan ini ke Word untuk rapat dewan guru?
- Kelompokkan berdasarkan kelas untuk melihat pola per angkatan?

Mau saya lakukan yang mana?"`;

const TOOLS = [
  {
    type: "function",
    function: {
      name: "search_aspirations",
      description: "Cari/filter aspirasi dari SELURUH data tersimpan. Gunakan limit BESAR (100+). Tahun sekarang: 2026 — kalau user bilang 'april ke juni', gunakan 2026-04-01 sampai 2026-06-30.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Kata kunci pencarian pada isi aspirasi, nama siswa, atau kelas. Kosongkan jika hanya ingin filter status/tanggal." },
          status: { type: "string", enum: ["sudah_ditanggapi", "belum_ditanggapi", "all"] },
          date_from: { type: "string", description: "ISO date, awal rentang" },
          date_to: { type: "string", description: "ISO date, akhir rentang" },
          limit: { type: "number", description: "Maksimal hasil dikembalikan, default 40" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_statistics",
      description: "Hitung ringkasan statistik (total, sudah/belum ditanggapi, breakdown per kelas) dari SELURUH data.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "get_aspiration_details",
      description: "Ambil isi lengkap (tidak terpotong) dan seluruh tanggapan admin untuk ID aspirasi tertentu. Maksimal 15 ID per panggilan.",
      parameters: {
        type: "object",
        properties: { ids: { type: "array", items: { type: "string" }, maxItems: 15 } },
        required: ["ids"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "cluster_topics",
      description: "Laporkan hasil pengelompokan aspirasi berdasarkan topik. Dirender sebagai kartu-kartu topik dengan tombol aksi untuk admin.",
      parameters: {
        type: "object",
        properties: {
          groups: {
            type: "array",
            items: {
              type: "object",
              properties: {
                topic_name: { type: "string" },
                aspiration_ids: { type: "array", items: { type: "string" } },
                summary: { type: "string" },
              },
              required: ["topic_name", "aspiration_ids", "summary"],
            },
          },
        },
        required: ["groups"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "select_aspirations",
      description: "Aktifkan mode pilih (checkbox) di dashboard dan centang otomatis ID yang diberikan, supaya admin bisa meninjau sebelum melakukan aksi manual lanjutan.",
      parameters: {
        type: "object",
        properties: { ids: { type: "array", items: { type: "string" } } },
        required: ["ids"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "mark_aspirations_status",
      description: "Tandai beberapa aspirasi dengan status baru.",
      parameters: {
        type: "object",
        properties: {
          ids: { type: "array", items: { type: "string" }, description: "ID aspirasi" },
          status: { type: "string", enum: ["sudah_ditanggapi", "belum_ditanggapi"] },
        },
        required: ["ids", "status"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "apply_filters",
      description: "Terapkan filter pada dashboard admin (status, rentang tanggal, dan/atau kata kunci pencarian).",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["sudah_ditanggapi", "belum_ditanggapi", "all"] },
          date_from: { type: "string", description: "ISO date" },
          date_to: { type: "string", description: "ISO date" },
          search_query: { type: "string" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "trigger_export",
      description: "Picu download laporan untuk ID aspirasi tertentu dalam format pilihan.",
      parameters: {
        type: "object",
        properties: {
          aspiration_ids: { type: "array", items: { type: "string" } },
          format: { type: "string", enum: ["pdf", "word", "excel", "pptx"] },
          title: { type: "string" },
        },
        required: ["aspiration_ids", "format"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_aspirations",
      description: "Usulkan penghapusan beberapa aspirasi berdasarkan ID. SELALU memunculkan dialog konfirmasi manual ke admin sebelum benar-benar terhapus.",
      parameters: {
        type: "object",
        properties: { ids: { type: "array", items: { type: "string" }, description: "ID aspirasi yang diusulkan untuk dihapus" } },
        required: ["ids"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "tag_aspirations",
      description: "Beri tag/label ke beberapa aspirasi. Tag persisten, bisa di-filter. Contoh: 'AC', 'Pacaran', 'Kantin', 'Prioritas'.",
      parameters: {
        type: "object",
        properties: {
          ids: { type: "array", items: { type: "string" } },
          tag_name: { type: "string", description: "Nama tag" },
          color: { type: "string", description: "Hex color opsional" },
        },
        required: ["ids", "tag_name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "remove_tags",
      description: "Hapus tag dari aspirasi. Jika tag_name kosong, hapus semua tag.",
      parameters: {
        type: "object",
        properties: {
          ids: { type: "array", items: { type: "string" } },
          tag_name: { type: "string" },
        },
        required: ["ids"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_tags",
      description: "Ambil daftar semua tag yang ada + jumlah aspirasi per tag.",
      parameters: { type: "object", properties: {} },
    },
  },
];

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const origin = req.headers.get("Origin");
  const corsHeaders = getCorsHeaders(origin);

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SERVICE_ROLE_KEY") ?? "",
      { global: { headers: { Authorization: req.headers.get("Authorization") || "" } } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
    const isAdmin = roles?.some((r) => r.role === "admin" || r.role === "developer");
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const envBaseUrl = Deno.env.get("AI_BASE_URL");
    const envApiKey = Deno.env.get("AI_API_KEY");
    const envModel = Deno.env.get("AI_MODEL");

    let aiSettings;
    if (envBaseUrl && envApiKey && envModel) {
      aiSettings = { base_url: envBaseUrl, api_key: envApiKey, model: envModel };
    } else {
      const { data } = await supabase
        .from("ai_settings")
        .select("base_url, api_key, model")
        .eq("is_active", true)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      aiSettings = data;
    }

    if (!aiSettings) {
      return new Response(
        JSON.stringify({ error: "AI belum dikonfigurasi. Hubungi developer." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // `messages` dikirim client dalam bentuk OpenAI-shape APA ADANYA, termasuk
    // pesan assistant berisi tool_calls dan pesan role "tool" berisi hasil
    // eksekusinya — supaya provider LLM paham konteks percakapan multi-langkah.
    const { messages, context } = await req.json();

    const llmMessages = [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "system",
        content: `Ringkasan awal aspirasi saat ini (${context.aspirations.length} data, isi dipotong 300 karakter — gunakan search_aspirations/get_aspiration_details kalau butuh lebih akurat/lengkap):\n${JSON.stringify(
          context.aspirations.map((a: any) => ({
            id: a.id,
            student_name: a.student_name,
            student_class: a.student_class,
            content: a.content?.substring(0, 300),
            status: a.status,
            created_at: a.created_at,
          }))
        )}\n\nFilter aktif di dashboard: ${JSON.stringify(context.currentFilters || {})}`,
      },
      ...messages,
    ];

    // Call AI API directly (no shared module dependency)
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000); // 60 detik timeout

    let llmRes;
    try {
      llmRes = await fetch(`${aiSettings.base_url}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${aiSettings.api_key}`,
        },
        body: JSON.stringify({
          model: aiSettings.model,
          messages: llmMessages,
          tools: TOOLS,
          tool_choice: "auto",
          max_tokens: 16000,
        }),
        signal: controller.signal,
      });
    } catch (e: any) {
      clearTimeout(timeout);
      if (e.name === "AbortError") {
        return new Response(
          JSON.stringify({ error: "AI timeout (>60 detik). Coba lagi." }),
          { status: 504, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ error: `Network error: ${e.message}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    clearTimeout(timeout);

    if (!llmRes.ok) {
      const errText = await llmRes.text();
      console.error("AI API error:", llmRes.status, errText);
      return new Response(
        JSON.stringify({ error: `AI error: ${llmRes.status} ${errText.substring(0, 300)}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const llmData = await llmRes.json();
    const assistantMessage = llmData.choices?.[0]?.message;

    // Handle response — bisa berisi content ATAU tool_calls ATAU keduanya
    const response: any = {};
    
    // JANGAN return reasoning sebagai message (itu internal thinking)
    // Hanya return content yang layak ditampilkan ke user
    if (assistantMessage?.content) {
      response.message = assistantMessage.content;
    } else if (assistantMessage?.tool_calls?.length > 0) {
      // Tool calls tanpa content — ini NORMAL, kosongkan message
      // Frontend akan execute tool dan continue conversation
      response.message = "";
    } else {
      // Fallback: tidak ada content dan tidak ada tool_calls sama sekali.
      // Model reasoning (deepseek-v4-flash dkk) kadang menaruh jawaban akhirnya
      // di field reasoning/reasoning_content, bukan content, saat thinking mode
      // aktif. Tanpa fallback ini, chat berhenti kosong tanpa pesan apapun.
      response.message =
        assistantMessage?.reasoning || assistantMessage?.reasoning_content || "";
    }
    
    // Selalu return tool_calls jika ada
    if (assistantMessage?.tool_calls?.length > 0) {
      response.tool_calls = assistantMessage.tool_calls;
    }

    return new Response(
      JSON.stringify(response),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("ai-admin-agent error:", error);
    return new Response(
      JSON.stringify({ error: error?.message ?? "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
