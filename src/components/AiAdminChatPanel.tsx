import { useState, useRef, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Bot, User, Send, Loader2, X, Sparkles, Download, CheckCircle2, Filter, Trash2, Search, BarChart3, ListChecks, Tag,
} from "lucide-react";

// ── Bentuk pesan mengikuti OpenAI tool-calling shape apa adanya, supaya
// riwayat percakapan tetap valid dikirim ulang ke provider LLM.
interface ChatMsg {
  role: "user" | "assistant" | "tool";
  content: string;
  tool_calls?: any[] | null;
  tool_call_id?: string;
  name?: string;
}

interface TopicGroup {
  topic_name: string;
  aspiration_ids: string[];
  summary: string;
}

interface AiAdminChatPanelProps {
  aspirations: any[];
  currentFilters: any;
  onApplyFilters?: (filters: any) => void;
  onTriggerExport?: (ids: string[], format: string) => void;
  onMarkStatus?: (ids: string[], status: string) => void;
  onSelectAspirations?: (ids: string[]) => void;
  onDeleteAspirations?: (ids: string[]) => void;
  onClose: () => void;
}

const STORAGE_KEY = "faspira-ai-chat-v2";
const MAX_AUTO_STEPS = 999; // Admin: tanpa batas
const WELCOME = "Halo! Saya Asisten AI admin — saya bisa cari data, hitung statistik, kelompokkan topik, tandai status, ubah filter/seleksi, unduh laporan (PDF/Word/Excel/PPT), dan mengusulkan hapus. Ada yang bisa saya bantu?";

const loadMessages = (): ChatMsg[] => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch { /* ignore */ }
  return [{ role: "assistant", content: WELCOME }];
};

function statusText(s: string) {
  return s === "sudah_ditanggapi" ? "Sudah Ditanggapi" : "Belum Ditanggapi";
}

