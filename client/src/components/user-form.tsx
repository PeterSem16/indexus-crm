import { useEffect, useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Phone, User, Shield, MapPin, Camera, Loader2, Link2, RefreshCw, Mail, Star, Trash2, Plus, CheckCircle, XCircle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { COUNTRIES } from "@/lib/countries";
import { useI18n } from "@/i18n/I18nProvider";
import type { User as UserType, Role } from "@shared/schema";
import { useModuleFieldPermissions } from "@/components/ui/permission-field";

const createUserFormSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  email: z.string().email("Invalid email address"),
  fullName: z.string().min(2, "Full name is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(["admin", "manager", "user"]),
  roleId: z.string().optional(),
  isActive: z.boolean(),
  assignedCountries: z.array(z.string()).min(1, "At least one country must be assigned"),
  sipEnabled: z.boolean().optional(),
  sipExtension: z.string().optional(),
  sipPassword: z.string().optional(),
  sipDisplayName: z.string().optional(),
  authMethod: z.enum(["local", "ms365"]).optional(),
});

const updateUserFormSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  email: z.string().email("Invalid email address"),
  fullName: z.string().min(2, "Full name is required"),
  password: z.string().min(6, "Password must be at least 6 characters").optional().or(z.literal("")),
  role: z.enum(["admin", "manager", "user"]),
  roleId: z.string().optional(),
  isActive: z.boolean(),
  assignedCountries: z.array(z.string()).min(1, "At least one country must be assigned"),
  sipEnabled: z.boolean().optional(),
  sipExtension: z.string().optional(),
  sipPassword: z.string().optional(),
  sipDisplayName: z.string().optional(),
  authMethod: z.enum(["local", "ms365"]).optional(),
});

export type UserFormData = z.infer<typeof createUserFormSchema>;

interface UserFormProps {
  initialData?: UserType;
  onSubmit: (data: UserFormData) => void;
  isLoading?: boolean;
  onCancel: () => void;
}

