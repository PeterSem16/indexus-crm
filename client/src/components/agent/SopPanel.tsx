import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useI18n } from "@/i18n";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Search, BookOpen, Pin, CheckCircle2, AlertTriangle, AlertCircle, Maximize2, Tag, Clock } from "lucide-react";
import type { SopArticle, SopCategory, SopArticleRead } from "@shared/schema";

function sanitizeHtml(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, "")
    .replace(/on\w+\s*=\s*\S+/gi, "")
    .replace(/javascript\s*:/gi, "");
}

interface SopPanelProps {
  campaignId?: string;
  userId?: string;
}

export function SopPanel({ campaignId, userId }: SopPanelProps) {
  const { t } = useI18n();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [maximizedArticle, setMaximizedArticle] = useState<SopArticle | null>(null);

  const { data: categories = [] } = useQuery<SopCategory[]>({
    queryKey: ["/api/sop/categories"],
  });

  const { data: allArticles = [], isLoading: isLoadingAll } = useQuery<SopArticle[]>({
    queryKey: ["/api/sop/articles", { isPublished: "true", search: searchQuery, categoryId: selectedCategory }],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("isPublished", "true");
      if (searchQuery) params.set("search", searchQuery);
      if (selectedCategory) params.set("categoryId", selectedCategory);
      const res = await fetch(`/api/sop/articles?${params.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch articles");
      return res.json();
    },
  });

  const { data: campaignArticles = [] } = useQuery<SopArticle[]>({
    queryKey: ["/api/sop/articles/campaign", campaignId],
    queryFn: async () => {
      if (!campaignId) return [];
      const res = await fetch(`/api/sop/articles/campaign/${campaignId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch campaign articles");
      return res.json();
    },
    enabled: !!campaignId,
  });

  const { data: userReads = [] } = useQuery<SopArticleRead[]>({
    queryKey: ["/api/sop/user-reads"],
    enabled: !!userId,
  });

  const markReadMutation = useMutation({
    mutationFn: async (articleId: string) => {
      await apiRequest("POST", `/api/sop/articles/${articleId}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sop/user-reads"] });
    },
  });

  const readArticleIds = new Set(userReads.map(r => r.articleId));
  const campaignArticleIds = new Set(campaignArticles.map(a => a.id));

  const articles = allArticles;

  const campaignSpecific = articles.filter(a => campaignArticleIds.has(a.id));
  const general = articles.filter(a => !campaignArticleIds.has(a.id));

  const getPriorityBadge = (priority: string | null) => {
    switch (priority) {
      case "critical":
        return <Badge variant="destructive" className="text-[9px] h-4 px-1 gap-0.5"><AlertCircle className="h-2.5 w-2.5" />{t.sop.priorityCritical}</Badge>;
      case "high":
        return <Badge className="text-[9px] h-4 px-1 gap-0.5 bg-orange-500 hover:bg-orange-600"><AlertTriangle className="h-2.5 w-2.5" />{t.sop.priorityHigh}</Badge>;
      default:
        return null;
    }
  };

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString(undefined, { day: "2-digit", month: "2-digit", year: "numeric" });
  };

  const getCategoryName = (categoryId: string) => {
    return categories.find(c => c.id === categoryId)?.name || "—";
  };

  const handleArticleOpen = (article: SopArticle) => {
    if (!readArticleIds.has(article.id)) {
      markReadMutation.mutate(article.id);
    }
  };

  const renderArticleItem = (article: SopArticle, isCampaignLinked: boolean) => (
    <AccordionItem key={article.id} value={article.id} className="border-b last:border-b-0">
      <AccordionTrigger
        className="px-3 py-2 text-left hover:no-underline hover:bg-muted/50 [&[data-state=open]]:bg-muted/30"
        onClick={() => handleArticleOpen(article)}
        data-testid={`sop-article-trigger-${article.id}`}
      >
        <div className="flex items-start gap-2 flex-1 min-w-0 mr-2">
          <div className="flex flex-col gap-1 flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              {article.isPinned && <Pin className="h-3 w-3 text-blue-500 shrink-0" />}
              {!readArticleIds.has(article.id) && (
                <Badge variant="secondary" className="text-[8px] h-3.5 px-1 bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" data-testid={`sop-new-badge-${article.id}`}>NEW</Badge>
              )}
              {isCampaignLinked && (
                <Badge variant="outline" className="text-[8px] h-3.5 px-1 border-green-300 text-green-700 dark:text-green-400" data-testid={`sop-campaign-badge-${article.id}`}>CAMPAIGN</Badge>
              )}
              {getPriorityBadge(article.priority)}
            </div>
            <span className="text-xs font-medium leading-tight truncate" data-testid={`sop-article-title-${article.id}`}>{article.title}</span>
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-0.5">
                <Tag className="h-2.5 w-2.5" />
                {getCategoryName(article.categoryId)}
              </span>
              <span className="flex items-center gap-0.5">
                <Clock className="h-2.5 w-2.5" />
                {formatDate(article.updatedAt)}
              </span>
              {readArticleIds.has(article.id) && (
                <CheckCircle2 className="h-3 w-3 text-green-500" data-testid={`sop-read-check-${article.id}`} />
              )}
            </div>
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-3 pb-3">
        {article.summary && (
          <p className="text-[11px] text-muted-foreground italic mb-2 leading-relaxed" data-testid={`sop-article-summary-${article.id}`}>{article.summary}</p>
        )}
        <div
          className="text-xs leading-relaxed prose prose-sm dark:prose-invert max-w-none [&_h1]:text-sm [&_h2]:text-xs [&_h3]:text-xs [&_p]:text-xs [&_li]:text-xs [&_ul]:my-1 [&_ol]:my-1 [&_p]:my-1"
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(article.content) }}
          data-testid={`sop-article-content-${article.id}`}
        />
        {article.tags && article.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t">
            {article.tags.map((tag, i) => (
              <Badge key={i} variant="secondary" className="text-[9px] h-4">{tag}</Badge>
            ))}
          </div>
        )}
        <div className="flex justify-end mt-2">
          <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => setMaximizedArticle(article)} data-testid={`sop-maximize-${article.id}`}>
            <Maximize2 className="h-3 w-3 mr-1" />{t.sop.enlarge}
          </Button>
        </div>
      </AccordionContent>
    </AccordionItem>
  );

  return (
    <div className="flex flex-col h-full" data-testid="sop-panel">
      <div className="p-2 border-b space-y-2 shrink-0">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder={t.sop.searchSop} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="h-7 text-xs pl-7" data-testid="sop-search-input" />
        </div>
        <div className="flex gap-1 flex-wrap">
          <Button variant={selectedCategory === null ? "default" : "outline"} size="sm" className="h-5 text-[10px] px-2" onClick={() => setSelectedCategory(null)} data-testid="sop-filter-all">
            {t.sop.all}
          </Button>
          {categories.filter(c => c.isActive).map(cat => (
            <Button key={cat.id} variant={selectedCategory === cat.id ? "default" : "outline"} size="sm" className="h-5 text-[10px] px-2" onClick={() => setSelectedCategory(cat.id)} data-testid={`sop-filter-${cat.id}`}>
              {cat.icon && <span className="mr-0.5">{cat.icon}</span>}{cat.name}
            </Button>
          ))}
        </div>
      </div>

      <ScrollArea className="flex-1">
        {isLoadingAll ? (
          <div className="p-4 text-center text-xs text-muted-foreground">{t.sop.loading}</div>
        ) : articles.length === 0 ? (
          <div className="p-8 text-center" data-testid="sop-empty-state">
            <BookOpen className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
            <p className="text-xs text-muted-foreground">{t.sop.noSopArticles}</p>
            {searchQuery && <p className="text-[10px] text-muted-foreground mt-1">{t.sop.tryAdjustSearch}</p>}
          </div>
        ) : (
          <Accordion type="multiple" className="w-full">
            {campaignSpecific.length > 0 && (
              <div>
                <div className="px-3 py-1.5 bg-green-50 dark:bg-green-950/30 border-b">
                  <span className="text-[10px] font-semibold text-green-700 dark:text-green-400 uppercase tracking-wider" data-testid="sop-campaign-section">
                    {t.sop.campaignSopSection}
                  </span>
                </div>
                {campaignSpecific.map(a => renderArticleItem(a, true))}
              </div>
            )}
            {general.length > 0 && (
              <div>
                {campaignSpecific.length > 0 && (
                  <div className="px-3 py-1.5 bg-muted/30 border-b">
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider" data-testid="sop-general-section">
                      {t.sop.generalSopSection}
                    </span>
                  </div>
                )}
                {general.map(a => renderArticleItem(a, false))}
              </div>
            )}
          </Accordion>
        )}
      </ScrollArea>

      <Dialog open={!!maximizedArticle} onOpenChange={() => setMaximizedArticle(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base" data-testid="sop-dialog-title">
              <BookOpen className="h-4 w-4" />
              {maximizedArticle?.title}
              {maximizedArticle?.priority && getPriorityBadge(maximizedArticle.priority)}
            </DialogTitle>
            {maximizedArticle && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{getCategoryName(maximizedArticle.categoryId)}</span>
                <span>•</span>
                <span>{t.sop.updatedAt}: {formatDate(maximizedArticle.updatedAt)}</span>
                {maximizedArticle.version && <><span>•</span><span>v{maximizedArticle.version}</span></>}
              </div>
            )}
          </DialogHeader>
          <ScrollArea className="flex-1 mt-2">
            {maximizedArticle?.summary && (
              <div className="bg-muted/30 rounded-md p-3 mb-3">
                <p className="text-sm italic text-muted-foreground">{maximizedArticle.summary}</p>
              </div>
            )}
            <div
              className="prose prose-sm dark:prose-invert max-w-none"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(maximizedArticle?.content || "") }}
            />
            {maximizedArticle?.tags && maximizedArticle.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-4 pt-3 border-t">
                {maximizedArticle.tags.map((tag, i) => (
                  <Badge key={i} variant="secondary" className="text-xs">{tag}</Badge>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
