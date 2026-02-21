import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Server,
  Wifi,
  Save,
  TestTube,
  Loader2,
  CheckCircle2,
  XCircle,
  Phone,
  Shield,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface AriSettingsData {
  id?: string;
  host: string;
  port: number;
  protocol: string;
  username: string;
  password: string;
  appName: string;
  wsProtocol: string;
  wsPort: number;
  isEnabled: boolean;
}

export function AriSettingsTab() {
  const { toast } = useToast();
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const [formData, setFormData] = useState<AriSettingsData>({
    host: "",
    port: 8088,
    protocol: "http",
    username: "",
    password: "",
    appName: "indexus-inbound",
    wsProtocol: "ws",
    wsPort: 8088,
    isEnabled: false,
  });

  const { data: settings, isLoading } = useQuery<AriSettingsData>({
    queryKey: ["/api/ari-settings"],
  });

  useEffect(() => {
    if (settings) {
      setFormData({
        id: settings.id,
        host: settings.host || "",
        port: settings.port || 8088,
        protocol: settings.protocol || "http",
        username: settings.username || "",
        password: settings.password || "",
        appName: settings.appName || "indexus-inbound",
        wsProtocol: settings.wsProtocol || "ws",
        wsPort: settings.wsPort || 8088,
        isEnabled: settings.isEnabled || false,
      });
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: (data: AriSettingsData) => apiRequest("PUT", "/api/ari-settings", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ari-settings"] });
      toast({ title: "ARI settings saved" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await apiRequest("POST", "/api/ari-settings/test", {
        host: formData.host,
        port: formData.port,
        protocol: formData.protocol,
        username: formData.username,
        password: formData.password,
        appName: formData.appName,
        wsProtocol: formData.wsProtocol,
        wsPort: formData.wsPort,
      });
      const data = await res.json();
      setTestResult({ success: data.success, message: data.message || data.error || "Connection test completed" });
    } catch (err: any) {
      setTestResult({ success: false, message: err.message || "Connection failed" });
    } finally {
      setTesting(false);
    }
  };

  const useTls = formData.protocol === "https";
  const setUseTls = (v: boolean) => {
    setFormData(f => ({
      ...f,
      protocol: v ? "https" : "http",
      wsProtocol: v ? "wss" : "ws",
    }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h3 className="text-lg font-semibold flex items-center gap-2" data-testid="text-ari-settings-title">
          <Server className="h-5 w-5 text-primary" />
          Asterisk ARI Connection
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          Configure the connection to your Asterisk server for inbound call management
        </p>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Wifi className="h-4 w-4" />
            Connection Settings
          </CardTitle>
          <CardDescription>
            ARI (Asterisk REST Interface) connection parameters
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Host / IP Address</Label>
              <Input
                value={formData.host}
                onChange={e => setFormData(f => ({ ...f, host: e.target.value }))}
                placeholder="192.168.1.100"
                data-testid="input-ari-host"
              />
            </div>
            <div>
              <Label>HTTP Port</Label>
              <Input
                type="number"
                value={formData.port}
                onChange={e => setFormData(f => ({ ...f, port: parseInt(e.target.value) || 8088 }))}
                data-testid="input-ari-port"
              />
            </div>
            <div>
              <Label>Username</Label>
              <Input
                value={formData.username}
                onChange={e => setFormData(f => ({ ...f, username: e.target.value }))}
                data-testid="input-ari-username"
              />
            </div>
            <div>
              <Label>Password</Label>
              <Input
                type="password"
                value={formData.password}
                onChange={e => setFormData(f => ({ ...f, password: e.target.value }))}
                data-testid="input-ari-password"
              />
            </div>
            <div>
              <Label>Application Name</Label>
              <Input
                value={formData.appName}
                onChange={e => setFormData(f => ({ ...f, appName: e.target.value }))}
                data-testid="input-ari-app-name"
              />
              <p className="text-xs text-muted-foreground mt-1">Must match Stasis() name in dialplan</p>
            </div>
            <div>
              <Label>WebSocket Port</Label>
              <Input
                type="number"
                value={formData.wsPort}
                onChange={e => setFormData(f => ({ ...f, wsPort: parseInt(e.target.value) || 8088 }))}
                data-testid="input-ari-ws-port"
              />
            </div>
          </div>

          <Separator />

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Switch
                checked={useTls}
                onCheckedChange={setUseTls}
                data-testid="switch-ari-tls"
              />
              <Label className="flex items-center gap-1">
                <Shield className="h-3.5 w-3.5" />
                Use TLS/SSL
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={formData.isEnabled}
                onCheckedChange={v => setFormData(f => ({ ...f, isEnabled: v }))}
                data-testid="switch-ari-active"
              />
              <Label className="flex items-center gap-1">
                <Phone className="h-3.5 w-3.5" />
                Enable Connection
              </Label>
            </div>
          </div>

          {testResult && (
            <div className={`p-3 rounded-md flex items-center gap-2 text-sm ${
              testResult.success ? "bg-green-50 text-green-800 border border-green-200" : "bg-red-50 text-red-800 border border-red-200"
            }`}>
              {testResult.success ? (
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              ) : (
                <XCircle className="h-4 w-4 text-red-600" />
              )}
              {testResult.message}
            </div>
          )}

          <div className="flex items-center gap-3 pt-2">
            <Button
              variant="outline"
              onClick={handleTestConnection}
              disabled={testing || !formData.host}
              data-testid="btn-test-ari"
            >
              {testing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <TestTube className="h-4 w-4 mr-2" />
              )}
              Test Connection
            </Button>
            <Button
              onClick={() => saveMutation.mutate(formData)}
              disabled={saveMutation.isPending}
              data-testid="btn-save-ari"
            >
              {saveMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Settings
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Connection Info</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground space-y-2">
            <p>
              The ARI connection allows INDEXUS CRM to control Asterisk for inbound call management.
              Asterisk acts as the media server while all queue logic, routing decisions, and agent
              assignments are handled by the CRM.
            </p>
            <div className="flex items-center gap-2 mt-3">
              <Badge variant="outline" className="text-xs">
                HTTP: {formData.protocol}://{formData.host || "..."}:{formData.port}
              </Badge>
              <Badge variant="outline" className="text-xs">
                WS: {formData.wsProtocol}://{formData.host || "..."}:{formData.wsPort}/ari/events
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
