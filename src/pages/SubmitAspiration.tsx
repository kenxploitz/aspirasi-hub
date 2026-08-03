import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Send, Sparkles, CheckCircle2, User, GraduationCap, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { ThemeToggle } from "@/components/ThemeToggle";

const aspirationSchema = z.object({
  studentName: z.string().trim().max(100, "Nama terlalu panjang").optional(),
  studentClass: z.string().trim().max(50, "Kelas terlalu panjang").optional(),
  content: z.string().trim().min(10, "Aspirasi minimal 10 karakter").max(2000, "Aspirasi maksimal 2000 karakter"),
});

const HONEYPOT = "website_url";

const SubmitAspiration = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [formData, setFormData] = useState({
    studentName: "",
    studentClass: "",
    content: "",
    [HONEYPOT]: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const lastSubmit = useRef(0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Honeypot check
    if (formData[HONEYPOT]) { setIsSuccess(true); return; }

    // Cooldown
    if (Date.now() - lastSubmit.current < 30000) {
      toast({ title: "Tunggu 30 detik", variant: "destructive" }); return;
    }

    try {
      const validated = aspirationSchema.parse(formData);
      setIsSubmitting(true);

      // Use Edge Function for secure submission
      const { data, error } = await supabase.functions.invoke("submit-aspiration", {
        body: {
          student_name: validated.studentName || "Anonim",
          student_class: validated.studentClass || null,
          content: validated.content,
          honeypot: formData[HONEYPOT],
        },
      });

      if (error) {
        if (error.message?.includes("429")) {
          toast({ title: "Tunggu beberapa menit", variant: "destructive" }); return;
        }
        throw error;
      }
      if (data?.error) throw new Error(data.error);

      setIsSuccess(true);
      lastSubmit.current = Date.now();
      toast({
        title: "Aspirasi Terkirim! 🎉",
        description: "Terima kasih telah menyampaikan aspirasi Anda.",
      });

      setTimeout(() => navigate("/"), 3000);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            fieldErrors[err.path[0] as string] = err.message;
          }
        });
        setErrors(fieldErrors);
      } else {
        toast({
          title: "Gagal Mengirim",
          description: "Terjadi kesalahan. Silakan coba lagi.",
          variant: "destructive",
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 via-accent/5 to-secondary/5 flex items-center justify-center px-4 relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-20 w-72 h-72 bg-green-500/10 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-accent/10 rounded-full blur-3xl animate-pulse" />
        </div>
        
        <Card className="p-12 max-w-md text-center animate-scale-in shadow-2xl border-2 border-green-500/30 bg-card/95 backdrop-blur-md">
          <div className="relative w-24 h-24 mx-auto mb-6">
            <div className="absolute inset-0 bg-green-500/30 rounded-full blur-xl animate-pulse" />
            <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center shadow-2xl">
              <CheckCircle2 className="w-14 h-14 text-white" />
            </div>
          </div>
          <h2 className="text-3xl font-bold mb-4 bg-gradient-to-r from-green-500 to-accent bg-clip-text text-transparent">
            Aspirasi Terkirim!
          </h2>
          <p className="text-muted-foreground text-lg mb-6">
            Terima kasih telah menyampaikan aspirasi Anda. Suara Anda sangat berarti! ✨
          </p>
          <p className="text-sm text-muted-foreground">
            Mengarahkan ke halaman utama dalam 3 detik...
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-accent/5 to-secondary/5 py-12 px-4 relative overflow-hidden">
      {/* Enhanced animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-10 right-10 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-10 left-10 w-80 h-80 bg-accent/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1.5s' }} />
        <div className="absolute top-1/3 left-1/3 w-72 h-72 bg-secondary/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '3s' }} />
      </div>

      <ThemeToggle />

      <div className="container max-w-2xl mx-auto relative z-10 px-4">
        <Button
          variant="ghost"
          className="mb-6 hover:bg-muted/80 backdrop-blur-sm border border-border/50 transition-all duration-300"
          onClick={() => navigate("/")}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Kembali
        </Button>

        <Card className="p-6 md:p-10 animate-fade-in shadow-xl border border-border/50 backdrop-blur-md bg-card/95">
          <div className="text-center mb-8">
            <div className="relative w-16 h-16 mx-auto mb-4">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/30 to-accent/30 rounded-xl blur-lg animate-pulse" />
              <div className="relative w-16 h-16 rounded-xl bg-gradient-to-br from-primary via-accent to-secondary flex items-center justify-center shadow-xl">
                <Sparkles className="w-8 h-8 text-white" />
              </div>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold mb-3 bg-gradient-to-r from-primary via-accent to-secondary bg-clip-text text-transparent">
              Kirim Aspirasi
            </h1>
            <p className="text-muted-foreground text-base">
              Sampaikan pendapat, saran, atau keluhan Anda ✨
            </p>
            <p className="text-xs text-muted-foreground mt-2 flex items-center justify-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
              Identitas Anda terjaga kerahasiaannya
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Honeypot — hidden from real users */}
            <div style={{ position: "absolute", left: "-9999px", opacity: 0, height: 0, overflow: "hidden" }} aria-hidden="true">
              <Label htmlFor={HONEYPOT}>Website</Label>
              <Input id={HONEYPOT} type="text" tabIndex={-1} autoComplete="off" value={formData[HONEYPOT]} onChange={(e) => setFormData({ ...formData, [HONEYPOT]: e.target.value })} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="studentName" className="flex items-center gap-2 text-sm">
                  <User className="w-4 h-4 text-primary" />
                  Nama (Opsional)
                </Label>
                <Input
                  id="studentName"
                  placeholder="Masukkan nama Anda"
                  value={formData.studentName}
                  onChange={(e) =>
                    setFormData({ ...formData, studentName: e.target.value })
                  }
                  className={`py-5 text-base border-2 transition-all duration-300 focus:border-primary ${errors.studentName ? "border-destructive" : ""}`}
                />
                {errors.studentName && (
                  <p className="text-sm text-destructive">{errors.studentName}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="studentClass" className="flex items-center gap-2 text-sm">
                  <GraduationCap className="w-4 h-4 text-accent" />
                  Kelas (Opsional)
                </Label>
                <Input
                  id="studentClass"
                  placeholder="Contoh: XII IPA 1"
                  value={formData.studentClass}
                  onChange={(e) =>
                    setFormData({ ...formData, studentClass: e.target.value })
                  }
                  className={`py-5 text-base border-2 transition-all duration-300 focus:border-accent ${errors.studentClass ? "border-destructive" : ""}`}
                />
                {errors.studentClass && (
                  <p className="text-sm text-destructive">{errors.studentClass}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="content" className="flex items-center gap-2 text-sm">
                <FileText className="w-4 h-4 text-secondary" />
                Aspirasi <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="content"
                placeholder="Tuliskan aspirasi Anda di sini..."
                rows={6}
                value={formData.content}
                onChange={(e) =>
                  setFormData({ ...formData, content: e.target.value })
                }
                className={`text-base border-2 transition-all duration-300 focus:border-secondary resize-none ${errors.content ? "border-destructive" : ""}`}
              />
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {formData.content.length}/2000 karakter
                </p>
                {formData.content.length >= 10 && (
                  <p className="text-sm text-green-500 flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" />
                    Siap dikirim
                  </p>
                )}
              </div>
              {errors.content && (
                <p className="text-sm text-destructive">{errors.content}</p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-primary via-accent to-secondary hover:opacity-90 text-white font-bold py-6 text-lg shadow-xl transition-all duration-300"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Mengirim...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <Send className="h-5 w-5" />
                  Kirim Aspirasi
                </span>
              )}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
};

export default SubmitAspiration;
