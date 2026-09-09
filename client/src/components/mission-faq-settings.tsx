import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Bold, ChevronDown, ChevronUp, HelpCircle, Italic, Plus, Save, Trash2, Underline } from "lucide-react";
import type { Campaign } from "@shared/schema";
import {
  normalizeMissionFaqCategoryOrder,
  normalizeMissionFaqItems,
  sanitizeMissionFaqAnswer,
  type MissionFaqItem,
} from "@shared/mission-faq";
import { useI18n } from "@/i18n";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { readMissionFaq, readMissionFaqCategoryOrder } from "@/lib/mission-faq";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const createId = () => typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `faq-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const answerHasText = (answer: string) => sanitizeMissionFaqAnswer(answer).replace(/<[^>]*>/g, "").replace(/&nbsp;|&#160;/gi, " ").trim().length > 0;
type EditorCategory = { key: string; name: string };
type EditorFaqItem = Omit<MissionFaqItem, "category"> & { categoryKey: string };
type EditorState = { categories: EditorCategory[]; items: EditorFaqItem[] };
const createCategory = (name: string): EditorCategory => ({ key: createId(), name });

function buildEditorState(
  settings: string | null | undefined,
  locale: string,
  fallback: string,
): EditorState {
  const sourceItems = readMissionFaq(settings, locale);
  const categories = readMissionFaqCategoryOrder(settings, sourceItems, fallback).map(createCategory);
  const categoryKeys = new Map(categories.map((category) => [category.name, category.key]));
  return {
    categories,
    items: sourceItems.map(({ category, ...item }) => ({
      ...item,
      categoryKey: categoryKeys.get(category || fallback) || categories[0].key,
    })),
  };
}

function materializeItems(
  items: EditorFaqItem[],
  categories: EditorCategory[],
  fallback: string,
): MissionFaqItem[] {
  const categoryNames = new Map(categories.map((category) => [category.key, category.name.trim()]));
  return items.map(({ categoryKey, ...item }) => ({
    ...item,
    category: categoryNames.get(categoryKey) || fallback,
  }));
}

function AnswerEditor({ value, onChange, placeholder, labels, testId }: {
  value: string; onChange: (value: string) => void; placeholder: string; testId: string;
  labels: { bold: string; italic: string; underline: string };
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const editor = editorRef.current;
    const sanitized = sanitizeMissionFaqAnswer(value);
    if (editor && document.activeElement !== editor && editor.innerHTML !== sanitized) editor.innerHTML = sanitized;
  }, [value]);
  const emit = () => onChange(sanitizeMissionFaqAnswer(editorRef.current?.innerHTML || ""));
  const format = (command: "bold" | "italic" | "underline") => {
    editorRef.current?.focus();
    document.execCommand(command);
    emit();
  };
  const tools = [
    { command: "bold" as const, label: labels.bold, icon: Bold },
    { command: "italic" as const, label: labels.italic, icon: Italic },
    { command: "underline" as const, label: labels.underline, icon: Underline },
  ];
  return (
    <div className="overflow-hidden rounded-md border bg-background transition-colors focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/10">
      <div className="flex h-8 items-center gap-0.5 border-b bg-muted/35 px-1">
        {tools.map(({ command, label, icon: Icon }) => (
          <Button key={command} type="button" variant="ghost" size="icon" className="h-6 w-6 rounded-sm" title={label} aria-label={label}
            onMouseDown={(event) => { event.preventDefault(); format(command); }} data-testid={`${testId}-${command}`}>
            <Icon className="h-3.5 w-3.5" />
          </Button>
        ))}
      </div>
      <div ref={editorRef} contentEditable role="textbox" aria-multiline="true" data-placeholder={placeholder}
        className="min-h-20 px-3 py-2 text-sm leading-5 outline-none whitespace-pre-wrap empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground"
        onInput={emit} onBlur={emit}
        onPaste={(event) => { event.preventDefault(); document.execCommand("insertText", false, event.clipboardData.getData("text/plain")); }}
        data-testid={testId} />
    </div>
  );
}

export function MissionFaqSettings({ campaign }: { campaign: Campaign }) {
  const { t, locale } = useI18n();
  const { toast } = useToast();
  const fallback = t.campaigns.faq.category;
  const [initialEditorState] = useState(() => buildEditorState(campaign.settings, locale, fallback));
  const [items, setItems] = useState<EditorFaqItem[]>(initialEditorState.items);
  const [categories, setCategories] = useState<EditorCategory[]>(initialEditorState.categories);
  const [newCategory, setNewCategory] = useState("");
  const [modified, setModified] = useState(false);
  const hasIncompleteItem = items.some((item) => !item.question.trim() || !answerHasText(item.answer));
  const normalizedCategoryNames = categories.map((category) => category.name.trim());
  const hasInvalidCategory = normalizedCategoryNames.some((category) => !category)
    || new Set(normalizedCategoryNames).size !== normalizedCategoryNames.length;

  useEffect(() => {
    const next = buildEditorState(campaign.settings, locale, fallback);
    setItems(next.items);
    setCategories(next.categories);
    setNewCategory("");
    setModified(false);
  }, [campaign.id, campaign.settings, locale, fallback]);

  const saveMutation = useMutation({
    mutationFn: () => {
      const faq = normalizeMissionFaqItems(materializeItems(items, categories, fallback));
      return apiRequest("PATCH", `/api/campaigns/${campaign.id}/faq`, {
        faq,
        faqCategoryOrder: normalizeMissionFaqCategoryOrder(categories.map((category) => category.name), faq, fallback),
      });
    },
    onSuccess: () => {
      setModified(false);
      toast({ title: t.campaigns.detail.faqSaved });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaign.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/assigned-campaigns"] });
    },
    onError: () => toast({ title: t.campaigns.detail.error, description: t.campaigns.detail.faqSaveError, variant: "destructive" }),
  });

  const change = (fn: () => void) => { fn(); setModified(true); };
  const updateItem = (id: string, patch: Partial<EditorFaqItem>) => change(() => setItems((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item)));
  const move = <T,>(list: T[], index: number, direction: -1 | 1) => {
    const next = [...list]; [next[index], next[index + direction]] = [next[index + direction], next[index]]; return next;
  };
  const moveQuestion = (categoryKey: string, index: number, direction: -1 | 1) => change(() => setItems((current) => {
    const positions = current.map((candidate, itemIndex) => candidate.categoryKey === categoryKey ? itemIndex : -1).filter((itemIndex) => itemIndex >= 0);
    const next = [...current];
    const from = positions[index];
    const to = positions[index + direction];
    [next[from], next[to]] = [next[to], next[from]];
    return next;
  }));
  const addCategory = () => {
    const name = newCategory.trim().slice(0, 100);
    if (!name || categories.some((category) => category.name === name)) return;
    change(() => { setCategories((current) => [...current, createCategory(name)]); setNewCategory(""); });
  };
  const renameCategory = (category: EditorCategory, name: string) => {
    setCategories((current) => current.map((candidate) => candidate.key === category.key ? { ...candidate, name } : candidate));
    setModified(true);
  };
  const deleteCategory = (category: EditorCategory) => {
    const containsQuestions = items.some((item) => item.categoryKey === category.key);
    if (containsQuestions && !window.confirm(t.campaigns.detail.faqDeleteCategoryConfirm)) return;
    change(() => {
      setItems((current) => current.filter((item) => item.categoryKey !== category.key));
      setCategories((current) => {
        const next = current.filter((candidate) => candidate.key !== category.key);
        return next.length ? next : [createCategory(fallback)];
      });
    });
  };
  const addQuestion = (categoryKey: string) => change(() => setItems((current) => [
    ...current,
    { id: createId(), question: "", answer: "", categoryKey },
  ]));

  return (
    <Card className="overflow-hidden border-border/80 shadow-sm">
      <CardHeader className="border-b bg-muted/20 px-4 py-4 sm:px-5">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2 text-base"><HelpCircle className="h-4 w-4 text-primary" />{t.campaigns.detail.faqTitle}</CardTitle>
            <CardDescription className="mt-1 text-xs">{t.campaigns.detail.faqDescription}</CardDescription>
          </div>
          <Button type="button" size="sm" onClick={() => saveMutation.mutate()}
            title={hasIncompleteItem || hasInvalidCategory ? t.campaigns.detail.faqIncomplete : undefined}
            disabled={!modified || hasIncompleteItem || hasInvalidCategory || saveMutation.isPending}
            data-testid="button-save-mission-faq">
            <Save className="mr-1.5 h-3.5 w-3.5" />{t.common.save}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 p-3 sm:p-4">
        <div className="flex gap-2 rounded-lg border border-dashed bg-muted/15 p-2">
          <Input value={newCategory} maxLength={100} placeholder={t.campaigns.detail.faqCategoryNamePlaceholder} className="h-8 bg-background text-sm"
            onChange={(event) => setNewCategory(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addCategory(); } }}
            data-testid="input-mission-faq-new-category" />
          <Button type="button" variant="outline" size="sm" className="h-8 shrink-0" onClick={addCategory} disabled={!newCategory.trim() || categories.some((category) => category.name === newCategory.trim())} data-testid="button-add-mission-faq-category">
            <Plus className="mr-1 h-3.5 w-3.5" />{t.campaigns.detail.faqAddCategory}
          </Button>
        </div>
        {categories.map((category, categoryIndex) => {
          const categoryItems = items.filter((item) => item.categoryKey === category.key);
          return <section key={category.key} className="overflow-hidden rounded-lg border bg-card" data-testid={`mission-faq-category-${category.name}`}>
            <header className="flex items-center gap-2 border-b bg-muted/25 px-3 py-2">
              <Input aria-label={t.campaigns.detail.faqCategoryNamePlaceholder} value={category.name} maxLength={100} className="h-7 max-w-xs border-transparent bg-transparent px-1 text-sm font-semibold shadow-none hover:border-input focus-visible:border-input focus-visible:ring-1"
                onChange={(event) => renameCategory(category, event.target.value.replace(/<[^>]*>/g, "").slice(0, 100))} />
              <div className="ml-auto flex items-center gap-0.5">
                <Button type="button" variant="ghost" size="icon" className="h-7 w-7" aria-label={t.campaigns.detail.faqMoveUp} title={t.campaigns.detail.faqMoveUp} disabled={categoryIndex === 0} onClick={() => change(() => setCategories((current) => move(current, categoryIndex, -1))) }><ChevronUp className="h-3.5 w-3.5" /></Button>
                <Button type="button" variant="ghost" size="icon" className="h-7 w-7" aria-label={t.campaigns.detail.faqMoveDown} title={t.campaigns.detail.faqMoveDown} disabled={categoryIndex === categories.length - 1} onClick={() => change(() => setCategories((current) => move(current, categoryIndex, 1))) }><ChevronDown className="h-3.5 w-3.5" /></Button>
                <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" aria-label={t.campaigns.detail.faqDeleteCategory} title={t.campaigns.detail.faqDeleteCategory} onClick={() => deleteCategory(category)}><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
            </header>
            <div className="space-y-2 p-2">
              {categoryItems.map((item, index) => <div key={item.id} className="rounded-md border bg-background p-2.5" data-testid={`mission-faq-item-${item.id}`}>
                <div className="mb-2 flex items-center gap-1.5">
                  <span className="w-5 text-center text-[11px] font-semibold tabular-nums text-muted-foreground">{index + 1}</span>
                  <Input value={item.question} maxLength={300} placeholder={t.campaigns.detail.faqQuestionPlaceholder} className="h-8 flex-1 text-sm" onChange={(event) => updateItem(item.id, { question: event.target.value })} data-testid={`input-mission-faq-question-${item.id}`} />
                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7" aria-label={t.campaigns.detail.faqMoveUp} title={t.campaigns.detail.faqMoveUp} disabled={index === 0} onClick={() => moveQuestion(category.key, index, -1)}><ChevronUp className="h-3.5 w-3.5" /></Button>
                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7" aria-label={t.campaigns.detail.faqMoveDown} title={t.campaigns.detail.faqMoveDown} disabled={index === categoryItems.length - 1} onClick={() => moveQuestion(category.key, index, 1)}><ChevronDown className="h-3.5 w-3.5" /></Button>
                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" title={t.campaigns.detail.faqDelete} aria-label={t.campaigns.detail.faqDelete} onClick={() => change(() => setItems((current) => current.filter((candidate) => candidate.id !== item.id)))} data-testid={`button-delete-mission-faq-${item.id}`}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
                <AnswerEditor value={item.answer} onChange={(answer) => updateItem(item.id, { answer })} placeholder={t.campaigns.detail.faqAnswerPlaceholder} labels={{ bold: t.campaigns.detail.faqBold, italic: t.campaigns.detail.faqItalic, underline: t.campaigns.detail.faqUnderline }} testId={`editor-mission-faq-answer-${item.id}`} />
              </div>)}
              {categoryItems.length === 0 && <div className="rounded-md border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">{t.campaigns.detail.faqEmpty}</div>}
              <Button type="button" variant="ghost" size="sm" className="h-8 w-full justify-start text-xs text-primary hover:text-primary" onClick={() => addQuestion(category.key)} data-testid={`button-add-mission-faq-${category.name}`}><Plus className="mr-1.5 h-3.5 w-3.5" />{t.campaigns.detail.faqAddQuestion}</Button>
            </div>
          </section>;
        })}
      </CardContent>
    </Card>
  );
}