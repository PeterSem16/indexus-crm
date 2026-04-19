import { useState, useMemo, useEffect } from "react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Trash2, History, Settings2, X } from "lucide-react";

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

type Catalog = {
  modules: { value: string; label: string }[];
  eventTypes: { value: string; label: string }[];
  actionTypes: { value: string; label: string; configSchema: Record<string, string> }[];
  operators: { value: string; label: string; arity: number }[];
  fields: Record<string, { value: string; label: string; type: string; options?: string[] }[]>;
  countries: { value: string; label: string }[];
};

type UserOpt = { id: string; fullName: string; email: string; role?: string };

type LeafCondition = { field: string; op: string; value?: any };
type GroupCondition = { all?: ConditionNode[]; any?: ConditionNode[]; not?: ConditionNode };
type ConditionNode = LeafCondition | GroupCondition;

type ActionNode = { type: string; config: Record<string, any> };

type RuleDraft = {
  name: string;
  description: string;
  module: string;
  countryCode: string | null;
  enabled: boolean;
  trigger: { type: "event"; entityType: string; eventType: string };
  conditions: ConditionNode | null;
  actions: ActionNode[];
  rateLimitPerHour: number | null;
};

const EMPTY_DRAFT = (): RuleDraft => ({
  name: "",
  description: "",
  module: "task",
  countryCode: null,
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
});

