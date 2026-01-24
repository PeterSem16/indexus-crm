import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Phone, PhoneOff, Save, Loader2, Settings, User, Mail, Shield, PhoneCall, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { useSip } from "@/contexts/sip-context";
import { useI18n } from "@/i18n";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface SipSettingsData {
  server?: string;
  port?: number;
  transport?: string;
  isEnabled?: boolean;
}

interface UserSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UserSettingsDialog({ open, onOpenChange }: UserSettingsDialogProps) {
  const { t } = useI18n();
  const { user } = useAuth();
  const showSipPhone = (user as any)?.showSipPhone;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            {t.settings.tabs.profile}
          </DialogTitle>
          <DialogDescription>
            {t.settings.userDescription}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="sip" className="mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="general" data-testid="tab-user-general">
              {t.common.detail}
            </TabsTrigger>
            <TabsTrigger value="sip" data-testid="tab-user-sip">
              {t.settings.sipProfile.title}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="mt-4">
            <GeneralTab />
          </TabsContent>

          <TabsContent value="sip" className="mt-4">
            <UserSipProfileTab showSipPhone={showSipPhone} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function GeneralTab() {
  const { t } = useI18n();
  const { user } = useAuth();

  const roleLabels: Record<string, string> = {
    admin: (t.users.roles as any)?.admin || "Administrator",
    manager: (t.users.roles as any)?.manager || "Manager",
    user: (t.users.roles as any)?.user || "User",
    agent: (t.users.roles as any)?.agent || "Agent",
    collaborator: (t.users.roles as any)?.collaborator || "Collaborator",
  };

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <User className="h-6 w-6 text-primary" />
          </div>
          <div>
            <CardTitle className="text-lg">{user?.fullName || "-"}</CardTitle>
            <CardDescription>{t.settings.userDescription}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
          <div className="flex items-center gap-3">
            <User className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">{t.users.fullName}</p>
              <p className="text-sm font-medium truncate" data-testid="text-user-name">{user?.fullName || "-"}</p>
            </div>
          </div>
          <Separator />
          <div className="flex items-center gap-3">
            <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">{t.common.email}</p>
              <p className="text-sm font-medium truncate" data-testid="text-user-email">{user?.email || "-"}</p>
            </div>
          </div>
          <Separator />
          <div className="flex items-center gap-3">
            <PhoneCall className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">{t.common.phone || "Phone"}</p>
              <p className="text-sm font-medium truncate" data-testid="text-user-phone">{(user as any)?.phone || "-"}</p>
            </div>
          </div>
          <Separator />
          <div className="flex items-center gap-3">
            <Shield className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">{t.users.role}</p>
              <Badge variant="secondary" className="mt-0.5" data-testid="badge-user-role">
                {roleLabels[user?.role || ""] || user?.role || "-"}
              </Badge>
            </div>
          </div>
        </div>
        <p className="text-xs text-muted-foreground text-center">
          {t.settings.contactAdminToChange || "Contact administrator to change these settings"}
        </p>
      </CardContent>
    </Card>
  );
}

