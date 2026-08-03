import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, TrendingUp, Calendar, Loader2, BarChart3, PieChart as PieChartIcon, Users, MessageSquare, CheckCircle2, Clock } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";

interface Aspiration { created_at: string; status: string; student_class: string | null; }

const COLORS = {
  primary: "#1E3A5F",
  accent: "#2E86AB",
  success: "#10B981",
  warning: "#F59E0B",
  purple: "#8B5CF6",
  pink: "#EC4899",
  gradient1: ["#1E3A5F", "#2E86AB"],
  gradient2: ["#10B981", "#34D399"],
};

const CHART_COLORS = ["#1E3A5F", "#2E86AB", "#10B981", "#F59E0B", "#8B5CF6", "#EC4899", "#06B6D4", "#84CC16"];

const Statistics = () => {
  const navigate = useNavigate();
  const [aspirations, setAspirations] = useState<Aspiration[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"week" | "month">("month");

  useEffect(() => {
    checkAuth();
    fetchAspirations();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) { navigate("/admin/login"); return; }
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", session.user.id);
    if (!roles || roles.length === 0) { await supabase.auth.signOut(); navigate("/admin/login"); return; }
  };

  const fetchAspirations = async () => {
    try {
      const { data, error } = await supabase.from("aspirations").select("created_at, status, student_class").order("created_at", { ascending: true });
      if (error) throw error;
      setAspirations(data || []);
    } catch (e) { console.error(e); }
    finally { setIsLoading(false); }
  };

  const getMonthlyData = () => {
    const map = new Map<string, { count: number; sudah: number }>();
    aspirations.forEach((a) => {
      const d = new Date(a.created_at);
      const key = `${d.toLocaleString('id-ID', { month: 'short' })} ${d.getFullYear()}`;
      const entry = map.get(key) || { count: 0, sudah: 0 };
      entry.count++;
      if (a.status === "sudah_ditanggapi") entry.sudah++;
      map.set(key, entry);
    });
    return Array.from(map.entries()).map(([month, data]) => ({ month, ...data, belum: data.count - data.sudah })).slice(-6);
  };

  const getWeeklyData = () => {
    const weeks = Array.from({ length: 8 }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - (i * 7)); return d;
    }).reverse();
    return weeks.map((ws) => {
      const we = new Date(ws); we.setDate(we.getDate() + 6);
      const label = `${ws.getDate()}/${ws.getMonth() + 1}`;
      const filtered = aspirations.filter((a) => { const ad = new Date(a.created_at); return ad >= ws && ad <= we; });
      return { week: label, count: filtered.length, sudah: filtered.filter((a) => a.status === "sudah_ditanggapi").length, belum: filtered.filter((a) => a.status !== "sudah_ditanggapi").length };
    });
  };

  const getClassData = () => {
    const map = new Map<string, number>();
    aspirations.forEach((a) => { const k = a.student_class || "Tanpa Kelas"; map.set(k, (map.get(k) || 0) + 1); });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 8);
  };

  const getStatusData = () => {
    const sudah = aspirations.filter((a) => a.status === "sudah_ditanggapi").length;
    return [
      { name: "Sudah Ditanggapi", value: sudah, color: COLORS.success },
      { name: "Belum Ditanggapi", value: aspirations.length - sudah, color: COLORS.warning },
    ];
  };

  const total = aspirations.length;
  const sudah = aspirations.filter((a) => a.status === "sudah_ditanggapi").length;
  const pct = total > 0 ? Math.round((sudah / total) * 100) : 0;

  if (isLoading) return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-accent/5 flex items-center justify-center">
      <div className="text-center"><Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-4" /><p className="text-muted-foreground">Memuat statistik...</p></div>
    </div>
  );

  const data = viewMode === "month" ? getMonthlyData() : getWeeklyData();
  const xKey = viewMode === "month" ? "month" : "week";

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-accent/5 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-20 w-72 h-72 bg-primary/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-accent/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      <ThemeToggle />

      <div className="container mx-auto px-4 py-8 relative z-10">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center gap-6 mb-8 animate-fade-in">
          <Button onClick={() => navigate("/admin/dashboard")} variant="outline" className="w-fit border-2 hover:scale-105 transition-all">
            <ArrowLeft className="mr-2 h-4 w-4" />Kembali
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-gradient-to-br from-primary to-accent shadow-lg">
                <BarChart3 className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-primary via-accent to-secondary bg-clip-text text-transparent">Statistik Aspirasi</h1>
                <p className="text-muted-foreground">Analisis tren dan pola aspirasi siswa</p>
              </div>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 animate-fade-in" style={{ animationDelay: '0.1s' }}>
          {[
            { label: "Total", value: total, icon: MessageSquare, color: "from-blue-500 to-blue-600" },
            { label: "Sudah Ditanggapi", value: sudah, icon: CheckCircle2, color: "from-green-500 to-green-600", sub: `${pct}%` },
            { label: "Tingkat Respon", value: `${pct}%`, icon: TrendingUp, color: "from-purple-500 to-purple-600" },
            { label: "Kelas Aktif", value: new Set(aspirations.map((a) => a.student_class).filter(Boolean)).size, icon: Users, color: "from-pink-500 to-pink-600" },
          ].map((s) => {
            const Icon = s.icon;
            return (
              <Card key={s.label} className="p-4 border border-border/50 bg-card/80 backdrop-blur-sm hover:shadow-lg transition-all">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg bg-gradient-to-br ${s.color} shadow-md`}>
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-bold">{s.value}</span>
                      {s.sub && <span className="text-xs text-green-600 font-medium">{s.sub}</span>}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        {/* View Toggle */}
        <div className="flex gap-2 mb-6 animate-fade-in" style={{ animationDelay: '0.15s' }}>
          <Button onClick={() => setViewMode("week")} variant={viewMode === "week" ? "default" : "outline"} className="transition-all hover:scale-105">
            <Calendar className="mr-2 h-4 w-4" />Mingguan
          </Button>
          <Button onClick={() => setViewMode("month")} variant={viewMode === "month" ? "default" : "outline"} className="transition-all hover:scale-105">
            <TrendingUp className="mr-2 h-4 w-4" />Bulanan
          </Button>
        </div>

        {/* Charts */}
        <div className="grid gap-6 mb-8">
          {/* Area Chart */}
          <Card className="p-6 shadow-xl border border-border/50 bg-card/80 backdrop-blur-sm animate-fade-in" style={{ animationDelay: '0.2s' }}>
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Tren Aspirasi {viewMode === "week" ? "Mingguan" : "Bulanan"}
            </h2>
            <ResponsiveContainer width="100%" height={350}>
              <AreaChart data={data}>
                <defs>
                  <linearGradient id="gradSudah" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.success} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={COLORS.success} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradBelum" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.warning} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={COLORS.warning} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey={xKey} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip
                  contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "12px", boxShadow: "0 10px 40px rgba(0,0,0,0.1)" }}
                />
                <Legend />
                <Area type="monotone" dataKey="sudah" name="Sudah Ditanggapi" stroke={COLORS.success} fill="url(#gradSudah)" strokeWidth={3} dot={{ r: 4 }} />
                <Area type="monotone" dataKey="belum" name="Belum Ditanggapi" stroke={COLORS.warning} fill="url(#gradBelum)" strokeWidth={3} dot={{ r: 4 }} />
              </AreaChart>
            </ResponsiveContainer>
          </Card>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Bar Chart */}
            <Card className="p-6 shadow-xl border border-border/50 bg-card/80 backdrop-blur-sm animate-fade-in" style={{ animationDelay: '0.3s' }}>
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-accent" />Perbandingan Status
              </h2>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey={xKey} stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} />
                  <Legend />
                  <Bar dataKey="sudah" name="Sudah" fill={COLORS.success} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="belum" name="Belum" fill={COLORS.warning} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>

            {/* Pie Chart */}
            <Card className="p-6 shadow-xl border border-border/50 bg-card/80 backdrop-blur-sm animate-fade-in" style={{ animationDelay: '0.4s' }}>
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                <PieChartIcon className="h-5 w-5 text-secondary" />Distribusi Status
              </h2>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={getStatusData()} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {getStatusData().map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} />
                </PieChart>
              </ResponsiveContainer>
            </Card>
          </div>

          {/* Class Distribution */}
          <Card className="p-6 shadow-xl border border-border/50 bg-card/80 backdrop-blur-sm animate-fade-in" style={{ animationDelay: '0.5s' }}>
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Users className="h-5 w-5 text-pink-500" />Distribusi Per Kelas
            </h2>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={getClassData()} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis type="category" dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} width={100} />
                <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} />
                <Bar dataKey="value" name="Aspirasi" fill={COLORS.accent} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Statistics;
