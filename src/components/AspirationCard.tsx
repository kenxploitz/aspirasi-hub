import { useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { sanitizeText } from "@/lib/security";
import {
  Trash2, Download, Calendar, User, GraduationCap, Tag,
  Loader2, CheckCircle2, X,
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
  const [isToggling, setIsToggling] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [tags, setTags] = useState<{ id: string; tag_name: string; color: string }[]>([]);
  const [showAddTag, setShowAddTag] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [isAddingTag, setIsAddingTag] = useState(false);
  const tagInputRef = useRef<HTMLInputElement>(null);

  const st = getStatus(aspiration.status);
  const isSudah = aspiration.status === "sudah_ditanggapi";

  // Fetch tags
  useEffect(() => {
    const fetchTags = async () => {
      const { data } = await supabase
        .from("aspiration_tags")
        .select("id, tag_name, color")
        .eq("aspiration_id", aspiration.id);
      setTags(data || []);
    };
    fetchTags();
  }, [aspiration.id]);

  const handleRemoveTag = async (tagId: string) => {
    try {
      const { error } = await supabase.from("aspiration_tags").delete().eq("id", tagId);
      if (error) throw error;
      setTags((prev) => prev.filter((t) => t.id !== tagId));
      toast({ title: "Tag dihapus" });
    } catch {
      toast({ title: "Gagal hapus tag", variant: "destructive" });
    }
  };

  const handleAddTag = async () => {
    if (!newTagName.trim()) return;
    try {
      setIsAddingTag(true);
      const { data, error } = await supabase.from("aspiration_tags").insert({
        aspiration_id: aspiration.id,
        tag_name: newTagName.trim(),
      }).select("id, tag_name, color").single();
      if (error) {
        if (error.code === "23505") {
          toast({ title: "Tag sudah ada" });
        } else {
          throw error;
        }
      } else if (data) {
        setTags((prev) => [...prev, data]);
        toast({ title: `Tag "${newTagName.trim()}" ditambahkan` });
      }
      setNewTagName("");
      setShowAddTag(false);
    } catch {
      toast({ title: "Gagal tambah tag", variant: "destructive" });
    } finally {
      setIsAddingTag(false);
    }
  };

  // Focus input when shown
  useEffect(() => {
    if (showAddTag && tagInputRef.current) {
      tagInputRef.current.focus();
    }
  }, [showAddTag]);

  const handleToggleStatus = async () => {
    try {
      setIsToggling(true);
      const newStatus = isSudah ? "belum_ditanggapi" : "sudah_ditanggapi";
      const { error } = await supabase.from("aspirations").update({ status: newStatus }).eq("id", aspiration.id);
      if (error) throw error;
      toast({ title: isSudah ? "Dibatalkan" : "Ditanggapi" });
      onUpdate();
    } catch { toast({ title: "Gagal", variant: "destructive" }); } finally { setIsToggling(false); }
  };

  const handleDelete = async () => {
    try { setIsDeleting(true); const { error } = await supabase.from("aspirations").delete().eq("id", aspiration.id); if (error) throw error; toast({ title: "Dihapus" }); onUpdate(); } catch { toast({ title: "Gagal", variant: "destructive" }); } finally { setIsDeleting(false); }
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
              {/* Tag badges */}
              {tags.map((tag) => (
                <Badge key={tag.id} variant="outline"
                  className="text-[10px] px-1.5 py-0 h-4 font-normal bg-accent/10 text-accent border-accent/20 gap-0.5 group/tag cursor-default">
                  <Tag className="h-2.5 w-2.5 mr-0.5" />
                  {tag.tag_name}
                  <button onClick={() => handleRemoveTag(tag.id)}
                    className="ml-0.5 opacity-0 group-hover/tag:opacity-100 hover:text-destructive transition-opacity">
                    <X className="h-2.5 w-2.5" />
                  </button>
                </Badge>
              ))}
              {/* Add tag button */}
              {showAddTag ? (
                <div className="flex items-center gap-1">
                  <input
                    ref={tagInputRef}
                    type="text"
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleAddTag();
                      if (e.key === "Escape") { setShowAddTag(false); setNewTagName(""); }
                    }}
                    placeholder="Nama tag..."
                    className="h-5 w-20 text-[10px] px-1.5 border border-border rounded bg-background focus:outline-none focus:border-accent"
                    disabled={isAddingTag}
                  />
                  <button onClick={handleAddTag} disabled={isAddingTag || !newTagName.trim()}
                    className="h-5 w-5 flex items-center justify-center rounded bg-accent text-white hover:bg-accent/80 disabled:opacity-50">
                    {isAddingTag ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <CheckCircle2 className="h-2.5 w-2.5" />}
                  </button>
                  <button onClick={() => { setShowAddTag(false); setNewTagName(""); }}
                    className="h-5 w-5 flex items-center justify-center rounded hover:bg-muted">
                    <X className="h-2.5 w-2.5" />
                  </button>
                </div>
              ) : (
                <button onClick={() => setShowAddTag(true)}
                  className="h-4 w-4 flex items-center justify-center rounded-full border border-dashed border-muted-foreground/30 hover:border-accent hover:bg-accent/10 transition-colors">
                  <span className="text-[10px] text-muted-foreground hover:text-accent">+</span>
                </button>
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

        {/* ── Actions ── */}
        <div className="flex items-center gap-1.5 ml-6">
          <Button size="sm" variant="ghost" className={`h-7 text-xs px-2 ${isSudah ? "text-green-600 hover:text-green-700" : "text-muted-foreground hover:text-green-600"}`}
            onClick={handleToggleStatus} disabled={isToggling}>
            {isToggling ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <CheckCircle2 className="mr-1 h-3 w-3" />}
            {isSudah ? "Sudah Ditanggapi" : "Tanggapi"}
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
