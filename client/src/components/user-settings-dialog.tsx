import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Phone, Save, Loader2, Settings } from "lucide-react";
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

        <Tabs defaultValue={showSipPhone ? "sip" : "general"} className="mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="general" data-testid="tab-user-general">
              {t.common.detail}
            </TabsTrigger>
            {showSipPhone && (
              <TabsTrigger value="sip" data-testid="tab-user-sip">
                {t.settings.sipProfile.title}
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="general" className="mt-4">
            <GeneralTab />
          </TabsContent>

          {showSipPhone && (
            <TabsContent value="sip" className="mt-4">
              <UserSipProfileTab />
            </TabsContent>
          )}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function GeneralTab() {
  const { t } = useI18n();
  const { user } = useAuth();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t.users.title}</CardTitle>
        <CardDescription>{t.users.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>{t.users.fullName}</Label>
            <Input value={user?.fullName || ""} disabled data-testid="input-user-name" />
          </div>
          <div className="space-y-2">
            <Label>{t.common.email}</Label>
            <Input value={user?.email || ""} disabled data-testid="input-user-email" />
          </div>
        </div>
        <div className="space-y-2">
          <Label>{t.users.role}</Label>
          <Input value={user?.role || ""} disabled data-testid="input-user-role" />
        </div>
      </CardContent>
    </Card>
  );
}

function UserSipProfileTab() {
  const { t } = useI18n();
  const { toast } = useToast();
  const { user } = useAuth();
  const { isRegistered, isRegistering, register, unregister } = useSip();
  
  const [sipExtension, setSipExtension] = useState("");
  const [sipPassword, setSipPassword] = useState("");
  const [sipDisplayName, setSipDisplayName] = useState("");
  const [isSaving, setIsSaving] = useState(false);

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
    await register();
  };

  const handleUnregister = async () => {
    await unregister();
  };

  const isGlobalSipEnabled = sipSettings?.isEnabled;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Phone className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <CardTitle className="text-base">{t.settings.sipProfile.title}</CardTitle>
            <CardDescription className="text-sm">
              {t.settings.sipProfile.description}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {isRegistered && (
              <Badge variant="default" className="bg-green-600">
                {t.settings.sipProfile.registered}
              </Badge>
            )}
            {!isRegistered && !isRegistering && (
              <Badge variant="destructive">
                {t.settings.sipProfile.notRegistered}
              </Badge>
            )}
            {isRegistering && (
              <Badge variant="secondary">
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
                {t.settings.sipProfile.testing}
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

          {isGlobalSipEnabled && (
            <>
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

            </>
          )}

          <Separator />

          <div className="space-y-4">
            <div className="flex gap-2 flex-wrap">
              <Button 
                onClick={handleSave} 
                disabled={isSaving || !isGlobalSipEnabled}
                data-testid="button-user-save-sip-profile"
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                {t.settings.sipProfile.save}
              </Button>
              {!isRegistered ? (
                <Button 
                  variant="outline"
                  onClick={handleRegister} 
                  disabled={isRegistering || !sipExtension || !sipPassword || !isGlobalSipEnabled}
                  data-testid="button-user-sip-register"
                >
                  {isRegistering ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Phone className="h-4 w-4 mr-2" />
                  )}
                  {t.settings.sipProfile.register}
                </Button>
              ) : (
                <Button 
                  variant="outline"
                  onClick={handleUnregister} 
                  data-testid="button-user-sip-unregister"
                >
                  <Phone className="h-4 w-4 mr-2" />
                  {t.settings.sipProfile.unregister}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {isGlobalSipEnabled && sipSettings && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t.settings.sipProfile.serverInfo}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t.settings.sipProfile.server}:</span>
                <span className="font-mono">{sipSettings.server}</span>
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
