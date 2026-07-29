// AI Admin Agent Edge Function — Tool-calling based assistant
// Allows admin to cluster, filter, mark status, export via natural language

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";

const SYSTEM_PROMPT = `Kamu adalah asisten AI internal untuk admin sekolah dalam mengelola aspirasi siswa di aplikasi Aspirasi Hub. Tugasmu: membantu admin mengelompokkan aspirasi berdasarkan topik, menandai status tanggapan, memfilter, dan memicu unduhan laporan sesuai instruksi admin — dengan memanggil tools yang tersedia. Selalu jelaskan secara ringkas apa yang kamu lakukan dan kenapa (misal alasan pengelompokan topik). Jangan pernah mengarang data aspirasi yang tidak ada dalam konteks yang diberikan. Jika instruksi admin ambigu (misal 'topik ini' tanpa kejelasan), tanyakan klarifikasi singkat sebelum bertindak. Kamu HANYA beroperasi dalam konteks data aspirasi sekolah ini, tidak menjawab pertanyaan umum di luar tugas ini.`;

const TOOLS = [
  {
    type: "function",
    function: {
      name: "mark_aspirations_status",
      description: "Tandai beberapa aspirasi dengan status baru",
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
      name: "cluster_topics",
      description: "Laporkan hasil pengelompokan aspirasi berdasarkan topik",
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
      name: "trigger_export",
      description: "Picu download laporan untuk aspirasi tertentu",
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
      name: "apply_filters",
      description: "Terapkan filter pada dashboard admin",
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
];

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const origin = req.headers.get("Origin");
  const corsHeaders = getCorsHeaders(origin);

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { global: { headers: { Authorization: req.headers.get("Authorization") || "" } } }
    );

    // Verify admin role
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    const isAdmin = roles?.some((r) => r.role === "admin" || r.role === "superadmin");
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get AI settings
    const { data: aiSettings } = await supabase
      .from("ai_settings")
      .select("base_url, api_key, model")
      .eq("is_active", true)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!aiSettings) {
      return new Response(
        JSON.stringify({ error: "AI belum dikonfigurasi. Hubungi superadmin." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { messages, context } = await req.json();

    // Build messages for LLM
    const llmMessages = [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "system",
        content: `Konteks aspirasi saat ini (${context.aspirations.length} data):\n${JSON.stringify(
          context.aspirations.map((a: any) => ({
            id: a.id,
            student_name: a.student_name,
            student_class: a.student_class,
            content: a.content?.substring(0, 300),
            status: a.status,
            created_at: a.created_at,
          }))
        )}\n\nFilter aktif: ${JSON.stringify(context.currentFilters || {})}`,
      },
      ...messages,
    ];

    // Call LLM
    const llmRes = await fetch(`${aiSettings.base_url}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${aiSettings.api_key}`,
      },
      body: JSON.stringify({
        model: aiSettings.model,
        messages: llmMessages,
        tools: TOOLS,
        max_tokens: 2000,
      }),
    });

    if (!llmRes.ok) {
      const errText = await llmRes.text();
      return new Response(
        JSON.stringify({ error: `AI error: ${llmRes.status} ${errText.substring(0, 200)}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const llmData = await llmRes.json();
    const assistantMessage = llmData.choices?.[0]?.message;

    return new Response(
      JSON.stringify({
        message: assistantMessage?.content || "",
        tool_calls: assistantMessage?.tool_calls || null,
      }),
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
