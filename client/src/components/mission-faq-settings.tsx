import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Bold, HelpCircle, Plus, Save, Trash2 } from "lucide-react";
import type { Campaign } from "@shared/schema";
import {
  normalizeMissionFaqItems,
  sanitizeMissionFaqAnswer,
  type MissionFaqItem,
} from "@shared/mission-faq";
import { useI18n } from "@/i18n";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

function readFaq(settings: string | null | undefined): MissionFaqItem[] {
  try {
    return normalizeMissionFaqItems(JSON.parse(settings || "{}").faq);
  } catch {
    return [];
  }
}

function SimpleBoldEditor({
  value,
  onChange,
  placeholder,
  boldLabel,
  testId,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  boldLabel: string;
  testId: string;
}) {
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const editor = editorRef.current;
    const sanitized = sanitizeMissionFaqAnswer(value);
    if (editor && document.activeElement !== editor && editor.innerHTML !== sanitized) {
      editor.innerHTML = sanitized;
    }
  }, [value]);

  const emitChange = () => {
    onChange(sanitizeMissionFaqAnswer(editorRef.current?.innerHTML || ""));
  };

  return (
    <div className="rounded-md border bg-background overflow-hidden">
      <div className="flex items-center border-b bg-muted/30 px-1 py-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          title={boldLabel}
          aria-label={boldLabel}
          onMouseDown={(event) => {
            event.preventDefault();
            editorRef.current?.focus();
            document.execCommand("bold");
            emitChange();
          }}
          data-testid={`${testId}-bold`}
        >
          <Bold className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div
        ref={editorRef}
        contentEditable
        role="textbox"
        aria-multiline="true"
        data-placeholder={placeholder}
        className="min-h-24 px-3 py-2 text-sm outline-none whitespace-pre-wrap empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground"
        onInput={emitChange}
        onBlur={emitChange}
        onPaste={(event) => {
          event.preventDefault();
          document.execCommand("insertText", false, event.clipboardData.getData("text/plain"));
        }}
        data-testid={testId}
      />
    </div>
  );
}

export function MissionFaqSettings({ campaign }: { campaign: Campaign }) {
  const { t } = useI18n();
  const { toast } = useToast();
  const [items, setItems] = useState<MissionFaqItem[]>(() => readFaq(campaign.settings));
  const [modified, setModified] = useState(false);
  const hasIncompleteItem = items.some((item) => (
    !item.question.trim()
    || !item.answer.replace(/<[^>]*>/g, "").replace(/&nbsp;|&#160;/gi, " ").trim()
  ));

  useEffect(() => {
    setItems(readFaq(campaign.settings));
    setModified(false);
  }, [campaign.id, campaign.settings]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      let settings: Record<string, unknown> = {};
      try {
        settings = JSON.parse(campaign.settings || "{}");
      } catch {}
      const faq = normalizeMissionFaqItems(items);
      return apiRequest("PATCH", `/api/campaigns/${campaign.id}`, {
        settings: JSON.stringify({ ...settings, faq }),
      });
    },
    onSuccess: () => {
      setModified(false);
      toast({ title: t.campaigns.detail.faqSaved });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaign.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/assigned-campaigns"] });
    },
    onError: () => {
      toast({
        title: t.campaigns.detail.error,
        description: t.campaigns.detail.faqSaveError,
        variant: "destructive",
      });
    },
  });

  const updateItem = (id: string, patch: Partial<MissionFaqItem>) => {
    setItems((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item));
    setModified(true);
  };

  const addItem = () => {
    setItems((current) => [
      ...current,
      {
        id: typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `faq-${Date.now()}`,
        question: "",
        answer: "",
      },
    ]);
    setModified(true);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5" />
            {t.campaigns.detail.faqTitle}
          </CardTitle>
          <CardDescription>{t.campaigns.detail.faqDescription}</CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" onClick={addItem} data-testid="button-add-mission-faq">
            <Plus className="h-4 w-4 mr-2" />
            {t.campaigns.detail.faqAdd}
          </Button>
          <Button
            type="button"
            onClick={() => saveMutation.mutate()}
            disabled={!modified || hasIncompleteItem || saveMutation.isPending}
            title={hasIncompleteItem ? t.campaigns.detail.faqIncomplete : undefined}
            data-testid="button-save-mission-faq"
          >
            <Save className="h-4 w-4 mr-2" />
            {t.common.save}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {items.length === 0 ? (
          <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
            <HelpCircle className="h-8 w-8 mx-auto mb-2 opacity-40" />
            {t.campaigns.detail.faqEmpty}
          </div>
        ) : items.map((item, index) => (
          <div key={item.id} className="rounded-lg border p-4 space-y-3" data-testid={`mission-faq-item-${item.id}`}>
            <div className="flex items-center gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                {index + 1}
              </span>
              <Input
                value={item.question}
                maxLength={300}
                placeholder={t.campaigns.detail.faqQuestionPlaceholder}
                onChange={(event) => updateItem(item.id, { question: event.target.value })}
                data-testid={`input-mission-faq-question-${item.id}`}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0 text-destructive hover:text-destructive"
                title={t.campaigns.detail.faqDelete}
                onClick={() => {
                  setItems((current) => current.filter((candidate) => candidate.id !== item.id));
                  setModified(true);
                }}
                data-testid={`button-delete-mission-faq-${item.id}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <SimpleBoldEditor
              value={item.answer}
              onChange={(answer) => updateItem(item.id, { answer })}
              placeholder={t.campaigns.detail.faqAnswerPlaceholder}
              boldLabel={t.campaigns.detail.faqBold}
              testId={`editor-mission-faq-answer-${item.id}`}
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}