import assert from "node:assert/strict";
import {
  relationshipTargets, relationshipSelection, relationshipGroup, searchRelationshipTargets,
  type RelationshipItem,
} from "./status-list-relationships";

const items: RelationshipItem[] = [
  { id: "current", stepId: "START", label: "Current", tab: "acquisition", questions: [
    { id: "q1", questionText: "Current question", groupName: "Kontakt", logicOperator: "OR" },
    { id: "q2", questionText: "Other question", groupName: "Kontakt", logicOperator: "ONE", isHidden: true },
    { id: "q3", questionText: "Ungrouped", groupName: null, logicOperator: "OR" },
  ] },
  { id: "next", stepId: "NEXT", label: "Overenie zmlúv", tab: "contract", questions: [{ id: "q4", questionText: "Podpis zmluvy" }] },
  { id: "hidden-parent", stepId: "HIDDEN", label: "Hidden parent", isHidden: true, tab: "retention" },
  { id: "hidden-child", stepId: "CHILD", label: "Hidden child", parentId: "hidden-parent", questions: [{ id: "q5", questionText: "Inherited hidden question" }] },
  { id: "dup1", stepId: "DUP", label: "Duplicate 1" },
  { id: "dup2", stepId: "DUP", label: "Duplicate 2" },
  { id: "quick", stepId: "OPT-01", label: "Callback", itemType: "option" },
];
const original = JSON.stringify(items);
let checks = 0;
const check = (value: unknown, message: string) => { assert.ok(value, message); checks++; };
const steps = relationshipTargets(items, "current", null);
check(steps.every(target => target.kind === "step"), "Step references never offer question IDs");
check(steps.find(target => target.itemId === "next")?.value === "NEXT", "Manual links retain the stored step-code representation");
check(steps.find(target => target.itemId === "current")?.selectable === false, "Self-navigation cannot be newly selected");
check(steps.filter(target => target.step === "DUP").every(target => target.ambiguous && !target.selectable), "Duplicate step codes cannot be guessed");
check(steps.find(target => target.itemId === "quick")?.selectable === false, "Quick outcome buttons are not navigation steps");
check(steps.find(target => target.itemId === "hidden-child")?.hidden, "Hidden ancestors apply to destinations");
check(steps.find(target => target.itemId === "hidden-child")?.phase === "retention", "Destination phase is inherited explicitly");
check(steps.find(target => target.itemId === "hidden-child")?.selectable, "Hidden links are warned about, not silently removed");
const questions = relationshipTargets(items, "current", "q1");
check(questions.find(target => target.key === "step:next")?.value === "step:NEXT", "Question-to-step references preserve their prefix");
check(questions.find(target => target.questionId === "q4")?.value === "q4", "Question-to-question references preserve the real UUID");
check(questions.find(target => target.questionId === "q1")?.self && !questions.find(target => target.questionId === "q1")?.selectable, "A question cannot choose itself");
check(questions.find(target => target.key === "step:current")?.selectable, "A question may explicitly reference its parent step");
check(questions.find(target => target.questionId === "q5")?.hidden, "Question destination inherits hidden parent state");
check(relationshipSelection(steps, "").empty && relationshipSelection(steps, "—").empty, "Both existing empty-link representations remain supported");
check(relationshipSelection(steps, "deleted-step").missing, "Deleted targets are reported without guessing replacements");
check(relationshipSelection(steps, "DUP").ambiguous, "An existing ambiguous link is retained and flagged");
check(relationshipSelection(steps, "START").target?.self, "An existing self-link remains available for explicit review");
check(relationshipSelection(steps, "OPT-01").target?.quickOption, "An existing quick-option link is retained and explained");
check(relationshipSelection(questions, "q4").target?.label === "Podpis zmluvy", "Stored IDs resolve to a human-readable destination");
check(searchRelationshipTargets(questions, "overenie zmluv")[0]?.itemId === "next", "Search tolerates accents");
check(searchRelationshipTargets(questions, "contract podpis", "question").some(target => target.questionId === "q4"), "Search combines allowed identity fields and kind");
check(searchRelationshipTargets(questions, "not-found").length === 0, "No search results cannot invent a target");
check(searchRelationshipTargets(questions, "", "question").every(target => target.kind === "question"), "Kind filter is independent of the stored reference");
const draft = { ...items[0].questions![0] };
const group = relationshipGroup(items[0], draft);
check(group.members.length === 2 && group.mixed, "Mixed saved group modes are visible");
check(group.members.some(question => question.id === "q2" && question.isHidden), "Hidden group members remain part of the saved configuration");
check(group.names.length === 1 && group.names[0] === "Kontakt", "Group suggestions are scoped to the parent step");
check(relationshipGroup(items[0], { ...draft, groupName: " Nová skupina " }).members.length === 1, "Draft preview follows the trimmed group name that will be saved");
check(relationshipGroup(items[0], { ...draft, groupName: "" }).members.some(question => question.id === "q3"), "Blank and NULL share the existing unnamed group");
check(relationshipGroup({ ...items[0], questionSelectionMode: "single" }, draft).stepSingle, "Parent single-selection is explicit");
check(relationshipGroup(items[0], { ...draft, logicOperator: "custom-old-mode" }).unknownLogic, "Unknown saved modes are not silently normalized");
check(JSON.stringify(items) === original, "Reading, searching and previewing never mutate items, siblings or configuration");
console.log(`Status List relationships: ${checks} assertions passed`);
