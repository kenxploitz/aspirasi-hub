import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import Index from "./pages/Index";
import SubmitAspiration from "./pages/SubmitAspiration";
import AdminLogin from "./pages/AdminLogin";
import AdminDashboard from "./pages/AdminDashboard";
import Statistics from "./pages/Statistics";
import AiSettingsPage from "./pages/admin/AiSettingsPage";
import AdminAiPage from "./pages/AdminAiPage";
import NotFound from "./pages/NotFound";
import MaintenancePage from "./pages/MaintenancePage";
import ClientAiChatWidget from "./components/ClientAiChatWidget";
import { Loader2 } from "lucide-react";

const queryClient = new QueryClient();

const AppContent = () => {
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith("/admin");
  const [maintenanceMode, setMaintenanceMode] = useState<boolean | null>(null);
  const [maintenanceMsg, setMaintenanceMsg] = useState("");

  useEffect(() => {
    const checkMaintenance = async () => {
      try {
        const { data } = await supabase
          .from("site_settings")
          .select("maintenance_mode, maintenance_message")
          .limit(1)
          .maybeSingle();

        if (data) {
          setMaintenanceMode(data.maintenance_mode || false);
          setMaintenanceMsg(data.maintenance_message || "");
        } else {
          setMaintenanceMode(false);
        }
      } catch {
        setMaintenanceMode(false);
      }
    };

    checkMaintenance();

    // Subscribe to changes
    const channel = supabase
      .channel("site_settings_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "site_settings" }, (payload) => {
        if (payload.new && typeof payload.new === "object") {
          const newData = payload.new as any;
          setMaintenanceMode(newData.maintenance_mode || false);
          setMaintenanceMsg(newData.maintenance_message || "");
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // Loading state
  if (maintenanceMode === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  // Maintenance mode — block public pages, allow admin
  if (maintenanceMode && !isAdminRoute) {
    return <MaintenancePage message={maintenanceMsg} />;
  }

  return (
    <>
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/submit" element={<SubmitAspiration />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin/dashboard" element={<AdminDashboard />} />
        <Route path="/admin/statistics" element={<Statistics />} />
        <Route path="/admin/ai" element={<AdminAiPage />} />
        <Route path="/admin/settings/ai" element={<AiSettingsPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      {/* Curhat AI — hanya muncul di halaman client, BUKAN admin */}
      {!isAdminRoute && <ClientAiChatWidget />}
    </>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AppContent />
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
