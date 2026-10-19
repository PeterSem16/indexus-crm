import type { WorkflowAction, WorkflowCatalogItem, WorkflowRef } from "@shared/status-list-workflow";

export const workflowRefKey = (ref?: WorkflowRef) => ref ? `${ref.kind}:${ref.id}` : "";
export const isWorkflowBoolean = (item?: WorkflowCatalogItem) => item?.kind === "item" || ["checkbox", "radio"].includes(item?.fieldType.toLowerCase() || "");
export const isWorkflowYesNo = (item?: WorkflowCatalogItem) => ["yesno", "yes_no"].includes(item?.fieldType.toLowerCase() || "");
export const workflowDefaultAnswer = (item?: WorkflowCatalogItem) => isWorkflowBoolean(item) ? true : isWorkflowYesNo(item) ? "yes" : "";
export const isWorkflowSupported = (item: WorkflowCatalogItem) => item.kind === "item" || isWorkflowBoolean(item) || isWorkflowYesNo(item) || ["text", "string", "number", "date"].includes(item.fieldType.toLowerCase());
export type WorkflowCatalogNode = { item: WorkflowCatalogItem; children: WorkflowCatalogNode[] };
export function workflowNewAction(type: WorkflowAction["type"], item: WorkflowCatalogItem): WorkflowAction {
  const target: WorkflowRef = { kind: item.kind, id: item.id };
  if (type === "set_answer") return { type, target, value: workflowDefaultAnswer(item), mode: "if_empty" };
  if (type === "replace_note" || type === "append_note") return { type, target, text: "" };
  return { type, target };
}

/** Group by exact item IDs, never by labels (which may legitimately repeat). */
export function groupWorkflowCatalog(catalog: WorkflowCatalogItem[], search = "") {
  const nodes = new Map(catalog.map(item => [workflowRefKey(item), { item, children: [] } as WorkflowCatalogNode]));
  const roots: WorkflowCatalogNode[] = [];
  for (const node of nodes.values()) {
    const visited = new Set([workflowRefKey(node.item)]);
    let ancestor = node.item.parentId ? nodes.get(`item:${node.item.parentId}`) : undefined;
    const parent = ancestor;
    let cycle = false;
    while (ancestor) {
      const key = workflowRefKey(ancestor.item);
      if (visited.has(key)) { cycle = true; break; }
      visited.add(key);
      ancestor = ancestor.item.parentId ? nodes.get(`item:${ancestor.item.parentId}`) : undefined;
    }
    if (parent && !cycle) parent.children.push(node);
    else roots.push(node);
  }
  const compare = (a: WorkflowCatalogNode, b: WorkflowCatalogNode) =>
    (a.item.sortOrder ?? 0) - (b.item.sortOrder ?? 0) || a.item.label.localeCompare(b.item.label) || workflowRefKey(a.item).localeCompare(workflowRefKey(b.item));
  const sort = (list: WorkflowCatalogNode[]) => { list.sort(compare); list.forEach(node => sort(node.children)); };
  sort(roots);
  const query = search.trim().normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase();
  const matches = (node: WorkflowCatalogNode): boolean => node.item.label.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase().includes(query) || node.children.some(matches);
  return query ? roots.filter(matches) : roots;
}

export function workflowCatalogPath(item: WorkflowCatalogItem | undefined, catalog: WorkflowCatalogItem[]) {
  const path: string[] = [];
  const seen = new Set<string>();
  let parent = item?.parentId ? catalog.find(entry => entry.kind === "item" && entry.id === item.parentId) : undefined;
  while (parent && !seen.has(parent.id)) {
    seen.add(parent.id); path.unshift(parent.label);
    parent = parent.parentId ? catalog.find(entry => entry.kind === "item" && entry.id === parent!.parentId) : undefined;
  }
  return path.join(" / ") || item?.parentLabel || "";
}
