import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { UserPlus, Trash2, Mail, Loader2, Shield } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface AdminEmail { id: string; email: string; created_at: string; }

export const AdminUserManagement = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newEmail, setNewEmail] = useState("");

  const { data: admins, isLoading } = useQuery({
    queryKey: ["admin-emails"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_emails" as any).select("*")
        .order("created_at", { ascending: false }) as unknown as { data: AdminEmail[] | null; error: any };
      if (error) throw error;
      return data || [];
    },
  });

  const addMut = useMutation({
    mutationFn: async (email: string) => {
      const { error } = await supabase.from("admin_emails" as any).insert({ email: email.toLowerCase().trim() } as any);
      if (error) throw error;
    },
    onSuccess: () => { toast({ title: "Email ditambahkan" }); setNewEmail(""); queryClient.invalidateQueries({ queryKey: ["admin-emails"] }); },
    onError: (e: any) => { toast({ title: e.message?.includes("duplicate") ? "Email sudah terdaftar" : "Gagal", variant: "destructive" }); },
  });

  const removeMut = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("admin_emails" as any).delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { toast({ title: "Email dihapus" }); queryClient.invalidateQueries({ queryKey: ["admin-emails"] }); },
    onError: (e: any) => { toast({ title: "Gagal", description: e.message, variant: "destructive" }); },
  });

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim()) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) { toast({ title: "Email tidak valid", variant: "destructive" }); return; }
    addMut.mutate(newEmail);
  };

  return (
    <div className="space-y-4">
      {/* Add form */}
      <Card className="p-4 border border-border">
        <div className="flex items-center gap-2 mb-3">
          <UserPlus className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Tambah Admin</h2>
        </div>
        <form onSubmit={handleAdd} className="flex gap-2">
          <Input type="email" placeholder="admin@gmail.com" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} required className="h-9 text-sm flex-1" />
          <Button type="submit" size="sm" className="h-9 text-xs bg-primary text-primary-foreground hover:bg-primary/90" disabled={addMut.isPending}>
            {addMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Tambah"}
          </Button>
        </form>
        <p className="text-[10px] text-muted-foreground mt-2">Email yang didaftarkan bisa login via Google OAuth.</p>
      </Card>

      {/* List */}
      <Card className="p-4 border border-border">
        <div className="flex items-center gap-2 mb-3">
          <Mail className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">Admin Terdaftar</h2>
          {admins && <span className="text-[10px] text-muted-foreground">({admins.length})</span>}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 text-primary animate-spin" /></div>
        ) : admins && admins.length > 0 ? (
          <div className="space-y-1">
            {admins.map((a) => (
              <div key={a.id} className="flex items-center justify-between p-2.5 rounded bg-muted/40 hover:bg-muted/60 transition-colors">
                <div className="flex items-center gap-2.5 min-w-0">
                  <Shield className="h-3.5 w-3.5 text-primary shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{a.email}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(a.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive shrink-0"
                  onClick={() => removeMut.mutate(a.id)} disabled={removeMut.isPending}>
                  {removeMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6">
            <Mail className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">Belum ada admin terdaftar.</p>
          </div>
        )}
      </Card>
    </div>
  );
};
