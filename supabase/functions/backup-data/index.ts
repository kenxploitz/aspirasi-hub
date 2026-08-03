// Backup Data Edge Function
// Export aspirations + related tables in SQL/JSON format
// Can be called manually or via cron

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
      Deno.env.get("SERVICE_ROLE_KEY") ?? ""
    );

    const { format = "json", tables = ["aspirations", "comments", "aspiration_tags"] } = await req.json().catch(() => ({}));

    const backup: Record<string, any[]> = {};
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

    // Fetch data from each table
    for (const table of tables) {
      const { data, error } = await supabase
        .from(table)
        .select("*")
        .order("created_at", { ascending: true });

      if (error) {
        console.error(`Error fetching ${table}:`, error);
        backup[table] = [];
      } else {
        backup[table] = data || [];
      }
    }

    if (format === "json") {
      // Return as JSON
      const jsonContent = JSON.stringify({
        backup_timestamp: new Date().toISOString(),
        tables: backup,
        row_counts: Object.fromEntries(
          Object.entries(backup).map(([k, v]) => [k, v.length])
        ),
      }, null, 2);

      return new Response(jsonContent, {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="faspira-backup-${timestamp}.json"`,
        },
      });
    }

    if (format === "sql") {
      // Generate SQL INSERT statements
      let sql = `-- FASPIRA Backup\n-- Generated: ${new Date().toISOString()}\n\n`;

      for (const [table, rows] of Object.entries(backup)) {
        if (rows.length === 0) continue;

        sql += `-- Table: ${table} (${rows.length} rows)\n`;
        sql += `DELETE FROM ${table};\n`;

        const columns = Object.keys(rows[0]);
        for (const row of rows) {
          const values = columns.map((col) => {
            const val = row[col];
            if (val === null) return "NULL";
            if (typeof val === "number") return val.toString();
            if (typeof val === "boolean") return val ? "true" : "false";
            // Escape single quotes
            return `'${String(val).replace(/'/g, "''")}'`;
          });
          sql += `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${values.join(", ")}) ON CONFLICT (id) DO NOTHING;\n`;
        }
        sql += "\n";
      }

      return new Response(sql, {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/sql",
          "Content-Disposition": `attachment; filename="faspira-backup-${timestamp}.sql"`,
        },
      });
    }

    // Default: summary
    const summary = {
      timestamp: new Date().toISOString(),
      row_counts: Object.fromEntries(
        Object.entries(backup).map(([k, v]) => [k, v.length])
      ),
    };

    return new Response(JSON.stringify(summary), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("backup-data error:", error);
    return new Response(
      JSON.stringify({ error: error?.message ?? "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
