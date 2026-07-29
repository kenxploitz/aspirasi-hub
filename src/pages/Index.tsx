import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { MessageSquare, Shield, ArrowRight, Star, Zap, Heart } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

const Index = () => {
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    const checkAndRedirect = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) return;
        const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", session.user.id);
        const hasAdminRole = roles?.some((r) => r.role === "admin" || r.role === "superadmin");
        if (hasAdminRole && mounted) navigate("/admin/dashboard", { replace: true });
      } catch {}
    };
    checkAndRedirect();
    return () => { mounted = false; };
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background">
      <ThemeToggle />
      <div className="max-w-3xl mx-auto px-4 py-16 md:py-24">

        {/* Hero */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-muted text-xs font-medium text-muted-foreground mb-4">
            SMA Negeri 1 Kendal
          </div>
          <h1 className="text-3xl md:text-5xl font-bold text-foreground mb-4 leading-tight">
            FASPIRA
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-xl mx-auto">
            Forum Aspirasi Siswa — Sampaikan pendapat, saran, atau keluhan Anda dengan aman.
          </p>
        </div>

        {/* Main CTA Card */}
        <Card className="p-8 md:p-10 mb-10 border border-border cursor-pointer hover:border-primary/30 transition-colors group" onClick={() => navigate("/submit")}>
          <div className="flex flex-col items-center text-center space-y-5">
            <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center group-hover:bg-primary/10 transition-colors">
              <MessageSquare className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-foreground mb-2">Kirim Aspirasi</h2>
              <p className="text-sm text-muted-foreground max-w-md">
                Sampaikan pendapat, saran, atau keluhan Anda dengan aman dan terjamin kerahasiaannya.
              </p>
            </div>
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90 h-10 text-sm">
              Mulai Kirim <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </Card>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-3 mb-10">
          {[
            { icon: Shield, title: "Anonim", desc: "Identitas terjaga" },
            { icon: Zap, title: "Direspon", desc: "Pasti didengar" },
            { icon: Heart, title: "Dipedulikan", desc: "Setiap suara berarti" },
          ].map((f) => (
            <Card key={f.title} className="p-4 border border-border text-center">
              <div className="w-10 h-10 rounded bg-muted flex items-center justify-center mx-auto mb-3">
                <f.icon className="w-5 h-5 text-primary" />
              </div>
              <h3 className="text-sm font-semibold text-foreground">{f.title}</h3>
              <p className="text-xs text-muted-foreground mt-1">{f.desc}</p>
            </Card>
          ))}
        </div>

        {/* Footer */}
        <div className="text-center space-y-3">
          <div className="flex items-center justify-center gap-6 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-500" />Anonim</span>
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-blue-500" />Terenkripsi</span>
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-purple-500" />Direspon</span>
          </div>
          <p className="text-[10px] text-muted-foreground/50 flex items-center justify-center gap-1">
            <Star className="w-2.5 h-2.5" />DIBUAT OLEH MPK SMA NEGERI 1 KENDAL<Star className="w-2.5 h-2.5" />
          </p>
        </div>
      </div>
    </div>
  );
};

export default Index;
