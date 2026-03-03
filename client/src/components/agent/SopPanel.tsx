import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useI18n } from "@/i18n";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Search, BookOpen, Pin, CheckCircle2, AlertTriangle, AlertCircle, Maximize2, Tag, Clock, X, ChevronDown, ChevronUp, ChevronRight, FileText, FolderOpen,
  Clipboard, FolderClosed, FileCheck, Bookmark, Heart, Syringe,
  Phone, Mail, MessageSquare, Shield, Settings, Target, Globe,
  Star, Lightbulb, BarChart3, Lock, Key, Zap, Bell, Calendar,
  Thermometer, Baby, Brain, Microscope, Stethoscope, Pill,
  CircleCheck, CircleX, RefreshCw, ArrowLeftRight, Package,
  Tags, GraduationCap, Headphones, Award, Sparkles,
  type LucideIcon
} from "lucide-react";
import type { SopArticle, SopCategory, SopArticleRead } from "@shared/schema";

const ICON_MAP: Record<string, LucideIcon> = {
  "clipboard": Clipboard, "folder-closed": FolderClosed, "folder-open": FolderOpen,
  "file-text": FileText, "file-check": FileCheck, "bookmark": Bookmark, "book-open": BookOpen,
  "tags": Tags, "package": Package, "heart": Heart, "syringe": Syringe, "baby": Baby,
  "brain": Brain, "microscope": Microscope, "stethoscope": Stethoscope, "pill": Pill,
  "thermometer": Thermometer, "phone": Phone, "mail": Mail, "message-square": MessageSquare,
  "headphones": Headphones, "users": Search, "settings": Settings, "target": Target,
  "bar-chart": BarChart3, "circle-check": CircleCheck, "circle-x": CircleX,
  "alert-circle": AlertCircle, "refresh-cw": RefreshCw, "arrow-left-right": ArrowLeftRight,
  "zap": Zap, "clock": Clock, "globe": Globe, "star": Star, "lightbulb": Lightbulb,
  "lock": Lock, "key": Key, "shield": Shield, "bell": Bell, "calendar": Calendar,
  "award": Award, "sparkles": Sparkles, "graduation-cap": GraduationCap,
};

function isEmojiIcon(str: string | null | undefined): boolean {
  if (!str) return false;
  return /\p{Emoji}/u.test(str) && !ICON_MAP[str];
}

function getIconComponent(iconName: string | null | undefined): LucideIcon {
  if (!iconName) return FolderOpen;
  return ICON_MAP[iconName] || FolderOpen;
}

function sanitizeHtml(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, "")
    .replace(/on\w+\s*=\s*\S+/gi, "")
    .replace(/javascript\s*:/gi, "");
}

