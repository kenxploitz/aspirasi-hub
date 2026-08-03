import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  ArrowLeft, Save, Loader2, Eye, EyeOff, Wifi, Settings, CheckCircle2, XCircle,
  Shield, Database, Upload, Download, AlertTriangle, Wrench, Globe, Clock,
  RefreshCw, FileJson, FileText, Zap, Server, HardDrive, Image, Building2, Users,
} from "lucide-react";

const SettingsPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [testResult, setTestResult] = useState<"idle" | "success" | "error">("idle");
  const [testMessage, setTestMessage] = useState("");
  const [activeTab, setActiveTab] = useState<"ai" | "site" | "backup" | "branding">("site");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const schoolLogoRef = useRef<HTMLInputElement>(null);
  const orgLogoRef = useRef<HTMLInputElement>(null);

  // AI Settings
  const [aiForm, setAiForm] = useState({
    provider_name: "custom",
    base_url: "",
    api_key: "",
    model: "",
  });

  // Site Settings
  const [siteSettings, setSiteSettings] = useState({
    maintenance_mode: false,
    maintenance_message: "Sistem sedang dalam pemeliharaan. Silakan coba lagi nanti.",
    site_name: "FASPIRA - Forum Aspirasi Siswa",
    school_name: "SMA Negeri 1 Kendal",
    max_aspiration_length: 2000,
    min_aspiration_length: 10,
    enable_ai_curhat: true,
    enable_anonymous: true,
    school_logo_url: "",
    org_logo_url: "",
    org_name: "MPK SMA Negeri 1 Kendal",
  });

  // Logo upload state
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [schoolLogoPreview, setSchoolLogoPreview] = useState<string | null>(null);
  const [orgLogoPreview, setOrgLogoPreview] = useState<string | null>(null);

  // Backup state
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [lastBackup, setLastBackup] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { navigate("/admin/login"); return; }

      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", session.user.id);
      if (!roles?.some((r) => r.role === "developer")) {
        toast({ title: "Akses ditolak", description: "Hanya developer", variant: "destructive" });
        navigate("/admin/dashboard"); return;
      }

      // Load AI settings
      const { data: aiData } = await supabase.functions.invoke("ai-settings", { body: { action: "get" } });
      if (aiData) {
        setAiForm({
          provider_name: aiData.provider_name || "custom",
          base_url: aiData.base_url || "",
          api_key: "",
          model: aiData.model || "",
        });
      }

      // Load site settings from database
      const { data: settingsData } = await supabase
        .from("site_settings")
        .select("*")
        .limit(1)
        .maybeSingle();

      if (settingsData) {
        setSiteSettings({
          maintenance_mode: settingsData.maintenance_mode || false,
          maintenance_message: settingsData.maintenance_message || "Sistem sedang dalam pemeliharaan. Silakan coba lagi nanti.",
          site_name: settingsData.site_name || "FASPIRA - Forum Aspirasi Siswa",
          school_name: settingsData.school_name || "SMA Negeri 1 Kendal",
          max_aspiration_length: settingsData.max_aspiration_length || 2000,
          min_aspiration_length: settingsData.min_aspiration_length || 10,
          enable_ai_curhat: settingsData.enable_ai_curhat !== false,
          enable_anonymous: settingsData.enable_anonymous !== false,
          school_logo_url: settingsData.school_logo_url || "",
          org_logo_url: settingsData.org_logo_url || "",
          org_name: settingsData.org_name || "MPK SMA Negeri 1 Kendal",
        });
        if (settingsData.school_logo_url) setSchoolLogoPreview(settingsData.school_logo_url);
        if (settingsData.org_logo_url) setOrgLogoPreview(settingsData.org_logo_url);
      }

      // Get last backup info
      const { data: backupInfo } = await supabase.storage.from("backups").list("", { limit: 1, sortBy: { column: "created_at", order: "desc" } });
      if (backupInfo && backupInfo.length > 0) {
        setLastBackup(backupInfo[0].created_at);
      }

      setIsLoading(false);
    })();
  }, []);

  const handleSaveAI = async () => {
    if (!aiForm.base_url || !aiForm.api_key || !aiForm.model) {
      toast({ title: "Lengkapi semua field AI", variant: "destructive" }); return;
    }
    try {
      setIsSaving(true);
      const { data, error } = await supabase.functions.invoke("ai-settings", {
        body: { action: "save", ...aiForm },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: "Pengaturan AI disimpan" });
      setAiForm((f) => ({ ...f, api_key: "" }));
    } catch (e: any) {
      toast({ title: "Gagal menyimpan", description: e.message, variant: "destructive" });
    } finally { setIsSaving(false); }
  };

  const handleTestAI = async () => {
    if (!aiForm.base_url || !aiForm.api_key || !aiForm.model) {
      toast({ title: "Lengkapi semua field dulu", variant: "destructive" }); return;
    }
    try {
      setIsTesting(true); setTestResult("idle"); setTestMessage("");
      const { data, error } = await supabase.functions.invoke("ai-settings", {
        body: { action: "test", base_url: aiForm.base_url, api_key: aiForm.api_key, model: aiForm.model },
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

  const handleSaveSiteSettings = async () => {
    try {
      setIsSaving(true);
      const { error } = await supabase
        .from("site_settings")
        .upsert(siteSettings, { onConflict: "id" });
      if (error) throw error;
      toast({ title: "Pengaturan situs disimpan" });
    } catch (e: any) {
      toast({ title: "Gagal menyimpan", description: e.message, variant: "destructive" });
    } finally { setIsSaving(false); }
  };

  const handleLogoUpload = async (file: File, type: "school" | "org") => {
    try {
      setIsUploadingLogo(true);
      const ext = file.name.split('.').pop() || 'png';
      const fileName = `${type}-logo-${Date.now()}.${ext}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from("logos")
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("logos")
        .getPublicUrl(fileName);

      const logoUrl = urlData.publicUrl;

      // Update state
      if (type === "school") {
        setSiteSettings((s) => ({ ...s, school_logo_url: logoUrl }));
        setSchoolLogoPreview(logoUrl);
      } else {
        setSiteSettings((s) => ({ ...s, org_logo_url: logoUrl }));
        setOrgLogoPreview(logoUrl);
      }

      // Save to database
      const updateField = type === "school" ? "school_logo_url" : "org_logo_url";
      const { error: dbError } = await supabase
        .from("site_settings")
        .update({ [updateField]: logoUrl })
        .neq("id", "00000000-0000-0000-0000-000000000000");

      if (dbError) throw dbError;

      toast({ title: `Logo ${type === "school" ? "sekolah" : "organisasi"} berhasil diupload` });
    } catch (e: any) {
      toast({ title: "Gagal upload logo", description: e.message, variant: "destructive" });
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const handleBackup = async (format: "json" | "sql") => {
    try {
      setIsBackingUp(true);
      toast({ title: `Membuat backup ${format.toUpperCase()}...` });
      const { data, error } = await supabase.functions.invoke("backup-data", { body: { format } });
      if (error) throw error;

      const blob = new Blob([typeof data === "string" ? data : JSON.stringify(data)], {
        type: format === "json" ? "application/json" : "application/sql",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `faspira-backup-${new Date().toISOString().split("T")[0]}.${format}`;
      a.click();
      URL.revokeObjectURL(url);

      // Also upload to Supabase Storage
      const fileName = `auto-backup-${new Date().toISOString().split("T")[0]}.${format}`;
      await supabase.storage.from("backups").upload(fileName, blob, { upsert: true });
      setLastBackup(new Date().toISOString());

      toast({ title: `Backup ${format.toUpperCase()} berhasil` });
    } catch (e: any) {
      toast({ title: "Gagal backup", description: e.message, variant: "destructive" });
    } finally { setIsBackingUp(false); }
  };

  const handleRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsRestoring(true);
      const text = await file.text();
      let data: any;

      if (file.name.endsWith(".json")) {
        data = JSON.parse(text);
        // Restore aspirations from JSON
        if (data.aspirations && Array.isArray(data.aspirations)) {
          const { error } = await supabase.from("aspirations").upsert(data.aspirations, { onConflict: "id", ignoreDuplicates: true });
          if (error) throw error;
          toast({ title: `${data.aspirations.length} aspirasi dipulihkan` });
        }
      } else if (file.name.endsWith(".sql")) {
        // For SQL, we need to run it through the edge function
        const { error } = await supabase.functions.invoke("backup-data", { body: { action: "restore", sql: text } });
        if (error) throw error;
        toast({ title: "Database dipulihkan dari SQL" });
      }

      toast({ title: "Restore berhasil!" });
    } catch (e: any) {
      toast({ title: "Gagal restore", description: e.message, variant: "destructive" });
    } finally {
      setIsRestoring(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  if (isLoading) return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-accent/5 flex items-center justify-center">
      <Loader2 className="w-12 h-12 text-primary animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-accent/5 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-20 w-72 h-72 bg-primary/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-accent/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      <ThemeToggle />

      <div className="container mx-auto px-4 py-8 relative z-10 max-w-4xl">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8 animate-fade-in">
          <Button variant="outline" onClick={() => navigate("/admin/dashboard")}
            className="border-2 hover:scale-105 transition-all duration-300">
            <ArrowLeft className="mr-2 h-4 w-4" />Kembali
          </Button>
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-gradient-to-br from-primary to-accent shadow-lg">
              <Settings className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-primary via-accent to-secondary bg-clip-text text-transparent">
                Pengaturan Sistem
              </h1>
              <p className="text-muted-foreground">Kelola konfigurasi FASPIRA</p>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 mb-6 animate-fade-in flex-wrap" style={{ animationDelay: '0.1s' }}>
          {[
            { id: "site" as const, label: "Situs", icon: Globe },
            { id: "branding" as const, label: "Branding", icon: Image },
            { id: "ai" as const, label: "AI", icon: Zap },
            { id: "backup" as const, label: "Backup", icon: Database },
          ].map((tab) => (
            <Button
              key={tab.id}
              variant={activeTab === tab.id ? "default" : "outline"}
              onClick={() => setActiveTab(tab.id)}
              className={`transition-all duration-300 hover:scale-105 ${activeTab === tab.id ? "shadow-lg" : ""}`}
            >
              <tab.icon className="mr-2 h-4 w-4" />
              {tab.label}
            </Button>
          ))}
        </div>

        {/* Site Settings */}
        {activeTab === "site" && (
          <div className="space-y-6 animate-fade-in" style={{ animationDelay: '0.2s' }}>
            {/* Maintenance Mode */}
            <Card className="p-6 shadow-xl border-2 border-destructive/20 bg-card/80 backdrop-blur-md">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-destructive/10">
                    <AlertTriangle className="w-6 h-6 text-destructive" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">Mode Pemeliharaan</h2>
                    <p className="text-sm text-muted-foreground">Nonaktifkan sementara akses publik</p>
                  </div>
                </div>
                <Switch
                  checked={siteSettings.maintenance_mode}
                  onCheckedChange={(checked) => setSiteSettings({ ...siteSettings, maintenance_mode: checked })}
                />
              </div>
              {siteSettings.maintenance_mode && (
                <div className="space-y-3">
                  <div className="p-3 bg-destructive/10 rounded-lg border border-destructive/20">
                    <p className="text-sm text-destructive font-medium">⚠️ Mode pemeliharaan AKTIF — pengguna tidak bisa mengakses situs</p>
                  </div>
                  <div>
                    <Label className="text-sm">Pesan Pemeliharaan</Label>
                    <Input
                      value={siteSettings.maintenance_message}
                      onChange={(e) => setSiteSettings({ ...siteSettings, maintenance_message: e.target.value })}
                      className="mt-1"
                      placeholder="Pesan yang ditampilkan saat maintenance"
                    />
                  </div>
                </div>
              )}
            </Card>

            {/* General Settings */}
            <Card className="p-6 shadow-xl border-2 border-primary/20 bg-card/80 backdrop-blur-md">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Wrench className="w-6 h-6 text-primary" />
                </div>
                <h2 className="text-xl font-bold">Pengaturan Umum</h2>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm">Nama Situs</Label>
                  <Input
                    value={siteSettings.site_name}
                    onChange={(e) => setSiteSettings({ ...siteSettings, site_name: e.target.value })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-sm">Nama Sekolah</Label>
                  <Input
                    value={siteSettings.school_name}
                    onChange={(e) => setSiteSettings({ ...siteSettings, school_name: e.target.value })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-sm">Min Karakter Aspirasi</Label>
                  <Input
                    type="number"
                    value={siteSettings.min_aspiration_length}
                    onChange={(e) => setSiteSettings({ ...siteSettings, min_aspiration_length: parseInt(e.target.value) || 10 })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-sm">Max Karakter Aspirasi</Label>
                  <Input
                    type="number"
                    value={siteSettings.max_aspiration_length}
                    onChange={(e) => setSiteSettings({ ...siteSettings, max_aspiration_length: parseInt(e.target.value) || 2000 })}
                    className="mt-1"
                  />
                </div>
              </div>
            </Card>

            {/* Feature Toggles */}
            <Card className="p-6 shadow-xl border-2 border-accent/20 bg-card/80 backdrop-blur-md">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-lg bg-accent/10">
                  <Zap className="w-6 h-6 text-accent" />
                </div>
                <h2 className="text-xl font-bold">Fitur</h2>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">AI Curhat</p>
                    <p className="text-sm text-muted-foreground">Aktifkan chatbot curhat untuk siswa</p>
                  </div>
                  <Switch
                    checked={siteSettings.enable_ai_curhat}
                    onCheckedChange={(checked) => setSiteSettings({ ...siteSettings, enable_ai_curhat: checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Mode Anonim</p>
                    <p className="text-sm text-muted-foreground">Izinkan pengiriman tanpa nama</p>
                  </div>
                  <Switch
                    checked={siteSettings.enable_anonymous}
                    onCheckedChange={(checked) => setSiteSettings({ ...siteSettings, enable_anonymous: checked })}
                  />
                </div>
              </div>
            </Card>

            <div className="flex justify-end">
              <Button onClick={handleSaveSiteSettings} disabled={isSaving}
                className="bg-gradient-to-r from-primary to-accent text-white hover:opacity-90 shadow-xl px-8 py-6 text-lg">
                {isSaving ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Save className="mr-2 h-5 w-5" />}
                Simpan Pengaturan
              </Button>
            </div>
          </div>
        )}

        {/* Branding Settings */}
        {activeTab === "branding" && (
          <div className="space-y-6 animate-fade-in" style={{ animationDelay: '0.2s' }}>
            {/* School Logo */}
            <Card className="p-6 shadow-xl border-2 border-primary/20 bg-card/80 backdrop-blur-md">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Building2 className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">Logo Sekolah</h2>
                  <p className="text-sm text-muted-foreground">Upload logo sekolah untuk ditampilkan di homepage</p>
                </div>
              </div>

              <div className="flex flex-col md:flex-row gap-6">
                <div className="flex-1">
                  <div className="border-2 border-dashed border-primary/20 rounded-xl p-8 text-center hover:border-primary/50 transition-colors cursor-pointer"
                    onClick={() => schoolLogoRef.current?.click()}>
                    {schoolLogoPreview ? (
                      <div className="space-y-4">
                        <img src={schoolLogoPreview} alt="Logo Sekolah" className="max-h-32 mx-auto object-contain" />
                        <p className="text-sm text-muted-foreground">Klik untuk mengganti</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <Upload className="h-12 w-12 text-muted-foreground mx-auto" />
                        <div>
                          <p className="font-medium">Upload Logo Sekolah</p>
                          <p className="text-sm text-muted-foreground">PNG, JPG, SVG (max 2MB)</p>
                        </div>
                      </div>
                    )}
                  </div>
                  <input ref={schoolLogoRef} type="file" accept="image/*" className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleLogoUpload(f, "school"); }} />
                </div>
                <div className="flex-1 space-y-3">
                  <Label className="text-sm">Nama Sekolah</Label>
                  <Input value={siteSettings.school_name}
                    onChange={(e) => setSiteSettings({ ...siteSettings, school_name: e.target.value })} />
                  <p className="text-xs text-muted-foreground">Nama sekolah akan ditampilkan di homepage dan laporan</p>
                </div>
              </div>
            </Card>

            {/* Organization Logo */}
            <Card className="p-6 shadow-xl border-2 border-accent/20 bg-card/80 backdrop-blur-md">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-lg bg-accent/10">
                  <Users className="w-6 h-6 text-accent" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">Logo Organisasi</h2>
                  <p className="text-sm text-muted-foreground">Upload logo MPK/OSIS untuk ditampilkan di homepage</p>
                </div>
              </div>

              <div className="flex flex-col md:flex-row gap-6">
                <div className="flex-1">
                  <div className="border-2 border-dashed border-accent/20 rounded-xl p-8 text-center hover:border-accent/50 transition-colors cursor-pointer"
                    onClick={() => orgLogoRef.current?.click()}>
                    {orgLogoPreview ? (
                      <div className="space-y-4">
                        <img src={orgLogoPreview} alt="Logo Organisasi" className="max-h-32 mx-auto object-contain" />
                        <p className="text-sm text-muted-foreground">Klik untuk mengganti</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <Upload className="h-12 w-12 text-muted-foreground mx-auto" />
                        <div>
                          <p className="font-medium">Upload Logo Organisasi</p>
                          <p className="text-sm text-muted-foreground">PNG, JPG, SVG (max 2MB)</p>
                        </div>
                      </div>
                    )}
                  </div>
                  <input ref={orgLogoRef} type="file" accept="image/*" className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleLogoUpload(f, "org"); }} />
                </div>
                <div className="flex-1 space-y-3">
                  <Label className="text-sm">Nama Organisasi</Label>
                  <Input value={siteSettings.org_name}
                    onChange={(e) => setSiteSettings({ ...siteSettings, org_name: e.target.value })} />
                  <p className="text-xs text-muted-foreground">Contoh: MPK, OSIS, DKM</p>
                </div>
              </div>
            </Card>

            {/* Preview */}
            <Card className="p-6 shadow-xl border-2 border-secondary/20 bg-card/80 backdrop-blur-md">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-secondary/10">
                  <Image className="w-6 h-6 text-secondary" />
                </div>
                <h2 className="text-xl font-bold">Preview Logo</h2>
              </div>
              <div className="flex items-center justify-center gap-8 p-8 bg-muted/30 rounded-xl">
                {schoolLogoPreview ? (
                  <img src={schoolLogoPreview} alt="School" className="h-16 object-contain" />
                ) : (
                  <div className="h-16 w-16 bg-muted rounded-lg flex items-center justify-center">
                    <Building2 className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}
                <div className="h-12 w-px bg-border" />
                {orgLogoPreview ? (
                  <img src={orgLogoPreview} alt="Org" className="h-16 object-contain" />
                ) : (
                  <div className="h-16 w-16 bg-muted rounded-lg flex items-center justify-center">
                    <Users className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}
              </div>
            </Card>
          </div>
        )}

        {/* AI Settings */}
        {activeTab === "ai" && (
          <div className="space-y-6 animate-fade-in" style={{ animationDelay: '0.2s' }}>
            <Card className="p-6 shadow-xl border-2 border-primary/20 bg-card/80 backdrop-blur-md">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Zap className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">Konfigurasi AI</h2>
                  <p className="text-sm text-muted-foreground">Koneksi AI untuk asisten admin dan curhat siswa</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <Label className="text-sm">Provider</Label>
                  <Input value={aiForm.provider_name} onChange={(e) => setAiForm({ ...aiForm, provider_name: e.target.value })} placeholder="custom" className="mt-1" />
                  <p className="text-xs text-muted-foreground mt-1">Nama provider (untuk identifikasi)</p>
                </div>
                <div>
                  <Label className="text-sm">Base URL</Label>
                  <Input value={aiForm.base_url} onChange={(e) => setAiForm({ ...aiForm, base_url: e.target.value })} placeholder="https://api.openai.com/v1" className="mt-1" />
                  <p className="text-xs text-muted-foreground mt-1">Endpoint API OpenAI-compatible</p>
                </div>
                <div>
                  <Label className="text-sm">API Key</Label>
                  <div className="relative mt-1">
                    <Input type={showKey ? "text" : "password"} value={aiForm.api_key} onChange={(e) => setAiForm({ ...aiForm, api_key: e.target.value })} placeholder="sk-..." className="pr-9" />
                    <button type="button" onClick={() => setShowKey(!showKey)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Disimpan terenkripsi, tidak pernah dikirim ke browser</p>
                </div>
                <div>
                  <Label className="text-sm">Model</Label>
                  <Input value={aiForm.model} onChange={(e) => setAiForm({ ...aiForm, model: e.target.value })} placeholder="gpt-4o-mini" className="mt-1" />
                  <p className="text-xs text-muted-foreground mt-1">Contoh: gpt-4o, deepseek-chat, llama-3.1-70b</p>
                </div>

                {testResult !== "idle" && (
                  <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${testResult === "success" ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400" : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400"}`}>
                    {testResult === "success" ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                    {testMessage}
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <Button variant="outline" onClick={handleTestAI} disabled={isTesting}>
                    {isTesting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wifi className="mr-2 h-4 w-4" />}
                    Test Koneksi
                  </Button>
                  <Button onClick={handleSaveAI} disabled={isSaving}
                    className="bg-gradient-to-r from-primary to-accent text-white hover:opacity-90">
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Simpan
                  </Button>
                </div>
              </div>
            </Card>

            <Card className="p-4 bg-muted/30">
              <div className="flex items-start gap-2">
                <Shield className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div className="text-xs text-muted-foreground space-y-1">
                  <p><strong>Provider yang didukung:</strong> OpenAI, OpenRouter, Groq, DeepSeek, atau API manapun yang kompatibel dengan format <code>/v1/chat/completions</code>.</p>
                  <p><strong>Keamanan:</strong> API key hanya disimpan di server dan tidak pernah dikirim ke browser.</p>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Backup & Restore */}
        {activeTab === "backup" && (
          <div className="space-y-6 animate-fade-in" style={{ animationDelay: '0.2s' }}>
            {/* Export Backup */}
            <Card className="p-6 shadow-xl border-2 border-green-500/20 bg-card/80 backdrop-blur-md">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <Download className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">Export Backup</h2>
                  <p className="text-sm text-muted-foreground">Download backup data aspirasi</p>
                </div>
              </div>

              {lastBackup && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                  <Clock className="h-4 w-4" />
                  <span>Backup terakhir: {new Date(lastBackup).toLocaleString("id-ID")}</span>
                </div>
              )}

              <div className="grid md:grid-cols-2 gap-4">
                <Button onClick={() => handleBackup("json")} disabled={isBackingUp}
                  className="h-24 flex-col gap-2 bg-gradient-to-br from-green-500 to-green-600 text-white hover:opacity-90 shadow-xl">
                  {isBackingUp ? <Loader2 className="h-8 w-8 animate-spin" /> : <FileJson className="h-8 w-8" />}
                  <span className="text-lg font-bold">Backup JSON</span>
                  <span className="text-xs opacity-80">Data lengkap, bisa di-restore</span>
                </Button>
                <Button onClick={() => handleBackup("sql")} disabled={isBackingUp}
                  className="h-24 flex-col gap-2 bg-gradient-to-br from-blue-500 to-blue-600 text-white hover:opacity-90 shadow-xl">
                  {isBackingUp ? <Loader2 className="h-8 w-8 animate-spin" /> : <FileText className="h-8 w-8" />}
                  <span className="text-lg font-bold">Backup SQL</span>
                  <span className="text-xs opacity-80">Query SQL untuk restore manual</span>
                </Button>
              </div>
            </Card>

            {/* Import/Restore */}
            <Card className="p-6 shadow-xl border-2 border-amber-500/20 bg-card/80 backdrop-blur-md">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-lg bg-amber-500/10">
                  <Upload className="w-6 h-6 text-amber-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">Import / Restore</h2>
                  <p className="text-sm text-muted-foreground">Pulihkan data dari file backup</p>
                </div>
              </div>

              <div className="p-4 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800 mb-4">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                  <div className="text-sm text-amber-800 dark:text-amber-200">
                    <p className="font-medium">Perhatian!</p>
                    <p>Restore akan menimpa data yang ada. Pastikan Anda sudah backup dulu sebelum restore.</p>
                  </div>
                </div>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept=".json,.sql"
                onChange={handleRestore}
                className="hidden"
              />
              <Button onClick={() => fileInputRef.current?.click()} disabled={isRestoring} variant="outline"
                className="w-full h-16 border-2 border-dashed border-amber-300 hover:border-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/30">
                {isRestoring ? (
                  <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Memulihkan data...</>
                ) : (
                  <><Upload className="mr-2 h-5 w-5" />Pilih File Backup (.json atau .sql)</>
                )}
              </Button>
            </Card>

            {/* Auto Backup Info */}
            <Card className="p-6 shadow-xl border-2 border-accent/20 bg-card/80 backdrop-blur-md">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-accent/10">
                  <RefreshCw className="w-6 h-6 text-accent" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">Auto Backup</h2>
                  <p className="text-sm text-muted-foreground">Backup otomatis harian</p>
                </div>
              </div>
              <div className="p-4 bg-accent/5 rounded-lg border border-accent/20">
                <div className="flex items-center gap-3">
                  <Server className="h-5 w-5 text-accent" />
                  <div>
                    <p className="text-sm font-medium">Supabase Storage</p>
                    <p className="text-xs text-muted-foreground">Backup otomatis tersimpan di bucket "backups" setiap hari</p>
                  </div>
                  <Badge variant="secondary" className="ml-auto">Aktif</Badge>
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default SettingsPage;