function UserSipProfileTab({ showSipPhone }: { showSipPhone?: boolean }) {
  const { t } = useI18n();
  const { toast } = useToast();
  const { user } = useAuth();
  const sipContext = useSip();
  const isRegistered = sipContext?.isRegistered ?? false;
  const isRegistering = sipContext?.isRegistering ?? false;
  const registrationError = sipContext?.registrationError ?? null;
  const register = sipContext?.register ?? (async () => {});
  const unregister = sipContext?.unregister ?? (async () => {});
  
  const [sipExtension, setSipExtension] = useState("");
  const [sipPassword, setSipPassword] = useState("");
  const [sipDisplayName, setSipDisplayName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [localRegistering, setLocalRegistering] = useState(false);
  const registerTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const { data: sipSettings } = useQuery<SipSettingsData | null>({
    queryKey: ["/api/sip-settings"],
    retry: false,
  });

  useEffect(() => {
    if (user) {
      setSipExtension((user as any).sipExtension || "");
      setSipPassword((user as any).sipPassword || "");
      setSipDisplayName((user as any).sipDisplayName || user.fullName || "");
    }
  }, [user]);

  useEffect(() => {
    if (isRegistered || registrationError) {
      setLocalRegistering(false);
      if (registerTimeoutRef.current) {
        clearTimeout(registerTimeoutRef.current);
        registerTimeoutRef.current = null;
      }
    }
  }, [isRegistered, registrationError]);

  useEffect(() => {
    return () => {
      if (registerTimeoutRef.current) {
        clearTimeout(registerTimeoutRef.current);
      }
    };
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await apiRequest("PATCH", "/api/users/me/sip-profile", {
        sipExtension,
        sipPassword,
        sipDisplayName,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({ title: t.settings.sipProfile.saved });
    } catch (error: any) {
      toast({ 
        title: t.settings.sipProfile.saveFailed, 
        description: error.message,
        variant: "destructive" 
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRegister = async () => {
    if (!sipSettings?.server || !sipExtension || !sipPassword) {
      toast({ 
        title: t.settings.sipProfile.missingConfig,
        variant: "destructive" 
      });
      return;
    }
    setLocalRegistering(true);
    registerTimeoutRef.current = setTimeout(() => {
      setLocalRegistering(false);
      toast({ 
        title: t.settings.sipProfile.registrationTimeout || "Registration timeout",
        description: t.settings.sipProfile.registrationTimeoutDesc || "Could not connect to SIP server",
        variant: "destructive" 
      });
    }, 15000);
    try {
      await register();
    } catch (error: any) {
      setLocalRegistering(false);
      toast({ 
        title: t.settings.sipProfile.error || "Error",
        description: error.message,
        variant: "destructive" 
      });
    }
  };

  const handleUnregister = async () => {
    try {
      await unregister();
      toast({ title: t.settings.sipProfile.unregistered || "SIP Unregistered" });
    } catch (error: any) {
      toast({ 
        title: t.settings.sipProfile.error || "Error",
        description: error.message,
        variant: "destructive" 
      });
    }
  };

  const handleCancelRegistration = async () => {
    setLocalRegistering(false);
    if (registerTimeoutRef.current) {
      clearTimeout(registerTimeoutRef.current);
      registerTimeoutRef.current = null;
    }
    try {
      await unregister();
    } catch (e) {
      // ignore
    }
    toast({ title: t.settings.sipProfile.registrationCancelled || "Registration cancelled" });
  };

  const showSpinner = localRegistering || isRegistering;
  const isGlobalSipEnabled = sipSettings?.isEnabled;

  if (!showSipPhone) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
              <Phone className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <CardTitle className="text-base">{t.settings.sipProfile.title}</CardTitle>
              <CardDescription>{"SIP phone is not enabled for your account"}</CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-row items-center gap-4 flex-wrap">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Phone className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <CardTitle className="text-base">{t.settings.sipProfile.title}</CardTitle>
              <CardDescription className="text-sm">
                {t.settings.sipProfile.description}
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-3">
            <span className="text-sm text-muted-foreground">{t.common.status}:</span>
            {isRegistered ? (
              <Badge variant="default" className="bg-green-600" data-testid="badge-sip-registered">
                <CheckCircle className="h-3 w-3 mr-1" />
                {t.settings.sipProfile.registered}
              </Badge>
            ) : registrationError ? (
              <Badge variant="destructive" data-testid="badge-sip-error">
                <XCircle className="h-3 w-3 mr-1" />
                {t.settings.sipProfile.error || "Error"}
              </Badge>
            ) : showSpinner ? (
              <Badge variant="secondary" data-testid="badge-sip-registering">
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
                {t.settings.sipProfile.registering || "Registering..."}
              </Badge>
            ) : (
              <Badge variant="outline" data-testid="badge-sip-not-registered">
                {t.settings.sipProfile.notRegistered}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isGlobalSipEnabled && (
            <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-900 dark:bg-yellow-950">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                {t.settings.sipProfile.notEnabled}
              </p>
            </div>
          )}

          {/* Form fields */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="userSipExtension">{t.settings.sipProfile.extension}</Label>
              <Input
                id="userSipExtension"
                value={sipExtension}
                onChange={(e) => setSipExtension(e.target.value)}
                placeholder="1001"
                data-testid="input-user-sip-extension"
              />
              <p className="text-xs text-muted-foreground">
                {t.settings.sipProfile.extensionHelp}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="userSipPassword">{t.settings.sipProfile.password}</Label>
              <Input
                id="userSipPassword"
                type="password"
                value={sipPassword}
                onChange={(e) => setSipPassword(e.target.value)}
                placeholder="********"
                data-testid="input-user-sip-password"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="userSipDisplayName">{t.settings.sipProfile.displayName}</Label>
            <Input
              id="userSipDisplayName"
              value={sipDisplayName}
              onChange={(e) => setSipDisplayName(e.target.value)}
              placeholder={user?.fullName || ""}
              data-testid="input-user-sip-display-name"
            />
            <p className="text-xs text-muted-foreground">
              {t.settings.sipProfile.displayNameHelp}
            </p>
          </div>

          <Separator />

          {/* Action Buttons - ALWAYS VISIBLE */}
          <div className="flex gap-2 flex-wrap">
            <Button 
              onClick={handleSave} 
              disabled={isSaving}
              data-testid="button-user-save-sip-profile"
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              {t.settings.sipProfile.save}
            </Button>
            {showSpinner ? (
              <Button 
                variant="destructive"
                onClick={handleCancelRegistration}
                data-testid="button-user-sip-cancel"
              >
                <XCircle className="h-4 w-4 mr-2" />
                {t.settings.sipProfile.cancel || "Cancel"}
              </Button>
            ) : isRegistered ? (
              <Button 
                variant="outline"
                onClick={handleUnregister}
                data-testid="button-user-sip-unregister"
              >
                <PhoneOff className="h-4 w-4 mr-2" />
                {t.settings.sipProfile.unregister}
              </Button>
            ) : (
              <Button 
                variant="default"
                onClick={handleRegister}
                disabled={!sipExtension || !sipPassword}
                data-testid="button-user-sip-register"
              >
                <Phone className="h-4 w-4 mr-2" />
                {t.settings.sipProfile.register}
              </Button>
            )}
          </div>
          {showSpinner && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800">
              <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
              <span className="text-sm text-blue-700 dark:text-blue-300">
                {t.settings.sipProfile.registering || "Registering..."}
              </span>
            </div>
          )}
          {isRegistered && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-sm text-green-700 dark:text-green-300">
                {t.settings.sipProfile.registered}
              </span>
            </div>
          )}
          {registrationError && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950">
              <p className="text-sm text-red-800 dark:text-red-200 flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                {registrationError}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {sipSettings && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t.settings.sipProfile.serverInfo}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t.settings.sipProfile.server}:</span>
                <span className="font-mono">{sipSettings.server || "-"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t.settings.sipProfile.port}:</span>
                <span className="font-mono">{sipSettings.port || 443}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t.settings.sipProfile.transport}:</span>
                <span className="font-mono">{sipSettings.transport || "WSS"}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
