import { Card } from "@/components/ui/card";
import { MessageSquare, CheckCircle2, AlertCircle, Clock, TrendingUp } from "lucide-react";

interface Aspiration { id: string; comments: any[]; created_at: string; status: string; }
interface AspirationStatsProps { aspirations: Aspiration[]; }

const AspirationStats = ({ aspirations }: AspirationStatsProps) => {
  const total = aspirations.length;
  const sudah = aspirations.filter((a) => a.status === "sudah_ditanggapi").length;
  const belum = total - sudah;
  const pct = (n: number) => total > 0 ? Math.round((n / total) * 100) : 0;

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayCount = aspirations.filter((a) => new Date(a.created_at) >= today).length;
  const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
  const weekCount = aspirations.filter((a) => new Date(a.created_at) >= weekAgo).length;

  const stats = [
    { label: "Total", value: total, icon: MessageSquare, color: "text-primary", bg: "bg-primary/10" },
    { label: "Sudah Ditanggapi", value: sudah, sub: `${pct(sudah)}%`, icon: CheckCircle2, color: "text-green-600", bg: "bg-green-50 dark:bg-green-950" },
    { label: "Belum Ditanggapi", value: belum, sub: `${pct(belum)}%`, icon: AlertCircle, color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-950" },
    { label: "Hari Ini", value: todayCount, icon: Clock, color: "text-muted-foreground", bg: "bg-muted" },
    { label: "Minggu Ini", value: weekCount, icon: TrendingUp, color: "text-muted-foreground", bg: "bg-muted" },
  ];

  return (
    <div className="grid grid-cols-3 lg:grid-cols-5 gap-2 mb-4">
      {stats.map((s) => {
        const Icon = s.icon;
        return (
          <Card key={s.label} className="p-3 border border-border">
            <div className="flex items-center gap-2.5">
              <div className={`${s.bg} p-1.5 rounded`}><Icon className={`h-3.5 w-3.5 ${s.color}`} /></div>
              <div className="min-w-0">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide truncate">{s.label}</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-lg font-bold text-foreground">{s.value}</span>
                  {s.sub && <span className="text-[10px] text-muted-foreground">{s.sub}</span>}
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
