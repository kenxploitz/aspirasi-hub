import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import {
  LogOut, Search, MessageSquare, FileText, BarChart3, Loader2, Trash,
  Download, Calendar, CheckSquare, X, Filter, ChevronDown, ChevronLeft, ChevronRight, Users, Settings, Sparkles, Database,
} from "lucide-react";
import AspirationCard from "@/components/AspirationCard";
import AspirationStats from "@/components/AspirationStats";
import { AdminUserManagement } from "@/components/AdminUserManagement";
import { ThemeToggle } from "@/components/ThemeToggle";
import { sanitizeForPDF } from "@/lib/security";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DateRange } from "react-day-picker";
import { format, isWithinInterval, startOfDay, endOfDay, subDays, startOfMonth, endOfMonth } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { exportToWord } from "@/lib/export/exportToWord";
import { exportToExcel } from "@/lib/export/exportToExcel";
import { exportToPptx } from "@/lib/export/exportToPptx";
import AiAdminChatPanel from "@/components/AiAdminChatPanel";

interface Aspiration {
  id: string;
  student_name: string;
  student_class: string | null;
  content: string;
  status: string;
  created_at: string;
  comments: Array<{
    id: string;
    comment_text: string;
    created_at: string;
    admin_id: string;
  }>;
}

type StatusFilter = "all" | "belum_ditanggapi" | "sudah_ditanggapi";
type ViewMode = "aspirations" | "admins";

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [aspirations, setAspirations] = useState<Aspiration[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [user, setUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<string>("");
  const [viewMode, setViewMode] = useState<ViewMode>("aspirations");
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showAiChat, setShowAiChat] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 25;

  useEffect(() => {
    let mounted = true;
    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) { if (mounted) navigate("/admin/login", { replace: true }); return; }

        const { data: userRoles } = await supabase.from("user_roles").select("role").eq("user_id", session.user.id);
        const hasDeveloper = userRoles?.some((r) => r.role === "developer");
        const hasAdmin = userRoles?.some((r) => r.role === "admin");
        const userEmail = session.user.email?.toLowerCase();

        if (!hasDeveloper && !hasAdmin) {
          // Check admin_emails table (no hardcoded emails)
          const { data: adminEmail } = await supabase.from("admin_emails" as any).select("email").ilike("email", userEmail || "").maybeSingle();
          if (!adminEmail) { await supabase.auth.signOut(); if (mounted) navigate("/admin/login", { replace: true }); return; }
          await supabase.from("user_roles").upsert({ user_id: session.user.id, role: "admin" as const }, { onConflict: "user_id,role", ignoreDuplicates: true });
          if (mounted) { setUser(session.user); setUserRole("admin"); setIsLoading(false); }
          return;
        }

        if (mounted) { setUser(session.user); setUserRole(hasDeveloper ? "developer" : "admin"); setIsLoading(false); }
      } catch { if (mounted) navigate("/admin/login", { replace: true }); }
    };

    checkAuth();
    fetchAspirations();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (event === "SIGNED_OUT" || !session) navigate("/admin/login", { replace: true });
    });
    return () => { mounted = false; subscription.unsubscribe(); };
  }, [navigate]);

  const fetchAspirations = async () => {
    try {
      const { data, error } = await supabase.from("aspirations").select(`*, comments (id, comment_text, created_at, admin_id)`).order("created_at", { ascending: false });
      if (error) throw error;
      setAspirations(data || []);
    } catch { toast({ title: "Gagal memuat data", variant: "destructive" }); }
    finally { setIsLoading(false); }
  };

  const filteredAspirations = useMemo(() => {
    let result = [...aspirations];
    if (statusFilter !== "all") result = result.filter((a) => a.status === statusFilter);
    if (dateRange?.from) {
      const from = startOfDay(dateRange.from);
      const to = dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from);
      result = result.filter((a) => isWithinInterval(new Date(a.created_at), { start: from, end: to }));
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((a) => a.student_name.toLowerCase().includes(q) || a.content.toLowerCase().includes(q) || (a.student_class && a.student_class.toLowerCase().includes(q)));
    }
    return result;
  }, [aspirations, statusFilter, dateRange, searchQuery]);

  // Pagination
  const totalPages = Math.ceil(filteredAspirations.length / PAGE_SIZE);
  const paginatedAspirations = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredAspirations.slice(start, start + PAGE_SIZE);
  }, [filteredAspirations, currentPage]);

  // Reset page when filters change
  useEffect(() => { setCurrentPage(1); }, [statusFilter, dateRange, searchQuery]);

  const statusCounts = useMemo(() => ({
    all: aspirations.length,
    belum_ditanggapi: aspirations.filter((a) => a.status === "belum_ditanggapi").length,
    sudah_ditanggapi: aspirations.filter((a) => a.status === "sudah_ditanggapi").length,
  }), [aspirations]);

  const handleLogout = async () => { await supabase.auth.signOut(); toast({ title: "Logout berhasil" }); navigate("/"); };

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  };

  const getExportAspirations = (overrideIds?: string[]): Aspiration[] => {
    if (overrideIds && overrideIds.length > 0) return aspirations.filter((a) => overrideIds.includes(a.id));
    if (selectionMode && selectedIds.size > 0) return filteredAspirations.filter((a) => selectedIds.has(a.id));
    return filteredAspirations;
  };

  const handleDownloadPDF = async (overrideIds?: string[]) => {
    const data = getExportAspirations(overrideIds);
    if (data.length === 0) { toast({ title: "Pilih minimal 1 aspirasi", variant: "destructive" }); return; }
    try {
      toast({ title: "Membuat PDF..." });
      const doc = new jsPDF("l", "mm", "a4");
      doc.setFontSize(20); doc.setFont("helvetica", "bold"); doc.setTextColor(30, 58, 95);
      doc.text("REKAP ASPIRASI SISWA", doc.internal.pageSize.getWidth() / 2, 18, { align: "center" });
      doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.setTextColor(107, 114, 128);
      doc.text(`${format(new Date(), "d MMMM yyyy, HH:mm", { locale: idLocale })} WIB — ${data.length} aspirasi`, doc.internal.pageSize.getWidth() / 2, 25, { align: "center" });
      const tableData = data.map((asp, i) => [(i + 1).toString(), sanitizeForPDF(asp.student_name), sanitizeForPDF(asp.student_class || "-"), sanitizeForPDF(asp.content), asp.status === "sudah_ditanggapi" ? "Sudah" : "Belum", new Date(asp.created_at).toLocaleDateString("id-ID")]);
      const colW = [12, 30, 22, 100, 25, 25]; const tw = colW.reduce((a, b) => a + b, 0); const ml = (doc.internal.pageSize.getWidth() - tw) / 2;
      autoTable(doc, { startY: 32, head: [["No", "Nama", "Kelas", "Isi Aspirasi", "Status", "Tanggal"]], body: tableData, styles: { fontSize: 8, cellPadding: 3, overflow: "linebreak" }, headStyles: { fillColor: [30, 58, 95], textColor: [255, 255, 255], fontStyle: "bold", halign: "center" }, alternateRowStyles: { fillColor: [248, 250, 252] }, columnStyles: { 0: { cellWidth: 12, halign: "center" }, 1: { cellWidth: 30 }, 2: { cellWidth: 22, halign: "center" }, 3: { cellWidth: 100 }, 4: { cellWidth: 25, halign: "center" }, 5: { cellWidth: 25, halign: "center" } }, margin: { left: ml, right: ml } });
      const pc = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= pc; i++) { doc.setPage(i); doc.setFontSize(7); doc.setTextColor(156, 163, 175); doc.text(`Halaman ${i} dari ${pc}`, doc.internal.pageSize.getWidth() / 2, doc.internal.pageSize.getHeight() - 6, { align: "center" }); }
      doc.save(`Rekap-Aspirasi_${new Date().toISOString().split("T")[0]}.pdf`);
      toast({ title: "PDF berhasil diunduh" });
    } catch { toast({ title: "Gagal membuat PDF", variant: "destructive" }); }
  };

  const handleDeleteAll = async () => {
    if (!window.confirm("YAKIN MENGHAPUS SEMUA ASPIRASI?")) return;
    try { toast({ title: "Menghapus..." }); const { error } = await supabase.rpc("delete_all_aspirations"); if (error) throw error; toast({ title: "Semua aspirasi dihapus" }); fetchAspirations(); } catch { toast({ title: "Gagal menghapus", variant: "destructive" }); }
  };

  const handleDeleteSelected = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (!window.confirm(`YAKIN MENGHAPUS ${ids.length} ASPIRASI YANG DIPILIH?`)) return;
    try {
      toast({ title: `Menghapus ${ids.length} aspirasi...` });
      for (const id of ids) {
        await supabase.from("aspirations").delete().eq("id", id);
      }
      toast({ title: `${ids.length} aspirasi dihapus` });
      setSelectedIds(new Set());
      setSelectionMode(false);
      fetchAspirations();
    } catch { toast({ title: "Gagal menghapus", variant: "destructive" }); }
  };

  const handleExportWord = async (overrideIds?: string[]) => {
    const data = getExportAspirations(overrideIds);
    if (data.length === 0) { toast({ title: "Pilih minimal 1 aspirasi", variant: "destructive" }); return; }
    try { toast({ title: "Membuat Word..." }); await exportToWord(data, { schoolName: "SMA Negeri 1 Kendal" }); toast({ title: "Word berhasil diunduh" }); } catch { toast({ title: "Gagal membuat Word", variant: "destructive" }); }
  };

  const handleExportExcel = async (overrideIds?: string[]) => {
    const data = getExportAspirations(overrideIds);
    if (data.length === 0) { toast({ title: "Pilih minimal 1 aspirasi", variant: "destructive" }); return; }
    try { toast({ title: "Membuat Excel..." }); await exportToExcel(data, { schoolName: "SMA Negeri 1 Kendal" }); toast({ title: "Excel berhasil diunduh" }); } catch { toast({ title: "Gagal membuat Excel", variant: "destructive" }); }
  };

  const handleExportPptx = async (overrideIds?: string[]) => {
    const data = getExportAspirations(overrideIds);
    if (data.length === 0) { toast({ title: "Pilih minimal 1 aspirasi", variant: "destructive" }); return; }
    if (data.length > 50 && !window.confirm(`Anda akan membuat ${data.length} slide. Lanjutkan?`)) return;
    try { toast({ title: "Membuat PowerPoint..." }); await exportToPptx(data, { schoolName: "SMA Negeri 1 Kendal" }); toast({ title: "PowerPoint berhasil diunduh" }); } catch { toast({ title: "Gagal membuat PowerPoint", variant: "destructive" }); }
  };

  const setDatePreset = (preset: string) => {
    const now = new Date();
    switch (preset) {
      case "today": setDateRange({ from: now, to: now }); break;
      case "7days": setDateRange({ from: subDays(now, 7), to: now }); break;
      case "30days": setDateRange({ from: subDays(now, 30), to: now }); break;
      case "month": setDateRange({ from: startOfMonth(now), to: endOfMonth(now) }); break;
      case "all": setDateRange(undefined); break;
    }
  };

  const handleBackup = async (format: "json" | "sql") => {
    try {
      toast({ title: `Membuat backup ${format.toUpperCase()}...` });
      const { data, error } = await supabase.functions.invoke("backup-data", {
        body: { format },
      });
      if (error) throw error;

      // Create blob and download
      const blob = new Blob([typeof data === "string" ? data : JSON.stringify(data)], {
        type: format === "json" ? "application/json" : "application/sql",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `faspira-backup-${new Date().toISOString().split("T")[0]}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: `Backup ${format.toUpperCase()} berhasil diunduh` });
    } catch {
      toast({ title: "Gagal membuat backup", variant: "destructive" });
    }
  };

  const hasActiveFilters = statusFilter !== "all" || dateRange || searchQuery;

  if (isLoading) return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-accent/5 flex items-center justify-center">
      <Loader2 className="w-12 h-12 text-primary animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-accent/5 relative overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-accent/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      <ThemeToggle />

      <div className="container mx-auto px-4 py-8 relative z-10">
        {/* ── HEADER ── */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-10 animate-fade-in">
          <div className="space-y-2">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-primary to-accent rounded-2xl blur-xl opacity-50 animate-pulse" />
                <div className="relative p-4 rounded-2xl bg-gradient-to-br from-primary via-accent to-secondary shadow-2xl">
                  <MessageSquare className="w-10 h-10 text-white" />
                </div>
              </div>
              <div>
                <h1 className="text-4xl lg:text-5xl font-bold bg-gradient-to-r from-primary via-accent to-secondary bg-clip-text text-transparent">
                  Dashboard Admin
                </h1>
                <p className="text-muted-foreground text-lg ml-1">
                  Kelola aspirasi siswa secara real-time
                </p>
              </div>
            </div>
            {user && (
              <p className="text-sm text-muted-foreground ml-20 flex items-center gap-2">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                {user.email} &middot; {userRole === "developer" ? "Developer" : "Admin"}
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-3 animate-fade-in" style={{ animationDelay: '0.2s' }}>
            {userRole === "developer" && (
              <>
                <Button variant={viewMode === "admins" ? "default" : "outline"} onClick={() => setViewMode(viewMode === "admins" ? "aspirations" : "admins")}
                  className="group border-2 border-secondary/50 bg-card/50 backdrop-blur-sm text-secondary hover:bg-secondary hover:text-white hover:border-secondary transition-all duration-300 hover:scale-105 hover:shadow-xl">
                  <Users className="mr-2 h-5 w-5 group-hover:rotate-12 transition-transform" />
                  {viewMode === "admins" ? "Lihat Aspirasi" : "Kelola Admin"}
                </Button>
                <Button variant="outline" onClick={() => navigate("/admin/settings/ai")}
                  className="group border-2 border-accent/50 bg-card/50 backdrop-blur-sm text-accent hover:bg-accent hover:text-white hover:border-accent transition-all duration-300 hover:scale-105 hover:shadow-xl">
                  <Settings className="mr-2 h-5 w-5 group-hover:rotate-90 transition-transform" />
                  Settings
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline"
                      className="group border-2 border-green-500/50 bg-card/50 backdrop-blur-sm text-green-600 hover:bg-green-500 hover:text-white hover:border-green-500 transition-all duration-300 hover:scale-105 hover:shadow-xl">
                      <Database className="mr-2 h-5 w-5" />
                      Backup
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => handleBackup("json")}>
                      <FileText className="mr-2 h-4 w-4" />Backup JSON
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleBackup("sql")}>
                      <FileText className="mr-2 h-4 w-4" />Backup SQL
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
            <Button variant="outline" onClick={() => navigate("/admin/statistics")}
              className="group border-2 border-accent/50 bg-card/50 backdrop-blur-sm text-accent hover:bg-accent hover:text-white hover:border-accent transition-all duration-300 hover:scale-105 hover:shadow-xl">
              <BarChart3 className="mr-2 h-5 w-5 group-hover:scale-110 transition-transform" />
              Statistik
            </Button>
            <Button variant="outline" onClick={handleLogout}
              className="group border-2 border-destructive/50 bg-card/50 backdrop-blur-sm text-destructive hover:bg-destructive hover:text-white hover:border-destructive transition-all duration-300 hover:scale-105 hover:shadow-xl">
              <LogOut className="mr-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              Logout
            </Button>
          </div>
        </div>

        {viewMode === "admins" ? (
          <div className="animate-fade-in"><AdminUserManagement /></div>
        ) : (
          <>
            <AspirationStats aspirations={aspirations} />

            {/* ── TOOLBAR ── */}
            <Card className="group relative p-6 mb-8 shadow-xl border-2 border-primary/20 bg-card/80 backdrop-blur-md animate-fade-in hover:shadow-2xl hover:border-primary/40 transition-all duration-500">
              <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-accent/5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative flex flex-col md:flex-row items-stretch md:items-center gap-3">
                {/* Search */}
                <div className="relative flex-1 min-w-0">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input placeholder="Cari nama, kelas, atau isi aspirasi..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 py-6 text-base border-2 border-primary/10 focus:border-primary bg-background/50 backdrop-blur-sm rounded-xl transition-all duration-300 hover:shadow-lg focus:shadow-xl" />
                </div>

                {/* Status pills */}
                <div className="flex items-center gap-1 bg-muted rounded-xl p-1 shrink-0">
                  {(["all", "belum_ditanggapi", "sudah_ditanggapi"] as StatusFilter[]).map((s) => (
                    <button key={s} onClick={() => setStatusFilter(s)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${statusFilter === s ? "bg-gradient-to-r from-primary to-accent text-white shadow-lg" : "text-muted-foreground hover:text-foreground hover:bg-background/50"}`}>
                      {s === "all" ? "Semua" : s === "belum_ditanggapi" ? "Belum" : "Sudah"}
                      <span className="ml-1.5 opacity-70">({statusCounts[s]})</span>
                    </button>
                  ))}
                </div>

                {/* Date picker */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="h-12 gap-2 shrink-0 border-2 border-primary/10 hover:border-primary/30 rounded-xl">
                      <Calendar className="h-4 w-4" />
                      {dateRange?.from ? (dateRange.to ? `${format(dateRange.from, "d MMM")} – ${format(dateRange.to, "d MMM")}` : format(dateRange.from, "d MMM")) : "Tanggal"}
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="end">
                    <div className="flex">
                      <div className="border-r border-border p-2 space-y-0.5">
                        {[{ l: "Hari Ini", v: "today" }, { l: "7 Hari", v: "7days" }, { l: "30 Hari", v: "30days" }, { l: "Bulan Ini", v: "month" }, { l: "Semua", v: "all" }].map((p) => (
                          <button key={p.v} onClick={() => setDatePreset(p.v)} className="block w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-muted whitespace-nowrap">{p.l}</button>
                        ))}
                      </div>
                      <CalendarComponent mode="range" selected={dateRange} onSelect={setDateRange} numberOfMonths={2} />
                    </div>
                  </PopoverContent>
                </Popover>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <Button variant={selectionMode ? "default" : "outline"} onClick={() => { setSelectionMode(!selectionMode); if (selectionMode) setSelectedIds(new Set()); }}
                    className={`h-12 border-2 ${selectionMode ? "bg-gradient-to-r from-primary to-accent text-white shadow-lg" : "border-primary/10 hover:border-primary/30"}`}>
                    <CheckSquare className="mr-2 h-4 w-4" />{selectionMode ? "Batal" : "Pilih"}
                  </Button>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button className="h-12 bg-gradient-to-r from-accent to-secondary text-white hover:opacity-90 shadow-xl">
                        <Download className="mr-2 h-4 w-4" />Download
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={handleDownloadPDF}><FileText className="mr-2 h-4 w-4" />PDF</DropdownMenuItem>
                      <DropdownMenuItem onClick={handleExportWord}><FileText className="mr-2 h-4 w-4" />Word (.docx)</DropdownMenuItem>
                      <DropdownMenuItem onClick={handleExportExcel}><FileText className="mr-2 h-4 w-4" />Excel (.xlsx)</DropdownMenuItem>
                      <DropdownMenuItem onClick={handleExportPptx}><FileText className="mr-2 h-4 w-4" />PowerPoint (.pptx)</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {userRole === "developer" && (
                    <Button variant="outline" onClick={handleDeleteAll}
                      className="h-12 border-2 border-destructive/50 text-destructive hover:bg-destructive hover:text-white hover:border-destructive transition-all duration-300 hover:scale-105 hover:shadow-xl">
                      <Trash className="h-5 w-5" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Filter info */}
              {hasActiveFilters && (
                <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                  <Filter className="h-4 w-4" />
                  <span>Menampilkan <strong className="text-foreground">{filteredAspirations.length}</strong> dari <strong className="text-foreground">{aspirations.length}</strong> aspirasi</span>
                  {searchQuery && <Badge variant="secondary" className="gap-1 cursor-pointer" onClick={() => setSearchQuery("")}>"{searchQuery}" <X className="h-3 w-3" /></Badge>}
                  {statusFilter !== "all" && <Badge variant="secondary" className="gap-1 cursor-pointer" onClick={() => setStatusFilter("all")}>{statusFilter === "belum_ditanggapi" ? "Belum Ditanggapi" : "Sudah Ditanggapi"} <X className="h-3 w-3" /></Badge>}
                  {dateRange && <Badge variant="secondary" className="gap-1 cursor-pointer" onClick={() => setDateRange(undefined)}>{dateRange.from && format(dateRange.from, "d MMM")} {dateRange.to && `– ${format(dateRange.to, "d MMM")}`} <X className="h-3 w-3" /></Badge>}
                </div>
              )}
            </Card>

            {/* ── ASPIRATIONS LIST ── */}
            {filteredAspirations.length === 0 ? (
              <Card className="p-16 text-center shadow-2xl border-2 border-primary/20 bg-card/80 backdrop-blur-lg animate-fade-in">
                <div className="relative w-28 h-28 mx-auto mb-8">
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/30 to-accent/30 rounded-full blur-2xl animate-pulse" />
                  <div className="relative w-full h-full rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                    <MessageSquare className="w-14 h-14 text-primary" />
                  </div>
                </div>
                <h3 className="text-3xl font-bold mb-4 bg-gradient-to-r from-primary via-accent to-secondary bg-clip-text text-transparent">
                  {hasActiveFilters ? "Tidak Ada Hasil" : "Belum Ada Aspirasi"}
                </h3>
                <p className="text-muted-foreground text-lg max-w-md mx-auto">
                  {hasActiveFilters ? "Coba ubah filter pencarian Anda" : "Aspirasi siswa akan muncul di sini setelah mereka mengirimkan"}
                </p>
              </Card>
            ) : (
              <>
                <div className="space-y-4">
                  {paginatedAspirations.map((asp, index) => (
                    <div key={asp.id} className="animate-fade-in" style={{ animationDelay: `${index * 0.03}s` }}>
                      <AspirationCard aspiration={asp} onUpdate={fetchAspirations}
                        isSelected={selectedIds.has(asp.id)} onToggleSelect={handleToggleSelect} showCheckbox={selectionMode} />
                    </div>
                  ))}
                </div>

                {/* ── PAGINATION ── */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-6">
                    <Button variant="outline" size="sm" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1}
                      className="h-9 w-9 p-0 border-2 border-primary/10 hover:border-primary/30">
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let page: number;
                      if (totalPages <= 5) page = i + 1;
                      else if (currentPage <= 3) page = i + 1;
                      else if (currentPage >= totalPages - 2) page = totalPages - 4 + i;
                      else page = currentPage - 2 + i;
                      return (
                        <Button key={page} variant={currentPage === page ? "default" : "outline"} size="sm"
                          onClick={() => setCurrentPage(page)}
                          className={`h-9 w-9 p-0 ${currentPage === page ? "bg-gradient-to-r from-primary to-accent text-white shadow-lg" : "border-2 border-primary/10 hover:border-primary/30"}`}>
                          {page}
                        </Button>
                      );
                    })}
                    {totalPages > 5 && currentPage < totalPages - 2 && <span className="text-muted-foreground">...</span>}
                    {totalPages > 5 && currentPage < totalPages - 2 && (
                      <Button variant="outline" size="sm" onClick={() => setCurrentPage(totalPages)}
                        className="h-9 w-9 p-0 border-2 border-primary/10 hover:border-primary/30">
                        {totalPages}
                      </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                      className="h-9 w-9 p-0 border-2 border-primary/10 hover:border-primary/30">
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    <span className="text-xs text-muted-foreground ml-2">
                      Halaman {currentPage} dari {totalPages}
                    </span>
                  </div>
                )}
              </>
            )}

            {/* ── BULK ACTION BAR ── */}
            {selectionMode && (
              <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-card/95 backdrop-blur-md border-2 border-primary/20 rounded-2xl shadow-2xl px-6 py-3 flex items-center gap-4">
                <span className="text-sm font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent whitespace-nowrap">{selectedIds.size} dipilih</span>
                <div className="h-6 w-px bg-border" />
                <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set(filteredAspirations.map((a) => a.id)))} className="hover:scale-105">Pilih Semua</Button>
                <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())} className="hover:scale-105">Batal</Button>
                <div className="h-6 w-px bg-border" />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" className="bg-gradient-to-r from-accent to-secondary text-white hover:opacity-90 shadow-lg">
                      <Download className="mr-1.5 h-4 w-4" />Download
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={handleDownloadPDF}>PDF</DropdownMenuItem>
                    <DropdownMenuItem onClick={handleExportWord}>Word</DropdownMenuItem>
                    <DropdownMenuItem onClick={handleExportExcel}>Excel</DropdownMenuItem>
                    <DropdownMenuItem onClick={handleExportPptx}>PowerPoint</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                {selectedIds.size > 0 && (
                  <Button size="sm" variant="outline" onClick={handleDeleteSelected}
                    className="border-2 border-destructive/50 text-destructive hover:bg-destructive hover:text-white">
                    <Trash className="mr-1.5 h-4 w-4" />Hapus
                  </Button>
                )}
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:scale-110" onClick={() => { setSelectionMode(false); setSelectedIds(new Set()); }}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
          </>
        )}

        {/* ── AI ASSISTANT BUTTON ── */}
        {viewMode === "aspirations" && (
          <button onClick={() => setShowAiChat(true)}
            className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-2xl bg-gradient-to-br from-primary via-accent to-secondary text-white flex items-center justify-center shadow-2xl hover:scale-110 hover:shadow-3xl transition-all duration-300">
            <Sparkles className="h-6 w-6" />
          </button>
        )}

        {/* ── AI CHAT SHEET ── */}
        <Sheet open={showAiChat} onOpenChange={setShowAiChat}>
          <SheetContent side="right" className="w-full sm:w-[440px] p-0 bg-card/95 backdrop-blur-md">
            <SheetTitle className="sr-only">Asisten AI</SheetTitle>
            <AiAdminChatPanel
              aspirations={aspirations}
              currentFilters={{ status: statusFilter, dateFrom: dateRange?.from?.toISOString(), dateTo: dateRange?.to?.toISOString(), searchQuery }}
              onApplyFilters={(f) => {
                if (f.status) setStatusFilter(f.status);
                if (typeof f.search_query === "string") setSearchQuery(f.search_query);
                if (f.date_from || f.date_to) setDateRange({ from: f.date_from ? new Date(f.date_from) : undefined, to: f.date_to ? new Date(f.date_to) : undefined });
              }}
              onTriggerExport={(ids, fmt) => {
                if (fmt === "pdf") handleDownloadPDF(ids);
                else if (fmt === "word") handleExportWord(ids);
                else if (fmt === "excel") handleExportExcel(ids);
                else if (fmt === "pptx") handleExportPptx(ids);
              }}
              onMarkStatus={async (ids, status) => { for (const id of ids) { await supabase.from("aspirations").update({ status }).eq("id", id); } fetchAspirations(); toast({ title: `${ids.length} aspirasi ditandai` }); }}
              onSelectAspirations={(ids) => { setSelectionMode(true); setSelectedIds(new Set(ids)); toast({ title: `${ids.length} aspirasi dicentang otomatis oleh AI` }); }}
              onDeleteAspirations={async (ids) => {
                if (!window.confirm(`YAKIN MENGHAPUS ${ids.length} ASPIRASI?`)) return;
                for (const id of ids) { await supabase.from("aspirations").delete().eq("id", id); }
                fetchAspirations();
                toast({ title: `${ids.length} aspirasi dihapus` });
              }}
              onClose={() => setShowAiChat(false)}
            />
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
};

export default AdminDashboard;
