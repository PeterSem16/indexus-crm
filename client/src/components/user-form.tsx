import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Phone, User, Shield, MapPin } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  const { isHidden, isReadonly } = useModuleFieldPermissions("users");
  const isEditing = !!initialData;
  
  const { data: roles = [], isLoading: rolesLoading } = useQuery<Role[]>({
    queryKey: ["/api/roles"],
  });
  
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
    
    onSubmit(submitData);
  };

  const handleSelectAll = () => {
    form.setValue("assignedCountries", COUNTRIES.map(c => c.code));
  };

  const handleClearAll = () => {
    form.setValue("assignedCountries", []);
  };

  const renderProfileTab = () => (
    <div className="space-y-4">
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

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-6">
        <Tabs defaultValue="profile" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
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