const AiAdminChatPanel = ({
  aspirations, currentFilters, onApplyFilters, onTriggerExport, onMarkStatus,
  onSelectAspirations, onDeleteAspirations, onClose,
}: AiAdminChatPanelProps) => {
  const { toast } = useToast();
  const [messages, setMessages] = useState<ChatMsg[]>(loadMessages);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [stepLabel, setStepLabel] = useState<string>("Berpikir...");
  const [topicGroups, setTopicGroups] = useState<TopicGroup[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isLoading]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  }, [messages]);

  const handleClearChat = () => {
    const fresh: ChatMsg[] = [{ role: "assistant", content: WELCOME }];
    setMessages(fresh);
    setTopicGroups([]);
    localStorage.removeItem(STORAGE_KEY);
  };

  // ── Eksekusi satu tool_call secara lokal (data sudah ada di browser),
  // mengembalikan hasil untuk dikirim balik ke model + teks ramah untuk chip UI.
  const executeTool = (tc: any): { forModel: any; friendly: string } => {
    const fn = tc.function;
    let args: any = {};
    try { args = JSON.parse(fn.arguments || "{}"); } catch { args = {}; }

    switch (fn.name) {
      case "search_aspirations": {
        const q = (args.query || "").toLowerCase().trim();
        const limit = Math.min(args.limit || 40, 60);
        let results = aspirations.filter((a) => {
          if (args.status && args.status !== "all" && a.status !== args.status) return false;
          if (args.date_from && new Date(a.created_at) < new Date(args.date_from)) return false;
          if (args.date_to && new Date(a.created_at) > new Date(args.date_to)) return false;
          if (q) {
            const hay = `${a.student_name} ${a.student_class || ""} ${a.content}`.toLowerCase();
            if (!hay.includes(q)) return false;
          }
          return true;
        }).slice(0, limit).map((a) => ({
          id: a.id, student_name: a.student_name, student_class: a.student_class,
          snippet: (a.content || "").slice(0, 150), status: a.status, created_at: a.created_at,
        }));
        return { forModel: { count: results.length, results }, friendly: `${results.length} aspirasi ditemukan` };
      }
      case "get_statistics": {
        const total = aspirations.length;
        const sudah = aspirations.filter((a) => a.status === "sudah_ditanggapi").length;
        const byClass: Record<string, number> = {};
        aspirations.forEach((a) => { const k = a.student_class || "Tanpa Kelas"; byClass[k] = (byClass[k] || 0) + 1; });
        const stats = { total, sudah_ditanggapi: sudah, belum_ditanggapi: total - sudah, per_kelas: byClass };
        return { forModel: stats, friendly: "Statistik diambil" };
      }
      case "get_aspiration_details": {
        const ids: string[] = (args.ids || []).slice(0, 15);
        const details = aspirations.filter((a) => ids.includes(a.id)).map((a) => ({
          id: a.id, student_name: a.student_name, student_class: a.student_class,
          content: a.content, status: a.status, created_at: a.created_at,
          comments: (a.comments || []).map((c: any) => ({ text: c.comment_text, at: c.created_at })),
        }));
        return { forModel: { details }, friendly: `${details.length} detail aspirasi diambil` };
      }
      case "cluster_topics": {
        const groups: TopicGroup[] = args.groups || [];
        setTopicGroups(groups);
        return { forModel: { rendered: true, group_count: groups.length }, friendly: `${groups.length} topik ditemukan — lihat kartu di bawah` };
      }
      case "select_aspirations": {
        const ids: string[] = args.ids || [];
        onSelectAspirations?.(ids);
        return { forModel: { selected: ids.length }, friendly: `${ids.length} aspirasi dicentang di mode pilih` };
      }
      case "mark_aspirations_status": {
        const ids: string[] = args.ids || [];
        onMarkStatus?.(ids, args.status);
        return { forModel: { updated: ids.length }, friendly: `${ids.length} aspirasi ditandai ${statusText(args.status)}` };
      }
      case "apply_filters": {
        onApplyFilters?.(args);
        return { forModel: { applied: true }, friendly: "Filter dashboard diterapkan" };
      }
      case "trigger_export": {
        const ids: string[] = args.aspiration_ids || [];
        onTriggerExport?.(ids, args.format);
        return { forModel: { exported: ids.length, format: args.format }, friendly: `Export ${String(args.format).toUpperCase()} untuk ${ids.length} aspirasi dipicu` };
      }
      case "delete_aspirations": {
        const ids: string[] = args.ids || [];
        onDeleteAspirations?.(ids);
        return { forModel: { proposed_delete: ids.length, note: "Menunggu konfirmasi manual admin di dialog konfirmasi." }, friendly: `Usulan hapus ${ids.length} aspirasi diajukan (perlu konfirmasi admin)` };
      }
      case "tag_aspirations": {
        const ids: string[] = args.ids || [];
        const tagName = args.tag_name || "Tag";
        const color = args.color || "#2E86AB";
        (async () => {
          for (const id of ids) {
            await supabase.from("aspiration_tags").upsert({
              aspiration_id: id, tag_name: tagName, color,
            }, { onConflict: "aspiration_id,tag_name", ignoreDuplicates: true });
          }
        })();
        return { forModel: { tagged: ids.length, tag_name: tagName }, friendly: `${ids.length} aspirasi ditandai tag "${tagName}"` };
      }
      case "remove_tags": {
        const ids: string[] = args.ids || [];
        const tagName = args.tag_name;
        (async () => {
          for (const id of ids) {
            if (tagName) {
              await supabase.from("aspiration_tags").delete().eq("aspiration_id", id).eq("tag_name", tagName);
            } else {
              await supabase.from("aspiration_tags").delete().eq("aspiration_id", id);
            }
          }
        })();
        return { forModel: { removed: ids.length, tag_name: tagName || "all" }, friendly: tagName ? `Tag "${tagName}" dihapus dari ${ids.length} aspirasi` : `Semua tag dihapus dari ${ids.length} aspirasi` };
      }
      case "get_tags": {
        (async () => {
          const { data } = await supabase.from("aspiration_tags").select("tag_name");
          if (data) {
            const counts: Record<string, number> = {};
            data.forEach((t: any) => { counts[t.tag_name] = (counts[t.tag_name] || 0) + 1; });
          }
        })();
        return { forModel: { note: "Tags fetched" }, friendly: "Mengambil daftar tag..." };
      }
      default:
        return { forModel: { error: "unknown tool" }, friendly: `Tool tidak dikenal: ${fn.name}` };
    }
  };

  const iconFor = (name: string) => {
    if (name === "search_aspirations") return <Search className="h-3 w-3" />;
    if (name === "get_statistics") return <BarChart3 className="h-3 w-3" />;
    if (name === "select_aspirations") return <ListChecks className="h-3 w-3" />;
    if (name === "trigger_export") return <Download className="h-3 w-3" />;
    if (name === "delete_aspirations") return <Trash2 className="h-3 w-3" />;
    if (name === "apply_filters") return <Filter className="h-3 w-3" />;
    if (name === "tag_aspirations" || name === "remove_tags" || name === "get_tags") return <Tag className="h-3 w-3" />;
    return <CheckCircle2 className="h-3 w-3" />;
  };

  // ── Satu putaran agent: kirim history ke LLM, kalau dia minta tool,
  // jalankan lokal lalu OTOMATIS lanjut lagi (tanpa user perlu ketik ulang)
  // sampai model memberi jawaban teks final atau batas langkah tercapai.
  const runAgentTurn = async (history: ChatMsg[], depth: number) => {
    if (depth >= MAX_AUTO_STEPS) {
      setIsLoading(false);
      return;
    }

    // Step 1: Thinking
    setStepLabel("🤔 Thinking...");

    try {
      const context = {
        aspirations: aspirations.map((a) => ({
          id: a.id, student_name: a.student_name, student_class: a.student_class,
          content: a.content?.substring(0, 300), status: a.status, created_at: a.created_at,
        })),
        currentFilters,
      };

      const apiMessages = history.map((m) => ({
        role: m.role, content: m.content,
        ...(m.tool_calls ? { tool_calls: m.tool_calls } : {}),
        ...(m.tool_call_id ? { tool_call_id: m.tool_call_id } : {}),
        ...(m.name ? { name: m.name } : {}),
      }));

      const { data, error } = await supabase.functions.invoke("ai-admin-agent", {
        body: { messages: apiMessages, context },
      });
      if (error) throw error;

      const assistantMsg: ChatMsg = {
        role: "assistant",
        content: data?.message || "",
        tool_calls: data?.tool_calls || null,
      };
      
      // SELALU tambahkan assistant message jika ada tool_calls
      if (assistantMsg.content || assistantMsg.tool_calls?.length) {
        setMessages([...history, assistantMsg]);
      }

      if (data?.tool_calls && data.tool_calls.length > 0) {
        // Step 2: Executing tools — tampilkan tool apa yang dipakai
        const toolNames = data.tool_calls.map((tc: any) => tc.function.name).join(", ");
        setStepLabel(`⚡ Executing: ${toolNames}`);

        // Eksekusi tools
        const toolMsgs: ChatMsg[] = data.tool_calls.map((tc: any) => {
          const { forModel } = executeTool(tc);
          return { role: "tool" as const, tool_call_id: tc.id, name: tc.function.name, content: JSON.stringify(forModel) };
        });
        
        // Kirim: history + assistant(tool_calls) + tool_results
        const afterTools = [...history, assistantMsg, ...toolMsgs];
        setMessages(afterTools);
        
        // Step 3: Analyzing results
        setStepLabel("📊 Analyzing results...");
        
        // Lanjut otomatis — AI akan generate final response
        await runAgentTurn(afterTools, depth + 1);
        return;
      }

      // Step 4: Done — tampilkan final response
      setIsLoading(false);
    } catch (e: any) {
      setMessages([...history, { role: "assistant", content: `Terjadi error: ${e.message}` }]);
      setIsLoading(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    const userMsg = input.trim();
    setInput("");
    const newHistory: ChatMsg[] = [...messages, { role: "user", content: userMsg }];
    setMessages(newHistory);
    setIsLoading(true);
    await runAgentTurn(newHistory, 0);
  };

  // Kelompokkan pesan "tool" (tidak dirender sebagai bubble) di bawah pesan
  // assistant yang memicunya, untuk ditampilkan sebagai chip hasil aksi.
  const renderItems: { assistant: ChatMsg | null; user?: ChatMsg; toolFriendly: string[]; hasCluster: boolean }[] = [];
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    if (m.role === "tool") continue;
    if (m.role === "user") { renderItems.push({ assistant: null, user: m, toolFriendly: [], hasCluster: false }); continue; }
    // assistant message — kumpulkan tool messages tepat setelahnya
    const toolFriendly: string[] = [];
    let hasCluster = false;
    let j = i + 1;
    while (j < messages.length && messages[j].role === "tool") {
      const tm = messages[j];
      if (tm.name === "cluster_topics") hasCluster = true;
      const tc = m.tool_calls?.find((t: any) => t.id === tm.tool_call_id);
      if (tc) {
        try {
          const { friendly } = executeToolFriendlyOnly(tc, tm.content);
          toolFriendly.push(friendly);
        } catch { /* ignore */ }
      }
      j++;
    }
    renderItems.push({ assistant: m, toolFriendly, hasCluster });
  }

  // Helper ringan untuk regenerasi teks chip dari hasil tool yang sudah tersimpan
  // (dipanggil ulang saat render, tidak menjalankan efek samping apa pun).
  function executeToolFriendlyOnly(tc: any, resultContent: string) {
    let result: any = {};
    try { result = JSON.parse(resultContent); } catch { /* ignore */ }
    const name = tc.function.name;
    let args: any = {};
    try { args = JSON.parse(tc.function.arguments || "{}"); } catch { /* ignore */ }
    switch (name) {
      case "search_aspirations": return { friendly: `${result.count ?? 0} aspirasi ditemukan` };
      case "get_statistics": return { friendly: "Statistik diambil" };
      case "get_aspiration_details": return { friendly: `${result.details?.length ?? 0} detail aspirasi diambil` };
      case "cluster_topics": return { friendly: `${result.group_count ?? 0} topik ditemukan — lihat kartu di bawah` };
      case "select_aspirations": return { friendly: `${result.selected ?? 0} aspirasi dicentang di mode pilih` };
      case "mark_aspirations_status": return { friendly: `${result.updated ?? 0} aspirasi ditandai ${statusText(args.status)}` };
      case "apply_filters": return { friendly: "Filter dashboard diterapkan" };
      case "trigger_export": return { friendly: `Export ${String(args.format).toUpperCase()} untuk ${result.exported ?? 0} aspirasi dipicu` };
      case "delete_aspirations": return { friendly: `Usulan hapus ${result.proposed_delete ?? 0} aspirasi diajukan (perlu konfirmasi admin)` };
      default: return { friendly: name };
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">Asisten AI</span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={handleClearChat} title="Reset chat">
            <X className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
        {renderItems.map((item, i) => {
          if (item.user) {
            return (
              <div key={i} className="flex gap-2 justify-end">
                <div className="max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed bg-primary text-primary-foreground">
                  {item.user.content}
                </div>
                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <User className="h-3.5 w-3.5 text-primary" />
                </div>
              </div>
            );
          }
          const msg = item.assistant!;
          return (
            <div key={i} className="flex gap-2 justify-start">
              <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center shrink-0 mt-0.5">
                <Bot className="h-3.5 w-3.5 text-primary-foreground" />
              </div>
              <div className="max-w-[85%] space-y-1.5">
                {msg.content && (
                  <div className="rounded-xl px-3 py-2 text-sm leading-relaxed bg-muted text-foreground border border-border">
                    <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0 prose-strong:text-foreground">
                      <ReactMarkdown 
                        remarkPlugins={[remarkGfm]}
                        components={{
                          table: ({children, ...props}) => <table className="ai-markdown-table" {...props}>{children}</table>,
                          thead: ({children, ...props}) => <thead {...props}>{children}</thead>,
                          tbody: ({children, ...props}) => <tbody {...props}>{children}</tbody>,
                          tr: ({children, ...props}) => <tr {...props}>{children}</tr>,
                          th: ({children, ...props}) => <th {...props}>{children}</th>,
                          td: ({children, ...props}) => <td {...props}>{children}</td>,
                        }}
                      >
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                  </div>
                )}

                {item.toolFriendly.length > 0 && (
                  <div className="space-y-1">
                    {msg.tool_calls?.map((tc: any, j: number) => (
                      <div key={j} className="flex items-center gap-1.5 text-xs text-success bg-success-muted rounded px-2 py-1">
                        {iconFor(tc.function.name)}
                        {item.toolFriendly[j]}
                      </div>
                    ))}
                  </div>
                )}

                {item.hasCluster && topicGroups.length > 0 && (
                  <div className="space-y-2 mt-2">
                    {topicGroups.map((g, j) => (
                      <Card key={j} className="p-3 border border-border bg-card">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-sm font-semibold text-foreground">{g.topic_name}</span>
                          <Badge variant="secondary" className="text-xs">{g.aspiration_ids.length}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed mb-2">{g.summary}</p>
                        <div className="flex flex-wrap gap-1.5">
                          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => onSelectAspirations?.(g.aspiration_ids)}>
                            <ListChecks className="mr-1 h-3 w-3" />Pilih
                          </Button>
                          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => onTriggerExport?.(g.aspiration_ids, "word")}>
                            <Download className="mr-1 h-3 w-3" />Word
                          </Button>
                          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => onTriggerExport?.(g.aspiration_ids, "excel")}>
                            <Download className="mr-1 h-3 w-3" />Excel
                          </Button>
                          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => onTriggerExport?.(g.aspiration_ids, "pptx")}>
                            <Download className="mr-1 h-3 w-3" />PPT
                          </Button>
                          <Button variant="outline" size="sm" className="h-7 text-xs text-destructive" onClick={() => onDeleteAspirations?.(g.aspiration_ids)}>
                            <Trash2 className="mr-1 h-3 w-3" />Hapus
                          </Button>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {isLoading && (
          <div className="flex gap-2">
            <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center shrink-0">
              <Bot className="h-3.5 w-3.5 text-primary-foreground" />
            </div>
            <div className="bg-muted rounded-xl px-3 py-2 text-sm text-muted-foreground flex items-center gap-2 border border-border">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />{stepLabel}
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-3 border-t border-border">
        <div className="flex gap-2">
          <Input value={input} onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
            placeholder="Coba: 'Cari aspirasi soal kantin, tandai sudah ditanggapi, lalu unduh Excel-nya'" className="h-9 text-sm" disabled={isLoading} />
          <Button size="sm" className="h-9 w-9 p-0" onClick={handleSend} disabled={isLoading || !input.trim()}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1.5">
          AI bisa mencari seluruh data, menghitung statistik, mengelompokkan topik, menandai status, memilih, memfilter, mengekspor 4 format, dan mengusulkan hapus (tetap perlu konfirmasi Anda).
        </p>
      </div>
    </div>
  );
};

export default AiAdminChatPanel;
