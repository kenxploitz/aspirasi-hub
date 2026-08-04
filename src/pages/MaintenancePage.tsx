import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Wrench, Clock, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

const MaintenancePage = ({ message }: { message: string }) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-accent/5 flex items-center justify-center px-4">
      <div className="max-w-md text-center space-y-6">
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/30 to-accent/30 rounded-full blur-3xl animate-pulse" />
          <div className="relative w-24 h-24 mx-auto bg-gradient-to-br from-primary to-accent rounded-full flex items-center justify-center shadow-2xl">
            <Wrench className="w-12 h-12 text-white animate-bounce" />
          </div>
        </div>

        <div className="space-y-3">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Sedang Dalam Pemeliharaan
          </h1>
          <p className="text-muted-foreground text-lg">
            {message || "Sistem sedang dalam pemeliharaan. Silakan coba lagi nanti."}
          </p>
        </div>

        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4" />
          <span>Kami akan segera kembali</span>
        </div>

        <Button
          onClick={() => window.location.reload()}
          variant="outline"
          className="gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          Coba Lagi
        </Button>
      </div>
    </div>
  );
};

export default MaintenancePage;
