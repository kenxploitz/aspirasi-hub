import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, LogIn, Loader2, Shield, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ThemeToggle } from "@/components/ThemeToggle";

const AdminLogin = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    let mounted = true;

    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user && mounted) {
          await handlePostLogin(session.user, true);
        }
      } catch (error) {
        console.error("Session check error:", error);
      } finally {
        if (mounted) setIsChecking(false);
      }
    };

    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!mounted) return;
        
        if (event === "SIGNED_IN" && session?.user) {
          setTimeout(() => {
            if (mounted) handlePostLogin(session.user, false);
          }, 0);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const handlePostLogin = async (user: any, silent: boolean = false) => {
    try {
      const userEmail = user.email?.toLowerCase();
      console.debug("PostLogin: userId=", user.id);
      
      // Check if user already has a role
      const { data: existingRole } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();

      if (existingRole) {
        if (!silent) toast({ title: "Login Berhasil! 🎉" });
        navigate("/admin/dashboard", { replace: true });
        return;
      }

      // Check admin_emails table (server-side, no hardcoded emails)
      const { data: adminEmail } = await supabase
        .from("admin_emails" as any)
        .select("email")
        .ilike("email", userEmail || "")
        .maybeSingle();

      if (!adminEmail) {
        await supabase.auth.signOut();
        if (!silent) {
          toast({
            title: "Akses Ditolak ❌",
            description: "Email tidak terdaftar. Hubungi developer.",
            variant: "destructive",
          });
        }
        return;
      }

      // Assign admin role
      await supabase.from("user_roles").upsert({
        user_id: user.id,
        role: "admin" as const,
      }, { onConflict: "user_id,role", ignoreDuplicates: true });

      if (!silent) {
        toast({
          title: "Login Berhasil! 🎉",
          description: "Selamat datang di panel admin!",
        });
      }
      navigate("/admin/dashboard", { replace: true });
    } catch (error: any) {
      console.error("Post-login error:", error);
      if (!silent) {
        toast({
          title: "Error",
          description: "Terjadi kesalahan saat memproses login.",
          variant: "destructive",
        });
      }
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setIsLoading(true);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/admin/login`,
        },
      });

      if (error) throw error;
    } catch (error: any) {
      toast({
        title: "Login Gagal",
        description: error.message || "Tidak dapat login dengan Google.",
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

  if (isChecking) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 flex items-center justify-center">
        <div className="text-center animate-fade-in">
          <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground font-medium">Memeriksa sesi...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 flex items-center justify-center px-4 relative overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-20 w-72 h-72 bg-primary/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-accent/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/3 w-64 h-64 bg-secondary/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      <ThemeToggle />

      <div className="w-full max-w-md relative z-10">
        <Button
          variant="ghost"
          className="mb-6 hover:bg-muted/80 backdrop-blur-sm border border-border/50 transition-all duration-300 hover:scale-105"
          onClick={() => navigate("/")}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Kembali
        </Button>

        <Card className="p-10 animate-fade-in shadow-2xl border-2 border-primary/20 bg-card/95 backdrop-blur-md hover:shadow-3xl transition-all duration-500">
          <div className="text-center mb-10">
            <div className="relative w-24 h-24 mx-auto mb-6">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/30 to-accent/30 rounded-3xl blur-xl animate-pulse" />
              <div className="relative w-24 h-24 rounded-3xl bg-gradient-to-br from-primary via-accent to-secondary flex items-center justify-center shadow-2xl transform hover:scale-110 transition-transform duration-300">
                <LogIn className="w-12 h-12 text-white" />
              </div>
            </div>
            <h1 className="text-4xl font-bold mb-3 bg-gradient-to-r from-primary via-accent to-secondary bg-clip-text text-transparent">
              Admin Login
            </h1>
            <p className="text-muted-foreground text-lg">
              Login dengan akun Google Anda
            </p>
          </div>

          <div className="space-y-8">
            <Button
              onClick={handleGoogleLogin}
              className="w-full bg-card hover:bg-muted text-foreground border-2 border-border/50 font-semibold py-7 text-lg shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02] hover:border-primary/50 group"
              disabled={isLoading}
            >
              <svg className="w-6 h-6 mr-3 group-hover:scale-110 transition-transform" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Menghubungkan...
                </span>
              ) : (
                "Masuk dengan Google"
              )}
            </Button>

            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 rounded-xl bg-muted/50 border border-border/50">
                <Shield className="w-5 h-5 text-primary flex-shrink-0" />
                <p className="text-sm text-muted-foreground">
                  Hanya email yang terdaftar oleh superadmin yang dapat login
                </p>
              </div>
              
              <div className="flex items-center gap-3 p-4 rounded-xl bg-muted/50 border border-border/50">
                <Sparkles className="w-5 h-5 text-accent flex-shrink-0" />
                <p className="text-sm text-muted-foreground">
                  Sesi login akan tersimpan otomatis
                </p>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default AdminLogin;