export function UserForm({ initialData, onSubmit, isLoading, onCancel }: UserFormProps) {
  const { t } = useI18n();
  const { toast } = useToast();
  const { isHidden, isReadonly } = useModuleFieldPermissions("users");
  const isEditing = !!initialData;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>((initialData as any)?.avatarUrl || null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  
  const { data: roles = [], isLoading: rolesLoading } = useQuery<Role[]>({
    queryKey: ["/api/roles"],
  });
  
  interface JiraUser {
    accountId: string;
    displayName: string;
    emailAddress?: string;
    avatarUrls?: { "48x48"?: string };
  }
  
  const { data: jiraUsers = [], isLoading: jiraUsersLoading, refetch: refetchJiraUsers } = useQuery<JiraUser[]>({
    queryKey: ["/api/jira/users"],
  });
  
  const [selectedJiraUser, setSelectedJiraUser] = useState<string>((initialData as any)?.jiraAccountId || "");
  
  const activeRoles = roles.filter(r => r.isActive);
  const systemRolesWithLegacy = activeRoles.filter(r => (r as any).legacyRole);
  const hasSystemRoles = systemRolesWithLegacy.length > 0;
  
  const getLegacyRoleId = (legacyRoleValue: string): string => {
    if (!hasSystemRoles) return "";
    const matchingRole = activeRoles.find(r => (r as any).legacyRole === legacyRoleValue);
    return matchingRole?.id || "";
  };
  
  const form = useForm<UserFormData>({
    resolver: zodResolver(isEditing ? updateUserFormSchema : createUserFormSchema),
    defaultValues: {
      username: initialData?.username || "",
      email: initialData?.email || "",
      fullName: initialData?.fullName || "",
      password: "",
      role: (initialData?.role as any) || "user",
      roleId: (initialData as any)?.roleId || "",
      isActive: initialData?.isActive ?? true,
      assignedCountries: initialData?.assignedCountries || [],
      sipEnabled: (initialData as any)?.sipEnabled ?? false,
      sipExtension: (initialData as any)?.sipExtension || "",
      sipPassword: (initialData as any)?.sipPassword || "",
      authMethod: (initialData as any)?.authMethod || "local",
      sipDisplayName: (initialData as any)?.sipDisplayName || "",
    },
  });
  
  useEffect(() => {
    const currentRoleId = form.getValues("roleId");
    const legacyRole = initialData?.role;
    
    if (hasSystemRoles && !currentRoleId && legacyRole) {
      const mappedRoleId = getLegacyRoleId(legacyRole);
      if (mappedRoleId) {
        form.setValue("roleId", mappedRoleId);
      }
    }
  }, [hasSystemRoles, activeRoles, initialData?.role]);
  
  const handleFormSubmit = (data: UserFormData) => {
    const submitData = { ...data };
    if (isEditing && !data.password) {
      delete (submitData as any).password;
    }
    
    if (submitData.roleId && hasSystemRoles) {
      const selectedRole = activeRoles.find(r => r.id === submitData.roleId);
      if (selectedRole && (selectedRole as any).legacyRole) {
        submitData.role = (selectedRole as any).legacyRole as "admin" | "manager" | "user";
      } else {
        submitData.role = "user";
      }
    }
    
    if (selectedJiraUser) {
      const jiraUser = jiraUsers.find(j => j.accountId === selectedJiraUser);
      (submitData as any).jiraAccountId = selectedJiraUser;
      (submitData as any).jiraDisplayName = jiraUser?.displayName || null;
    } else {
      (submitData as any).jiraAccountId = null;
      (submitData as any).jiraDisplayName = null;
    }
    
    onSubmit(submitData);
  };

  const handleSelectAll = () => {
    form.setValue("assignedCountries", COUNTRIES.map(c => c.code));
  };

  const handleClearAll = () => {
    form.setValue("assignedCountries", []);
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!isEditing || !initialData?.id) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      return;
    }

    setIsUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append("avatar", file);
      
      const response = await fetch(`/api/users/${initialData.id}/avatar`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      
      if (!response.ok) {
        throw new Error("Failed to upload avatar");
      }
      
      const data = await response.json();
      setAvatarPreview(data.avatarUrl);
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({ title: "Avatar nahraný", description: "Profilový obrázok bol úspešne aktualizovaný" });
    } catch (error) {
      toast({ title: "Chyba", description: "Nepodarilo sa nahrať avatar", variant: "destructive" });
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map(n => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const renderProfileTab = () => (
    <div className="space-y-4">
      <div className="flex items-center gap-4 mb-4">
        <div className="relative">
          <Avatar className="h-20 w-20">
            <AvatarImage src={avatarPreview || undefined} className="object-cover" />
            <AvatarFallback className="text-lg">
              {getInitials(form.watch("fullName") || "U")}
            </AvatarFallback>
          </Avatar>
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploadingAvatar}
            data-testid="button-upload-avatar"
          >
            {isUploadingAvatar ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Camera className="h-3 w-3" />
            )}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            className="hidden"
            onChange={handleAvatarChange}
            data-testid="input-avatar"
          />
        </div>
        <div>
          <p className="text-sm font-medium">Profilový obrázok</p>
          <p className="text-xs text-muted-foreground">
            Kliknite na ikonu fotoaparátu pre nahratie obrázka
          </p>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {!isHidden("full_name") && (
          <FormField
            control={form.control}
            name="fullName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t.users.fullName}</FormLabel>
                <FormControl>
                  <Input 
                    placeholder={t.users.fullName} 
                    {...field} 
                    data-testid="input-fullname"
                    disabled={isReadonly("full_name")}
                    className={isReadonly("full_name") ? "bg-muted" : ""}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {!isHidden("username") && (
          <FormField
            control={form.control}
            name="username"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t.users.username}</FormLabel>
                <FormControl>
                  <Input 
                    placeholder={t.users.username} 
                    {...field} 
                    data-testid="input-username"
                    disabled={isReadonly("username")}
                    className={isReadonly("username") ? "bg-muted" : ""}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {!isHidden("email") && (
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t.common.email}</FormLabel>
                <FormControl>
                  <Input 
                    type="email" 
                    placeholder={t.common.email} 
                    {...field} 
                    data-testid="input-email"
                    disabled={isReadonly("email")}
                    className={isReadonly("email") ? "bg-muted" : ""}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {!isHidden("password") && (
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{isEditing ? t.users.newPassword : t.users.password}</FormLabel>
                <FormControl>
                  <Input 
                    type="password" 
                    placeholder={isEditing ? t.users.leaveEmptyPassword : t.users.enterPassword} 
                    {...field} 
                    data-testid="input-password"
                    disabled={isReadonly("password")}
                    className={isReadonly("password") ? "bg-muted" : ""}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
      </div>
    </div>
  );

  const renderAccessTab = () => (
    <div className="space-y-4">
      {!isHidden("role") && (
        rolesLoading ? (
          <FormItem>
            <FormLabel>{t.users.role}</FormLabel>
            <div className="h-9 flex items-center text-sm text-muted-foreground">
              {t.common.loading}...
            </div>
          </FormItem>
        ) : hasSystemRoles ? (
          <FormField
            control={form.control}
            name="roleId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t.users.role}</FormLabel>
                <Select 
                  onValueChange={field.onChange} 
                  value={field.value || ""}
                  key={`role-select-${field.value}`}
                  disabled={isReadonly("role")}
                >
                  <FormControl>
                    <SelectTrigger data-testid="select-role" className={isReadonly("role") ? "bg-muted" : ""}>
                      <SelectValue placeholder={t.users.selectRole} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {activeRoles.map((role) => (
                      <SelectItem key={role.id} value={role.id}>
                        {role.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        ) : (
          <FormField
            control={form.control}
            name="role"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t.users.role}</FormLabel>
                <Select 
                  onValueChange={field.onChange} 
                  defaultValue={field.value}
                  disabled={isReadonly("role")}
                >
                  <FormControl>
                    <SelectTrigger data-testid="select-role" className={isReadonly("role") ? "bg-muted" : ""}>
                      <SelectValue placeholder={t.users.selectRole} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="admin">{t.users.roles.admin}</SelectItem>
                    <SelectItem value="manager">{t.users.roles.manager}</SelectItem>
                    <SelectItem value="user">{t.users.roles.user}</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        )
      )}

      {!isHidden("is_active") && (
        <FormField
          control={form.control}
          name="isActive"
          render={({ field }) => (
            <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  data-testid="checkbox-active"
                  disabled={isReadonly("is_active")}
                />
              </FormControl>
              <div className="space-y-1 leading-none">
                <FormLabel>{t.users.activeAccount}</FormLabel>
                <FormDescription>
                  {t.users.activeAccountHint}
                </FormDescription>
              </div>
            </FormItem>
          )}
        />
      )}

      {/* Authentication Method Selection */}
      <FormField
        control={form.control}
        name="authMethod"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Spôsob prihlásenia</FormLabel>
            <Select 
              onValueChange={field.onChange} 
              value={field.value || "local"}
            >
              <FormControl>
                <SelectTrigger data-testid="select-auth-method">
                  <SelectValue placeholder="Vyberte spôsob prihlásenia" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="local">Lokálne (meno a heslo)</SelectItem>
                <SelectItem value="ms365">Microsoft 365</SelectItem>
              </SelectContent>
            </Select>
            <FormDescription>
              Pri Microsoft 365 sa používateľ prihlasuje cez svoje firemné Microsoft konto.
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );

  const renderCountriesTab = () => (
    <div className="space-y-4">
      {!isHidden("assigned_countries") && (
        <FormField
          control={form.control}
          name="assignedCountries"
          render={() => (
            <FormItem>
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <FormLabel className="text-base">{t.users.assignedCountries}</FormLabel>
                <div className="flex gap-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm"
                    onClick={handleSelectAll}
                    data-testid="button-select-all"
                    disabled={isReadonly("assigned_countries")}
                  >
                    {t.users.selectAll}
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm"
                    onClick={handleClearAll}
                    data-testid="button-clear-all"
                    disabled={isReadonly("assigned_countries")}
                  >
                    {t.users.clearAll}
                  </Button>
                </div>
              </div>
              <FormDescription className="mb-4">
                {t.users.selectCountriesHint}
              </FormDescription>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {COUNTRIES.map((country) => (
                  <FormField
                    key={country.code}
                    control={form.control}
                    name="assignedCountries"
                    render={({ field }) => {
                      return (
                        <FormItem
                          key={country.code}
                          className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-3 hover-elevate"
                        >
                          <FormControl>
                            <Checkbox
                              checked={field.value?.includes(country.code)}
                              onCheckedChange={(checked) => {
                                return checked
                                  ? field.onChange([...field.value, country.code])
                                  : field.onChange(
                                      field.value?.filter(
                                        (value) => value !== country.code
                                      )
                                    );
                              }}
                              data-testid={`checkbox-country-${country.code}`}
                              disabled={isReadonly("assigned_countries")}
                            />
                          </FormControl>
                          <FormLabel className="flex items-center gap-2 font-normal cursor-pointer">
                            <span className="text-lg">{country.flag}</span>
                            <span>{country.name}</span>
                          </FormLabel>
                        </FormItem>
                      );
                    }}
                  />
                ))}
              </div>
              <FormMessage />
            </FormItem>
          )}
        />
      )}
    </div>
  );

  const renderSipTab = () => (
    <div className="space-y-4">
      <FormField
        control={form.control}
        name="sipEnabled"
        render={({ field }) => (
          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <FormLabel className="text-base">Povoliť SIP telefón</FormLabel>
              <FormDescription>
                Aktivovať možnosť telefonovania pre tohto používateľa
              </FormDescription>
            </div>
            <FormControl>
              <Switch
                checked={field.value}
                onCheckedChange={field.onChange}
                data-testid="switch-sip-enabled"
              />
            </FormControl>
          </FormItem>
        )}
      />

      {form.watch("sipEnabled") && (
        <div className="grid gap-4 sm:grid-cols-2 pl-4 border-l-2 border-primary/20">
          <FormField
            control={form.control}
            name="sipExtension"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Linka (Extension)</FormLabel>
                <FormControl>
                  <Input 
                    placeholder="1001" 
                    {...field}
                    data-testid="input-sip-extension"
                  />
                </FormControl>
                <FormDescription>
                  Číslo linky pridelené v Asterisk PBX
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="sipPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Heslo</FormLabel>
                <FormControl>
                  <Input 
                    type="password"
                    placeholder="••••••••" 
                    {...field}
                    data-testid="input-sip-password"
                  />
                </FormControl>
                <FormDescription>
                  Heslo pre autentifikáciu SIP linky
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="sipDisplayName"
            render={({ field }) => (
              <FormItem className="sm:col-span-2">
                <FormLabel>Zobrazované meno (voliteľné)</FormLabel>
                <FormControl>
                  <Input 
                    placeholder="Meno zobrazené pri hovore" 
                    {...field}
                    data-testid="input-sip-display-name"
                  />
                </FormControl>
                <FormDescription>
                  Meno ktoré sa zobrazí volanému
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      )}
    </div>
  );

  // MS365 Connection state and queries
  const userId = initialData?.id;
  
  const { data: ms365Connection, isLoading: ms365Loading, refetch: refetchMs365Connection } = useQuery<{
    id: string;
    email: string;
    displayName: string | null;
    isConnected: boolean;
    lastSyncAt: string | null;
    hasTokens: boolean;
  } | null>({
    queryKey: ["/api/users", userId, "ms365-connection"],
    queryFn: async () => {
      if (!userId) return null;
      const res = await fetch(`/api/users/${userId}/ms365-connection`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
    enabled: !!userId,
  });
  
  const { data: ms365Mailboxes = [], refetch: refetchMailboxes } = useQuery<{
    id: string;
    email: string;
    displayName: string;
    isDefault: boolean;
    isActive: boolean;
  }[]>({
    queryKey: ["/api/users", userId, "ms365-shared-mailboxes"],
    queryFn: async () => {
      if (!userId) return [];
      const res = await fetch(`/api/users/${userId}/ms365-shared-mailboxes`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
    enabled: !!userId,
  });
  
  const [newMailboxEmail, setNewMailboxEmail] = useState("");
  const [newMailboxName, setNewMailboxName] = useState("");
  const [isAddingMailbox, setIsAddingMailbox] = useState(false);
  
  const connectMs365Mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/users/${userId}/ms365-connection`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to save connection');
      return res.json();
    },
    onSuccess: () => {
      refetchMs365Connection();
      toast({ title: "MS365 pripojenie uložené" });
    },
    onError: () => {
      toast({ title: "Chyba pri ukladaní pripojenia", variant: "destructive" });
    },
  });
  
  const disconnectMs365Mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/users/${userId}/ms365-connection`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to disconnect');
      return res.json();
    },
    onSuccess: () => {
      refetchMs365Connection();
      refetchMailboxes();
      toast({ title: "MS365 odpojené" });
    },
    onError: () => {
      toast({ title: "Chyba pri odpájaní", variant: "destructive" });
    },
  });
  
  const addMailboxMutation = useMutation({
    mutationFn: async ({ email, displayName }: { email: string; displayName: string }) => {
      const res = await fetch(`/api/users/${userId}/ms365-shared-mailboxes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, displayName, isDefault: ms365Mailboxes.length === 0 }),
      });
      if (!res.ok) throw new Error('Failed to add mailbox');
      return res.json();
    },
    onSuccess: () => {
      refetchMailboxes();
      setNewMailboxEmail("");
      setNewMailboxName("");
      setIsAddingMailbox(false);
      toast({ title: "Shared mailbox pridaný" });
    },
    onError: () => {
      toast({ title: "Chyba pri pridávaní mailboxu", variant: "destructive" });
    },
  });
  
  const deleteMailboxMutation = useMutation({
    mutationFn: async (mailboxId: string) => {
      const res = await fetch(`/api/users/${userId}/ms365-shared-mailboxes/${mailboxId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to delete mailbox');
      return res.json();
    },
    onSuccess: () => {
      refetchMailboxes();
      toast({ title: "Shared mailbox odstránený" });
    },
    onError: () => {
      toast({ title: "Chyba pri odstraňovaní mailboxu", variant: "destructive" });
    },
  });
  
  const setDefaultMailboxMutation = useMutation({
    mutationFn: async (mailboxId: string) => {
      const res = await fetch(`/api/users/${userId}/ms365-shared-mailboxes/${mailboxId}/set-default`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to set default');
      return res.json();
    },
    onSuccess: () => {
      refetchMailboxes();
      toast({ title: "Predvolený mailbox nastavený" });
    },
    onError: () => {
      toast({ title: "Chyba pri nastavovaní predvoleného mailboxu", variant: "destructive" });
    },
  });
  
  const handleConnectMs365 = async () => {
    // First authenticate with MS365
    const res = await fetch('/api/auth/microsoft', { credentials: 'include' });
    if (res.ok) {
      const data = await res.json();
      if (data.authUrl) {
        window.location.href = data.authUrl;
      }
    }
  };
  
  const renderMs365Tab = () => {
    if (!isEditing) {
      return (
        <div className="p-4 rounded-md bg-muted text-center">
          <p className="text-sm text-muted-foreground">
            MS365 pripojenie je dostupné až po vytvorení používateľa.
          </p>
        </div>
      );
    }
    
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2 text-muted-foreground mb-4">
          <Mail className="h-4 w-4" />
          <span className="text-sm">Pripojenie Microsoft 365 účtu pre email a kalendár</span>
        </div>
        
        {ms365Loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Načítavanie...
          </div>
        ) : ms365Connection?.isConnected ? (
          <div className="space-y-4">
            <div className="p-4 rounded-lg border bg-green-50 dark:bg-green-900/20">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                  <div>
                    <p className="font-medium text-green-700 dark:text-green-300">Pripojené</p>
                    <p className="text-sm text-green-600 dark:text-green-400">{ms365Connection.email}</p>
                    {ms365Connection.displayName && (
                      <p className="text-xs text-green-600/70 dark:text-green-400/70">{ms365Connection.displayName}</p>
                    )}
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => disconnectMs365Mutation.mutate()}
                  disabled={disconnectMs365Mutation.isPending}
                  data-testid="button-disconnect-ms365"
                >
                  {disconnectMs365Mutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <XCircle className="h-4 w-4 mr-1" />
                  )}
                  Odpojiť
                </Button>
              </div>
            </div>
            
            <div className="border-t pt-4">
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <h4 className="font-medium">Shared Mailboxy</h4>
                {!isAddingMailbox && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsAddingMailbox(true)}
                    data-testid="button-add-mailbox"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Pridať
                  </Button>
                )}
              </div>
              
              <p className="text-sm text-muted-foreground mb-3">
                Pridajte shared mailboxy, z ktorých môžete odosielať emaily. Predvolený mailbox sa použije ako prvý pri odosielaní.
              </p>
              
              {isAddingMailbox && (
                <div className="p-3 border rounded-md mb-3 space-y-3">
                  <Input
                    placeholder="Email (napr. info@firma.sk)"
                    value={newMailboxEmail}
                    onChange={(e) => setNewMailboxEmail(e.target.value)}
                    data-testid="input-new-mailbox-email"
                  />
                  <Input
                    placeholder="Názov (napr. Info box)"
                    value={newMailboxName}
                    onChange={(e) => setNewMailboxName(e.target.value)}
                    data-testid="input-new-mailbox-name"
                  />
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => addMailboxMutation.mutate({ email: newMailboxEmail, displayName: newMailboxName })}
                      disabled={!newMailboxEmail || !newMailboxName || addMailboxMutation.isPending}
                      data-testid="button-save-mailbox"
                    >
                      {addMailboxMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Uložiť"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setIsAddingMailbox(false);
                        setNewMailboxEmail("");
                        setNewMailboxName("");
                      }}
                      data-testid="button-cancel-mailbox"
                    >
                      Zrušiť
                    </Button>
                  </div>
                </div>
              )}
              
              {ms365Mailboxes.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">Žiadne shared mailboxy</p>
              ) : (
                <div className="space-y-2">
                  {ms365Mailboxes.map((mailbox) => (
                    <div
                      key={mailbox.id}
                      className="flex items-center justify-between p-3 border rounded-md"
                    >
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="font-medium text-sm">{mailbox.displayName}</p>
                          <p className="text-xs text-muted-foreground">{mailbox.email}</p>
                        </div>
                        {mailbox.isDefault && (
                          <Badge variant="secondary" className="ml-2">
                            <Star className="h-3 w-3 mr-1" />
                            Predvolený
                          </Badge>
                        )}
                      </div>
                      <div className="flex gap-1">
                        {!mailbox.isDefault && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => setDefaultMailboxMutation.mutate(mailbox.id)}
                            disabled={setDefaultMailboxMutation.isPending}
                            title="Nastaviť ako predvolený"
                            data-testid={`button-set-default-${mailbox.id}`}
                          >
                            <Star className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteMailboxMutation.mutate(mailbox.id)}
                          disabled={deleteMailboxMutation.isPending}
                          title="Odstrániť"
                          data-testid={`button-delete-mailbox-${mailbox.id}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-md bg-muted space-y-3">
            <div className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-muted-foreground" />
              <p className="font-medium">Nepripojené</p>
            </div>
            <p className="text-sm text-muted-foreground">
              Pre pripojenie Microsoft 365 účtu najprv vykonajte autentifikáciu na stránke MS365 Integrácia a potom sa vráťte sem.
            </p>
            <Button
              type="button"
              onClick={handleConnectMs365}
              data-testid="button-connect-ms365"
            >
              <Mail className="h-4 w-4 mr-2" />
              Pripojiť Microsoft 365
            </Button>
          </div>
        )}
      </div>
    );
  };

  const renderJiraTab = () => (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-muted-foreground mb-4">
        <Link2 className="h-4 w-4" />
        <span className="text-sm">Prepojenie Jira účtu umožní synchronizáciu úloh s Jirou</span>
      </div>
      
      {jiraUsersLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Načítavanie Jira používateľov...
        </div>
      ) : jiraUsers.length === 0 ? (
        <div className="p-4 rounded-md bg-muted space-y-3">
          <p className="text-sm text-muted-foreground">
            Nepodarilo sa načítať Jira používateľov. Toto môže byť spôsobené:
          </p>
          <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
            <li>Vypršaním prístupového tokenu (vyžaduje opätovné pripojenie)</li>
            <li>Chýbajúcimi oprávneniami v Jira</li>
            <li>Neaktívnou Jira integráciou</li>
          </ul>
          <Button 
            type="button"
            variant="outline"
            size="sm"
            onClick={() => refetchJiraUsers()}
            data-testid="button-refresh-jira"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Skúsiť znova
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <FormLabel>Jira účet</FormLabel>
            <Select 
              value={selectedJiraUser} 
              onValueChange={setSelectedJiraUser}
            >
              <SelectTrigger data-testid="select-jira-user">
                <SelectValue placeholder="Vyberte Jira používateľa" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Žiadny</SelectItem>
                {jiraUsers.map((jUser) => (
                  <SelectItem key={jUser.accountId} value={jUser.accountId}>
                    <div className="flex items-center gap-2">
                      {jUser.avatarUrls?.["48x48"] && (
                        <img 
                          src={jUser.avatarUrls["48x48"]} 
                          alt="" 
                          className="h-5 w-5 rounded-full"
                        />
                      )}
                      <span>{jUser.displayName}</span>
                      {jUser.emailAddress && (
                        <span className="text-muted-foreground text-xs">({jUser.emailAddress})</span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              Po prepojení budú úlohy pridelené tomuto používateľovi automaticky synchronizované s jeho Jira účtom
            </p>
          </div>
          
          {selectedJiraUser && (
            <div className="p-3 rounded-md bg-green-50 dark:bg-green-900/20 text-sm">
              <div className="flex items-center gap-2">
                <Link2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                <span className="text-green-700 dark:text-green-300">
                  Prepojené s Jira účtom: {jiraUsers.find(j => j.accountId === selectedJiraUser)?.displayName}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-6">
        <Tabs defaultValue="profile" className="w-full">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="profile" className="flex items-center gap-2" data-testid="tab-profile">
              <User className="h-4 w-4" />
              <span className="hidden sm:inline">Profil</span>
            </TabsTrigger>
            <TabsTrigger value="access" className="flex items-center gap-2" data-testid="tab-access">
              <Shield className="h-4 w-4" />
              <span className="hidden sm:inline">Prístupy</span>
            </TabsTrigger>
            <TabsTrigger value="countries" className="flex items-center gap-2" data-testid="tab-countries">
              <MapPin className="h-4 w-4" />
              <span className="hidden sm:inline">Krajiny</span>
            </TabsTrigger>
            <TabsTrigger value="sip" className="flex items-center gap-2" data-testid="tab-sip">
              <Phone className="h-4 w-4" />
              <span className="hidden sm:inline">SIP</span>
            </TabsTrigger>
            <TabsTrigger value="ms365" className="flex items-center gap-2" data-testid="tab-ms365">
              <Mail className="h-4 w-4" />
              <span className="hidden sm:inline">MS365</span>
            </TabsTrigger>
            <TabsTrigger value="jira" className="flex items-center gap-2" data-testid="tab-jira">
              <Link2 className="h-4 w-4" />
              <span className="hidden sm:inline">Jira</span>
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="profile" className="mt-6">
            {renderProfileTab()}
          </TabsContent>
          
          <TabsContent value="access" className="mt-6">
            {renderAccessTab()}
          </TabsContent>
          
          <TabsContent value="countries" className="mt-6">
            {renderCountriesTab()}
          </TabsContent>
          
          <TabsContent value="sip" className="mt-6">
            {renderSipTab()}
          </TabsContent>
          
          <TabsContent value="ms365" className="mt-6">
            {renderMs365Tab()}
          </TabsContent>
          
          <TabsContent value="jira" className="mt-6">
            {renderJiraTab()}
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button 
            type="button" 
            variant="outline" 
            onClick={onCancel}
            data-testid="button-cancel"
          >
            {t.common.cancel}
          </Button>
          <Button 
            type="submit" 
            disabled={isLoading}
            data-testid="button-submit"
          >
            {isLoading ? t.users.saving : initialData ? t.users.updateUser : t.users.createUser}
          </Button>
        </div>
      </form>
    </Form>
  );
}
