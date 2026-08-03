import { Card } from "@/components/ui/card";
import { MessageSquare, CheckCircle2, Clock, TrendingUp, Users } from "lucide-react";

interface Aspiration { id: string; comments: any[]; created_at: string; status: string; student_class: string | null; }
interface AspirationStatsProps { aspirations: Aspiration[]; }

const AspirationStats = ({ aspirations }: AspirationStatsProps) => {
  const total = aspirations.length;
  const sudah = aspirations.filter((a) => a.status === "sudah_ditanggapi").length;
  const pct = (n: number) => total > 0 ? Math.round((n / total) * 100) : 0;

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayCount = aspirations.filter((a) => new Date(a.created_at) >= today).length;
  const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
  const weekCount = aspirations.filter((a) => new Date(a.created_at) >= weekAgo).length;

  // Count unique classes
  const uniqueClasses = new Set(aspirations.map((a) => a.student_class).filter(Boolean)).size;

  const stats = [
    { label: "Total Aspirasi", value: total, icon: MessageSquare, color: "from-blue-500 to-blue-600", bg: "bg-blue-50 dark:bg-blue-950/30", textColor: "text-blue-600" },
    { label: "Sudah Ditanggapi", value: sudah, sub: `${pct(sudah)}%`, icon: CheckCircle2, color: "from-green-500 to-green-600", bg: "bg-green-50 dark:bg-green-950/30", textColor: "text-green-600" },
    { label: "Hari Ini", value: todayCount, icon: Clock, color: "from-purple-500 to-purple-600", bg: "bg-purple-50 dark:bg-purple-950/30", textColor: "text-purple-600" },
    { label: "Minggu Ini", value: weekCount, icon: TrendingUp, color: "from-orange-500 to-orange-600", bg: "bg-orange-50 dark:bg-orange-950/30", textColor: "text-orange-600" },
    { label: "Kelas Aktif", value: uniqueClasses, icon: Users, color: "from-pink-500 to-pink-600", bg: "bg-pink-50 dark:bg-pink-950/30", textColor: "text-pink-600" },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
      {stats.map((s) => {
        const Icon = s.icon;
        return (
          <Card key={s.label} className="group p-4 border border-border/50 hover:border-primary/30 transition-all duration-300 hover:shadow-lg hover:scale-[1.02] bg-card/80 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-xl bg-gradient-to-br ${s.color} shadow-lg group-hover:scale-110 transition-transform`}>
                <Icon className="h-4 w-4 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider truncate">{s.label}</p>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-bold text-foreground">{s.value}</span>
                  {s.sub && <span className={`text-xs font-medium ${s.textColor}`}>{s.sub}</span>}
                </div>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
};

export default AspirationStats;
