import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/contexts/auth-context";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/i18n";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  BookOpen, Plus, Pencil, Trash2, FolderOpen, FileText, Pin, Copy,
  AlertCircle, AlertTriangle, EyeOff, Users, Search, Tag, Upload, Loader2,
} from "lucide-react";
import TipTapEditor from "@/components/sop/TipTapEditor";
import type { SopCategory, SopArticle, Campaign } from "@shared/schema";

const EMOJI_GROUPS = [
  { label: "Office", emojis: ["📋", "📁", "📂", "📄", "📑", "📌", "📎", "📝", "📒", "📓"] },
  { label: "Medical", emojis: ["🏥", "💉", "🩸", "🧬", "🔬", "💊", "🩺", "🧪", "🫀", "👶"] },
  { label: "Communication", emojis: ["📞", "📧", "💬", "📱", "☎️", "📨", "🗣️", "💌"] },
  { label: "Process", emojis: ["⚙️", "🔧", "🔄", "✅", "❌", "⚠️", "🔀", "📊", "📈", "🎯"] },
  { label: "People", emojis: ["👥", "👤", "🤝", "🧑‍⚕️", "🧑‍💼", "👨‍👩‍👧", "🙋"] },
  { label: "Other", emojis: ["🌐", "💡", "🔒", "🔑", "⭐", "🏷️", "📦", "🗂️", "🛡️", "🔔"] },
];

const ALL_EMOJIS = EMOJI_GROUPS.flatMap(g => g.emojis);

function getEmojiForIcon(iconName: string | null | undefined): string {
  if (!iconName) return "📁";
  if (ALL_EMOJIS.includes(iconName)) return iconName;
  return "📁";
}


