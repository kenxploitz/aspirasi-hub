import { useEffect, useState, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Bot, User, Send, Loader2, X, Sparkles, Download, CheckCircle2, Filter,
  Trash2, Search, BarChart3, ListChecks, Tag, ArrowLeft, RotateCcw, Settings,
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { sanitizeForPDF } from "@/lib/security";
import { exportToWord } from "@/lib/export/exportToWord";
import { exportToExcel } from "@/lib/export/exportToExcel";
import { exportToPptx } from "@/lib/export/exportToPptx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";

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

interface Aspiration {
  id: string;
  student_name: string;
  student_class: string | null;
  content: string;
  status: string;
  created_at: string;
  comments: any[];
}

const STORAGE_KEY = "faspira-ai-chat-v2";
const MAX_AUTO_STEPS = 999;
const WELCOME = `Halo! Saya Asisten AI admin FASPIRA. Saya bisa:

🔍 **Mencari** aspirasi berdasarkan kata kunci, kelas, atau tanggal
📊 **Menganalisis** statistik dan pola aspirasi
🏷️ **Mengelompokkan** aspirasi berdasarkan topik
✅ **Menandai** status aspirasi
📥 **Mengekspor** laporan (PDF/Word/Excel/PPTX)
🗑️ **Mengusulkan** penghapusan

Coba ketik: *"Cari aspirasi soal kantin, kelompokkan berdasarkan topik, lalu tandai yang sudah ditanggapi"*`;

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

const AdminAiPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [aspirations, setAspirations] = useState<Aspiration[]>([]);
  const [messages, setMessages] = useState<ChatMsg[]>(loadMessages);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [stepLabel, setStepLabel] = useState("Berpikir...");
  const [topicGroups, setTopicGroups] = useState<TopicGroup[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { navigate("/admin/login"); return; }
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", session.user.id);
      if (!roles?.some((r) => r.role === "admin" || r.role === "developer")) {
        navigate("/admin/dashboard"); return;
      }
    };
    checkAuth();
    fetchAspirations();
  }, []);

  const fetchAspirations = async () => {
    try {
      const { data } = await supabase.from("aspirations").select("*, comments (id, comment_text, created_at, admin_id)").order("created_at", { ascending: false });
      setAspirations(data || []);
    } catch { /* ignore */ }
    finally { setDataLoading(false); }
  };

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
    toast({ title: "Chat direset" });
  };

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
        return { forModel: { total, sudah_ditanggapi: sudah, belum_ditanggapi: total - sudah, per_kelas: byClass }, friendly: "Statistik diambil" };
      }
      case "get_aspiration_details": {
        const ids: string[] = (args.ids || []).slice(0, 15);
        const details = aspirations.filter((a) => ids.includes(a.id)).map((a) => ({
          id: a.id, student_name: a.student_name, student_class: a.student_class,
          content: a.content, status: a.status, created_at: a.created_at,
          comments: (a.comments || []).map((c: any) => ({ text: c.comment_text, at: c.created_at })),
        }));
        return { forModel: { details }, friendly: `${details.length} detail diambil` };
      }
      case "cluster_topics": {
        const groups: TopicGroup[] = args.groups || [];
        setTopicGroups(groups);
        return { forModel: { rendered: true, group_count: groups.length }, friendly: `${groups.length} topik ditemukan` };
      }
      case "select_aspirations": {
        return { forModel: { selected: (args.ids || []).length }, friendly: `${(args.ids || []).length} aspirasi dicentang` };
      }
      case "mark_aspirations_status": {
        const ids: string[] = args.ids || [];
        const newStatus = args.status || "sudah_ditanggapi";
        (async () => {
          for (const id of ids) {
            await supabase.from("aspirations").update({ status: newStatus }).eq("id", id);
          }
          fetchAspirations();
        })();
        return { forModel: { updated: ids.length, status: newStatus }, friendly: `${ids.length} aspirasi ditandai ${statusText(newStatus)}` };
      }
      case "apply_filters": {
        return { forModel: { applied: true }, friendly: "Filter diterapkan" };
      }
      case "trigger_export": {
        const ids: string[] = args.aspiration_ids || [];
        const fmt = (args.format || "pdf").toLowerCase();
        const exportData = ids.length > 0
          ? aspirations.filter((a) => ids.includes(a.id))
          : aspirations;

        if (exportData.length === 0) {
          return { forModel: { error: "Tidak ada data untuk diekspor" }, friendly: "Tidak ada data" };
        }

        // Fire and forget — download will start in browser
        (async () => {
          try {
            if (fmt === "pdf") {
              const doc = new jsPDF("l", "mm", "a4");
              doc.setFontSize(20); doc.setFont("helvetica", "bold"); doc.setTextColor(30, 58, 95);
              doc.text("REKAP ASPIRASI SISWA", doc.internal.pageSize.getWidth() / 2, 18, { align: "center" });
              doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.setTextColor(107, 114, 128);
              doc.text(`${format(new Date(), "d MMMM yyyy, HH:mm", { locale: idLocale })} — ${exportData.length} aspirasi`, doc.internal.pageSize.getWidth() / 2, 25, { align: "center" });
              const tableData = exportData.map((asp, i) => [(i + 1).toString(), sanitizeForPDF(asp.student_name), sanitizeForPDF(asp.student_class || "-"), sanitizeForPDF(asp.content), asp.status === "sudah_ditanggapi" ? "Sudah" : "Belum", new Date(asp.created_at).toLocaleDateString("id-ID")]);
              const colW = [12, 30, 22, 100, 25, 25]; const tw = colW.reduce((a, b) => a + b, 0); const ml = (doc.internal.pageSize.getWidth() - tw) / 2;
              autoTable(doc, { startY: 32, head: [["No", "Nama", "Kelas", "Isi Aspirasi", "Status", "Tanggal"]], body: tableData, styles: { fontSize: 8, cellPadding: 3, overflow: "linebreak" }, headStyles: { fillColor: [30, 58, 95], textColor: [255, 255, 255], fontStyle: "bold", halign: "center" }, alternateRowStyles: { fillColor: [248, 250, 252] }, margin: { left: ml, right: ml } });
              doc.save(`Rekap-Aspirasi_${new Date().toISOString().split("T")[0]}.pdf`);
            } else if (fmt === "word") {
              await exportToWord(exportData, { schoolName: "SMA Negeri 1 Kendal" });
            } else if (fmt === "excel") {
              await exportToExcel(exportData, { schoolName: "SMA Negeri 1 Kendal" });
            } else if (fmt === "pptx") {
              await exportToPptx(exportData, { schoolName: "SMA Negeri 1 Kendal" });
            }
          } catch (e) { console.error("Export error:", e); }
        })();

        return { forModel: { exported: exportData.length, format: fmt }, friendly: `Export ${fmt.toUpperCase()} untuk ${exportData.length} aspirasi dimulai` };
      }
      case "delete_aspirations": {
        const ids: string[] = args.ids || [];
        return { forModel: { proposed_delete: ids.length }, friendly: `Usulan hapus ${ids.length} aspirasi` };
      }
      case "tag_aspirations": {
        const ids: string[] = args.ids || [];
        const tagName = args.tag_name || "Tag";
        const color = args.color || "#2E86AB";
        (async () => { for (const id of ids) await supabase.from("aspiration_tags").upsert({ aspiration_id: id, tag_name: tagName, color }, { onConflict: "aspiration_id,tag_name", ignoreDuplicates: true }); })();
        return { forModel: { tagged: ids.length, tag_name: tagName }, friendly: `${ids.length} aspirasi ditandai tag "${tagName}"` };
      }
      case "remove_tags": {
        const ids: string[] = args.ids || [];
        const tagName = args.tag_name;
        (async () => { for (const id of ids) { if (tagName) await supabase.from("aspiration_tags").delete().eq("aspiration_id", id).eq("tag_name", tagName); else await supabase.from("aspiration_tags").delete().eq("aspiration_id", id); } })();
        return { forModel: { removed: ids.length }, friendly: `Tag dihapus dari ${ids.length} aspirasi` };
      }
      case "get_tags": {
        return { forModel: { note: "Tags fetched" }, friendly: "Mengambil daftar tag..." };
      }
      default:
        return { forModel: { error: "unknown tool" }, friendly: `Tool tidak dikenal: ${fn.name}` };
    }
  };

  const iconFor = (name: string) => {
    const map: Record<string, any> = {
      search_aspirations: Search, get_statistics: BarChart3, select_aspirations: ListChecks,
      trigger_export: Download, delete_aspirations: Trash2, apply_filters: Filter,
      tag_aspirations: Tag, remove_tags: Tag, get_tags: Tag,
    };
    const Icon = map[name] || CheckCircle2;
    return <Icon className="h-3 w-3" />;
  };

  const runAgentTurn = async (history: ChatMsg[], depth: number) => {
    if (depth >= MAX_AUTO_STEPS) { setIsLoading(false); return; }
    setStepLabel("🤔 Thinking...");

    try {
      const context = {
        aspirations: aspirations.map((a) => ({
          id: a.id, student_name: a.student_name, student_class: a.student_class,
          content: a.content?.substring(0, 300), status: a.status, created_at: a.created_at,
        })),
        currentFilters: {},
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

      if (assistantMsg.content || assistantMsg.tool_calls?.length) {
        setMessages([...history, assistantMsg]);
      }

      if (data?.tool_calls && data.tool_calls.length > 0) {
        const toolNames = data.tool_calls.map((tc: any) => tc.function.name).join(", ");
        setStepLabel(`⚡ ${toolNames}`);

        const toolMsgs: ChatMsg[] = data.tool_calls.map((tc: any) => {
          const { forModel } = executeTool(tc);
          return { role: "tool" as const, tool_call_id: tc.id, name: tc.function.name, content: JSON.stringify(forModel) };
        });

        const afterTools = [...history, assistantMsg, ...toolMsgs];
        setMessages(afterTools);
        setStepLabel("📊 Analyzing...");
        await runAgentTurn(afterTools, depth + 1);
        return;
      }

      setIsLoading(false);
    } catch (e: any) {
      setMessages([...history, { role: "assistant", content: `Error: ${e.message}` }]);
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

  // Render items
  const renderItems: { assistant: ChatMsg | null; user?: ChatMsg; toolFriendly: string[]; hasCluster: boolean }[] = [];
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    if (m.role === "tool") continue;
    if (m.role === "user") { renderItems.push({ assistant: null, user: m, toolFriendly: [], hasCluster: false }); continue; }
    const toolFriendly: string[] = [];
    let hasCluster = false;
    let j = i + 1;
    while (j < messages.length && messages[j].role === "tool") {
      const tm = messages[j];
      if (tm.name === "cluster_topics") hasCluster = true;
      const tc = m.tool_calls?.find((t: any) => t.id === tm.tool_call_id);
      if (tc) {
        try {
          let result: any = {};
          try { result = JSON.parse(tm.content); } catch { }
          const name = tc.function.name;
          let args: any = {};
          try { args = JSON.parse(tc.function.arguments || "{}"); } catch { }
          const friendlyMap: Record<string, string> = {
            search_aspirations: `${result.count ?? 0} aspirasi ditemukan`,
            get_statistics: "Statistik diambil",
            get_aspiration_details: `${result.details?.length ?? 0} detail diambil`,
            cluster_topics: `${result.group_count ?? 0} topik ditemukan`,
            select_aspirations: `${result.selected ?? 0} aspirasi dicentang`,
            mark_aspirations_status: `${result.updated ?? 0} ditandai ${statusText(args.status)}`,
            apply_filters: "Filter diterapkan",
            trigger_export: `Export ${String(args.format).toUpperCase()}`,
            delete_aspirations: `Usulan hapus ${result.proposed_delete ?? 0}`,
          };
          toolFriendly.push(friendlyMap[name] || name);
        } catch { toolFriendly.push("selesai"); }
      }
      j++;
    }
    renderItems.push({ assistant: m, toolFriendly, hasCluster });
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-accent/5 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-accent/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      <ThemeToggle />

      {/* Header */}
      <div className="sticky top-0 z-30 bg-card/80 backdrop-blur-xl border-b border-border/50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/admin/dashboard")} className="hover:scale-105">
              <ArrowLeft className="h-4 w-4 mr-1" />Dashboard
            </Button>
            <div className="h-6 w-px bg-border" />
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-gradient-to-br from-primary to-accent">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold">Asisten AI Admin</h1>
                <p className="text-[10px] text-muted-foreground">{aspirations.length} aspirasi terindeks</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleClearChat} className="text-xs gap-1.5 hover:scale-105">
              <RotateCcw className="h-3.5 w-3.5" />Reset Chat
            </Button>
          </div>
        </div>
      </div>

      {/* Messages — FULL WIDTH */}
      <div className="container mx-auto px-4 py-6 relative z-10">
        <div className="max-w-5xl mx-auto">
          <div ref={scrollRef} className="space-y-4 min-h-[60vh]">
            {renderItems.map((item, i) => {
              if (item.user) {
                return (
                  <div key={i} className="flex gap-3 justify-end">
                    <div className="max-w-[75%] rounded-2xl rounded-tr-md px-4 py-3 text-sm leading-relaxed bg-gradient-to-r from-primary to-accent text-white shadow-lg">
                      {item.user.content}
                    </div>
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-blue-500 flex items-center justify-center shrink-0 shadow-md">
                      <User className="h-4 w-4 text-white" />
                    </div>
                  </div>
                );
              }
              const msg = item.assistant!;
              return (
                <div key={i} className="flex gap-3 justify-start">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center shrink-0 shadow-md">
                    <Bot className="h-4 w-4 text-white" />
                  </div>
                  <div className="max-w-[85%] space-y-2 min-w-0">
                    {msg.content && (
                      <div className="rounded-2xl rounded-tl-md px-5 py-4 text-sm leading-relaxed bg-card border border-border/50 shadow-sm">
                        <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0 prose-strong:text-foreground prose-table:max-w-full overflow-x-auto">
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                              table: ({ children, ...props }) => <div className="overflow-x-auto my-2"><table className="ai-markdown-table" {...props}>{children}</table></div>,
                              thead: ({ children, ...props }) => <thead {...props}>{children}</thead>,
                              tbody: ({ children, ...props }) => <tbody {...props}>{children}</tbody>,
                              tr: ({ children, ...props }) => <tr {...props}>{children}</tr>,
                              th: ({ children, ...props }) => <th {...props}>{children}</th>,
                              td: ({ children, ...props }) => <td {...props}>{children}</td>,
                            }}
                          >
                            {msg.content}
                          </ReactMarkdown>
                        </div>
                      </div>
                    )}

                    {item.toolFriendly.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {msg.tool_calls?.map((tc: any, j: number) => (
                          <div key={j} className="inline-flex items-center gap-1.5 text-xs bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 rounded-full px-2.5 py-1 border border-green-200 dark:border-green-800">
                            {iconFor(tc.function.name)}
                            {item.toolFriendly[j]}
                          </div>
                        ))}
                      </div>
                    )}

                    {item.hasCluster && topicGroups.length > 0 && (
                      <div className="space-y-3 mt-3">
                        {topicGroups.map((g, j) => (
                          <Card key={j} className="p-4 border border-border/50 bg-card/80 backdrop-blur-sm">
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-semibold">{g.topic_name}</span>
                              <Badge variant="secondary">{g.aspiration_ids.length} aspirasi</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mb-3">{g.summary}</p>
                            <div className="flex flex-wrap gap-2">
                              <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => { }}>
                                <ListChecks className="mr-1 h-3 w-3" />Pilih
                              </Button>
                              <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => { }}>
                                <Download className="mr-1 h-3 w-3" />Word
                              </Button>
                              <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => { }}>
                                <Download className="mr-1 h-3 w-3" />Excel
                              </Button>
                              <Button variant="outline" size="sm" className="h-8 text-xs text-destructive" onClick={() => { }}>
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
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center shrink-0 shadow-md">
                  <Bot className="h-4 w-4 text-white" />
                </div>
                <div className="bg-card border border-border/50 rounded-2xl rounded-tl-md px-4 py-3 shadow-sm">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    <span className="text-sm text-muted-foreground">{stepLabel}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Input — STICKY BOTTOM */}
          <div className="sticky bottom-0 pt-4 pb-2 bg-gradient-to-t from-background via-background to-transparent">
            <div className="flex gap-3 max-w-5xl mx-auto">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                placeholder="Ketik perintah... (contoh: 'Cari aspirasi soal kantin, kelompokkan, lalu export Word')"
                className="flex-1 h-12 text-sm rounded-xl border-2 focus:border-primary"
                disabled={isLoading || dataLoading}
              />
              <Button onClick={handleSend} disabled={isLoading || !input.trim() || dataLoading}
                className="h-12 w-12 p-0 rounded-xl bg-gradient-to-r from-primary to-accent hover:opacity-90 shadow-lg">
                {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground text-center mt-2 max-w-5xl mx-auto">
              AI bisa mencari, statistik, kelompokkan topik, tandai status, filter, ekspor 4 format, tag, dan usul hapus.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminAiPage;
