import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, BarChart3, TrendingUp, PieChartIcon, Calendar } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

interface Aspiration { created_at: string; status: string; }

const Statistics = () => {
  const navigate = useNavigate();
  const [aspirations, setAspirations] = useState<Aspiration[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [view, setView] = useState<"week" | "month">("month");

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { navigate("/admin/login"); return; }
      const { data } = await supabase.from("aspirations").select("created_at, status").order("created_at", { ascending: true });
      setAspirations(data || []); setIsLoading(false);
    })();
  }, []);

  const monthlyData = () => {
    const m = new Map<string, number>();
    aspirations.forEach((a) => { const d = new Date(a.created_at); const k = `${d.toLocaleString("id-ID", { month: "short" })} ${d.getFullYear()}`; m.set(k, (m.get(k) || 0) + 1); });
    return Array.from(m.entries()).map(([month, count]) => ({ month, count })).slice(-6);
  };

  const weeklyData = () => {
    const weeks = Array.from({ length: 8 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - i * 7); return d; }).reverse();
    return weeks.map((ws) => { const we = new Date(ws); we.setDate(we.getDate() + 6); return { week: `${ws.getDate()}/${ws.getMonth() + 1}`, count: aspirations.filter((a) => { const ad = new Date(a.created_at); return ad >= ws && ad <= we; }).length }; });
  };

  const statusData = () => {
    const m = new Map<string, number>(); aspirations.forEach((a) => m.set(a.status, (m.get(a.status) || 0) + 1));
    return Array.from(m.entries()).map(([name, value]) => ({ name: name === "sudah_ditanggapi" ? "Sudah" : "Belum", value }));
  };

  const COLORS = ["hsl(var(--primary))", "hsl(var(--accent))"];
  const data = view === "month" ? monthlyData() : weeklyData();
  const key = view === "month" ? "month" : "week";

  if (isLoading) return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="w-6 h-6 text-primary animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-background">
      <ThemeToggle />
      <div className="max-w-5xl mx-auto px-4 md:px-6 py-6">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => navigate("/admin/dashboard")}>
            <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />Kembali
          </Button>
          <div>
            <h1 className="text-xl font-bold text-foreground">Statistik</h1>
            <p className="text-xs text-muted-foreground">Analisis tren aspirasi siswa</p>
          </div>
        </div>

        {/* View toggle */}
        <div className="flex gap-1 bg-muted rounded-md p-0.5 w-fit mb-4">
          {[{ v: "week" as const, l: "Mingguan" }, { v: "month" as const, l: "Bulanan" }].map((t) => (
            <button key={t.v} onClick={() => setView(t.v)} className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${view === t.v ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>{t.l}</button>
          ))}
        </div>

        <div className="space-y-3">
          {/* Line Chart */}
          <Card className="p-4 border border-border">
            <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2"><TrendingUp className="h-4 w-4 text-primary" />Tren {view === "month" ? "Bulanan" : "Mingguan"}</h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey={key} stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "6px", fontSize: 12 }} />
                <Line type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ fill: "hsl(var(--primary))", r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </Card>

          <div className="grid md:grid-cols-2 gap-3">
            {/* Bar Chart */}
            <Card className="p-4 border border-border">
              <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2"><BarChart3 className="h-4 w-4 text-accent" />Grafik Batang</h2>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey={key} stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "6px", fontSize: 12 }} />
                  <Bar dataKey="count" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>

            {/* Pie Chart */}
            <Card className="p-4 border border-border">
              <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2"><PieChartIcon className="h-4 w-4 text-secondary" />Status</h2>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={statusData()} cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} dataKey="value" fontSize={11}>
                    {statusData().map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "6px", fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Statistics;