export default function SopManagementPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState("articles");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [filterPriority, setFilterPriority] = useState<string | null>(null);

  const [showCategoryDialog, setShowCategoryDialog] = useState(false);
  const [editingCategory, setEditingCategory] = useState<SopCategory | null>(null);
  const [categoryForm, setCategoryForm] = useState({ name: "", description: "", icon: "", sortOrder: 0, countryCode: "", isActive: true });

  const [showArticleDialog, setShowArticleDialog] = useState(false);
  const [editingArticle, setEditingArticle] = useState<SopArticle | null>(null);
  const [articleForm, setArticleForm] = useState({
    title: "", content: "", summary: "", categoryId: "", priority: "normal" as "normal" | "high" | "critical",
    countryCode: "", isPublished: true, isPinned: false, tags: "" as string,
  });

  const [showReadsDialog, setShowReadsDialog] = useState(false);
  const [readsArticleId, setReadsArticleId] = useState<string | null>(null);

  const [showCampaignLinkDialog, setShowCampaignLinkDialog] = useState(false);
  const [linkingArticleId, setLinkingArticleId] = useState<string | null>(null);

  const [uploadingPdf, setUploadingPdf] = useState(false);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  const [showCopyDialog, setShowCopyDialog] = useState(false);
  const [copySourceArticle, setCopySourceArticle] = useState<SopArticle | null>(null);
  const [copyTargetCountry, setCopyTargetCountry] = useState("");
  const [copyWithTranslation, setCopyWithTranslation] = useState(true);
  const [isCopying, setIsCopying] = useState(false);

  const { data: categories = [] } = useQuery<SopCategory[]>({ queryKey: ["/api/sop/categories"] });
  const { data: articles = [], isLoading } = useQuery<SopArticle[]>({ queryKey: ["/api/sop/articles"] });
  const { data: campaigns = [] } = useQuery<Campaign[]>({ queryKey: ["/api/campaigns"] });
  const { data: users = [] } = useQuery<any[]>({ queryKey: ["/api/users"] });

  const { data: articleReads = [] } = useQuery<any[]>({
    queryKey: ["/api/sop/articles", readsArticleId, "reads"],
    queryFn: async () => {
      if (!readsArticleId) return [];
      const res = await fetch(`/api/sop/articles/${readsArticleId}/reads`, { credentials: "include" });
      return res.json();
    },
    enabled: !!readsArticleId,
  });

  const { data: articleCampaignLinks = [] } = useQuery<string[]>({
    queryKey: ["/api/sop/articles", linkingArticleId, "campaigns"],
    queryFn: async () => {
      if (!linkingArticleId) return [];
      const res = await fetch(`/api/sop/articles/${linkingArticleId}/campaigns`, { credentials: "include" });
      return res.json();
    },
    enabled: !!linkingArticleId,
  });

  const createCategoryMutation = useMutation({
    mutationFn: async (data: any) => { await apiRequest("POST", "/api/sop/categories", data); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/sop/categories"] }); setShowCategoryDialog(false); toast({ title: t.sop.categoryCreated }); },
  });

  const updateCategoryMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => { await apiRequest("PATCH", `/api/sop/categories/${id}`, data); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/sop/categories"] }); setShowCategoryDialog(false); toast({ title: t.sop.categoryUpdated }); },
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: async (id: string) => { await apiRequest("DELETE", `/api/sop/categories/${id}`); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/sop/categories"] }); toast({ title: t.sop.categoryDeleted }); },
  });

  const createArticleMutation = useMutation({
    mutationFn: async (data: any) => { await apiRequest("POST", "/api/sop/articles", data); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/sop/articles"] }); setShowArticleDialog(false); toast({ title: t.sop.articleCreated }); },
  });

  const updateArticleMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => { await apiRequest("PATCH", `/api/sop/articles/${id}`, data); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/sop/articles"] }); setShowArticleDialog(false); toast({ title: t.sop.articleUpdated }); },
  });

  const deleteArticleMutation = useMutation({
    mutationFn: async (id: string) => { await apiRequest("DELETE", `/api/sop/articles/${id}`); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/sop/articles"] }); toast({ title: t.sop.articleDeleted }); },
  });

  const linkCampaignMutation = useMutation({
    mutationFn: async ({ articleId, campaignId }: { articleId: string; campaignId: string }) => { await apiRequest("POST", `/api/sop/articles/${articleId}/campaigns`, { campaignId }); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/sop/articles", linkingArticleId, "campaigns"] }); toast({ title: t.sop.campaignLinked }); },
  });

  const unlinkCampaignMutation = useMutation({
    mutationFn: async ({ articleId, campaignId }: { articleId: string; campaignId: string }) => { await apiRequest("DELETE", `/api/sop/articles/${articleId}/campaigns/${campaignId}`); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/sop/articles", linkingArticleId, "campaigns"] }); toast({ title: t.sop.campaignUnlinked }); },
  });

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPdf(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/sop/upload-pdf", { method: "POST", body: formData, credentials: "include" });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      setArticleForm(p => ({ ...p, content: (p.content ? p.content + "\n" : "") + data.html }));
      toast({ title: t.sop.pdfUploaded });
    } catch {
      toast({ title: t.sop.pdfError, variant: "destructive" });
    } finally {
      setUploadingPdf(false);
      if (pdfInputRef.current) pdfInputRef.current.value = "";
    }
  };

  const openNewCategory = () => {
    setEditingCategory(null);
    setCategoryForm({ name: "", description: "", icon: "clipboard", sortOrder: 0, countryCode: "", isActive: true });
    setShowCategoryDialog(true);
  };

  const openEditCategory = (cat: SopCategory) => {
    setEditingCategory(cat);
    setCategoryForm({ name: cat.name, description: cat.description || "", icon: cat.icon || "clipboard", sortOrder: cat.sortOrder || 0, countryCode: cat.countryCode || "", isActive: cat.isActive ?? true });
    setShowCategoryDialog(true);
  };

  const saveCategory = () => {
    const data = { ...categoryForm, countryCode: categoryForm.countryCode || null, description: categoryForm.description || null, icon: categoryForm.icon || null };
    if (editingCategory) updateCategoryMutation.mutate({ id: editingCategory.id, data });
    else createCategoryMutation.mutate(data);
  };

  const COUNTRY_OPTIONS = [
    { code: "SK", flag: "🇸🇰", name: "Slovenčina" },
    { code: "CZ", flag: "🇨🇿", name: "Čeština" },
    { code: "US", flag: "🇬🇧", name: "English" },
    { code: "HU", flag: "🇭🇺", name: "Magyar" },
    { code: "RO", flag: "🇷🇴", name: "Română" },
    { code: "IT", flag: "🇮🇹", name: "Italiano" },
    { code: "DE", flag: "🇩🇪", name: "Deutsch" },
  ];

  const openCopyDialog = (article: SopArticle) => {
    setCopySourceArticle(article);
    setCopyTargetCountry("");
    setCopyWithTranslation(true);
    setShowCopyDialog(true);
  };

  const handleCopyArticle = async () => {
    if (!copySourceArticle || !copyTargetCountry) return;
    setIsCopying(true);
    try {
      const res = await apiRequest("POST", `/api/sop/articles/${copySourceArticle.id}/copy-translate`, {
        targetCountryCode: copyTargetCountry,
        translate: copyWithTranslation,
      });
      if (!res.ok) throw new Error("Failed to copy article");
      queryClient.invalidateQueries({ queryKey: ["/api/sop/articles"] });
      toast({ title: copyWithTranslation ? (t.konfigurator?.templateTranslated || "Article translated and copied") : (t.konfigurator?.templateCopied || "Article copied") });
      setShowCopyDialog(false);
      setCopySourceArticle(null);
    } catch (error) {
      toast({ title: t.errors?.saveFailed || "Error", variant: "destructive" });
    } finally {
      setIsCopying(false);
    }
  };

  const openNewArticle = () => {
    setEditingArticle(null);
    setArticleForm({ title: "", content: "", summary: "", categoryId: categories[0]?.id || "", priority: "normal", countryCode: "", isPublished: true, isPinned: false, tags: "" });
    setShowArticleDialog(true);
  };

  const openEditArticle = (art: SopArticle) => {
    setEditingArticle(art);
    setArticleForm({ title: art.title, content: art.content, summary: art.summary || "", categoryId: art.categoryId, priority: (art.priority as any) || "normal", countryCode: art.countryCode || "", isPublished: art.isPublished ?? true, isPinned: art.isPinned ?? false, tags: art.tags?.join(", ") || "" });
    setShowArticleDialog(true);
  };

  const saveArticle = () => {
    const tags = articleForm.tags ? articleForm.tags.split(",").map(t => t.trim()).filter(Boolean) : [];
    const data = { ...articleForm, tags, countryCode: articleForm.countryCode || null, summary: articleForm.summary || null };
    if (editingArticle) updateArticleMutation.mutate({ id: editingArticle.id, data });
    else createArticleMutation.mutate(data);
  };

  const filteredArticles = articles.filter(a => {
    if (filterCategory && a.categoryId !== filterCategory) return false;
    if (filterPriority && a.priority !== filterPriority) return false;
    if (searchQuery) { const q = searchQuery.toLowerCase(); return a.title.toLowerCase().includes(q) || a.content.toLowerCase().includes(q); }
    return true;
  });

  const getCategoryName = (id: string) => categories.find(c => c.id === id)?.name || "—";
  const getCategoryEmoji = (id: string) => {
    const cat = categories.find(c => c.id === id);
    return getEmojiForIcon(cat?.icon);
  };
  const getUserName = (id: string) => {
    const u = users.find((u: any) => u.id?.toString() === id?.toString());
    return u ? `${u.firstName || ""} ${u.lastName || ""}`.trim() || u.username : id;
  };

  const renderCategoryIcon = (iconName: string | null | undefined) => {
    return <span className="text-lg leading-none">{getEmojiForIcon(iconName)}</span>;
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6" data-testid="sop-management-page">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600">
            <BookOpen className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold" data-testid="sop-page-title">{t.sop.title}</h1>
            <p className="text-sm text-muted-foreground">{t.sop.subtitle}</p>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="articles" className="gap-1.5" data-testid="tab-sop-articles">
            <FileText className="h-4 w-4" />
            {t.sop.articles} ({articles.length})
          </TabsTrigger>
          <TabsTrigger value="categories" className="gap-1.5" data-testid="tab-sop-categories">
            <FolderOpen className="h-4 w-4" />
            {t.sop.categories} ({categories.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="articles" className="space-y-4 mt-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder={t.sop.searchArticles} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" data-testid="sop-admin-search" />
            </div>
            <Select value={filterCategory || "all"} onValueChange={(v) => setFilterCategory(v === "all" ? null : v)}>
              <SelectTrigger className="w-[180px]" data-testid="sop-filter-category"><SelectValue placeholder={t.sop.category} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t.sop.allCategories}</SelectItem>
                {categories.map(c => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
              </SelectContent>
            </Select>
            <Select value={filterPriority || "all"} onValueChange={(v) => setFilterPriority(v === "all" ? null : v)}>
              <SelectTrigger className="w-[140px]" data-testid="sop-filter-priority"><SelectValue placeholder={t.sop.filterPriority} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t.sop.priorityAll}</SelectItem>
                <SelectItem value="normal">{t.sop.priorityNormal}</SelectItem>
                <SelectItem value="high">{t.sop.priorityHigh}</SelectItem>
                <SelectItem value="critical">{t.sop.priorityCritical}</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={openNewArticle} className="gap-1.5" data-testid="btn-new-article">
              <Plus className="h-4 w-4" />{t.sop.newArticle}
            </Button>
          </div>

          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">{t.sop.loading}</div>
          ) : filteredArticles.length === 0 ? (
            <Card><CardContent className="py-12 text-center">
              <BookOpen className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground">{t.sop.noArticles}</p>
              <Button onClick={openNewArticle} variant="outline" className="mt-3" data-testid="btn-new-article-empty"><Plus className="h-4 w-4 mr-1" /> {t.sop.createFirstArticle}</Button>
            </CardContent></Card>
          ) : (
            <div className="grid gap-3">
              {filteredArticles.map(article => {
                return (
                  <Card key={article.id} className={`${!article.isPublished ? "opacity-60" : ""}`} data-testid={`sop-card-${article.id}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            {article.isPinned && <Pin className="h-3.5 w-3.5 text-blue-500" />}
                            <h3 className="font-semibold text-sm" data-testid={`sop-title-${article.id}`}>{article.title}</h3>
                            {article.priority === "critical" && <Badge variant="destructive" className="text-[10px] h-5 gap-0.5"><AlertCircle className="h-3 w-3" />{t.sop.priorityCritical}</Badge>}
                            {article.priority === "high" && <Badge className="text-[10px] h-5 gap-0.5 bg-orange-500"><AlertTriangle className="h-3 w-3" />{t.sop.priorityHigh}</Badge>}
                            {!article.isPublished && <Badge variant="secondary" className="text-[10px] h-5 gap-0.5"><EyeOff className="h-3 w-3" />{t.sop.hidden}</Badge>}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1"><span className="text-sm">{getCategoryEmoji(article.categoryId)}</span>{getCategoryName(article.categoryId)}</span>
                            {article.countryCode && <Badge variant="outline" className="text-[10px] h-4">{article.countryCode}</Badge>}
                            <span>v{article.version}</span>
                            <span>{new Date(article.updatedAt).toLocaleDateString()}</span>
                            {article.createdBy && <span>{t.sop.author}: {getUserName(article.createdBy)}</span>}
                          </div>
                          {article.summary && <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{article.summary}</p>}
                          {article.tags && article.tags.length > 0 && (
                            <div className="flex gap-1 mt-1.5 flex-wrap">{article.tags.map((tag, i) => <Badge key={i} variant="secondary" className="text-[9px] h-4">{tag}</Badge>)}</div>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => { setReadsArticleId(article.id); setShowReadsDialog(true); }} title={t.sop.whoRead} data-testid={`btn-reads-${article.id}`}><Users className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => { setLinkingArticleId(article.id); setShowCampaignLinkDialog(true); }} title={t.sop.campaignLink} data-testid={`btn-campaigns-${article.id}`}><Tag className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openCopyDialog(article)} title={t.konfigurator?.copyToLanguage || "Copy to language"} data-testid={`btn-copy-${article.id}`}><Copy className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openEditArticle(article)} data-testid={`btn-edit-${article.id}`}><Pencil className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive" onClick={() => { if (confirm(t.sop.confirmDeleteArticle)) deleteArticleMutation.mutate(article.id); }} data-testid={`btn-delete-${article.id}`}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="categories" className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{t.sop.subtitle}</p>
            <Button onClick={openNewCategory} className="gap-1.5" data-testid="btn-new-category"><Plus className="h-4 w-4" />{t.sop.newCategory}</Button>
          </div>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {categories.map(cat => {
              const articleCount = articles.filter(a => a.categoryId === cat.id).length;
              return (
                <Card key={cat.id} className={`${!cat.isActive ? "opacity-50" : ""}`} data-testid={`category-card-${cat.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          {renderCategoryIcon(cat.icon)}
                        </div>
                        <div>
                          <h3 className="font-semibold text-sm" data-testid={`category-name-${cat.id}`}>{cat.name}</h3>
                          {cat.description && <p className="text-xs text-muted-foreground">{cat.description}</p>}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEditCategory(cat)} data-testid={`btn-edit-cat-${cat.id}`}><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => { if (articleCount > 0) { toast({ title: t.sop.categoryHasArticles, variant: "destructive" }); return; } if (confirm(t.sop.confirmDeleteCategory)) deleteCategoryMutation.mutate(cat.id); }} data-testid={`btn-delete-cat-${cat.id}`}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
                      <span>{articleCount} {t.sop.articleCount}</span>
                      {cat.countryCode && <Badge variant="outline" className="text-[10px] h-4">{cat.countryCode}</Badge>}
                      <span>{t.sop.sortOrder}: {cat.sortOrder}</span>
                      {!cat.isActive && <Badge variant="secondary" className="text-[10px] h-4">{t.sop.inactive}</Badge>}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            {categories.length === 0 && (
              <Card className="col-span-full"><CardContent className="py-12 text-center">
                <FolderOpen className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
                <p className="text-muted-foreground">{t.sop.noCategories}</p>
                <Button onClick={openNewCategory} variant="outline" className="mt-3" data-testid="btn-new-category-empty"><Plus className="h-4 w-4 mr-1" /> {t.sop.createFirstCategory}</Button>
              </CardContent></Card>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={showCategoryDialog} onOpenChange={setShowCategoryDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                {renderCategoryIcon(categoryForm.icon)}
              </div>
              {editingCategory ? t.sop.editCategory : t.sop.newCategory}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5">
            <div className="space-y-2">
              <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{t.sop.name} *</Label>
              <Input value={categoryForm.name} onChange={(e) => setCategoryForm(p => ({ ...p, name: e.target.value }))} placeholder={t.sop.categoryNamePlaceholder} className="h-10" data-testid="input-category-name" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{t.sop.description}</Label>
              <Textarea value={categoryForm.description} onChange={(e) => setCategoryForm(p => ({ ...p, description: e.target.value }))} placeholder={t.sop.categoryDescPlaceholder} rows={2} data-testid="input-category-description" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{t.sop.icon}</Label>
              <div className="border rounded-lg bg-muted/30 p-3 space-y-2">
                {EMOJI_GROUPS.map(group => (
                  <div key={group.label}>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">{group.label}</p>
                    <div className="flex flex-wrap gap-1">
                      {group.emojis.map(emoji => {
                        const isSelected = categoryForm.icon === emoji;
                        return (
                          <button
                            key={emoji}
                            type="button"
                            className={`h-9 w-9 flex items-center justify-center rounded-lg text-lg transition-all ${isSelected ? "bg-primary shadow-sm ring-2 ring-primary/50 scale-110" : "hover:bg-muted hover:scale-105"}`}
                            onClick={() => setCategoryForm(p => ({ ...p, icon: emoji }))}
                            data-testid={`emoji-pick-${group.label.toLowerCase()}-${group.emojis.indexOf(emoji)}`}
                          >
                            {emoji}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{t.sop.sortOrder}</Label>
                <Input type="number" value={categoryForm.sortOrder} onChange={(e) => setCategoryForm(p => ({ ...p, sortOrder: parseInt(e.target.value) || 0 }))} data-testid="input-category-order" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{t.sop.country}</Label>
                <Select value={categoryForm.countryCode || "all"} onValueChange={(v) => setCategoryForm(p => ({ ...p, countryCode: v === "all" ? "" : v }))}>
                  <SelectTrigger data-testid="select-category-country"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t.sop.allCountries}</SelectItem>
                    <SelectItem value="SK">SK</SelectItem><SelectItem value="CZ">CZ</SelectItem><SelectItem value="HU">HU</SelectItem>
                    <SelectItem value="RO">RO</SelectItem><SelectItem value="IT">IT</SelectItem><SelectItem value="DE">DE</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 flex flex-col justify-end">
                <div className="flex items-center gap-2 h-10">
                  <Switch checked={categoryForm.isActive} onCheckedChange={(v) => setCategoryForm(p => ({ ...p, isActive: v }))} data-testid="switch-category-active" />
                  <Label className="text-sm">{t.sop.active}</Label>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={() => setShowCategoryDialog(false)}>{t.sop.cancel}</Button>
            <Button onClick={saveCategory} disabled={!categoryForm.name || createCategoryMutation.isPending || updateCategoryMutation.isPending} data-testid="btn-save-category">
              {editingCategory ? t.sop.save : t.sop.createCategory}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showArticleDialog} onOpenChange={setShowArticleDialog}>
        <DialogContent className="max-w-[95vw] w-[1400px] max-h-[92vh] overflow-hidden flex flex-col">
          <DialogHeader className="shrink-0 pb-3 border-b">
            <DialogTitle className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600">
                <FileText className="h-4 w-4" />
              </div>
              {editingArticle ? t.sop.editArticle : t.sop.newArticle}
            </DialogTitle>
          </DialogHeader>
          <div className="flex gap-0 flex-1 min-h-0 overflow-hidden -mx-6 -mb-6">
            <div className="w-[20%] min-w-[220px] max-w-[280px] shrink-0 border-r bg-muted/20 overflow-y-auto p-4 space-y-4">
              <div className="space-y-2">
                <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{t.sop.name} *</Label>
                <Input value={articleForm.title} onChange={(e) => setArticleForm(p => ({ ...p, title: e.target.value }))} placeholder={t.sop.titlePlaceholder} data-testid="input-article-title" />
              </div>

              <Separator />

              <div className="space-y-2">
                <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{t.sop.category} *</Label>
                <Select value={articleForm.categoryId} onValueChange={(v) => setArticleForm(p => ({ ...p, categoryId: v }))}>
                  <SelectTrigger data-testid="select-article-category"><SelectValue placeholder={t.sop.category} /></SelectTrigger>
                  <SelectContent>{categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{t.sop.filterPriority}</Label>
                <Select value={articleForm.priority} onValueChange={(v: any) => setArticleForm(p => ({ ...p, priority: v }))}>
                  <SelectTrigger data-testid="select-article-priority"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">{t.sop.priorityNormal}</SelectItem>
                    <SelectItem value="high">{t.sop.priorityHigh}</SelectItem>
                    <SelectItem value="critical">{t.sop.priorityCritical}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{t.sop.country}</Label>
                <Select value={articleForm.countryCode || "all"} onValueChange={(v) => setArticleForm(p => ({ ...p, countryCode: v === "all" ? "" : v }))}>
                  <SelectTrigger data-testid="select-article-country"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t.sop.allCountries}</SelectItem>
                    <SelectItem value="SK">SK</SelectItem><SelectItem value="CZ">CZ</SelectItem><SelectItem value="HU">HU</SelectItem>
                    <SelectItem value="RO">RO</SelectItem><SelectItem value="IT">IT</SelectItem><SelectItem value="DE">DE</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{t.sop.summary}</Label>
                <Textarea value={articleForm.summary} onChange={(e) => setArticleForm(p => ({ ...p, summary: e.target.value }))} placeholder={t.sop.summaryPlaceholder} rows={3} className="text-xs" data-testid="input-article-summary" />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{t.sop.tags}</Label>
                <Input value={articleForm.tags} onChange={(e) => setArticleForm(p => ({ ...p, tags: e.target.value }))} placeholder={t.sop.tagsPlaceholder} className="text-xs" data-testid="input-article-tags" />
              </div>

              <Separator />

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">{t.sop.published}</Label>
                  <Switch checked={articleForm.isPublished} onCheckedChange={(v) => setArticleForm(p => ({ ...p, isPublished: v }))} data-testid="switch-article-published" />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm">{t.sop.pinned}</Label>
                  <Switch checked={articleForm.isPinned} onCheckedChange={(v) => setArticleForm(p => ({ ...p, isPinned: v }))} data-testid="switch-article-pinned" />
                </div>
              </div>

              <div className="pt-2">
                <input type="file" ref={pdfInputRef} accept=".pdf" onChange={handlePdfUpload} className="hidden" data-testid="input-pdf-upload" />
                <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs" onClick={() => pdfInputRef.current?.click()} disabled={uploadingPdf} data-testid="btn-upload-pdf">
                  {uploadingPdf ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />{t.sop.uploading}</> : <><Upload className="h-3.5 w-3.5" />{t.sop.uploadPdf}</>}
                </Button>
                <p className="text-[10px] text-muted-foreground mt-1.5">{t.sop.uploadPdfDesc}</p>
              </div>
            </div>

            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
              <TipTapEditor
                content={articleForm.content}
                onChange={(val) => setArticleForm(p => ({ ...p, content: val }))}
                placeholder={t.sop.contentPlaceholder || "Start writing your SOP article..."}
                className="flex-1 min-h-0 border-0 rounded-none"
              />
              <div className="flex items-center justify-end gap-2 px-5 py-3 border-t bg-muted/10 shrink-0">
                <Button variant="outline" onClick={() => setShowArticleDialog(false)}>{t.sop.cancel}</Button>
                <Button onClick={saveArticle} disabled={!articleForm.title || !articleForm.content || !articleForm.categoryId || createArticleMutation.isPending || updateArticleMutation.isPending} data-testid="btn-save-article">
                  {editingArticle ? t.sop.saveChanges : t.sop.createArticle}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showReadsDialog} onOpenChange={(v) => { setShowReadsDialog(v); if (!v) setReadsArticleId(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Users className="h-4 w-4" /> {t.sop.whoRead}</DialogTitle></DialogHeader>
          {articleReads.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">{t.sop.noReads}</p>
          ) : (
            <ScrollArea className="max-h-[300px]">
              <div className="space-y-2">
                {articleReads.map((read: any) => (
                  <div key={read.id} className="flex items-center justify-between p-2 rounded border">
                    <span className="text-sm font-medium">{getUserName(read.userId)}</span>
                    <span className="text-xs text-muted-foreground">{new Date(read.readAt).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showCampaignLinkDialog} onOpenChange={(v) => { setShowCampaignLinkDialog(v); if (!v) setLinkingArticleId(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Tag className="h-4 w-4" /> {t.sop.campaignLink}</DialogTitle></DialogHeader>
          <ScrollArea className="max-h-[400px]">
            <div className="space-y-1">
              {campaigns.map((camp: any) => {
                const isLinked = articleCampaignLinks.includes(camp.id);
                return (
                  <div key={camp.id} className="flex items-center justify-between p-2 rounded border">
                    <span className="text-sm">{camp.name}</span>
                    <Button variant={isLinked ? "destructive" : "outline"} size="sm" className="h-7 text-xs" onClick={() => {
                      if (isLinked) unlinkCampaignMutation.mutate({ articleId: linkingArticleId!, campaignId: camp.id });
                      else linkCampaignMutation.mutate({ articleId: linkingArticleId!, campaignId: camp.id });
                    }} data-testid={`btn-toggle-campaign-${camp.id}`}>{isLinked ? t.sop.unlinkCampaign : t.sop.linkCampaign}</Button>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <Dialog open={showCopyDialog} onOpenChange={(v) => { setShowCopyDialog(v); if (!v) setCopySourceArticle(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Copy className="h-4 w-4" />
              {t.konfigurator?.copyToLanguage || "Copy / Translate"}
            </DialogTitle>
          </DialogHeader>
          {copySourceArticle && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-muted/50 border">
                <p className="text-sm font-medium">{copySourceArticle.title}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {t.sop.country}: {copySourceArticle.countryCode || "—"}
                </p>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {t.konfigurator?.targetLanguage || "Target language"}
                </Label>
                <div className="flex flex-wrap gap-2">
                  {COUNTRY_OPTIONS.map(opt => (
                    <button
                      key={opt.code}
                      type="button"
                      className={`h-10 w-10 flex items-center justify-center rounded-lg text-xl transition-all border ${
                        copyTargetCountry === opt.code
                          ? "border-primary bg-primary/10 ring-2 ring-primary/30 scale-110"
                          : "border-muted hover:border-foreground/30 hover:scale-105"
                      }`}
                      onClick={() => setCopyTargetCountry(opt.code)}
                      title={opt.name}
                      data-testid={`copy-lang-${opt.code}`}
                    >
                      {opt.flag}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg border">
                <div>
                  <Label className="text-sm font-medium">{t.konfigurator?.aiTranslation || "AI Translation"}</Label>
                  <p className="text-xs text-muted-foreground">{t.konfigurator?.aiTranslationDesc || "Automatically translate content using AI"}</p>
                </div>
                <Switch checked={copyWithTranslation} onCheckedChange={setCopyWithTranslation} data-testid="switch-copy-translate" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCopyDialog(false)}>{t.sop.cancel}</Button>
            <Button onClick={handleCopyArticle} disabled={!copyTargetCountry || isCopying} data-testid="btn-confirm-copy">
              {isCopying ? <><Loader2 className="h-4 w-4 animate-spin mr-1.5" />{t.konfigurator?.translating || "Translating..."}</> : <><Copy className="h-4 w-4 mr-1.5" />{copyWithTranslation ? (t.konfigurator?.copyAndTranslate || "Copy & Translate") : (t.konfigurator?.copy || "Copy")}</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
