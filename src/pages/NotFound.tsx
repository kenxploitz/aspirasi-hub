import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Home } from "lucide-react";

const NotFound = () => {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <Card className="p-8 max-w-sm text-center border border-border">
        <p className="text-5xl font-bold text-foreground mb-2">404</p>
        <p className="text-sm text-muted-foreground mb-4">Halaman tidak ditemukan.</p>
        <div className="flex gap-2 justify-center">
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => navigate(-1)}>
            <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />Kembali
          </Button>
          <Button size="sm" className="h-8 text-xs bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => navigate("/")}>
            <Home className="mr-1.5 h-3.5 w-3.5" />Beranda
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default NotFound;
