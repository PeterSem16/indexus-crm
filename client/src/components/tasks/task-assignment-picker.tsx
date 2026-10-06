import { useState } from "react";
import { Check, Search, Users } from "lucide-react";

type AssignmentMode = "group" | "people";

type TaskAssignmentPickerProps = {
  mode: AssignmentMode;
  onModeChange: (mode: AssignmentMode) => void;
  groups: Array<{ id: string; name: string; displayAlias?: string | null }>;
  users: Array<{ id: string; fullName: string | null; username: string }>;
  selectedGroupId: string;
  selectedUserIds: string[];
  onGroupChange: (id: string) => void;
  onUserToggle: (id: string) => void;
  labels: {
    assignedTo: string;
    assignToGroup: string;
    searchUser: string;
    noUsersFound: string;
    groupMode: string;
    peopleMode: string;
    groupModeHint: string;
    peopleModeHint: string;
    groupEmpty: string;
    groupPrompt: string;
    peoplePrompt: string;
  };
};

const avatarPalette = [
  "from-[#2d6fba] to-[#1c568f]",
  "from-amber-500 to-orange-600",
  "from-emerald-500 to-teal-600",
  "from-sky-500 to-blue-600",
  "from-violet-500 to-purple-600",
  "from-rose-500 to-pink-600",
];

export function TaskAssignmentPicker({
  mode,
  onModeChange,
  groups,
  users,
  selectedGroupId,
  selectedUserIds,
  onGroupChange,
  onUserToggle,
  labels,
}: TaskAssignmentPickerProps) {
  const [search, setSearch] = useState("");

  const changeMode = (nextMode: AssignmentMode) => {
    setSearch("");
    onModeChange(nextMode);
  };

  const filteredUsers = users.filter((user) => {
    const query = search.trim().toLowerCase();
    return user.id && (!query || (user.fullName || user.username || "").toLowerCase().includes(query));
  });

  return (
    <section className="space-y-3" aria-label={labels.assignedTo}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">
            {labels.assignedTo}
          </label>
          <p className="mt-1 text-[11px] text-stone-500 dark:text-stone-400">
            {mode === "group" ? labels.groupModeHint : labels.peopleModeHint}
          </p>
        </div>
        <div className="inline-flex rounded-xl border border-[#c7d8e7] bg-[#f4f8fb] p-1 dark:border-slate-700 dark:bg-slate-900" role="group">
          <button
            type="button"
            onClick={() => changeMode("group")}
            aria-pressed={mode === "group"}
            data-testid="task-assignment-group-mode"
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${mode === "group" ? "bg-[#2d6fba] text-white shadow-sm" : "text-slate-600 hover:text-[#2d6fba] dark:text-slate-300"}`}
          >
            <span className="inline-flex items-center gap-1.5"><Users className="h-3.5 w-3.5" />{labels.groupMode}</span>
          </button>
          <button
            type="button"
            onClick={() => changeMode("people")}
            aria-pressed={mode === "people"}
            data-testid="task-assignment-people-mode"
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${mode === "people" ? "bg-[#2d6fba] text-white shadow-sm" : "text-slate-600 hover:text-[#2d6fba] dark:text-slate-300"}`}
          >
            {labels.peopleMode}
          </button>
        </div>
      </div>

      {mode === "group" ? (
        <div className="rounded-xl border border-[#c7d8e7] bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{labels.assignToGroup}</span>
            {selectedGroupId && (
              <span className="rounded-full bg-[#e5f0fa] px-2 py-0.5 text-[10px] font-semibold text-[#2d6fba] dark:bg-blue-950 dark:text-blue-300">
                {groups.find((group) => group.id === selectedGroupId)?.displayAlias || groups.find((group) => group.id === selectedGroupId)?.name}
              </span>
            )}
          </div>
          {groups.length ? (
            <>
            <p className="mb-2 text-[11px] text-stone-500 dark:text-stone-400">{labels.groupPrompt}</p>
            <div className="flex flex-wrap gap-1.5">
              {groups.map((group) => {
                const selected = selectedGroupId === group.id;
                return (
                  <button
                    key={group.id}
                    type="button"
                    onClick={() => onGroupChange(selected ? "" : group.id)}
                    aria-pressed={selected}
                    data-testid={`chip-task-group-${group.id}`}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[11px] font-medium transition-all ${selected ? "scale-[1.02] border-[#2d6fba] bg-[#2d6fba] text-white shadow-sm" : "border-[#dce8f2] bg-[#f7fbfe] text-slate-700 hover:border-[#5a94ca] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"}`}
                  >
                    <Users className="h-3 w-3" />
                    <span className="max-w-[180px] truncate">{group.displayAlias || group.name}</span>
                    {selected && <Check className="h-3 w-3 shrink-0" />}
                  </button>
                );
              })}
            </div>
            </>
          ) : (
            <p className="rounded-lg border border-dashed border-[#c7d8e7] bg-[#f7fbfe] px-3 py-4 text-center text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
              {labels.groupEmpty}
            </p>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[#c7d8e7] bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="relative border-b border-stone-200 dark:border-stone-800">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-stone-400" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={labels.searchUser}
              className="w-full bg-transparent py-2.5 pl-9 pr-3 text-xs outline-none placeholder:text-stone-400 dark:placeholder:text-stone-500"
              data-testid="input-task-user-search"
            />
          </div>
          <div className="flex max-h-[168px] flex-wrap gap-1.5 overflow-y-auto p-2">
            <p className="w-full px-1 pb-1 text-[11px] text-stone-500 dark:text-stone-400">{labels.peoplePrompt}</p>
            {filteredUsers.length === 0 ? (
              <span className="px-1 py-2 text-xs text-stone-400 dark:text-stone-500">{labels.noUsersFound}</span>
            ) : filteredUsers.map((user) => {
              const name = user.fullName || user.username;
              const initials = String(name).split(/\s+/).map((part) => part[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
              const hash = String(user.id).split("").reduce((acc, character) => (acc * 31 + character.charCodeAt(0)) >>> 0, 0);
              const selected = selectedUserIds.includes(user.id);
              return (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => onUserToggle(user.id)}
                  aria-pressed={selected}
                  data-testid={`chip-task-user-${user.id}`}
                  className={`inline-flex items-center gap-1.5 rounded-full border py-1 pl-1 pr-2.5 text-[11px] font-medium transition-all ${selected ? "scale-[1.02] border-[#2d6fba] bg-[#2d6fba] text-white shadow-sm" : "border-[#dce8f2] bg-[#f7fbfe] text-slate-700 hover:border-[#5a94ca] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"}`}
                >
                  <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${avatarPalette[hash % avatarPalette.length]} text-[8px] font-bold text-white ${selected ? "ring-2 ring-white/60" : ""}`}>
                    {initials}
                  </span>
                  <span className="max-w-[120px] truncate">{name}</span>
                  {selected && <Check className="h-3 w-3 shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
