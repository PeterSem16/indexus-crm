import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, UserCheck, UserX, Search, Filter } from "lucide-react";
import { useI18n } from "@/i18n";
import { usePermissions } from "@/contexts/permissions-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { DataTable } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { CountryBadges } from "@/components/country-filter";
import { UserForm, type UserFormData } from "@/components/user-form";
import { UserFormWizard } from "@/components/user-form-wizard";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { User } from "@shared/schema";

export default function UsersPage() {
  const { toast } = useToast();
  const { t } = useI18n();
  const { canAdd, canEdit } = usePermissions();
  const [search, setSearch] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);

  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const updateMutation = useMutation({
    mutationFn: (data: UserFormData & { id: string }) => 
      apiRequest("PATCH", `/api/users/${data.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setEditingUser(null);
      toast({ title: t.success.updated });
    },
    onError: () => {
      toast({ title: t.errors.saveFailed, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/users/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setDeletingUser(null);
      toast({ title: t.success.deleted });
    },
    onError: () => {
      toast({ title: t.errors.deleteFailed, variant: "destructive" });
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      apiRequest("PATCH", `/api/users/${id}`, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: t.success.updated });
    },
    onError: () => {
      toast({ title: t.errors.saveFailed, variant: "destructive" });
    },
  });

  const filteredUsers = users.filter(user => 
    user.fullName.toLowerCase().includes(search.toLowerCase()) ||
    user.email.toLowerCase().includes(search.toLowerCase()) ||
    user.username.toLowerCase().includes(search.toLowerCase())
  );

  const columns = [
    {
      key: "user",
      header: t.users.userColumn,
      cell: (user: User) => (
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground font-medium">
            {user.fullName.split(" ").map(n => n[0]).join("").slice(0, 2)}
          </div>
          <div>
            <p className="font-medium">{user.fullName}</p>
            <p className="text-sm text-muted-foreground">{user.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: "username",
      header: t.users.username,
      cell: (user: User) => (
        <span className="text-sm font-mono bg-muted px-2 py-1 rounded">
          @{user.username}
        </span>
      ),
    },
    {
      key: "role",
      header: t.users.role,
      cell: (user: User) => {
        const roleLabel = user.role === "admin" 
          ? t.users.roles.admin 
          : user.role === "manager" 
            ? t.users.roles.manager 
            : t.users.roles.user;
        return (
          <Badge variant={user.role === "admin" ? "default" : "secondary"} className="capitalize">
            {roleLabel}
          </Badge>
        );
      },
    },
    {
      key: "countries",
      header: t.users.countriesColumn,
      cell: (user: User) => (
        <CountryBadges countries={user.assignedCountries || []} max={4} />
      ),
    },
    {
      key: "status",
      header: t.users.statusColumn,
      cell: (user: User) => (
        <StatusBadge status={user.isActive ? "active" : "inactive"} />
      ),
    },
    {
      key: "actions",
      header: "",
      className: "text-right",
      cell: (user: User) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              toggleStatusMutation.mutate({ 
                id: user.id, 
                isActive: !user.isActive 
              });
            }}
            data-testid={`button-toggle-status-${user.id}`}
          >
            {user.isActive ? (
              <UserX className="h-4 w-4" />
            ) : (
              <UserCheck className="h-4 w-4" />
            )}
          </Button>
          {canEdit("users") && (
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                setEditingUser(user);
              }}
              data-testid={`button-edit-user-${user.id}`}
            >
              <Pencil className="h-4 w-4" />
            </Button>
          )}
          {canEdit("users") && (
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                setDeletingUser(user);
              }}
              data-testid={`button-delete-user-${user.id}`}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader 
        title={t.users.title}
        description={t.users.description}
      >
        {canAdd("users") && (
          <Button onClick={() => setIsFormOpen(true)} data-testid="button-add-user">
            <Plus className="h-4 w-4 mr-2" />
            {t.users.addUser}
          </Button>
        )}
      </PageHeader>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t.users.searchPlaceholder}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
                data-testid="input-search-users"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <DataTable
        columns={columns}
        data={filteredUsers}
        isLoading={isLoading}
        emptyMessage={t.users.noUsers}
        getRowKey={(u) => u.id}
      />

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t.users.addNewUser}</DialogTitle>
            <DialogDescription>
              {t.users.description}
            </DialogDescription>
          </DialogHeader>
          <UserFormWizard
            onSuccess={() => setIsFormOpen(false)}
            onCancel={() => setIsFormOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingUser} onOpenChange={() => setEditingUser(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t.users.editUser}</DialogTitle>
            <DialogDescription>
              {t.users.updateUserInfo}
            </DialogDescription>
          </DialogHeader>
          {editingUser && (
            <UserForm
              initialData={editingUser}
              onSubmit={(data) => updateMutation.mutate({ ...data, id: editingUser.id })}
              isLoading={updateMutation.isPending}
              onCancel={() => setEditingUser(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingUser} onOpenChange={() => setDeletingUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.users.deleteUser}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.users.deleteConfirm}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">{t.common.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingUser && deleteMutation.mutate(deletingUser.id)}
              className="bg-destructive text-destructive-foreground"
              data-testid="button-confirm-delete"
            >
              {t.common.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
