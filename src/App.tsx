import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import Index from "./pages/Index";
import SubmitAspiration from "./pages/SubmitAspiration";
import AdminLogin from "./pages/AdminLogin";
import AdminDashboard from "./pages/AdminDashboard";
import Statistics from "./pages/Statistics";
import AiSettingsPage from "./pages/admin/AiSettingsPage";
import AdminAiPage from "./pages/AdminAiPage";
import NotFound from "./pages/NotFound";
import ClientAiChatWidget from "./components/ClientAiChatWidget";

const queryClient = new QueryClient();

const AppContent = () => {
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith("/admin");

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
