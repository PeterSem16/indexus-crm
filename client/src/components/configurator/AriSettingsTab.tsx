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
  WifiOff,
  Save,
  TestTube,
  Loader2,
  CheckCircle2,
  XCircle,
  Phone,
  Shield,
  Plug,
  Unplug,
  Activity,
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
  autoConnect: boolean;
}

interface AriStatus {
  ariConnected: boolean;
  queueEngineRunning: boolean;
}

export function AriSettingsTab() {
  const { toast } = useToast();
  const [testing, setTesting] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
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
    autoConnect: false,
  });

  const { data: settings, isLoading } = useQuery<AriSettingsData>({
    queryKey: ["/api/ari-settings"],
  });

  const { data: status, isError: statusError } = useQuery<AriStatus>({
    queryKey: ["/api/ari-settings/status"],
    refetchInterval: 5000,
    retry: false,
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
        autoConnect: settings.autoConnect || false,
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

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const res = await apiRequest("POST", "/api/ari-settings/connect");
      const data = await res.json();
      if (data.success) {
        toast({ title: "Connected to Asterisk ARI", description: "WebSocket connection established. Stasis app registered." });
        queryClient.invalidateQueries({ queryKey: ["/api/ari-settings/status"] });
      } else {
        toast({ title: "Connection failed", description: data.error || "Unknown error", variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Connection failed", description: err.message, variant: "destructive" });
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      const res = await apiRequest("POST", "/api/ari-settings/disconnect");
      const data = await res.json();
      if (data.success) {
        toast({ title: "Disconnected from Asterisk ARI" });
        queryClient.invalidateQueries({ queryKey: ["/api/ari-settings/status"] });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setDisconnecting(false);
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

  const isConnected = status?.ariConnected || false;
  const isQueueRunning = status?.queueEngineRunning || false;
  const statusUnavailable = statusError && !status;

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

      <Card className={isConnected ? "border-green-300 dark:border-green-700" : ""}>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Live Status
            </CardTitle>
            <div className="flex items-center gap-2">
              {statusUnavailable ? (
                <Badge variant="outline" data-testid="badge-ari-status-unavailable">
                  <XCircle className="h-3 w-3 mr-1" />
                  Status unavailable
                </Badge>
              ) : isConnected ? (
                <Badge className="bg-green-100 text-green-800 border-green-300 dark:bg-green-900 dark:text-green-200" data-testid="badge-ari-connected">
                  <Wifi className="h-3 w-3 mr-1" />
                  Connected
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-muted-foreground" data-testid="badge-ari-disconnected">
                  <WifiOff className="h-3 w-3 mr-1" />
                  Disconnected
                </Badge>
              )}
              {isQueueRunning && (
                <Badge className="bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900 dark:text-blue-200" data-testid="badge-queue-running">
                  Queue Engine Active
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            {!isConnected ? (
              <Button
                onClick={handleConnect}
                disabled={connecting || !formData.host || !formData.isEnabled}
                data-testid="btn-connect-ari"
              >
                {connecting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Plug className="h-4 w-4 mr-2" />
                )}
                Connect to Asterisk
              </Button>
            ) : (
              <Button
                variant="destructive"
                onClick={handleDisconnect}
                disabled={disconnecting}
                data-testid="btn-disconnect-ari"
              >
                {disconnecting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Unplug className="h-4 w-4 mr-2" />
                )}
                Disconnect
              </Button>
            )}
            {!isConnected && !formData.isEnabled && (
              <p className="text-xs text-muted-foreground" data-testid="text-ari-enable-hint">Enable Connection first, then Save Settings before connecting</p>
            )}
            {isConnected && (
              <p className="text-xs text-green-700 dark:text-green-300" data-testid="text-ari-stasis-status">
                WebSocket active — Stasis app "{formData.appName}" registered on Asterisk
              </p>
            )}
          </div>
        </CardContent>
      </Card>

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

          <div className="flex items-center gap-6 flex-wrap">
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
            <div className="flex items-center gap-2">
              <Switch
                checked={formData.autoConnect}
                onCheckedChange={v => setFormData(f => ({ ...f, autoConnect: v }))}
                data-testid="switch-ari-autoconnect"
              />
              <Label className="flex items-center gap-1">
                <Wifi className="h-3.5 w-3.5" />
                Auto-Connect on Startup
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
            <p className="text-xs mt-2">
              <strong>Test Connection</strong> — checks if Asterisk HTTP API is reachable (does not register Stasis app).
              <br />
              <strong>Connect to Asterisk</strong> — establishes persistent WebSocket and registers the Stasis application so inbound calls are handled.
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
