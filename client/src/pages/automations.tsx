import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Trash2, Play, History, FlaskConical, Settings2 } from "lucide-react";

type Rule = {
  id: string;
  name: string;
  description: string | null;
  module: string;
  countryCode: string | null;
  enabled: boolean;
  isSystem: boolean;
  trigger: any;
  conditions: any;
  actions: any[];
  rateLimitPerHour: number | null;
  updatedAt: string;
};

type Run = {
  id: string;
  ruleId: string;
  status: string;
  skippedReason: string | null;
  startedAt: string;
  finishedAt: string | null;
  error: string | null;
};

const EMPTY_RULE = {
  name: "",
  description: "",
  module: "task",
  countryCode: "",
  enabled: true,
  trigger: { type: "event", entityType: "task", eventType: "status_changed" },
  conditions: null,
  actions: [
    {
      type: "notify_user",
      config: {
        userId: "{{newValues.assignedUserId}}",
        title: "Task updated: {{newValues.title}}",
        message: "Status changed to {{newValues.status}}",
      },
    },
  ],
  rateLimitPerHour: null,
};

export default function AutomationsPage() {
  const { toast } = useToast();
  const [editing, setEditing] = useState<Rule | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [draftJson, setDraftJson] = useState("");
  const [historyFor, setHistoryFor] = useState<Rule | null>(null);

  const rulesQ = useQuery<Rule[]>({ queryKey: ["/api/automation/rules"] });

  const createMut = useMutation({
    mutationFn: async (data: any) => apiRequest("POST", "/api/automation/rules", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/automation/rules"] });
      setShowCreate(false);
      toast({ title: "Rule created" });
    },
    onError: (e: any) => toast({ title: "Failed", description: e?.message, variant: "destructive" }),
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) =>
      apiRequest("PATCH", `/api/automation/rules/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/automation/rules"] });
      setEditing(null);
      toast({ title: "Saved" });
    },
    onError: (e: any) => toast({ title: "Failed", description: e?.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/automation/rules/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/automation/rules"] });
      toast({ title: "Deleted" });
    },
    onError: (e: any) => toast({ title: "Failed", description: e?.message, variant: "destructive" }),
  });

  const toggleEnabled = (rule: Rule) =>
    updateMut.mutate({ id: rule.id, data: { enabled: !rule.enabled } });

  const openEdit = (rule: Rule) => {
    setEditing(rule);
    setDraftJson(
      JSON.stringify(
        {
          name: rule.name,
          description: rule.description,
          module: rule.module,
          countryCode: rule.countryCode,
          trigger: rule.trigger,
          conditions: rule.conditions,
          actions: rule.actions,
          rateLimitPerHour: rule.rateLimitPerHour,
        },
        null,
        2
      )
    );
  };

  const openCreate = () => {
    setShowCreate(true);
    setDraftJson(JSON.stringify(EMPTY_RULE, null, 2));
  };

  const saveJson = () => {
    let parsed: any;
    try {
      parsed = JSON.parse(draftJson);
    } catch (e: any) {
      toast({ title: "Invalid JSON", description: e.message, variant: "destructive" });
      return;
    }
    if (editing) updateMut.mutate({ id: editing.id, data: parsed });
    else createMut.mutate(parsed);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2" data-testid="text-page-title">
            <Settings2 className="h-6 w-6" />
            Automations
          </h1>
          <p className="text-sm text-muted-foreground">
            Trigger → conditions → actions. Reactive workflows across modules.
          </p>
        </div>
        <Button onClick={openCreate} data-testid="button-create-rule">
          <Plus className="h-4 w-4 mr-2" />
          New rule
        </Button>
      </div>

      {rulesQ.isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(rulesQ.data || []).map((rule) => (
            <Card key={rule.id} data-testid={`card-rule-${rule.id}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      {rule.name}
                      {rule.isSystem && <Badge variant="secondary">system</Badge>}
                      {!rule.enabled && <Badge variant="outline">disabled</Badge>}
                    </CardTitle>
                    {rule.description && (
                      <CardDescription className="mt-1">{rule.description}</CardDescription>
                    )}
                  </div>
                  <Switch
                    checked={rule.enabled}
                    onCheckedChange={() => toggleEnabled(rule)}
                    data-testid={`switch-enabled-${rule.id}`}
                  />
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="outline">module: {rule.module}</Badge>
                  {rule.countryCode && <Badge variant="outline">country: {rule.countryCode}</Badge>}
                  {rule.trigger?.eventType && (
                    <Badge variant="outline">on: {rule.trigger.eventType}</Badge>
                  )}
                  <Badge variant="outline">{(rule.actions || []).length} action(s)</Badge>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => openEdit(rule)} data-testid={`button-edit-${rule.id}`}>
                    Edit
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setHistoryFor(rule)} data-testid={`button-history-${rule.id}`}>
                    <History className="h-3.5 w-3.5 mr-1" />
                    Runs
                  </Button>
                  {!rule.isSystem && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        if (confirm(`Delete "${rule.name}"?`)) deleteMut.mutate(rule.id);
                      }}
                      data-testid={`button-delete-${rule.id}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
          {(rulesQ.data || []).length === 0 && (
            <div className="col-span-full text-center text-muted-foreground py-12">
              No rules yet. Click <strong>New rule</strong> to create your first automation.
            </div>
          )}
        </div>
      )}

      {/* Edit / Create dialog */}
      <Dialog
        open={!!editing || showCreate}
        onOpenChange={(open) => {
          if (!open) {
            setEditing(null);
            setShowCreate(false);
          }
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editing ? `Edit: ${editing.name}` : "New automation rule"}</DialogTitle>
          </DialogHeader>
          <Tabs defaultValue="json">
            <TabsList>
              <TabsTrigger value="json">JSON</TabsTrigger>
              <TabsTrigger value="help">Reference</TabsTrigger>
            </TabsList>
            <TabsContent value="json" className="space-y-3">
              <Label>Rule JSON</Label>
              <Textarea
                value={draftJson}
                onChange={(e) => setDraftJson(e.target.value)}
                className="font-mono text-xs h-[420px]"
                data-testid="textarea-rule-json"
              />
            </TabsContent>
            <TabsContent value="help" className="space-y-3 text-sm max-h-[420px] overflow-auto">
              <div>
                <strong>Trigger:</strong> <code>{`{ type: "event", entityType: "task"|"customer"|..., eventType: "created"|"updated"|"status_changed"|"task.completed" }`}</code>
              </div>
              <div>
                <strong>Conditions DSL:</strong> nested <code>{`{ all: [...] }`}</code> / <code>{`{ any: [...] }`}</code> /{" "}
                <code>{`{ not: ... }`}</code> with leaves{" "}
                <code>{`{ field: "newValues.status", op: "eq", value: "completed" }`}</code>
              </div>
              <div>
                <strong>Operators:</strong> eq, neq, gt, gte, lt, lte, in, not_in, contains, starts_with, is_null, is_not_null, changed, changed_to, changed_from
              </div>
              <div>
                <strong>Actions:</strong>
                <pre className="bg-muted p-2 rounded mt-1 overflow-auto text-xs">{`{ type: "create_task",
  config: {
    title: "Follow up with {{newValues.firstName}}",
    assignedUserId: "user-uuid",
    priority: "high",
    dueInHours: 24,
    checklist: ["Call customer", "Send email", "Log notes"]
  }}

{ type: "notify_user",
  config: {
    userId: "{{newValues.assignedUserId}}",
    title: "Status: {{newValues.status}}",
    message: "..."
  }}

{ type: "send_email",
  config: { to: "{{newValues.email}}", subject: "...", body: "..." }}`}</pre>
              </div>
              <div>
                <strong>Template variables:</strong> use <code>{`{{newValues.fieldName}}`}</code>,{" "}
                <code>{`{{oldValues.fieldName}}`}</code>, <code>{`{{event.entityId}}`}</code>,{" "}
                <code>{`{{event.actorUserId}}`}</code>
              </div>
            </TabsContent>
          </Tabs>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditing(null); setShowCreate(false); }}>
              Cancel
            </Button>
            <Button onClick={saveJson} disabled={createMut.isPending || updateMut.isPending} data-testid="button-save-rule">
              {(createMut.isPending || updateMut.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Run history dialog */}
      <Dialog open={!!historyFor} onOpenChange={(o) => !o && setHistoryFor(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Run history: {historyFor?.name}</DialogTitle>
          </DialogHeader>
          {historyFor && <RunHistory ruleId={historyFor.id} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RunHistory({ ruleId }: { ruleId: string }) {
  const runsQ = useQuery<Run[]>({ queryKey: ["/api/automation/runs", { ruleId }] });
  const [selectedRun, setSelectedRun] = useState<string | null>(null);
  const detailQ = useQuery<any>({
    queryKey: ["/api/automation/runs", selectedRun],
    enabled: !!selectedRun,
  });

  if (runsQ.isLoading)
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );

  return (
    <div className="space-y-3 max-h-[500px] overflow-auto">
      <div className="text-xs text-muted-foreground">{(runsQ.data || []).length} run(s)</div>
      {(runsQ.data || []).length === 0 && (
        <div className="text-center text-muted-foreground py-8 text-sm">No runs yet.</div>
      )}
      {(runsQ.data || []).map((run) => (
        <div key={run.id} className="border rounded-md p-2 text-xs" data-testid={`row-run-${run.id}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge
                variant={
                  run.status === "success"
                    ? "default"
                    : run.status === "failed"
                    ? "destructive"
                    : "secondary"
                }
              >
                {run.status}
              </Badge>
              {run.skippedReason && <Badge variant="outline">{run.skippedReason}</Badge>}
              <span className="text-muted-foreground">{new Date(run.startedAt).toLocaleString()}</span>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSelectedRun(selectedRun === run.id ? null : run.id)}
            >
              {selectedRun === run.id ? "Hide" : "Detail"}
            </Button>
          </div>
          {run.error && <div className="text-red-500 mt-1">{run.error}</div>}
          {selectedRun === run.id && detailQ.data && (
            <pre className="mt-2 bg-muted p-2 rounded overflow-auto text-[11px]">
              {JSON.stringify(detailQ.data, null, 2)}
            </pre>
          )}
        </div>
      ))}
    </div>
  );
}
