import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Send, CheckCircle2, User, GraduationCap, FileText, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { ThemeToggle } from "@/components/ThemeToggle";
import { sanitizeStudentName, sanitizeStudentClass, validateContent, detectSpam, sanitizeText } from "@/lib/security";

const schema = z.object({
  studentName: z.string().trim().max(100).optional(),
  studentClass: z.string().trim().max(50).optional(),
  content: z.string().trim().min(10).max(2000),
});

const HONEYPOT = "website_url";

const SubmitAspiration = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [form, setForm] = useState({ studentName: "", studentClass: "", content: "", [HONEYPOT]: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const lastSubmit = useRef(0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setErrors({});
    if (form[HONEYPOT]) { setIsSuccess(true); return; }
    if (Date.now() - lastSubmit.current < 30000) { toast({ title: "Tunggu 30 detik", variant: "destructive" }); return; }

    try {
      const v = schema.parse(form);
      const name = sanitizeStudentName(v.studentName || "Anonim");
      const cls = sanitizeStudentClass(v.studentClass || "");
      const content = sanitizeText(v.content);
      const cv = validateContent(content);
      if (!cv.valid) { setErrors({ content: cv.error! }); return; }
      if (detectSpam(content) || detectSpam(name)) { toast({ title: "Terdeteksi spam", variant: "destructive" }); return; }

      setIsSubmitting(true);
      const { data, error } = await supabase.functions.invoke("submit-aspiration", {
        body: { student_name: name, student_class: cls, content, honeypot: form[HONEYPOT] },
      });
      if (error) { if (error.message?.includes("429")) { toast({ title: "Tunggu beberapa menit", variant: "destructive" }); return; } throw error; }
      if (data?.error) { toast({ title: data.error, variant: "destructive" }); return; }

      lastSubmit.current = Date.now();
      setIsSuccess(true);
      toast({ title: "Aspirasi terkirim" });
      setTimeout(() => navigate("/"), 3000);
    } catch (err) {
      if (err instanceof z.ZodError) { const fe: Record<string, string> = {}; err.errors.forEach((e) => { if (e.path[0]) fe[e.path[0] as string] = e.message; }); setErrors(fe); }
      else toast({ title: "Gagal mengirim", variant: "destructive" });
    } finally { setIsSubmitting(false); }
  };

  if (isSuccess) return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <Card className="p-8 max-w-sm text-center border border-border">
        <div className="w-14 h-14 rounded-full bg-green-100 dark:bg-green-950 flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-7 h-7 text-green-600" />
        </div>
        <h2 className="text-lg font-bold text-foreground mb-2">Aspirasi Terkirim</h2>
        <p className="text-sm text-muted-foreground">Terima kasih. Mengarahkan ke halaman utama...</p>
      </Card>
    </div>
  );

  return (
    <div className="min-h-screen bg-background py-10 px-4">
      <ThemeToggle />
      <div className="max-w-xl mx-auto">
        <Button variant="ghost" size="sm" className="mb-4 h-8 text-xs" onClick={() => navigate("/")}>
          <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />Kembali
        </Button>
        <Card className="p-6 border border-border">
          <div className="text-center mb-6">
            <h1 className="text-xl font-bold text-foreground">Kirim Aspirasi</h1>
            <p className="text-xs text-muted-foreground mt-1">Sampaikan pendapat, saran, atau keluhan Anda.</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Honeypot */}
            <div style={{ position: "absolute", left: "-9999px", opacity: 0, height: 0, overflow: "hidden" }} aria-hidden="true">
              <Label htmlFor={HONEYPOT}>Website</Label>
              <Input id={HONEYPOT} type="text" tabIndex={-1} autoComplete="off" value={form[HONEYPOT]} onChange={(e) => setForm({ ...form, [HONEYPOT]: e.target.value })} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="studentName" className="text-xs flex items-center gap-1"><User className="h-3 w-3" />Nama</Label>
                <Input id="studentName" placeholder="Opsional" maxLength={100} value={form.studentName} onChange={(e) => setForm({ ...form, studentName: e.target.value })} className="h-9 text-sm mt-1" />
                {errors.studentName && <p className="text-[10px] text-destructive mt-0.5">{errors.studentName}</p>}
              </div>
              <div>
                <Label htmlFor="studentClass" className="text-xs flex items-center gap-1"><GraduationCap className="h-3 w-3" />Kelas</Label>
                <Input id="studentClass" placeholder="Opsional" maxLength={50} value={form.studentClass} onChange={(e) => setForm({ ...form, studentClass: e.target.value })} className="h-9 text-sm mt-1" />
              </div>
            </div>
            <div>
              <Label htmlFor="content" className="text-xs flex items-center gap-1"><FileText className="h-3 w-3" />Aspirasi <span className="text-destructive">*</span></Label>
              <Textarea id="content" placeholder="Tuliskan aspirasi Anda..." rows={6} maxLength={2000} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} className="text-sm mt-1 resize-none" />
              <div className="flex justify-between mt-1">
                {errors.content ? <p className="text-[10px] text-destructive">{errors.content}</p> : <span />}
                <span className="text-[10px] text-muted-foreground">{form.content.length}/2000</span>
              </div>
            </div>
            <Button type="submit" className="w-full h-10 text-sm bg-primary text-primary-foreground hover:bg-primary/90" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              {isSubmitting ? "Mengirim..." : "Kirim"}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
};

export default SubmitAspiration;
