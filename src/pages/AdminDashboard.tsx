import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  LogOut, Search, MessageSquare, FileText, BarChart3, Loader2, Trash,
  Download, Calendar, CheckSquare, X, Filter, ChevronDown, Users, Settings,
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
type ViewMode = "aspirations" | "admins" | "ai-settings";

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

  useEffect(() => {
    let mounted = true;
    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
          if (mounted) navigate("/admin/login", { replace: true });
          return;
        }

        const { data: userRoles } = await supabase
          .from("user_roles").select("role").eq("user_id", session.user.id);
        const hasSuperAdmin = userRoles?.some((r) => r.role === "superadmin");
        const hasAdmin = userRoles?.some((r) => r.role === "admin");

        if (!hasSuperAdmin && !hasAdmin) {
          const userEmail = session.user.email?.toLowerCase();
          const { data: adminEmail } = await supabase
            .from("admin_emails" as any).select("email")
            .ilike("email", userEmail || "").maybeSingle();
          if (!adminEmail) {
            await supabase.auth.signOut();
            if (mounted) navigate("/admin/login", { replace: true });
            return;
          }
          await supabase.from("user_roles").insert({ user_id: session.user.id, role: "admin" as const });
          if (mounted) { setUser(session.user); setUserRole("admin"); setIsLoading(false); }
          return;
        }

        if (mounted) {
          setUser(session.user);
          setUserRole(hasSuperAdmin ? "superadmin" : "admin");
          setIsLoading(false);
        }
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
      const { data, error } = await supabase
        .from("aspirations")
        .select(`*, comments (id, comment_text, created_at, admin_id)`)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setAspirations(data || []);
    } catch {
      toast({ title: "Gagal memuat data", variant: "destructive" });
    } finally { setIsLoading(false); }
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
      result = result.filter((a) =>
        a.student_name.toLowerCase().includes(q) ||
        a.content.toLowerCase().includes(q) ||
        (a.student_class && a.student_class.toLowerCase().includes(q))
      );
    }
    return result;
  }, [aspirations, statusFilter, dateRange, searchQuery]);

  const statusCounts = useMemo(() => ({
    all: aspirations.length,
    belum_ditanggapi: aspirations.filter((a) => a.status === "belum_ditanggapi").length,
    sudah_ditanggapi: aspirations.filter((a) => a.status === "sudah_ditanggapi").length,
  }), [aspirations]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast({ title: "Logout berhasil" });
    navigate("/");
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  };

  const getExportAspirations = (): Aspiration[] => {
    if (selectionMode && selectedIds.size > 0) return filteredAspirations.filter((a) => selectedIds.has(a.id));
    return filteredAspirations;
  };

  const handleDownloadPDF = async () => {
    const data = getExportAspirations();
    if (data.length === 0) { toast({ title: "Pilih minimal 1 aspirasi", variant: "destructive" }); return; }
    try {
      toast({ title: "Membuat PDF..." });
      const doc = new jsPDF("l", "mm", "a4");
      doc.setFontSize(20); doc.setFont("helvetica", "bold"); doc.setTextColor(30, 58, 95);
      doc.text("REKAP ASPIRASI SISWA", doc.internal.pageSize.getWidth() / 2, 18, { align: "center" });
      doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.setTextColor(107, 114, 128);
      doc.text(`${format(new Date(), "d MMMM yyyy, HH:mm", { locale: idLocale })} WIB — ${data.length} aspirasi`, doc.internal.pageSize.getWidth() / 2, 25, { align: "center" });

      const tableData = data.map((asp, i) => [
        (i + 1).toString(), sanitizeForPDF(asp.student_name), sanitizeForPDF(asp.student_class || "-"),
        sanitizeForPDF(asp.content), asp.status === "sudah_ditanggapi" ? "Sudah" : "Belum",
        new Date(asp.created_at).toLocaleDateString("id-ID"),
      ]);
      const colW = [12, 30, 22, 100, 25, 25];
      const tw = colW.reduce((a, b) => a + b, 0);
      const ml = (doc.internal.pageSize.getWidth() - tw) / 2;
      autoTable(doc, { startY: 32, head: [["No", "Nama", "Kelas", "Isi Aspirasi", "Status", "Tanggal"]], body: tableData,
        styles: { fontSize: 8, cellPadding: 3, overflow: "linebreak" },
        headStyles: { fillColor: [30, 58, 95], textColor: [255, 255, 255], fontStyle: "bold", halign: "center" },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: { 0: { cellWidth: 12, halign: "center" }, 1: { cellWidth: 30 }, 2: { cellWidth: 22, halign: "center" }, 3: { cellWidth: 100 }, 4: { cellWidth: 25, halign: "center" }, 5: { cellWidth: 25, halign: "center" } },
        margin: { left: ml, right: ml },
      });
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

  const hasActiveFilters = statusFilter !== "all" || dateRange || searchQuery;

  if (isLoading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Loader2 className="w-6 h-6 text-primary animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <ThemeToggle />
      <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-6">

        {/* ── HEADER ── */}
        <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-xl font-bold text-foreground">Dashboard Admin</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {user?.email} &middot; {userRole === "superadmin" ? "Superadmin" : "Admin"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {userRole === "superadmin" && (
              <>
                <Button variant={viewMode === "admins" ? "default" : "ghost"} size="sm" onClick={() => setViewMode(viewMode === "admins" ? "aspirations" : "admins")} className="h-8 text-xs">
                  <Users className="mr-1.5 h-3.5 w-3.5" />Kelola Admin
                </Button>
                <Button variant="ghost" size="sm" onClick={() => navigate("/admin/settings/ai")} className="h-8 text-xs">
                  <Settings className="mr-1.5 h-3.5 w-3.5" />AI
                </Button>
              </>
            )}
            <Button variant="ghost" size="sm" onClick={() => navigate("/admin/statistics")} className="h-8 text-xs">
              <BarChart3 className="mr-1.5 h-3.5 w-3.5" />Statistik
            </Button>
            <Button variant="ghost" size="sm" onClick={handleLogout} className="h-8 text-xs text-destructive hover:text-destructive">
              <LogOut className="mr-1.5 h-3.5 w-3.5" />Keluar
            </Button>
          </div>
        </header>

        {/* ── VIEW: ADMINS ── */}
        {viewMode === "admins" ? (
          <AdminUserManagement />
        ) : (
          <>
            {/* ── STATS ── */}
            <AspirationStats aspirations={aspirations} />

            {/* ── TOOLBAR ── */}
            <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2 mb-4">
              {/* Search */}
              <div className="relative flex-1 min-w-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input placeholder="Cari aspirasi..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-8 h-9 text-sm" />
              </div>

              {/* Status pills */}
              <div className="flex items-center gap-1 bg-muted rounded-md p-0.5 shrink-0">
                {(["all", "belum_ditanggapi", "sudah_ditanggapi"] as StatusFilter[]).map((s) => (
                  <button key={s} onClick={() => setStatusFilter(s)}
                    className={`px-2.5 py-1.5 rounded text-xs font-medium transition-colors whitespace-nowrap ${statusFilter === s ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                    {s === "all" ? "Semua" : s === "belum_ditanggapi" ? "Belum" : "Sudah"}
                    <span className="ml-1 opacity-60">{statusCounts[s]}</span>
                  </button>
                ))}
              </div>

              {/* Date picker */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 gap-1.5 shrink-0 text-xs">
                    <Calendar className="h-3.5 w-3.5" />
                    {dateRange?.from ? (dateRange.to ? `${format(dateRange.from, "d MMM")} – ${format(dateRange.to, "d MMM")}` : format(dateRange.from, "d MMM")) : "Tanggal"}
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <div className="flex">
                    <div className="border-r border-border p-2 space-y-0.5">
                      {[{ l: "Hari Ini", v: "today" }, { l: "7 Hari", v: "7days" }, { l: "30 Hari", v: "30days" }, { l: "Bulan Ini", v: "month" }, { l: "Semua", v: "all" }].map((p) => (
                        <button key={p.v} onClick={() => setDatePreset(p.v)} className="block w-full text-left px-2.5 py-1.5 text-xs rounded hover:bg-muted whitespace-nowrap">{p.l}</button>
                      ))}
                    </div>
                    <CalendarComponent mode="range" selected={dateRange} onSelect={setDateRange} numberOfMonths={2} />
                  </div>
                </PopoverContent>
              </Popover>

              {/* Actions */}
              <div className="flex items-center gap-2 shrink-0">
                <Button variant={selectionMode ? "default" : "outline"} size="sm" className="h-9 text-xs" onClick={() => { setSelectionMode(!selectionMode); if (selectionMode) setSelectedIds(new Set()); }}>
                  <CheckSquare className="mr-1.5 h-3.5 w-3.5" />{selectionMode ? "Batal" : "Pilih"}
                </Button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" className="h-9 text-xs bg-primary text-primary-foreground hover:bg-primary/90">
                      <Download className="mr-1.5 h-3.5 w-3.5" />Download
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={handleDownloadPDF}><FileText className="mr-2 h-4 w-4" />PDF</DropdownMenuItem>
                    <DropdownMenuItem disabled><FileText className="mr-2 h-4 w-4" />Word (.docx)</DropdownMenuItem>
                    <DropdownMenuItem disabled><FileText className="mr-2 h-4 w-4" />Excel (.xlsx)</DropdownMenuItem>
                    <DropdownMenuItem disabled><FileText className="mr-2 h-4 w-4" />PowerPoint (.pptx)</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                {userRole === "superadmin" && (
                  <Button variant="outline" size="sm" className="h-9 text-xs text-destructive hover:bg-destructive hover:text-destructive-foreground" onClick={handleDeleteAll}>
                    <Trash className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>

            {/* Filter info bar */}
            {hasActiveFilters && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                <Filter className="h-3 w-3" />
                <span>Menampilkan {filteredAspirations.length} dari {aspirations.length}</span>
                {searchQuery && (
                  <Badge variant="secondary" className="text-xs gap-1 cursor-pointer" onClick={() => setSearchQuery("")}>
                    "{searchQuery}" <X className="h-2.5 w-2.5" />
                  </Badge>
                )}
                {statusFilter !== "all" && (
                  <Badge variant="secondary" className="text-xs gap-1 cursor-pointer" onClick={() => setStatusFilter("all")}>
                    {statusFilter === "belum_ditanggapi" ? "Belum Ditanggapi" : "Sudah Ditanggapi"} <X className="h-2.5 w-2.5" />
                  </Badge>
                )}
                {dateRange && (
                  <Badge variant="secondary" className="text-xs gap-1 cursor-pointer" onClick={() => setDateRange(undefined)}>
                    {dateRange.from && format(dateRange.from, "d MMM")} {dateRange.to && `– ${format(dateRange.to, "d MMM")}`} <X className="h-2.5 w-2.5" />
                  </Badge>
                )}
              </div>
            )}

            {/* ── ASPIRATIONS LIST ── */}
            {filteredAspirations.length === 0 ? (
              <Card className="p-10 text-center border border-border">
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
                  <MessageSquare className="w-6 h-6 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-foreground">
                  {hasActiveFilters ? "Tidak ada hasil" : "Belum ada aspirasi"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {hasActiveFilters ? "Coba ubah filter" : "Aspirasi siswa akan muncul di sini"}
                </p>
              </Card>
            ) : (
              <div className="space-y-2">
                {filteredAspirations.map((asp) => (
                  <AspirationCard key={asp.id} aspiration={asp} onUpdate={fetchAspirations}
                    isSelected={selectedIds.has(asp.id)} onToggleSelect={handleToggleSelect} showCheckbox={selectionMode} />
                ))}
              </div>
            )}

            {/* ── BULK ACTION BAR ── */}
            {selectionMode && (
              <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-card border border-border rounded-lg shadow-strong px-4 py-2.5 flex items-center gap-3">
                <span className="text-sm font-medium text-foreground whitespace-nowrap">{selectedIds.size} dipilih</span>
                <div className="h-4 w-px bg-border" />
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setSelectedIds(new Set(filteredAspirations.map((a) => a.id)))}>Pilih Semua</Button>
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setSelectedIds(new Set())}>Batal</Button>
                <div className="h-4 w-px bg-border" />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" className="h-7 text-xs bg-primary text-primary-foreground hover:bg-primary/90">
                      <Download className="mr-1 h-3 w-3" />Download
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={handleDownloadPDF}>PDF</DropdownMenuItem>
                    <DropdownMenuItem disabled>Word</DropdownMenuItem>
                    <DropdownMenuItem disabled>Excel</DropdownMenuItem>
                    <DropdownMenuItem disabled>PowerPoint</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => { setSelectionMode(false); setSelectedIds(new Set()); }}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
