import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { MessageSquare, Shield, Sparkles, ArrowRight, Star, Zap, Heart } from "lucide-react";
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

        const { data: roles } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", session.user.id);

        const hasAdminRole = roles?.some(
          (r) => r.role === "admin" || r.role === "developer"
        );

        if (hasAdminRole && mounted) navigate("/admin/dashboard", { replace: true });
      } catch (e) {
        // noop
      }
    };

    checkAndRedirect();

    return () => { mounted = false; };
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 relative overflow-hidden">
      {/* Enhanced animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary/15 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-accent/15 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-secondary/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
        
        {/* Floating particles */}
        <div className="absolute top-1/4 right-1/4 w-4 h-4 bg-primary/30 rounded-full animate-bounce" style={{ animationDelay: '0.5s' }} />
        <div className="absolute top-3/4 left-1/4 w-3 h-3 bg-accent/30 rounded-full animate-bounce" style={{ animationDelay: '1.5s' }} />
        <div className="absolute top-1/3 left-1/5 w-2 h-2 bg-secondary/30 rounded-full animate-bounce" style={{ animationDelay: '2.5s' }} />
      </div>
      
      <ThemeToggle />
      
      <div className="container mx-auto px-4 py-16 md:py-24 relative z-10">
        {/* Hero Section */}
        <div className="text-center mb-20 animate-fade-in">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6 animate-fade-in" style={{ animationDelay: '0.1s' }}>
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-primary">SMA NEGERI 1 KENDAL</span>
          </div>
          
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold mb-8 bg-gradient-to-r from-primary via-accent to-secondary bg-clip-text text-transparent animate-fade-in leading-tight" style={{ animationDelay: '0.2s' }}>
            FASPIRA
            <br />
            <span className="text-4xl md:text-6xl lg:text-7xl">Forum Aspirasi Siswa</span>
          </h1>
          
          <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto leading-relaxed animate-fade-in" style={{ animationDelay: '0.3s' }}>
            Sampaikan aspirasi Anda dengan mudah, aman, dan terjamin kerahasiaannya.
            <span className="block mt-3 text-primary font-semibold text-2xl md:text-3xl">Suara Anda Sangat Berarti Bagi Kami! ✨</span>
          </p>
        </div>

        {/* Main Card */}
        <div className="max-w-4xl mx-auto mb-16">
          <Card 
            className="p-10 md:p-14 hover:shadow-3xl transition-all duration-700 cursor-pointer group animate-fade-in border-2 hover:border-primary/50 bg-card/80 backdrop-blur-lg relative overflow-hidden"
            onClick={() => navigate('/submit')}
            style={{ animationDelay: '0.4s' }}
          >
            {/* Card glow effect */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-accent/10 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
            <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 via-accent/20 to-secondary/20 rounded-xl blur-xl opacity-0 group-hover:opacity-50 transition-opacity duration-700" />
            
            <div className="flex flex-col items-center text-center space-y-8 relative z-10">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-primary to-accent rounded-3xl blur-2xl opacity-50 group-hover:opacity-75 transition-opacity duration-500 scale-110" />
                <div className="relative w-28 h-28 rounded-3xl bg-gradient-to-br from-primary via-accent to-secondary flex items-center justify-center group-hover:scale-110 group-hover:rotate-3 transition-all duration-500 shadow-2xl">
                  <MessageSquare className="w-14 h-14 text-white" />
                </div>
              </div>
              
              <div className="space-y-4">
                <h2 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-primary via-accent to-secondary bg-clip-text text-transparent group-hover:scale-105 transition-transform duration-300">
                  Kirim Aspirasi
                </h2>
                <p className="text-muted-foreground text-lg md:text-xl leading-relaxed max-w-lg">
                  Sampaikan pendapat, saran, atau keluhan Anda dengan aman dan terjamin kerahasiaannya
                </p>
              </div>
              
              <Button 
                size="lg"
                className="w-full max-w-md bg-gradient-to-r from-primary via-accent to-secondary hover:opacity-90 transition-all duration-300 text-white font-bold py-8 text-xl shadow-2xl group-hover:scale-105 group-hover:shadow-3xl"
              >
                <span className="flex items-center justify-center gap-3">
                  ✍️ Mulai Kirim Sekarang
                  <ArrowRight className="w-6 h-6 group-hover:translate-x-2 transition-transform duration-300" />
                </span>
              </Button>
            </div>
          </Card>
        </div>

        {/* Features Section */}
        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto mb-16 animate-fade-in" style={{ animationDelay: '0.5s' }}>
          {[
            { icon: Shield, title: "100% Anonim", desc: "Identitas Anda tetap terjaga", color: "text-green-500", bg: "bg-green-500/10" },
            { icon: Zap, title: "Pasti Di Respon", desc: "Aspirasi Pasti Di Dengar", color: "text-blue-500", bg: "bg-blue-500/10" },
            { icon: Heart, title: "Dipedulikan", desc: "Setiap suara sangat berarti", color: "text-pink-500", bg: "bg-pink-500/10" },
          ].map((feature, index) => (
            <Card 
              key={feature.title}
              className="p-6 text-center hover:shadow-xl transition-all duration-500 border border-border/50 bg-card/50 backdrop-blur-sm hover:scale-105 hover:border-primary/30 group"
              style={{ animationDelay: `${0.6 + index * 0.1}s` }}
            >
              <div className={`${feature.bg} w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300`}>
                <feature.icon className={`w-8 h-8 ${feature.color}`} />
              </div>
              <h3 className="font-bold text-xl mb-2">{feature.title}</h3>
              <p className="text-muted-foreground">{feature.desc}</p>
            </Card>
          ))}
        </div>

        {/* Footer Section */}
        <div className="text-center animate-fade-in space-y-6" style={{ animationDelay: '0.7s' }}>
          <div className="flex items-center justify-center gap-2 text-muted-foreground flex-wrap">
            <Shield className="w-5 h-5" />
            <p className="text-sm">
              Platform ini menjamin keamanan dan kerahasiaan aspirasi Anda dengan teknologi{' '}
              <span className="decoration-dotted underline-offset-4">
                enkripsi
              </span>
              {' '}modern
            </p>
          </div>
          
          <div className="flex items-center justify-center gap-8 flex-wrap">
            {[
              { color: "bg-green-500", label: "100% Anonim" },
              { color: "bg-blue-500", label: "Data Terenkripsi" },
              { color: "bg-purple-500", label: "Pasti Di Respon" },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-2 group">
                <div className={`w-3 h-3 rounded-full ${item.color} animate-pulse group-hover:scale-125 transition-transform`} />
                <span className="text-sm font-medium">{item.label}</span>
              </div>
            ))}
          </div>
          
          <div className="flex items-center justify-center gap-1 text-muted-foreground/50 text-xs bold">
            <Star className="w-3 h-3" />
            <span>DIBUAT OLEH MPK SMA NEGERI 1 KENDAL</span>
            <Star className="w-3 h-3" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
