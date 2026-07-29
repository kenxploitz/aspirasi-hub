import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, LogIn, Loader2, Shield } from "lucide-react";
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
        try { const { data } = await supabase.auth.getSessionFromUrl(); if (data?.session) { if (mounted) await handlePostLogin(data.session.user, false); } } catch {}
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user && mounted) await handlePostLogin(session.user, true);
      } catch {} finally { if (mounted) setIsChecking(false); }
    };
    checkSession();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (event === "SIGNED_IN" && session?.user) setTimeout(() => { if (mounted) handlePostLogin(session.user, false); }, 0);
    });
    return () => { mounted = false; subscription.unsubscribe(); };
  }, []);

  const handlePostLogin = async (user: any, silent: boolean = false) => {
    try {
      const { data: existingRole } = await supabase.from("user_roles").select("role").eq("user_id", user.id).maybeSingle();
      if (existingRole) { if (!silent) toast({ title: "Login berhasil" }); navigate("/admin/dashboard", { replace: true }); return; }
      const userEmail = user.email?.toLowerCase();
      const { data: adminEmail } = await supabase.from("admin_emails" as any).select("email").ilike("email", userEmail || "").maybeSingle();
      if (!adminEmail) { await supabase.auth.signOut(); if (!silent) toast({ title: "Akses ditolak", description: "Email tidak terdaftar.", variant: "destructive" }); return; }
      await supabase.from("user_roles").insert({ user_id: user.id, role: "admin" as const });
      if (!silent) toast({ title: "Login berhasil" });
      navigate("/admin/dashboard", { replace: true });
    } catch { if (!silent) toast({ title: "Error", variant: "destructive" }); }
  };

  const handleGoogleLogin = async () => {
    try { setIsLoading(true); const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${window.location.origin}/admin/login` } }); if (error) throw error; } catch (e: any) { toast({ title: "Login gagal", description: e.message, variant: "destructive" }); setIsLoading(false); }
  };

  if (isChecking) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Loader2 className="w-6 h-6 text-primary animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <ThemeToggle />
      <div className="w-full max-w-sm">
        <Button variant="ghost" size="sm" className="mb-4 h-8 text-xs" onClick={() => navigate("/")}>
          <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />Kembali
        </Button>
        <Card className="p-6 border border-border">
          <div className="text-center mb-6">
            <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center mx-auto mb-3">
              <LogIn className="h-6 w-6 text-primary" />
            </div>
            <h1 className="text-lg font-bold text-foreground">Admin Login</h1>
            <p className="text-xs text-muted-foreground mt-1">Login dengan akun Google</p>
          </div>
          <Button onClick={handleGoogleLogin} className="w-full h-10 text-sm bg-card hover:bg-muted text-foreground border border-border" disabled={isLoading}>
            <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Masuk dengan Google"}
          </Button>
          <div className="mt-4 p-3 rounded bg-muted/50 border border-border">
            <div className="flex items-start gap-2">
              <Shield className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
              <p className="text-[10px] text-muted-foreground leading-relaxed">Hanya email terdaftar yang bisa login. Hubungi superadmin untuk akses.</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default AdminLogin;
