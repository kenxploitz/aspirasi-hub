import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, TrendingUp, Calendar, Loader2, BarChart3, PieChartIcon } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

interface Aspiration {
  created_at: string;
  status: string;
}

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
    
    if (!session?.user) {
      navigate("/admin/login");
      return;
    }

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user.id);

    if (!roles || roles.length === 0) {
      await supabase.auth.signOut();
      navigate("/admin/login");
      return;
    }
  };

  const fetchAspirations = async () => {
    try {
      const { data, error } = await supabase
        .from("aspirations")
        .select("created_at, status")
        .order("created_at", { ascending: true });

      if (error) throw error;
      setAspirations(data || []);
    } catch (error) {
      console.error("Error fetching aspirations:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const getMonthlyData = () => {
    const monthlyMap = new Map<string, number>();
    
    aspirations.forEach((asp) => {
      const date = new Date(asp.created_at);
      const monthYear = `${date.toLocaleString('id-ID', { month: 'short' })} ${date.getFullYear()}`;
      monthlyMap.set(monthYear, (monthlyMap.get(monthYear) || 0) + 1);
    });

    return Array.from(monthlyMap.entries())
      .map(([month, count]) => ({ month, count }))
      .slice(-6);
  };

  const getWeeklyData = () => {
    const weeklyMap = new Map<string, number>();
    
    const last8Weeks = Array.from({ length: 8 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (i * 7));
      return date;
    }).reverse();

    last8Weeks.forEach((weekStart) => {
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      
      const weekLabel = `${weekStart.getDate()}/${weekStart.getMonth() + 1}`;
      const count = aspirations.filter((asp) => {
        const aspDate = new Date(asp.created_at);
        return aspDate >= weekStart && aspDate <= weekEnd;
      }).length;
      
      weeklyMap.set(weekLabel, count);
    });

    return Array.from(weeklyMap.entries()).map(([week, count]) => ({ week, count }));
  };

  const getStatusData = () => {
    const statusMap = new Map<string, number>();
    
    aspirations.forEach((asp) => {
      statusMap.set(asp.status, (statusMap.get(asp.status) || 0) + 1);
    });

    return Array.from(statusMap.entries()).map(([name, value]) => ({ name, value }));
  };

  const COLORS = ['hsl(var(--primary))', 'hsl(var(--accent))', 'hsl(var(--secondary))'];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-accent/5 flex items-center justify-center">
        <div className="text-center animate-fade-in">
          <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground font-medium">Memuat data statistik...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-accent/5 relative overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-20 w-72 h-72 bg-primary/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-accent/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      <ThemeToggle />
      
      <div className="container mx-auto px-4 py-8 relative z-10">
        {/* Header */}
        <div className="mb-10 flex flex-col md:flex-row md:items-center gap-6 animate-fade-in">
          <Button
            onClick={() => navigate("/admin/dashboard")}
            variant="outline"
            className="w-fit border-2 hover:scale-105 transition-all duration-300"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Kembali
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-gradient-to-br from-primary to-accent shadow-lg">
                <BarChart3 className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-primary via-accent to-secondary bg-clip-text text-transparent">
                  Statistik Aspirasi
                </h1>
                <p className="text-muted-foreground">Analisis tren dan pola aspirasi siswa</p>
              </div>
            </div>
          </div>
        </div>

        {/* View Mode Toggle */}
        <div className="flex gap-3 mb-8 animate-fade-in" style={{ animationDelay: '0.1s' }}>
          <Button
            onClick={() => setViewMode("week")}
            variant={viewMode === "week" ? "default" : "outline"}
            className={`transition-all duration-300 hover:scale-105 ${viewMode === "week" ? "shadow-lg" : ""}`}
          >
            <Calendar className="mr-2 h-4 w-4" />
            Per Minggu
          </Button>
          <Button
            onClick={() => setViewMode("month")}
            variant={viewMode === "month" ? "default" : "outline"}
            className={`transition-all duration-300 hover:scale-105 ${viewMode === "month" ? "shadow-lg" : ""}`}
          >
            <TrendingUp className="mr-2 h-4 w-4" />
            Per Bulan
          </Button>
        </div>

        {/* Charts Grid */}
        <div className="grid gap-8 mb-8">
          {/* Line Chart */}
          <Card className="p-8 animate-fade-in shadow-xl border-2 border-primary/20 bg-card/80 backdrop-blur-md hover:shadow-2xl transition-all duration-500" style={{ animationDelay: '0.2s' }}>
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <TrendingUp className="w-6 h-6 text-primary" />
              </div>
              Tren Aspirasi {viewMode === "week" ? "Mingguan" : "Bulanan"}
            </h2>
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={viewMode === "month" ? getMonthlyData() : getWeeklyData()}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey={viewMode === "month" ? "month" : "week"} 
                  stroke="hsl(var(--foreground))"
                />
                <YAxis stroke="hsl(var(--foreground))" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: "hsl(var(--card))",
                    border: "2px solid hsl(var(--border))",
                    borderRadius: "12px",
                    boxShadow: "0 10px 40px rgba(0,0,0,0.1)"
                  }}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="count" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={4}
                  name="Jumlah Aspirasi"
                  dot={{ fill: "hsl(var(--primary))", r: 6, strokeWidth: 2, stroke: "white" }}
                  activeDot={{ r: 10, stroke: "hsl(var(--primary))", strokeWidth: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </Card>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Bar Chart */}
            <Card className="p-8 animate-fade-in shadow-xl border-2 border-accent/20 bg-card/80 backdrop-blur-md hover:shadow-2xl transition-all duration-500" style={{ animationDelay: '0.3s' }}>
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-accent/10">
                  <BarChart3 className="w-6 h-6 text-accent" />
                </div>
                Grafik Batang
              </h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={viewMode === "month" ? getMonthlyData() : getWeeklyData()}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey={viewMode === "month" ? "month" : "week"} 
                    stroke="hsl(var(--foreground))"
                  />
                  <YAxis stroke="hsl(var(--foreground))" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: "hsl(var(--card))",
                      border: "2px solid hsl(var(--border))",
                      borderRadius: "12px"
                    }}
                  />
                  <Bar 
                    dataKey="count" 
                    fill="hsl(var(--accent))" 
                    name="Aspirasi"
                    radius={[8, 8, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </Card>

            {/* Pie Chart */}
            <Card className="p-8 animate-fade-in shadow-xl border-2 border-secondary/20 bg-card/80 backdrop-blur-md hover:shadow-2xl transition-all duration-500" style={{ animationDelay: '0.4s' }}>
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-secondary/10">
                  <PieChartIcon className="w-6 h-6 text-secondary" />
                </div>
                Status Aspirasi
              </h2>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={getStatusData()}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={100}
                    fill="hsl(var(--primary))"
                    dataKey="value"
                  >
                    {getStatusData().map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: "hsl(var(--card))",
                      border: "2px solid hsl(var(--border))",
                      borderRadius: "12px"
                    }}
                  />
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