export default function AutomationsPage() {
  const { toast } = useToast();
  const [editing, setEditing] = useState<Rule | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [historyFor, setHistoryFor] = useState<Rule | null>(null);

  const rulesQ = useQuery<Rule[]>({ queryKey: ["/api/automation/rules"] });
  const catalogQ = useQuery<Catalog>({ queryKey: ["/api/automation/catalog"] });
  const usersQ = useQuery<UserOpt[]>({ queryKey: ["/api/automation/users"] });

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

  const onSave = (draft: RuleDraft) => {
    if (editing) updateMut.mutate({ id: editing.id, data: draft });
    else createMut.mutate(draft);
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
        <Button onClick={() => setShowCreate(true)} data-testid="button-create-rule">
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
                  <Button size="sm" variant="outline" onClick={() => setEditing(rule)} data-testid={`button-edit-${rule.id}`}>
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

      {(editing || showCreate) && catalogQ.data && (
        <RuleEditor
          open={!!editing || showCreate}
          rule={editing}
          catalog={catalogQ.data}
          users={usersQ.data || []}
          onClose={() => {
            setEditing(null);
            setShowCreate(false);
          }}
          onSave={onSave}
          saving={createMut.isPending || updateMut.isPending}
        />
      )}

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

/* ============================================================
   Rule editor — Builder + JSON tabs
   ============================================================ */
function RuleEditor({
  open,
  rule,
  catalog,
  users,
  onClose,
  onSave,
  saving,
}: {
  open: boolean;
  rule: Rule | null;
  catalog: Catalog;
  users: UserOpt[];
  onClose: () => void;
  onSave: (draft: RuleDraft) => void;
  saving: boolean;
}) {
  const { toast } = useToast();
  const [draft, setDraft] = useState<RuleDraft>(() =>
    rule
      ? {
          name: rule.name,
          description: rule.description || "",
          module: rule.module,
          countryCode: rule.countryCode,
          enabled: rule.enabled,
          trigger: rule.trigger || { type: "event", entityType: rule.module, eventType: "updated" },
          conditions: rule.conditions || null,
          actions: rule.actions || [],
          rateLimitPerHour: rule.rateLimitPerHour,
        }
      : EMPTY_DRAFT()
  );
  const [jsonText, setJsonText] = useState(() => JSON.stringify(draft, null, 2));
  const [tab, setTab] = useState<string>("builder");

  useEffect(() => {
    if (tab === "json") setJsonText(JSON.stringify(draft, null, 2));
  }, [tab]);

  const fieldsForModule = catalog.fields[draft.module] || [];

  const submit = () => {
    let payload = draft;
    if (tab === "json") {
      try {
        payload = JSON.parse(jsonText);
      } catch (e: any) {
        toast({ title: "Invalid JSON", description: e.message, variant: "destructive" });
        return;
      }
    }
    onSave(payload);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{rule ? `Edit: ${rule.name}` : "New automation rule"}</DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="builder" data-testid="tab-builder">Builder</TabsTrigger>
            <TabsTrigger value="json" data-testid="tab-json">JSON</TabsTrigger>
          </TabsList>

          <TabsContent value="builder" className="space-y-4 pt-4">
            {/* Basics */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>Name *</Label>
                <Input
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  placeholder="e.g. Notify manager when high-priority task created"
                  data-testid="input-rule-name"
                />
              </div>
              <div>
                <Label>Country (optional)</Label>
                <Select
                  value={draft.countryCode || "__all__"}
                  onValueChange={(v) => setDraft({ ...draft, countryCode: v === "__all__" ? null : v })}
                >
                  <SelectTrigger data-testid="select-country"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All countries</SelectItem>
                    {catalog.countries.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2">
                <Label>Description</Label>
                <Textarea
                  value={draft.description}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                  rows={2}
                  data-testid="textarea-rule-description"
                />
              </div>
            </div>

            {/* Trigger */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">When this happens (Trigger)</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label>Module</Label>
                  <Select
                    value={draft.module}
                    onValueChange={(v) =>
                      setDraft({
                        ...draft,
                        module: v,
                        trigger: { ...draft.trigger, entityType: v },
                      })
                    }
                  >
                    <SelectTrigger data-testid="select-module"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {catalog.modules.map((m) => (
                        <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Event</Label>
                  <Select
                    value={draft.trigger.eventType}
                    onValueChange={(v) => setDraft({ ...draft, trigger: { ...draft.trigger, eventType: v } })}
                  >
                    <SelectTrigger data-testid="select-event"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {catalog.eventTypes.map((e) => (
                        <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Conditions */}
            <Card>
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <CardTitle className="text-sm">Only if (Conditions)</CardTitle>
                {!draft.conditions ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setDraft({
                        ...draft,
                        conditions: { all: [{ field: fieldsForModule[0]?.value || "newValues.status", op: "eq", value: "" }] },
                      })
                    }
                    data-testid="button-add-conditions"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Add conditions
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setDraft({ ...draft, conditions: null })}
                  >
                    <X className="h-3.5 w-3.5 mr-1" />
                    Remove
                  </Button>
                )}
              </CardHeader>
              {draft.conditions && (
                <CardContent>
                  <ConditionsEditor
                    node={draft.conditions}
                    fields={fieldsForModule}
                    operators={catalog.operators}
                    onChange={(c) => setDraft({ ...draft, conditions: c })}
                  />
                </CardContent>
              )}
            </Card>

            {/* Actions */}
            <Card>
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <CardTitle className="text-sm">Then do (Actions)</CardTitle>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setDraft({
                      ...draft,
                      actions: [...draft.actions, { type: "notify_user", config: {} }],
                    })
                  }
                  data-testid="button-add-action"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Add action
                </Button>
              </CardHeader>
              <CardContent className="space-y-3">
                {draft.actions.length === 0 && (
                  <div className="text-xs text-muted-foreground">No actions yet.</div>
                )}
                {draft.actions.map((a, i) => (
                  <ActionEditor
                    key={i}
                    action={a}
                    index={i}
                    actionTypes={catalog.actionTypes}
                    users={users}
                    onChange={(updated) => {
                      const next = [...draft.actions];
                      next[i] = updated;
                      setDraft({ ...draft, actions: next });
                    }}
                    onRemove={() => {
                      const next = [...draft.actions];
                      next.splice(i, 1);
                      setDraft({ ...draft, actions: next });
                    }}
                  />
                ))}
              </CardContent>
            </Card>

            {/* Advanced */}
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">Advanced</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label>Rate limit per hour (optional)</Label>
                  <Input
                    type="number"
                    value={draft.rateLimitPerHour ?? ""}
                    onChange={(e) =>
                      setDraft({ ...draft, rateLimitPerHour: e.target.value ? Number(e.target.value) : null })
                    }
                    placeholder="unlimited"
                    data-testid="input-rate-limit"
                  />
                </div>
                <div className="flex items-center gap-2 pt-6">
                  <Switch
                    checked={draft.enabled}
                    onCheckedChange={(v) => setDraft({ ...draft, enabled: v })}
                    data-testid="switch-enabled"
                  />
                  <Label>Enabled</Label>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="json" className="pt-4">
            <Label>Rule JSON</Label>
            <Textarea
              value={jsonText}
              onChange={(e) => setJsonText(e.target.value)}
              className="font-mono text-xs h-[420px]"
              data-testid="textarea-rule-json"
            />
            <p className="text-xs text-muted-foreground mt-2">
              Edits made here override the Builder tab on save. Templates use{" "}
              <code>{`{{newValues.fieldName}}`}</code> / <code>{`{{oldValues.fieldName}}`}</code>.
            </p>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={saving} data-testid="button-save-rule">
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ----------------- Conditions ----------------- */
function ConditionsEditor({
  node,
  fields,
  operators,
  onChange,
  depth = 0,
}: {
  node: ConditionNode;
  fields: { value: string; label: string; type: string; options?: string[] }[];
  operators: { value: string; label: string; arity: number }[];
  onChange: (n: ConditionNode) => void;
  depth?: number;
}) {
  const isGroup = "all" in (node as any) || "any" in (node as any);
  const isNot = "not" in (node as any);

  if (isNot) {
    return (
      <div className={`border-l-4 border-rose-300 dark:border-rose-700 pl-3 py-1 space-y-2`}>
        <div className="flex items-center gap-2 text-xs font-medium">
          NOT
          <Button size="sm" variant="ghost" onClick={() => onChange((node as any).not)} className="h-6 text-xs">
            unwrap
          </Button>
        </div>
        <ConditionsEditor
          node={(node as any).not}
          fields={fields}
          operators={operators}
          onChange={(c) => onChange({ not: c })}
          depth={depth + 1}
        />
      </div>
    );
  }

  if (isGroup) {
    const isAll = "all" in (node as any);
    const items: ConditionNode[] = (node as any)[isAll ? "all" : "any"];
    const update = (next: ConditionNode[]) =>
      onChange(isAll ? { all: next } : { any: next });

    return (
      <div className={`border-l-4 ${isAll ? "border-blue-300 dark:border-blue-700" : "border-amber-300 dark:border-amber-700"} pl-3 py-1 space-y-2`}>
        <div className="flex items-center gap-2 text-xs">
          <Select
            value={isAll ? "all" : "any"}
            onValueChange={(v) => onChange(v === "all" ? { all: items } : { any: items })}
          >
            <SelectTrigger className="h-7 w-28 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ALL of</SelectItem>
              <SelectItem value="any">ANY of</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" variant="ghost" className="h-7 text-xs"
            onClick={() => update([...items, { field: fields[0]?.value || "", op: "eq", value: "" }])}>
            <Plus className="h-3 w-3 mr-1" /> condition
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs"
            onClick={() => update([...items, { all: [{ field: fields[0]?.value || "", op: "eq", value: "" }] }])}>
            <Plus className="h-3 w-3 mr-1" /> group
          </Button>
          {depth > 0 && (
            <Button size="sm" variant="ghost" className="h-7 text-xs"
              onClick={() => onChange({ not: node })}>
              wrap NOT
            </Button>
          )}
        </div>
        {items.length === 0 && <div className="text-xs text-muted-foreground">Empty group</div>}
        {items.map((child, i) => (
          <div key={i} className="flex items-start gap-2">
            <div className="flex-1">
              <ConditionsEditor
                node={child}
                fields={fields}
                operators={operators}
                onChange={(c) => {
                  const next = [...items];
                  next[i] = c;
                  update(next);
                }}
                depth={depth + 1}
              />
            </div>
            <Button size="icon" variant="ghost" className="h-7 w-7"
              onClick={() => {
                const next = [...items];
                next.splice(i, 1);
                update(next);
              }}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </div>
    );
  }

  // Leaf
  const leaf = node as LeafCondition;
  const opMeta = operators.find((o) => o.value === leaf.op);
  const fieldMeta = fields.find((f) => f.value === leaf.field);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={leaf.field} onValueChange={(v) => onChange({ ...leaf, field: v })}>
        <SelectTrigger className="h-8 w-56 text-xs"><SelectValue placeholder="field..." /></SelectTrigger>
        <SelectContent>
          {fields.map((f) => (
            <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={leaf.op} onValueChange={(v) => onChange({ ...leaf, op: v })}>
        <SelectTrigger className="h-8 w-44 text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>
          {operators.map((o) => (
            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {opMeta && opMeta.arity > 0 && (
        fieldMeta?.type === "enum" && fieldMeta.options ? (
          <Select value={String(leaf.value ?? "")} onValueChange={(v) => onChange({ ...leaf, value: v })}>
            <SelectTrigger className="h-8 w-44 text-xs"><SelectValue placeholder="value" /></SelectTrigger>
            <SelectContent>
              {fieldMeta.options.map((o) => (
                <SelectItem key={o} value={o}>{o}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : fieldMeta?.type === "boolean" ? (
          <Select value={String(leaf.value ?? "")} onValueChange={(v) => onChange({ ...leaf, value: v === "true" })}>
            <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="true">true</SelectItem>
              <SelectItem value="false">false</SelectItem>
            </SelectContent>
          </Select>
        ) : (
          <Input
            className="h-8 w-44 text-xs"
            value={String(leaf.value ?? "")}
            onChange={(e) => onChange({ ...leaf, value: e.target.value })}
            placeholder="value"
          />
        )
      )}
    </div>
  );
}

/* ----------------- Actions ----------------- */
function ActionEditor({
  action,
  index,
  actionTypes,
  users,
  onChange,
  onRemove,
}: {
  action: ActionNode;
  index: number;
  actionTypes: Catalog["actionTypes"];
  users: UserOpt[];
  onChange: (a: ActionNode) => void;
  onRemove: () => void;
}) {
  const setCfg = (k: string, v: any) => onChange({ ...action, config: { ...action.config, [k]: v } });

  const userOptions = useMemo(
    () => [
      { id: "{{newValues.assignedUserId}}", label: "→ Assignee (template)" },
      { id: "{{newValues.createdByUserId}}", label: "→ Creator (template)" },
      ...users.map((u) => ({ id: u.id, label: `${u.fullName} (${u.email})` })),
    ],
    [users]
  );

  return (
    <div className="border rounded-md p-3 space-y-2 bg-muted/30">
      <div className="flex items-center gap-2">
        <Badge variant="secondary">#{index + 1}</Badge>
        <Select value={action.type} onValueChange={(v) => onChange({ type: v, config: {} })}>
          <SelectTrigger className="h-8 w-48 text-xs" data-testid={`select-action-type-${index}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {actionTypes.map((a) => (
              <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex-1" />
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onRemove} data-testid={`button-remove-action-${index}`}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      {action.type === "notify_user" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
          <div>
            <Label className="text-xs">User</Label>
            <Select value={action.config.userId || ""} onValueChange={(v) => setCfg("userId", v)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="pick user" /></SelectTrigger>
              <SelectContent>
                {userOptions.map((u) => (
                  <SelectItem key={u.id} value={u.id}>{u.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Priority</Label>
            <Select value={action.config.priority || "normal"} onValueChange={(v) => setCfg("priority", v)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="low">low</SelectItem>
                <SelectItem value="normal">normal</SelectItem>
                <SelectItem value="high">high</SelectItem>
                <SelectItem value="urgent">urgent</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2">
            <Label className="text-xs">Title</Label>
            <Input className="h-8 text-xs" value={action.config.title || ""} onChange={(e) => setCfg("title", e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <Label className="text-xs">Message</Label>
            <Textarea rows={2} className="text-xs" value={action.config.message || ""} onChange={(e) => setCfg("message", e.target.value)} />
          </div>
        </div>
      )}

      {action.type === "create_task" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
          <div className="md:col-span-2">
            <Label className="text-xs">Task title</Label>
            <Input className="h-8 text-xs" value={action.config.title || ""} onChange={(e) => setCfg("title", e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <Label className="text-xs">Description</Label>
            <Textarea rows={2} className="text-xs" value={action.config.description || ""} onChange={(e) => setCfg("description", e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Assignee</Label>
            <Select value={action.config.assignedUserId || ""} onValueChange={(v) => setCfg("assignedUserId", v)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="pick user" /></SelectTrigger>
              <SelectContent>
                {userOptions.map((u) => (
                  <SelectItem key={u.id} value={u.id}>{u.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Priority</Label>
            <Select value={action.config.priority || "medium"} onValueChange={(v) => setCfg("priority", v)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="low">low</SelectItem>
                <SelectItem value="medium">medium</SelectItem>
                <SelectItem value="high">high</SelectItem>
                <SelectItem value="urgent">urgent</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Due in (hours)</Label>
            <Input
              type="number"
              className="h-8 text-xs"
              value={action.config.dueInHours ?? ""}
              onChange={(e) => setCfg("dueInHours", e.target.value ? Number(e.target.value) : undefined)}
            />
          </div>
          <div>
            <Label className="text-xs">Department ID (opt)</Label>
            <Input className="h-8 text-xs" value={action.config.assignedDepartmentId || ""} onChange={(e) => setCfg("assignedDepartmentId", e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <Label className="text-xs">Checklist (one item per line)</Label>
            <Textarea
              rows={3}
              className="text-xs font-mono"
              value={Array.isArray(action.config.checklist) ? action.config.checklist.map((c: any) => typeof c === "string" ? c : c.label).join("\n") : ""}
              onChange={(e) => setCfg("checklist", e.target.value.split("\n").map((s) => s.trim()).filter(Boolean))}
            />
          </div>
        </div>
      )}

      {action.type === "send_email" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
          <div>
            <Label className="text-xs">To (email or template)</Label>
            <Input className="h-8 text-xs" value={action.config.to || ""} onChange={(e) => setCfg("to", e.target.value)} placeholder="{{newValues.email}}" />
          </div>
          <div>
            <Label className="text-xs">Subject</Label>
            <Input className="h-8 text-xs" value={action.config.subject || ""} onChange={(e) => setCfg("subject", e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <Label className="text-xs">Body</Label>
            <Textarea rows={4} className="text-xs" value={action.config.body || ""} onChange={(e) => setCfg("body", e.target.value)} />
          </div>
        </div>
      )}
    </div>
  );
}

/* ----------------- Run history ----------------- */
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
                  run.status === "success" ? "default" : run.status === "failed" ? "destructive" : "secondary"
                }
              >
                {run.status}
              </Badge>
              {run.skippedReason && <Badge variant="outline">{run.skippedReason}</Badge>}
              <span className="text-muted-foreground">{new Date(run.startedAt).toLocaleString()}</span>
            </div>
            <Button size="sm" variant="ghost" onClick={() => setSelectedRun(selectedRun === run.id ? null : run.id)}>
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
