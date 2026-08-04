// AI Settings Edge Function — Superadmin only
// Manages AI provider configuration (base_url, api_key, model)
// API key is NEVER sent to browser

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";

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

    // Verify superadmin role
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "developer")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Developer only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action } = body;

    if (action === "get") {
      const { data } = await supabase
        .from("ai_settings")
        .select("id, provider_name, base_url, model, is_active, updated_at")
        .eq("is_active", true)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) {
        // Mask api_key — only show last 6 chars
        return new Response(
          JSON.stringify({ ...data, api_key_masked: "sk-...***" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ settings: null }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "save") {
      const { base_url, api_key, model, provider_name } = body;

      if (!base_url || !api_key || !model) {
        return new Response(
          JSON.stringify({ error: "base_url, api_key, dan model wajib diisi" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Deactivate old settings
      await supabase
        .from("ai_settings")
        .update({ is_active: false })
        .eq("is_active", true);

      // Insert new settings
      const { data, error } = await supabase
        .from("ai_settings")
        .insert({
          provider_name: provider_name || "custom",
          base_url: base_url.replace(/\/+$/, ""),
          api_key,
          model,
          is_active: true,
          updated_by: user.id,
        })
        .select("id, provider_name, base_url, model, is_active")
        .single();

      if (error) throw error;

      // Also update Supabase secrets so edge functions use latest config
      try {
        const managementToken = Deno.env.get("MANAGEMENT_TOKEN");
        if (managementToken) {
          const projectRef = Deno.env.get("PROJECT_REF") || "fsspteutxmjrjoyplrll";
          await fetch(`https://api.supabase.com/v1/projects/${projectRef}/secrets`, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${managementToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify([
              { name: "AI_BASE_URL", value: base_url.replace(/\/+$/, "") },
              { name: "AI_API_KEY", value: api_key },
              { name: "AI_MODEL", value: model },
            ]),
          });
        }
      } catch (e) {
        console.log("Could not update secrets (non-critical):", e);
      }

      return new Response(
        JSON.stringify({ success: true, settings: data }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "test") {
      const { base_url, api_key, model } = body;

      try {
        const testRes = await fetch(`${base_url.replace(/\/+$/, "")}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${api_key}`,
          },
          body: JSON.stringify({
            model,
            messages: [{ role: "user", content: "Hello, respond with OK" }],
            max_tokens: 10,
          }),
        });

        if (!testRes.ok) {
          const errText = await testRes.text();
          return new Response(
            JSON.stringify({ success: false, error: `HTTP ${testRes.status}: ${errText.substring(0, 200)}` }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({ success: true, message: "Koneksi berhasil" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (e: any) {
        return new Response(
          JSON.stringify({ success: false, error: e.message }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("ai-settings error:", error);
    return new Response(
      JSON.stringify({ error: error?.message ?? "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
