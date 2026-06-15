import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth-context";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Plus, Edit, Trash2, Users, UserPlus, ArrowLeft } from "lucide-react";
import type { User } from "@shared/schema";
import { useLocation } from "wouter";

const GROUP_COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
  "#06b6d4", "#ec4899", "#6366f1", "#84cc16", "#f97316",
];

type TaskGroup = {
  id: string;
  name: string;
  description?: string | null;
  color?: string | null;
  icon?: string | null;
  members: { userId: string; fullName: string; avatarUrl?: string | null }[];
};

const emptyForm = () => ({
  name: "",
  description: "",
  color: GROUP_COLORS[0],
  memberUserIds: [] as string[],
});

export default function TaskGroupsPage() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editGroup, setEditGroup] = useState<TaskGroup | null>(null);
  const [form, setForm] = useState(emptyForm());

  const { data: groups = [], isLoading } = useQuery<TaskGroup[]>({
    queryKey: ["/api/task-groups"],
  });

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = { ...form };
      if (editGroup) {
        return apiRequest("PUT", `/api/task-groups/${editGroup.id}`, payload);
      }
      return apiRequest("POST", "/api/task-groups", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/task-groups"] });
      toast({ title: editGroup ? "Skupina upravená" : "Skupina vytvorená" });
      setDialogOpen(false);
      setEditGroup(null);
      setForm(emptyForm());
    },
    onError: () => {
      toast({ title: "Chyba pri ukladaní", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/task-groups/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/task-groups"] });
      toast({ title: "Skupina zmazaná" });
    },
    onError: () => {
      toast({ title: "Chyba pri mazaní", variant: "destructive" });
    },
  });

  const openCreate = () => {
    setEditGroup(null);
    setForm(emptyForm());
    setDialogOpen(true);
  };

  const openEdit = (g: TaskGroup) => {
    setEditGroup(g);
    setForm({
      name: g.name,
      description: g.description || "",
      color: g.color || GROUP_COLORS[0],
      memberUserIds: g.members.map(m => m.userId),
    });
    setDialogOpen(true);
  };

  const toggleMember = (uid: string) => {
    setForm(f => ({
      ...f,
      memberUserIds: f.memberUserIds.includes(uid)
        ? f.memberUserIds.filter(id => id !== uid)
        : [...f.memberUserIds, uid],
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/tasks")}
            data-testid="btn-back-to-tasks"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Úlohy
          </Button>
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-task-groups-title">Skupiny úloh</h1>
            <p className="text-muted-foreground text-sm">Spravujte skupiny používateľov pre automatické priraďovanie úloh</p>
          </div>
        </div>
        <Button onClick={openCreate} data-testid="btn-create-group">
          <Plus className="h-4 w-4 mr-2" />
          Nová skupina
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : groups.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground">Žiadne skupiny úloh. Vytvorte prvú skupinu kliknutím na "Nová skupina".</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {groups.map((group) => (
            <Card key={group.id} data-testid={`task-group-card-${group.id}`}>
              <CardHeader className="flex flex-row items-start justify-between pb-2">
                <div className="flex items-center gap-2">
                  <div
                    className="h-4 w-4 rounded-full shrink-0"
                    style={{ backgroundColor: group.color || "#3b82f6" }}
                  />
                  <CardTitle className="text-base">{group.name}</CardTitle>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openEdit(group)}
                    data-testid={`btn-edit-group-${group.id}`}
                  >
                    <Edit className="h-3.5 w-3.5" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="sm" className="text-destructive" data-testid={`btn-delete-group-${group.id}`}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Zmazať skupinu?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Táto akcia je nevratná. Skupina "{group.name}" bude zmazaná. Existujúce úlohy nebudú ovplyvnené.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Zrušiť</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          onClick={() => deleteMutation.mutate(group.id)}
                        >
                          Zmazať
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardHeader>
              <CardContent>
                {group.description && (
                  <p className="text-sm text-muted-foreground mb-3">{group.description}</p>
                )}
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground font-medium mb-2 flex items-center gap-1">
                    <UserPlus className="h-3 w-3" />
                    Členovia ({group.members.length})
                  </p>
                  {group.members.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">Žiadni členovia</p>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {group.members.map(m => (
                        <div key={m.userId} className="flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs">
                          <Avatar className="h-4 w-4">
                            <AvatarImage src={m.avatarUrl || undefined} className="object-cover" />
                            <AvatarFallback className="text-[6px] bg-primary text-primary-foreground">
                              {m.fullName.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span>{m.fullName}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={open => { if (!open) { setDialogOpen(false); setEditGroup(null); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editGroup ? "Upraviť skupinu" : "Nová skupina úloh"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="group-name" className="text-sm font-medium">Názov skupiny *</Label>
              <Input
                id="group-name"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="napr. Back Office SK, Koordinátori, Medici..."
                className="mt-1"
                data-testid="input-group-name"
              />
            </div>
            <div>
              <Label htmlFor="group-desc" className="text-sm font-medium">Popis (voliteľný)</Label>
              <Textarea
                id="group-desc"
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Účel skupiny, kto ju používa..."
                className="mt-1 resize-none min-h-[60px]"
                data-testid="input-group-description"
              />
            </div>
            <div>
              <Label className="text-sm font-medium">Farba</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {GROUP_COLORS.map(color => (
                  <button
                    key={color}
                    type="button"
                    className={`h-6 w-6 rounded-full border-2 transition-all ${form.color === color ? "border-foreground scale-110" : "border-transparent"}`}
                    style={{ backgroundColor: color }}
                    onClick={() => setForm(f => ({ ...f, color }))}
                    data-testid={`color-${color}`}
                  />
                ))}
              </div>
            </div>
            <div>
              <Label className="text-sm font-medium mb-2 block">Členovia skupiny</Label>
              <ScrollArea className="h-48 rounded-md border p-2">
                <div className="space-y-1">
                  {users.map((u) => (
                    <div
                      key={u.id}
                      className="flex items-center gap-2 p-1.5 rounded hover:bg-muted cursor-pointer"
                      onClick={() => toggleMember(u.id)}
                      data-testid={`member-toggle-${u.id}`}
                    >
                      <Checkbox
                        checked={form.memberUserIds.includes(u.id)}
                        onCheckedChange={() => toggleMember(u.id)}
                      />
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={u.avatarUrl || undefined} className="object-cover" />
                        <AvatarFallback className="text-[8px] bg-primary text-primary-foreground">
                          {(u.fullName || u.username).split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm">{u.fullName || u.username}</span>
                      {u.role && <Badge variant="secondary" className="text-[10px] py-0">{u.role}</Badge>}
                    </div>
                  ))}
                </div>
              </ScrollArea>
              {form.memberUserIds.length > 0 && (
                <p className="text-xs text-muted-foreground mt-1">{form.memberUserIds.length} člen(ov) vybratých</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Zrušiť</Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={!form.name || saveMutation.isPending}
              data-testid="btn-save-group"
            >
              {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editGroup ? "Uložiť zmeny" : "Vytvoriť skupinu"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
