export type TaskGroupMember = {
  userId: string;
  fullName: string;
  avatarUrl?: string | null;
};

export type TaskGroupForm = {
  name: string;
  description: string;
  color: string;
  icon: string | null;
  displayAlias: string;
  isBackOffice: boolean;
  memberUserIds: string[];
};

export const DEFAULT_TASK_GROUP_COLOR = "#3b82f6";

export function createEmptyTaskGroupForm(): TaskGroupForm {
  return {
    name: "",
    description: "",
    color: DEFAULT_TASK_GROUP_COLOR,
    icon: null,
    displayAlias: "",
    isBackOffice: false,
    memberUserIds: [],
  };
}

export function createTaskGroupForm(group: {
  name: string;
  description?: string | null;
  color?: string | null;
  icon?: string | null;
  displayAlias?: string | null;
  isBackOffice?: boolean | null;
  members?: TaskGroupMember[];
}): TaskGroupForm {
  return {
    name: group.name,
    description: group.description || "",
    color: group.color || DEFAULT_TASK_GROUP_COLOR,
    icon: group.icon || null,
    displayAlias: group.displayAlias || "",
    isBackOffice: group.isBackOffice ?? false,
    memberUserIds: (group.members || []).map(member => member.userId),
  };
}

export function isTaskGroupFormDirty(form: TaskGroupForm, initial: TaskGroupForm): boolean {
  const selectedIds = [...form.memberUserIds].sort();
  const initialIds = [...initial.memberUserIds].sort();
  return form.name !== initial.name
    || form.description !== initial.description
    || form.color !== initial.color
    || form.icon !== initial.icon
    || form.displayAlias !== initial.displayAlias
    || form.isBackOffice !== initial.isBackOffice
    || selectedIds.length !== initialIds.length
    || selectedIds.some((id, index) => id !== initialIds[index]);
}

export function createTaskGroupPayload(form: TaskGroupForm) {
  return {
    name: form.name.trim(),
    description: form.description.trim() || null,
    color: form.color,
    icon: form.icon,
    memberUserIds: Array.from(new Set(form.memberUserIds)),
    isBackOffice: form.isBackOffice,
    displayAlias: form.displayAlias.trim() || null,
  };
}