import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { sanitizeText } from "@/lib/security";
import {
  Trash2, MessageCircle, Send, Download, Calendar, User, GraduationCap,
  Loader2, ChevronDown, ChevronUp,
} from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface Comment { id: string; comment_text: string; created_at: string; admin_id: string; }
interface Aspiration {
  id: string; student_name: string; student_class: string | null;
  content: string; status: string; created_at: string; comments: Comment[];
}
interface AspirationCardProps {
  aspiration: Aspiration; onUpdate: () => void;
  isSelected?: boolean; onToggleSelect?: (id: string) => void; showCheckbox?: boolean;
}

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  sudah_ditanggapi: { label: "Sudah Ditanggapi", cls: "bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-400 dark:border-green-800" },
  belum_ditanggapi: { label: "Belum Ditanggapi", cls: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800" },
};

function getStatus(status: string) { return STATUS_MAP[status] || STATUS_MAP.belum_ditanggapi; }

function relativeTime(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000), h = Math.floor(diff / 3600000), dy = Math.floor(diff / 86400000);
  if (m < 1) return "Baru saja"; if (m < 60) return `${m}m`; if (h < 24) return `${h}j`;
  if (dy < 7) return `${dy}h`; return new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "short" });
}

function fmtDate(d: string) {
  return new Date(d).toLocaleString("id-ID", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

const AspirationCard = ({ aspiration, onUpdate, isSelected, onToggleSelect, showCheckbox }: AspirationCardProps) => {
  const { toast } = useToast();
  const [isCommenting, setIsCommenting] = useState(false);
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [showComments, setShowComments] = useState(false);

  const st = getStatus(aspiration.status);

  const handleDelete = async () => {
    try { setIsDeleting(true); const { error } = await supabase.from("aspirations").delete().eq("id", aspiration.id); if (error) throw error; toast({ title: "Dihapus" }); onUpdate(); } catch { toast({ title: "Gagal", variant: "destructive" }); } finally { setIsDeleting(false); }
  };

  const handleAddComment = async () => {
    if (!comment.trim()) return;
    try {
      setIsSubmitting(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase.from("comments").insert({ aspiration_id: aspiration.id, admin_id: user.id, comment_text: comment.trim() });
      if (error) throw error;
      toast({ title: "Tanggapan ditambahkan" }); setComment(""); setIsCommenting(false); onUpdate();
    } catch { toast({ title: "Gagal", variant: "destructive" }); } finally { setIsSubmitting(false); }
  };

  const handleDownloadDesign = async () => {
    try {
      setIsDownloading(true); toast({ title: "Membuat desain..." });
      const res = await supabase.functions.invoke("generate-instagram-design", { body: { aspirationId: aspiration.id } });
      if (res.error) throw res.error;
      const svg = typeof res.data === "string" ? res.data : new TextDecoder().decode(res.data as ArrayBuffer);
      const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
      const img = new Image(); img.onload = () => {
        const c = document.createElement("canvas"); c.width = 1080; c.height = 1080;
        const ctx = c.getContext("2d")!; ctx.drawImage(img, 0, 0, 1080, 1080); URL.revokeObjectURL(url);
        c.toBlob((b) => { if (!b) return; const u = URL.createObjectURL(b); const a = document.createElement("a"); a.href = u; a.download = `aspirasi-${new Date(aspiration.created_at).toISOString().split("T")[0]}.png`; a.click(); URL.revokeObjectURL(u); });
      }; img.src = url;
      toast({ title: "Desain diunduh" });
    } catch { toast({ title: "Gagal", variant: "destructive" }); } finally { setIsDownloading(false); }
  };

  return (
    <Card className="p-4 border border-border bg-card">
      <div className="space-y-3">
        {/* ── Header: badges ── */}
        <div className="flex items-start gap-3">
          {showCheckbox && onToggleSelect && (
            <Checkbox checked={isSelected} onCheckedChange={() => onToggleSelect(aspiration.id)} className="mt-0.5 shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap mb-2">
              <Badge variant="outline" className={`${st.cls} text-[10px] px-2 py-0 h-5 font-medium rounded`}>{st.label}</Badge>
              <span className="text-xs font-medium text-foreground truncate">{sanitizeText(aspiration.student_name)}</span>
              {aspiration.student_class && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-normal">{sanitizeText(aspiration.student_class)}</Badge>
              )}
              <span className="text-[10px] text-muted-foreground ml-auto shrink-0 flex items-center gap-1">
                <Calendar className="h-2.5 w-2.5" />{fmtDate(aspiration.created_at)}
              </span>
            </div>
            <p className="text-sm text-foreground/85 leading-relaxed whitespace-pre-wrap break-words">
              {sanitizeText(aspiration.content)}
            </p>
          </div>
        </div>

        {/* ── Comments ── */}
        {aspiration.comments.length > 0 && (
          <div className="ml-6 space-y-1.5">
            <button onClick={() => setShowComments(!showComments)} className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
              <MessageCircle className="h-3 w-3" />Tanggapan ({aspiration.comments.length}){showComments ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
            {showComments && (
              <div className="space-y-1.5 pl-3 border-l-2 border-muted">
                {aspiration.comments.map((c) => (
                  <div key={c.id} className="flex gap-2 p-2 rounded bg-muted/40">
                    <Avatar className="h-5 w-5 shrink-0"><AvatarFallback className="bg-muted text-[8px] font-medium text-muted-foreground">A</AvatarFallback></Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-foreground">{sanitizeText(c.comment_text)}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{relativeTime(c.created_at)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Comment input ── */}
        {isCommenting && (
          <div className="ml-6 space-y-2 p-3 rounded bg-muted/30 border border-border">
            <Textarea placeholder="Tulis tanggapan..." value={comment} onChange={(e) => setComment(e.target.value)} rows={2} className="border-border focus:border-primary resize-none text-sm" />
            <div className="flex gap-2">
              <Button size="sm" className="h-7 text-xs bg-primary text-primary-foreground hover:bg-primary/90" onClick={handleAddComment} disabled={isSubmitting || !comment.trim()}>
                {isSubmitting ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Send className="mr-1 h-3 w-3" />}Kirim
              </Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setIsCommenting(false); setComment(""); }}>Batal</Button>
            </div>
          </div>
        )}

        {/* ── Actions ── */}
        <div className="flex items-center gap-1.5 ml-6">
          <Button size="sm" variant="ghost" className="h-7 text-xs px-2 text-muted-foreground" onClick={() => setIsCommenting(!isCommenting)}>
            <MessageCircle className="mr-1 h-3 w-3" />Tanggapi
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs px-2 text-muted-foreground" onClick={handleDownloadDesign} disabled={isDownloading}>
            {isDownloading ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Download className="mr-1 h-3 w-3" />}Desain
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="ghost" className="h-7 text-xs px-2 text-destructive hover:text-destructive" disabled={isDeleting}>
                {isDeleting ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Trash2 className="mr-1 h-3 w-3" />}Hapus
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader><AlertDialogTitle>Hapus Aspirasi</AlertDialogTitle><AlertDialogDescription>Tindakan ini tidak dapat dibatalkan.</AlertDialogDescription></AlertDialogHeader>
              <AlertDialogFooter><AlertDialogCancel>Batal</AlertDialogCancel><AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Hapus</AlertDialogAction></AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </Card>
  );
};

export default AspirationCard;
