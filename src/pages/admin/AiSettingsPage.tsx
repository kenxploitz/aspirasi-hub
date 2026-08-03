import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  ArrowLeft, Save, Loader2, Eye, EyeOff, Wifi, WifiOff, Settings, CheckCircle2, XCircle,
} from "lucide-react";

const AiSettingsPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [testResult, setTestResult] = useState<"idle" | "success" | "error">("idle");
  const [testMessage, setTestMessage] = useState("");

  const [form, setForm] = useState({
    provider_name: "custom",
    base_url: "",
    api_key: "",
    model: "",
  });

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { navigate("/admin/login"); return; }

      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", session.user.id);
      if (!roles?.some((r) => r.role === "developer")) {
        toast({ title: "Akses ditolak", description: "Hanya developer", variant: "destructive" });
        navigate("/admin/dashboard"); return;
      }

      // Load current settings via edge function
      const { data, error } = await supabase.functions.invoke("ai-settings", {
        body: { action: "get" },
      });

      if (data && !error) {
        setForm({
          provider_name: data.provider_name || "custom",
          base_url: data.base_url || "",
          api_key: "", // Don't show full key
          model: data.model || "",
        });
      }
      setIsLoading(false);
    })();
  }, []);

  const handleSave = async () => {
    if (!form.base_url || !form.api_key || !form.model) {
      toast({ title: "Lengkapi semua field", variant: "destructive" }); return;
    }
    try {
      setIsSaving(true);
      const { data, error } = await supabase.functions.invoke("ai-settings", {
        body: { action: "save", ...form },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: "Pengaturan disimpan" });
      setForm((f) => ({ ...f, api_key: "" })); // Clear key field after save
    } catch (e: any) {
      toast({ title: "Gagal menyimpan", description: e.message, variant: "destructive" });
    } finally { setIsSaving(false); }
  };

  const handleTest = async () => {
    if (!form.base_url || !form.api_key || !form.model) {
      toast({ title: "Lengkapi semua field dulu", variant: "destructive" }); return;
    }
    try {
      setIsTesting(true); setTestResult("idle"); setTestMessage("");
      const { data, error } = await supabase.functions.invoke("ai-settings", {
        body: { action: "test", base_url: form.base_url, api_key: form.api_key, model: form.model },
      });
      if (error) throw error;
      if (data?.success) {
        setTestResult("success"); setTestMessage("Koneksi berhasil!");
      } else {
        setTestResult("error"); setTestMessage(data?.error || "Gagal terhubung");
      }
    } catch (e: any) {
      setTestResult("error"); setTestMessage(e.message);
    } finally { setIsTesting(false); }
  };

  if (isLoading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Loader2 className="w-6 h-6 text-primary animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <ThemeToggle />
      <div className="max-w-xl mx-auto px-4 md:px-6 py-6">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => navigate("/admin/dashboard")}>
            <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />Kembali
          </Button>
          <div>
            <h1 className="text-xl font-bold text-foreground">Pengaturan AI</h1>
            <p className="text-xs text-muted-foreground">Konfigurasi koneksi AI untuk asisten admin dan curhat siswa</p>
          </div>
        </div>

        <Card className="p-5 border border-border space-y-5">
          {/* Provider */}
          <div>
            <Label className="text-xs">Provider</Label>
            <Input value={form.provider_name} onChange={(e) => setForm({ ...form, provider_name: e.target.value })} placeholder="custom" className="h-9 text-sm mt-1" />
            <p className="text-[10px] text-muted-foreground mt-1">Nama provider (untuk identifikasi)</p>
          </div>

          {/* Base URL */}
          <div>
            <Label className="text-xs">Base URL</Label>
            <Input value={form.base_url} onChange={(e) => setForm({ ...form, base_url: e.target.value })} placeholder="https://api.openai.com/v1" className="h-9 text-sm mt-1" />
            <p className="text-[10px] text-muted-foreground mt-1">Endpoint API OpenAI-compatible (OpenAI, OpenRouter, Groq, DeepSeek, dll)</p>
          </div>

          {/* API Key */}
          <div>
            <Label className="text-xs">API Key</Label>
            <div className="relative mt-1">
              <Input type={showKey ? "text" : "password"} value={form.api_key} onChange={(e) => setForm({ ...form, api_key: e.target.value })} placeholder="sk-..." className="h-9 text-sm pr-9" />
              <button type="button" onClick={() => setShowKey(!showKey)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">Disimpan terenkripsi, tidak pernah dikirim ke browser</p>
          </div>

          {/* Model */}
          <div>
            <Label className="text-xs">Model</Label>
            <Input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} placeholder="gpt-4o-mini" className="h-9 text-sm mt-1" />
            <p className="text-[10px] text-muted-foreground mt-1">Nama model (contoh: gpt-4o, deepseek-chat, llama-3.1-70b)</p>
          </div>

          {/* Test result */}
          {testResult !== "idle" && (
            <div className={`flex items-center gap-2 p-3 rounded text-xs ${testResult === "success" ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400" : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400"}`}>
              {testResult === "success" ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
              {testMessage}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button variant="outline" size="sm" className="h-9 text-xs" onClick={handleTest} disabled={isTesting}>
              {isTesting ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Wifi className="mr-1.5 h-3.5 w-3.5" />}
              Test Koneksi
            </Button>
            <Button size="sm" className="h-9 text-xs bg-primary text-primary-foreground hover:bg-primary/90" onClick={handleSave} disabled={isSaving}>
              {isSaving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}
              Simpan
            </Button>
          </div>
        </Card>

        {/* Info card */}
        <Card className="p-4 border border-border mt-4">
          <div className="flex items-start gap-2">
            <Settings className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <div className="text-xs text-muted-foreground space-y-1">
              <p><strong>Provider yang didukung:</strong> OpenAI, OpenRouter, Groq, DeepSeek, atau API manapun yang kompatibel dengan format <code>/v1/chat/completions</code>.</p>
              <p><strong>Keamanan:</strong> API key hanya disimpan di server dan tidak pernah dikirim ke browser. Semua pemanggilan AI lewat Edge Function Supabase.</p>
              <p><strong>Model:</strong> Bisa diganti kapan saja. Model yang umum: <code>gpt-4o-mini</code>, <code>gpt-4o</code>, <code>deepseek-chat</code>, <code>llama-3.1-70b</code>.</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default AiSettingsPage;
