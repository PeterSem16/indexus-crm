import { useState } from "react";
import { Check, Plus, Trash2 } from "lucide-react";
import type { z } from "zod";
import type { StatusListOrganization, statusListOrganizationEditSchema } from "@shared/status-list-organization";
import { getStatusListWorkspaceCopy } from "./status-list-workspace-copy";
import { useStatusListConfirm } from "./status-list-confirm";

export function StatusListCategoryManager({ organization, locale, busy, onEdit }: {
  organization: StatusListOrganization; locale: string; busy: boolean;
  onEdit: (edit: z.infer<typeof statusListOrganizationEditSchema>) => void;
}) {
  const copy = getStatusListWorkspaceCopy(locale);
  const confirm = useStatusListConfirm(locale);
  const [name, setName] = useState("");
  const [names, setNames] = useState<Record<string, string>>({});
  return <details className="slw-category-manager" data-testid="status-list-category-manager">
    <summary>{copy.manageCategories}</summary>
    <p>{copy.categoryHint}</p>
    <form onSubmit={event => { event.preventDefault(); if (name.trim()) onEdit({ operation: "create", name: name.trim() }); }}>
      <input data-testid="status-list-new-category" aria-label={copy.newCategory} placeholder={copy.newCategory} maxLength={60} value={name} onChange={event => setName(event.target.value)}/>
      <button type="submit" data-testid="status-list-create-category" aria-label={copy.newCategory} title={copy.newCategory} disabled={busy || !name.trim() || organization.categories.some(category => category.name.toLowerCase() === name.trim().toLowerCase())}><Plus size={15}/></button>
    </form>
    {organization.categories.map(category => <div key={category.id} data-testid={`status-list-category-editor-${category.id}`}>
      <input aria-label={`${copy.categoryName}: ${category.name}`} maxLength={60} value={names[category.id] ?? category.name} onChange={event => setNames(previous => ({ ...previous, [category.id]: event.target.value }))}/>
      <button type="button" data-testid={`status-list-rename-category-${category.id}`} aria-label={`${copy.saveCategory}: ${category.name}`} title={copy.saveCategory} disabled={busy || !(names[category.id]?.trim()) || names[category.id]?.trim() === category.name} onClick={() => onEdit({ operation: "rename", id: category.id, name: names[category.id].trim() })}><Check size={14}/></button>
      <button type="button" data-testid={`status-list-delete-category-${category.id}`} aria-label={`${copy.deleteCategory}: ${category.name}`} title={copy.deleteCategory} disabled={busy} onClick={async () => { if (await confirm(copy.deleteCategoryHint, { destructive: true })) onEdit({ operation: "remove", id: category.id }); }}><Trash2 size={14}/></button>
    </div>)}
  </details>;
}
