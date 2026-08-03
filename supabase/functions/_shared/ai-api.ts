// Shared AI API caller with retry, timeout, and 429 handling
// Used by both ai-admin-agent and ai-client-chat

interface AiApiOptions {
  baseUrl: string;
  apiKey: string;
  model: string;
  messages: any[];
  tools?: any[];
  toolChoice?: string;
  maxTokens: number;
  temperature?: number;
  enableThinking?: boolean; // true = biarkan model berpikir (admin), false = matikan (client)
}

interface AiApiResponse {
  success: boolean;
  data?: any;
  error?: string;
  status?: number;
  retryAfter?: number;
}

const MAX_RETRIES = 2;
const TIMEOUT_MS = 30000; // 30 detik

// Parse tool call intent dari reasoning_content (fix bug farouter.tech mimo-v2.5)
function parseToolCallFromReasoning(reasoning: string, tools: any[]): any | null {
  if (!reasoning || !tools.length) return null;
  
  const reasoningLower = reasoning.toLowerCase();
  
  // Cari tool name yang disebut di reasoning
  let matchedTool: any = null;
  for (const tool of tools) {
    const name = tool.function?.name;
    if (name && reasoningLower.includes(name.toLowerCase())) {
      matchedTool = tool;
      break;
    }
    // Coba match tanpa underscore (search aspirations -> searchaspirations)
    const nameClean = name?.replace(/_/g, "");
    if (nameClean && reasoningLower.includes(nameClean.toLowerCase())) {
      matchedTool = tool;
      break;
    }
  }
  
  if (!matchedTool) return null;
  
  const toolName = matchedTool.function.name;
  const args: any = {};
  
  // Extract query/keyword dari reasoning
  const queryMatch = reasoning.match(/(?:query|kata kunci|keyword|cari|search)[:\s]*["']?([^"'.,\n]+)["']?/i);
  if (queryMatch) args.query = queryMatch[1].trim();
  
  // Extract tag_name
  const tagMatch = reasoning.match(/(?:tag|label)[:\s]*["']?([^"'.,\n]+)["']?/i);
  if (tagMatch) args.tag_name = tagMatch[1].trim();
  
  // Extract status
  const statusMatch = reasoning.match(/(?:status)[:\s]*["']?(sudah_ditanggapi|belum_ditanggapi)["']?/i);
  if (statusMatch) args.status = statusMatch[1];
  
  // Extract IDs
  const idsMatch = reasoning.match(/(?:ids?|id)[:\s]*\[([^\]]+)\]/i);
  if (idsMatch) {
    args.ids = idsMatch[1].split(",").map((s: string) => s.trim().replace(/["']/g, ""));
  }
  
  // Extract format
  const formatMatch = reasoning.match(/(?:format)[:\s]*["']?(pdf|word|excel|pptx)["']?/i);
  if (formatMatch) args.format = formatMatch[1];
  
  // Kalau gak ada args sama sekali, coba extract dari konteks
  if (Object.keys(args).length === 0) {
    // Coba cari query dari kalimat "cari ... soal ..." atau "search ... for ..."
    const searchMatch = reasoning.match(/(?:cari|search|find|look)[^.]*?(?:soal|about|for|tentang)\s+["']?([^"'.,\n]+)["']?/i);
    if (searchMatch) args.query = searchMatch[1].trim();
  }
  
  // Generate tool call ID
  const toolCallId = `parsed_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  
  return {
    id: toolCallId,
    type: "function",
    function: {
      name: toolName,
      arguments: JSON.stringify(args),
    },
  };
}

const MAX_RETRIES = 2;
const TIMEOUT_MS = 30000; // 30 detik

export async function callAiApi(options: AiApiOptions): Promise<AiApiResponse> {
  const { baseUrl, apiKey, model, messages, tools, toolChoice, maxTokens, temperature } = options;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

      const body: any = {
        model,
        messages,
        max_tokens: maxTokens,
      };
      if (tools) body.tools = tools;
      if (toolChoice) body.tool_choice = toolChoice;
      if (temperature) body.temperature = temperature;
      // DeepSeek: enable_thinking=false untuk matikan reasoning mode (hemat token)
      if (options.enableThinking === false) body.enable_thinking = false;

      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      // Success
      if (res.ok) {
        const data = await res.json();
        
        // Handle thinking models (mimo-v2.5, deepseek-r1, dll)
        // yang return reasoning_content + content terpisah
        const choice = data.choices?.[0];
        if (choice?.message) {
          const msg = choice.message;
          
          // FIX BUG farouter.tech: mimo-v2.5 return finish_reason=tool_calls
          // tapi tool_calls array kosong. Parse dari reasoning_content.
          if (choice.finish_reason === "tool_calls" && (!msg.tool_calls || msg.tool_calls.length === 0) && msg.reasoning_content) {
            const parsed = parseToolCallFromReasoning(msg.reasoning_content, tools || []);
            if (parsed) {
              msg.tool_calls = [parsed];
              msg.content = ""; // Clear content karena ini tool call
            }
          }
          
          // Kalau content kosong tapi ada reasoning, gabungkan
          if (!msg.content && msg.reasoning_content && !msg.tool_calls?.length) {
            msg.content = msg.reasoning_content;
          }
          // Kalau masih kosong, kasih fallback
          if (!msg.content && !msg.tool_calls?.length) {
            msg.content = "(AI sedang berpikir... coba ulangi dengan pertanyaan yang lebih spesifik)";
          }
        }
        
        return { success: true, data };
      }

      // Rate limited (429)
      if (res.status === 429) {
        const errText = await res.text();
        let retryAfter = 60; // default 1 menit
        
        // Parse retry-after header
        const retryHeader = res.headers.get("retry-after");
        if (retryHeader) {
          retryAfter = parseInt(retryHeader) || 60;
        }

        // Jika quota bulanan habis, jangan retry
        if (errText.includes("monthly") || errText.includes("limit")) {
          return {
            success: false,
            error: "Kuota AI bulanan habis. Hubungi developer untuk reset atau ganti provider.",
            status: 429,
            retryAfter: 0,
          };
        }

        // Rate limit biasa — retry dengan backoff
        if (attempt < MAX_RETRIES) {
          const backoff = Math.min(1000 * Math.pow(2, attempt), 10000);
          await new Promise((r) => setTimeout(r, backoff));
          continue;
        }

        return {
          success: false,
          error: "AI sedang sibuk. Coba lagi dalam beberapa menit.",
          status: 429,
          retryAfter,
        };
      }

      // Server error (5xx) — retry
      if (res.status >= 500 && attempt < MAX_RETRIES) {
        const backoff = Math.min(1000 * Math.pow(2, attempt), 5000);
        await new Promise((r) => setTimeout(r, backoff));
        continue;
      }

      // Other errors
      const errText = await res.text();
      return {
        success: false,
        error: `AI error: ${res.status} ${errText.substring(0, 200)}`,
        status: res.status,
      };

    } catch (e: any) {
      // Timeout
      if (e.name === "AbortError") {
        if (attempt < MAX_RETRIES) continue;
        return {
          success: false,
          error: "AI timeout. Response terlalu lama (>30 detik).",
          status: 408,
        };
      }

      // Network error — retry
      if (attempt < MAX_RETRIES) {
        const backoff = Math.min(1000 * Math.pow(2, attempt), 5000);
        await new Promise((r) => setTimeout(r, backoff));
        continue;
      }

      return {
        success: false,
        error: `Network error: ${e.message}`,
        status: 0,
      };
    }
  }

  return { success: false, error: "Max retries exceeded", status: 0 };
}