function stripHtml(html: string): string {
  const div = document.createElement("div");
  div.innerHTML = html;
  return div.textContent || div.innerText || "";
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highlightText(text: string, query: string): string {
  if (!query || query.length < 2) return text;
  const escaped = escapeRegex(query);
  const regex = new RegExp(`(${escaped})`, "gi");
  return text.replace(regex, '<mark class="bg-yellow-200 dark:bg-yellow-800 text-foreground rounded-sm px-0.5">$1</mark>');
}

function highlightHtml(html: string, query: string): string {
  if (!query || query.length < 2) return html;
  const escaped = escapeRegex(query);
  const regex = new RegExp(escaped, "gi");
  const parts = html.split(/(<[^>]*>)/);
  return parts.map(part => {
    if (part.startsWith("<")) return part;
    return part.replace(regex, '<mark class="bg-yellow-200 dark:bg-yellow-800 text-foreground rounded-sm px-0.5">$&</mark>');
  }).join("");
}

function getSnippets(text: string, query: string, maxSnippets = 3): string[] {
  if (!query || query.length < 2) return [];
  const lower = text.toLowerCase();
  const qLower = query.toLowerCase();
  const snippets: string[] = [];
  let startPos = 0;

  while (snippets.length < maxSnippets) {
    const idx = lower.indexOf(qLower, startPos);
    if (idx === -1) break;

    const snippetStart = Math.max(0, idx - 60);
    const snippetEnd = Math.min(text.length, idx + query.length + 60);
    let snippet = text.slice(snippetStart, snippetEnd).trim();
    if (snippetStart > 0) snippet = "..." + snippet;
    if (snippetEnd < text.length) snippet = snippet + "...";

    snippets.push(snippet);
    startPos = idx + query.length;
  }

  return snippets;
}

interface MatchResult {
  article: SopArticle;
  titleMatch: boolean;
  contentMatch: boolean;
  summaryMatch: boolean;
  tagsMatch: boolean;
  snippets: string[];
  matchCount: number;
  isCampaignLinked: boolean;
}

interface SopPanelProps {
  campaignId?: string;
  userId?: string;
}

export function SopPanel({ campaignId, userId }: SopPanelProps) {
  const { t } = useI18n();
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [maximizedArticle, setMaximizedArticle] = useState<SopArticle | null>(null);
  const [expandedResults, setExpandedResults] = useState<Set<string>>(new Set());
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [collapsedInitialized, setCollapsedInitialized] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearchChange = useCallback((value: string) => {
    setSearchInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setSearchQuery(value), 150);
  }, []);

  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, []);

  const { data: categories = [] } = useQuery<SopCategory[]>({
    queryKey: ["/api/sop/categories"],
  });

  useEffect(() => {
    if (categories.length > 0 && !collapsedInitialized) {
      setCollapsedCategories(new Set(categories.map(c => c.id)));
      setCollapsedInitialized(true);
    }
  }, [categories, collapsedInitialized]);

  const { data: allArticles = [], isLoading: isLoadingAll } = useQuery<SopArticle[]>({
    queryKey: ["/api/sop/articles", "published"],
    queryFn: async () => {
      const res = await fetch(`/api/sop/articles?isPublished=true`, { credentials: "include" });
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

  const readArticleIds = useMemo(() => new Set(userReads.map(r => r.articleId)), [userReads]);
  const campaignArticleIds = useMemo(() => new Set(campaignArticles.map(a => a.id)), [campaignArticles]);

  const filteredArticles = useMemo(() => {
    let arts = allArticles;
    if (selectedCategory) {
      arts = arts.filter(a => a.categoryId === selectedCategory);
    }
    return arts;
  }, [allArticles, selectedCategory]);

  const plainTextCache = useMemo(() => {
    const cache = new Map<string, string>();
    for (const article of allArticles) {
      cache.set(article.id, stripHtml(article.content));
    }
    return cache;
  }, [allArticles]);

  const searchResults = useMemo((): MatchResult[] | null => {
    const q = searchQuery.trim();
    if (q.length < 2) return null;

    const qLower = q.toLowerCase();

    const results: MatchResult[] = [];

    for (const article of filteredArticles) {
      const titleMatch = article.title.toLowerCase().includes(qLower);
      const plainContent = plainTextCache.get(article.id) || stripHtml(article.content);
      const contentMatch = plainContent.toLowerCase().includes(qLower);
      const summaryMatch = article.summary ? article.summary.toLowerCase().includes(qLower) : false;
      const tagsMatch = article.tags ? article.tags.some(tag => tag.toLowerCase().includes(qLower)) : false;

      if (!titleMatch && !contentMatch && !summaryMatch && !tagsMatch) continue;

      const snippets = contentMatch ? getSnippets(plainContent, q) : [];

      let matchCount = 0;
      if (titleMatch) matchCount++;
      if (contentMatch) {
        const regex = new RegExp(escapeRegex(qLower), "gi");
        matchCount += (plainContent.match(regex) || []).length;
      }
      if (summaryMatch) matchCount++;
      if (tagsMatch) matchCount++;

      results.push({
        article,
        titleMatch,
        contentMatch,
        summaryMatch,
        tagsMatch,
        snippets,
        matchCount,
        isCampaignLinked: campaignArticleIds.has(article.id),
      });
    }

    results.sort((a, b) => {
      if (a.titleMatch !== b.titleMatch) return a.titleMatch ? -1 : 1;
      return b.matchCount - a.matchCount;
    });

    return results;
  }, [searchQuery, filteredArticles, campaignArticleIds, plainTextCache]);

  const toggleExpanded = useCallback((id: string) => {
    setExpandedResults(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleArticleOpen = (article: SopArticle) => {
    if (!readArticleIds.has(article.id)) {
      markReadMutation.mutate(article.id);
    }
  };

  const clearSearch = () => {
    setSearchInput("");
    setSearchQuery("");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    searchInputRef.current?.focus();
  };

  const toggleCategory = useCallback((catId: string) => {
    setCollapsedCategories(prev => {
      const next = new Set(prev);
      if (next.has(catId)) next.delete(catId);
      else next.add(catId);
      return next;
    });
  }, []);

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

  const isSearching = searchQuery.trim().length >= 2;
  const totalMatches = searchResults ? searchResults.reduce((sum, r) => sum + r.matchCount, 0) : 0;

  const sortByTreeOrder = useCallback((arts: SopArticle[]) => {
    const catSortMap = new Map<string, number>();
    const catParentMap = new Map<string, string | null>();
    categories.forEach(c => {
      catSortMap.set(c.id, c.sortOrder || 0);
      catParentMap.set(c.id, c.parentId || null);
    });
    const getCatEffectiveSort = (catId: string): number => {
      const parentId = catParentMap.get(catId);
      const parentSort = parentId ? (catSortMap.get(parentId) || 0) * 10000 : 0;
      return parentSort + (catSortMap.get(catId) || 0);
    };
    return [...arts].sort((a, b) => {
      const catA = getCatEffectiveSort(a.categoryId);
      const catB = getCatEffectiveSort(b.categoryId);
      if (catA !== catB) return catA - catB;
      return (a.sortOrder || 0) - (b.sortOrder || 0);
    });
  }, [categories]);

  const campaignSpecific = sortByTreeOrder(filteredArticles.filter(a => campaignArticleIds.has(a.id)));
  const general = sortByTreeOrder(filteredArticles.filter(a => !campaignArticleIds.has(a.id)));

  const renderTreeView = (articles: SopArticle[], isCampaign: boolean) => {
    const activeCats = categories.filter(c => c.isActive).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    const topLevel = activeCats.filter(c => !c.parentId);
    const getChildren = (pid: string) => activeCats.filter(c => c.parentId === pid).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    const getArticlesForCat = (catId: string) => articles.filter(a => a.categoryId === catId).sort((a, b) => {
      if ((a.isPinned ? 1 : 0) !== (b.isPinned ? 1 : 0)) return a.isPinned ? -1 : 1;
      return (a.sortOrder || 0) - (b.sortOrder || 0);
    });

    const assignedCatIds = new Set(articles.map(a => a.categoryId));
    const relevantTopCats = topLevel.filter(c => {
      if (assignedCatIds.has(c.id)) return true;
      return getChildren(c.id).some(ch => assignedCatIds.has(ch.id));
    });

    const renderCategoryHeader = (cat: SopCategory, isChild: boolean, articleCount: number) => {
      const CatIcon = getIconComponent(cat.icon);
      const isCollapsed = collapsedCategories.has(cat.id);
      return (
        <button
          type="button"
          key={`cat-header-${cat.id}`}
          className={`w-full flex items-center gap-2 px-3 py-2 transition-colors hover:bg-muted/50 ${isChild ? "pl-7" : ""}`}
          onClick={() => toggleCategory(cat.id)}
          data-testid={`sop-tree-cat-${cat.id}`}
        >
          <div className={`flex items-center justify-center rounded-md ${isChild ? "h-5 w-5" : "h-6 w-6"} ${isCampaign ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400" : "bg-primary/10 text-primary"}`}>
            {isEmojiIcon(cat.icon)
              ? <span className={isChild ? "text-xs leading-none" : "text-sm leading-none"}>{cat.icon}</span>
              : <CatIcon className={isChild ? "h-3 w-3" : "h-3.5 w-3.5"} />}
          </div>
          <span className={`flex-1 text-left truncate ${isChild ? "text-[11px] font-medium text-muted-foreground" : "text-xs font-semibold"}`}>
            {isChild && <span className="text-muted-foreground/50 mr-0.5">↳</span>}
            {cat.name}
          </span>
          <Badge variant="secondary" className="text-[9px] h-4 px-1 shrink-0">{articleCount}</Badge>
          {isCollapsed
            ? <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
            : <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
          }
        </button>
      );
    };

    return (
      <div>
        {relevantTopCats.map(cat => {
          const catArticles = getArticlesForCat(cat.id);
          const children = getChildren(cat.id).filter(ch => assignedCatIds.has(ch.id));
          const totalCount = catArticles.length + children.reduce((sum, ch) => sum + getArticlesForCat(ch.id).length, 0);
          const isCatCollapsed = collapsedCategories.has(cat.id);

          return (
            <div key={cat.id} className="border-b last:border-b-0" data-testid={`sop-tree-group-${cat.id}`}>
              {renderCategoryHeader(cat, false, totalCount)}
              {!isCatCollapsed && (
                <div>
                  {catArticles.length > 0 && (
                    <div className="ml-4 border-l-2 border-primary/10">
                      {catArticles.map(a => renderArticleItem(a, isCampaign))}
                    </div>
                  )}
                  {children.map(child => {
                    const childArticles = getArticlesForCat(child.id);
                    const isChildCollapsed = collapsedCategories.has(child.id);
                    return (
                      <div key={child.id} data-testid={`sop-tree-subgroup-${child.id}`}>
                        {renderCategoryHeader(child, true, childArticles.length)}
                        {!isChildCollapsed && childArticles.length > 0 && (
                          <div className="ml-8 border-l-2 border-muted-foreground/10">
                            {childArticles.map(a => renderArticleItem(a, isCampaign))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const renderSearchResult = (result: MatchResult) => {
    const { article, titleMatch, contentMatch, summaryMatch, tagsMatch, snippets, matchCount } = result;
    const isExpanded = expandedResults.has(article.id);

    return (
      <div key={article.id} className="border-b last:border-b-0" data-testid={`sop-search-result-${article.id}`}>
        <button
          type="button"
          className="w-full text-left px-3 py-2.5 transition-colors hover:bg-muted/50"
          onClick={() => { toggleExpanded(article.id); handleArticleOpen(article); }}
          data-testid={`sop-search-result-toggle-${article.id}`}
        >
          <div className="flex items-start gap-2">
            <FileText className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                {article.isPinned && <Pin className="h-3 w-3 text-blue-500 shrink-0" />}
                {!readArticleIds.has(article.id) && (
                  <Badge variant="secondary" className="text-[8px] h-3.5 px-1 bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">{t.sop?.newBadge || "NEW"}</Badge>
                )}
                {result.isCampaignLinked && (
                  <Badge variant="outline" className="text-[8px] h-3.5 px-1 border-green-300 text-green-700 dark:text-green-400">{t.sop?.campaignBadge || "CAMPAIGN"}</Badge>
                )}
                {getPriorityBadge(article.priority)}
                <Badge variant="secondary" className="text-[8px] h-3.5 px-1 ml-auto">{matchCount}×</Badge>
              </div>
              <div
                className="text-xs font-medium leading-tight"
                dangerouslySetInnerHTML={{ __html: titleMatch ? highlightText(article.title, searchQuery) : article.title }}
                data-testid={`sop-search-title-${article.id}`}
              />
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                  <Tag className="h-2.5 w-2.5" />{getCategoryName(article.categoryId)}
                </span>
                {titleMatch && <Badge variant="outline" className="text-[7px] h-3 px-1 border-yellow-400 text-yellow-700 dark:text-yellow-300">{t.sop.matchInTitle}</Badge>}
                {contentMatch && <Badge variant="outline" className="text-[7px] h-3 px-1 border-yellow-400 text-yellow-700 dark:text-yellow-300">{t.sop.matchInContent}</Badge>}
                {summaryMatch && <Badge variant="outline" className="text-[7px] h-3 px-1 border-yellow-400 text-yellow-700 dark:text-yellow-300">{t.sop.matchInSummary}</Badge>}
                {tagsMatch && <Badge variant="outline" className="text-[7px] h-3 px-1 border-yellow-400 text-yellow-700 dark:text-yellow-300">{t.sop.matchInTags}</Badge>}
              </div>
              {snippets.length > 0 && (
                <div className="mt-1.5 space-y-1">
                  {snippets.slice(0, isExpanded ? undefined : 1).map((snippet, i) => (
                    <div
                      key={i}
                      className="text-[11px] text-muted-foreground leading-relaxed bg-muted/40 rounded px-2 py-1"
                      dangerouslySetInnerHTML={{ __html: highlightText(snippet, searchQuery) }}
                      data-testid={`sop-search-snippet-${article.id}-${i}`}
                    />
                  ))}
                </div>
              )}
            </div>
            <div className="shrink-0 mt-0.5">
              {isExpanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
            </div>
          </div>
        </button>

        {isExpanded && (
          <div className="px-3 pb-3 border-t bg-muted/10">
            <div className="flex justify-end my-1.5">
              <Button variant="outline" size="sm" className="h-6 text-[10px] gap-1" onClick={() => setMaximizedArticle(article)} data-testid={`sop-maximize-${article.id}`}>
                <Maximize2 className="h-3 w-3" />{t.sop.enlarge}
              </Button>
            </div>
            {article.summary && (
              <p className="text-[11px] text-muted-foreground italic mb-2 leading-relaxed"
                dangerouslySetInnerHTML={{ __html: summaryMatch ? highlightText(article.summary, searchQuery) : article.summary }}
                data-testid={`sop-search-summary-${article.id}`}
              />
            )}
            <div
              className="text-xs leading-relaxed prose prose-sm dark:prose-invert max-w-none [&_h1]:text-sm [&_h2]:text-xs [&_h3]:text-xs [&_p]:text-xs [&_li]:text-xs [&_ul]:my-1 [&_ol]:my-1 [&_p]:my-1"
              dangerouslySetInnerHTML={{ __html: searchQuery ? highlightHtml(sanitizeHtml(article.content), searchQuery) : sanitizeHtml(article.content) }}
              data-testid={`sop-search-content-${article.id}`}
            />
            {article.tags && article.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t">
                {article.tags.map((tag, i) => (
                  <Badge key={i} variant="secondary" className="text-[9px] h-4"
                    dangerouslySetInnerHTML={{ __html: tagsMatch ? highlightText(tag, searchQuery) : tag }}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderArticleItem = (article: SopArticle, isCampaignLinked: boolean) => (
    <div key={article.id} className="border-b last:border-b-0" data-testid={`sop-article-${article.id}`}>
      <button
        type="button"
        className="w-full text-left px-3 py-2.5 transition-colors hover:bg-muted/50"
        onClick={() => { toggleExpanded(article.id); handleArticleOpen(article); }}
        data-testid={`sop-article-trigger-${article.id}`}
      >
        <div className="flex items-start gap-2">
          <FileText className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
              {article.isPinned && <Pin className="h-3 w-3 text-blue-500 shrink-0" />}
              {!readArticleIds.has(article.id) && (
                <Badge variant="secondary" className="text-[8px] h-3.5 px-1 bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" data-testid={`sop-new-badge-${article.id}`}>{t.sop?.newBadge || "NEW"}</Badge>
              )}
              {isCampaignLinked && (
                <Badge variant="outline" className="text-[8px] h-3.5 px-1 border-green-300 text-green-700 dark:text-green-400" data-testid={`sop-campaign-badge-${article.id}`}>{t.sop?.campaignBadge || "CAMPAIGN"}</Badge>
              )}
              {getPriorityBadge(article.priority)}
            </div>
            <span className="text-xs font-medium leading-tight truncate block" data-testid={`sop-article-title-${article.id}`}>{article.title}</span>
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
              <span className="flex items-center gap-0.5">
                <Clock className="h-2.5 w-2.5" />{formatDate(article.updatedAt)}
              </span>
              {readArticleIds.has(article.id) && (
                <CheckCircle2 className="h-3 w-3 text-green-500" data-testid={`sop-read-check-${article.id}`} />
              )}
            </div>
          </div>
          <div className="shrink-0 mt-0.5">
            {expandedResults.has(article.id) ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
          </div>
        </div>
      </button>

      {expandedResults.has(article.id) && (
        <div className="px-3 pb-3 border-t bg-muted/10">
          <div className="flex justify-end my-1.5">
            <Button variant="outline" size="sm" className="h-6 text-[10px] gap-1" onClick={() => setMaximizedArticle(article)} data-testid={`sop-maximize-${article.id}`}>
              <Maximize2 className="h-3 w-3" />{t.sop.enlarge}
            </Button>
          </div>
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
        </div>
      )}
    </div>
  );

  return (
    <div className="flex flex-col h-full" data-testid="sop-panel">
      <div className="p-2 border-b space-y-2 shrink-0">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            ref={searchInputRef}
            placeholder={t.sop.searchSop}
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="h-7 text-xs pl-7 pr-7"
            data-testid="sop-search-input"
          />
          {searchInput && (
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={clearSearch}
              data-testid="sop-search-clear"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {isSearching && searchResults && (
          <div className="flex items-center gap-1.5" data-testid="sop-search-status">
            <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
              {searchResults.length} · {totalMatches} {t.sop.matchesFound}
            </Badge>
          </div>
        )}

        <div className="flex gap-1 flex-wrap">
          <Button variant={selectedCategory === null ? "default" : "outline"} size="sm" className="h-5 text-[10px] px-2" onClick={() => setSelectedCategory(null)} data-testid="sop-filter-all">
            {t.sop.all}
          </Button>
          {(() => {
            const active = categories.filter(c => c.isActive).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
            const topLevel = active.filter(c => !c.parentId);
            const getChildren = (pid: string) => active.filter(c => c.parentId === pid);
            const buttons: JSX.Element[] = [];
            topLevel.forEach(cat => {
              buttons.push(
                <Button key={cat.id} variant={selectedCategory === cat.id ? "default" : "outline"} size="sm" className="h-5 text-[10px] px-2 font-semibold" onClick={() => setSelectedCategory(cat.id)} data-testid={`sop-filter-${cat.id}`}>
                  {cat.name}
                </Button>
              );
              getChildren(cat.id).forEach(child => {
                buttons.push(
                  <Button key={child.id} variant={selectedCategory === child.id ? "default" : "outline"} size="sm" className="h-5 text-[10px] px-2 ml-1 opacity-80" onClick={() => setSelectedCategory(child.id)} data-testid={`sop-filter-${child.id}`}>
                    ↳ {child.name}
                  </Button>
                );
              });
            });
            return buttons;
          })()}
        </div>
      </div>

      <ScrollArea className="flex-1">
        {isLoadingAll ? (
          <div className="p-4 text-center text-xs text-muted-foreground">{t.sop.loading}</div>
        ) : isSearching && searchResults ? (
          searchResults.length === 0 ? (
            <div className="p-8 text-center" data-testid="sop-search-empty">
              <Search className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
              <p className="text-xs text-muted-foreground">{t.sop.noSopArticles}</p>
              <p className="text-[10px] text-muted-foreground mt-1">{t.sop.tryAdjustSearch}</p>
              <Button variant="ghost" size="sm" className="mt-2 text-xs" onClick={clearSearch} data-testid="sop-search-clear-btn">
                {t.sop.clearSearch}
              </Button>
            </div>
          ) : (
            <div data-testid="sop-search-results">
              {searchResults.map(renderSearchResult)}
            </div>
          )
        ) : filteredArticles.length === 0 ? (
          <div className="p-8 text-center" data-testid="sop-empty-state">
            <BookOpen className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
            <p className="text-xs text-muted-foreground">{t.sop.noSopArticles}</p>
          </div>
        ) : (
          <div className="py-1">
            {campaignSpecific.length > 0 && (
              <div className="mb-1">
                <div className="px-3 py-1.5 bg-green-50 dark:bg-green-950/30 border-b">
                  <span className="text-[10px] font-semibold text-green-700 dark:text-green-400 uppercase tracking-wider" data-testid="sop-campaign-section">
                    {t.sop.campaignSopSection}
                  </span>
                </div>
                {renderTreeView(campaignSpecific, true)}
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
                {renderTreeView(general, false)}
              </div>
            )}
          </div>
        )}
      </ScrollArea>

      <Dialog open={!!maximizedArticle} onOpenChange={() => setMaximizedArticle(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle className="flex items-center gap-2 text-base" data-testid="sop-dialog-title">
              <BookOpen className="h-4 w-4" />
              <span dangerouslySetInnerHTML={{ __html: searchQuery && maximizedArticle?.title ? highlightText(maximizedArticle.title, searchQuery) : (maximizedArticle?.title || "") }} />
              {maximizedArticle?.priority && getPriorityBadge(maximizedArticle.priority)}
            </DialogTitle>
            {maximizedArticle && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{getCategoryName(maximizedArticle.categoryId)}</span>
                <span>·</span>
                <span>{t.sop.updatedAt}: {formatDate(maximizedArticle.updatedAt)}</span>
                {maximizedArticle.version && <><span>·</span><span>v{maximizedArticle.version}</span></>}
              </div>
            )}
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-y-auto mt-2 pr-1">
            {maximizedArticle?.summary && (
              <div className="bg-muted/30 rounded-md p-3 mb-3">
                <p className="text-sm italic text-muted-foreground"
                  dangerouslySetInnerHTML={{ __html: searchQuery ? highlightText(maximizedArticle.summary, searchQuery) : maximizedArticle.summary }}
                />
              </div>
            )}
            <div
              className="prose prose-sm dark:prose-invert max-w-none"
              dangerouslySetInnerHTML={{ __html: searchQuery ? highlightHtml(sanitizeHtml(maximizedArticle?.content || ""), searchQuery) : sanitizeHtml(maximizedArticle?.content || "") }}
            />
            {maximizedArticle?.tags && maximizedArticle.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-4 pt-3 border-t">
                {maximizedArticle.tags.map((tag, i) => (
                  <Badge key={i} variant="secondary" className="text-xs"
                    dangerouslySetInnerHTML={{ __html: searchQuery ? highlightText(tag, searchQuery) : tag }}
                  />
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
