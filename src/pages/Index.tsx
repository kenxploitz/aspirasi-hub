import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { MessageSquare, Shield, Sparkles, ArrowRight, Star, Zap, Heart } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const Index = () => {
  const navigate = useNavigate();
  const [logos, setLogos] = useState({ school_logo_url: "", org_logo_url: "", school_name: "SMA Negeri 1 Kendal", org_name: "MPK SMA Negeri 1 Kendal" });

  useEffect(() => {
    let mounted = true;
    const checkAndRedirect = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) return;
        const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", session.user.id);
        const hasAdminRole = roles?.some((r) => r.role === "admin" || r.role === "developer");
        if (hasAdminRole && mounted) navigate("/admin/dashboard", { replace: true });
      } catch { /* noop */ }
    };
    checkAndRedirect();

    // Load logos
    const loadLogos = async () => {
      const { data } = await supabase.from("site_settings").select("school_logo_url, org_logo_url, school_name, org_name").limit(1).maybeSingle();
      if (data && mounted) {
        setLogos({
          school_logo_url: data.school_logo_url || "",
          org_logo_url: data.org_logo_url || "",
          school_name: data.school_name || "SMA Negeri 1 Kendal",
          org_name: data.org_name || "MPK SMA Negeri 1 Kendal",
        });
      }
    };
    loadLogos();

    return () => { mounted = false; };
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 relative overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary/15 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-accent/15 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-secondary/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
        <div className="absolute top-1/4 right-1/4 w-4 h-4 bg-primary/30 rounded-full animate-bounce" style={{ animationDelay: '0.5s' }} />
        <div className="absolute top-3/4 left-1/4 w-3 h-3 bg-accent/30 rounded-full animate-bounce" style={{ animationDelay: '1.5s' }} />
      </div>

      <ThemeToggle />

      <div className="container mx-auto px-4 py-12 md:py-20 relative z-10">
        {/* Logo Header */}
        <div className="flex items-center justify-center gap-6 md:gap-10 mb-10 animate-fade-in">
          {logos.school_logo_url ? (
            <img src={logos.school_logo_url} alt={logos.school_name} className="h-16 md:h-20 object-contain drop-shadow-lg" />
          ) : (
            <div className="h-16 md:h-20 w-16 md:w-20 bg-primary/10 rounded-2xl flex items-center justify-center">
              <span className="text-2xl md:text-3xl font-bold text-primary">🏫</span>
            </div>
          )}
          <div className="h-12 w-px bg-border hidden md:block" />
          {logos.org_logo_url ? (
            <img src={logos.org_logo_url} alt={logos.org_name} className="h-16 md:h-20 object-contain drop-shadow-lg" />
          ) : (
            <div className="h-16 md:h-20 w-16 md:w-20 bg-accent/10 rounded-2xl flex items-center justify-center">
              <span className="text-2xl md:text-3xl font-bold text-accent">👥</span>
            </div>
          )}
        </div>

        {/* Hero Section */}
        <div className="text-center mb-16 md:mb-20 animate-fade-in" style={{ animationDelay: '0.1s' }}>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-primary">{logos.school_name}</span>
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-7xl lg:text-8xl font-bold mb-6 bg-gradient-to-r from-primary via-accent to-secondary bg-clip-text text-transparent leading-tight">
            FASPIRA
            <br />
            <span className="text-3xl sm:text-4xl md:text-6xl lg:text-7xl">Forum Aspirasi Siswa</span>
          </h1>

          <p className="text-lg md:text-2xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Sampaikan aspirasi Anda dengan mudah, aman, dan terjamin kerahasiaannya.
            <span className="block mt-3 text-primary font-semibold text-xl md:text-3xl">Suara Anda Sangat Berarti! ✨</span>
          </p>
        </div>

        {/* Main CTA Card */}
        <div className="max-w-xl mx-auto mb-16">
          <Card
            className="p-8 md:p-10 hover:shadow-3xl transition-all duration-500 cursor-pointer group animate-fade-in border-2 hover:border-primary/50 bg-card/80 backdrop-blur-lg relative overflow-hidden"
            onClick={() => navigate('/submit')}
            style={{ animationDelay: '0.2s' }}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-accent/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="flex flex-col items-center text-center space-y-6 relative z-10">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-primary to-accent rounded-2xl blur-2xl opacity-50 group-hover:opacity-75 transition-opacity duration-500 scale-110" />
                <div className="relative w-20 h-20 md:w-24 md:h-24 rounded-2xl bg-gradient-to-br from-primary via-accent to-secondary flex items-center justify-center group-hover:scale-110 transition-all duration-500 shadow-2xl">
                  <MessageSquare className="w-10 h-10 md:w-12 md:h-12 text-white" />
                </div>
              </div>

              <div className="space-y-3">
                <h2 className="text-2xl md:text-4xl font-bold bg-gradient-to-r from-primary via-accent to-secondary bg-clip-text text-transparent">
                  Kirim Aspirasi
                </h2>
                <p className="text-muted-foreground text-base md:text-lg max-w-md">
                  Sampaikan pendapat, saran, atau keluhan Anda dengan aman
                </p>
              </div>

              <Button
                size="lg"
                className="w-full max-w-sm bg-gradient-to-r from-primary via-accent to-secondary hover:opacity-90 transition-all duration-300 text-white font-bold py-6 text-lg shadow-2xl group-hover:scale-105"
              >
                <span className="flex items-center justify-center gap-2">
                  ✍️ Mulai Kirim Sekarang
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </span>
              </Button>
            </div>
          </Card>
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6 max-w-3xl mx-auto mb-16 animate-fade-in" style={{ animationDelay: '0.3s' }}>
          {[
            { icon: Shield, title: "100% Anonim", desc: "Identitas terjaga", color: "text-green-500", bg: "bg-green-500/10" },
            { icon: Zap, title: "Pasti Direspon", desc: "Aspirasi didengar", color: "text-blue-500", bg: "bg-blue-500/10" },
            { icon: Heart, title: "Dipedulikan", desc: "Setiap suara berarti", color: "text-pink-500", bg: "bg-pink-500/10" },
          ].map((feature) => (
            <Card key={feature.title} className="p-5 text-center hover:shadow-lg transition-all duration-300 border border-border/50 bg-card/50 backdrop-blur-sm hover:scale-105">
              <div className={`${feature.bg} w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3`}>
                <feature.icon className={`w-6 h-6 ${feature.color}`} />
              </div>
              <h3 className="font-bold text-base mb-1">{feature.title}</h3>
              <p className="text-sm text-muted-foreground">{feature.desc}</p>
            </Card>
          ))}
        </div>

        {/* Footer */}
        <div className="text-center animate-fade-in space-y-4" style={{ animationDelay: '0.4s' }}>
          <div className="flex items-center justify-center gap-6 flex-wrap">
            {[
              { color: "bg-green-500", label: "100% Anonim" },
              { color: "bg-blue-500", label: "Data Terenkripsi" },
              { color: "bg-purple-500", label: "Pasti Direspon" },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${item.color} animate-pulse`} />
                <span className="text-xs font-medium text-muted-foreground">{item.label}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground/50 flex items-center justify-center gap-1">
            <Star className="w-3 h-3" />
            DIBUAT OLEH {logos.org_name}
            <Star className="w-3 h-3" />
          </p>
        </div>
      </div>
    </div>
  );
};

export default Index;
