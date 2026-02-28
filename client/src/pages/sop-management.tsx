import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/contexts/auth-context";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  BookOpen, Plus, Pencil, Trash2, FolderOpen, FileText, Pin,
  AlertCircle, AlertTriangle, Eye, EyeOff, Users, Search, Tag,
  GripVertical, ChevronRight
} from "lucide-react";
import type { SopCategory, SopArticle, Campaign } from "@shared/schema";

export default function SopManagementPage() {
  const { user } = useAuth();
  const { toast } = useToast();
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

  const { data: categories = [] } = useQuery<SopCategory[]>({ queryKey: ["/api/sop/categories"] });
  const { data: articles = [], isLoading } = useQuery<SopArticle[]>({
    queryKey: ["/api/sop/articles"],
  });
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
    mutationFn: async (data: any) => {
      await apiRequest("POST", "/api/sop/categories", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sop/categories"] });
      setShowCategoryDialog(false);
      toast({ title: "Kategória vytvorená" });
    },
  });

  const updateCategoryMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      await apiRequest("PATCH", `/api/sop/categories/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sop/categories"] });
      setShowCategoryDialog(false);
      toast({ title: "Kategória aktualizovaná" });
    },
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/sop/categories/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sop/categories"] });
      toast({ title: "Kategória vymazaná" });
    },
  });

  const createArticleMutation = useMutation({
    mutationFn: async (data: any) => {
      await apiRequest("POST", "/api/sop/articles", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sop/articles"] });
      setShowArticleDialog(false);
      toast({ title: "SOP článok vytvorený" });
    },
  });

  const updateArticleMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      await apiRequest("PATCH", `/api/sop/articles/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sop/articles"] });
      setShowArticleDialog(false);
      toast({ title: "SOP článok aktualizovaný" });
    },
  });

  const deleteArticleMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/sop/articles/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sop/articles"] });
      toast({ title: "SOP článok vymazaný" });
    },
  });

  const linkCampaignMutation = useMutation({
    mutationFn: async ({ articleId, campaignId }: { articleId: string; campaignId: string }) => {
      await apiRequest("POST", `/api/sop/articles/${articleId}/campaigns`, { campaignId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sop/articles", linkingArticleId, "campaigns"] });
      toast({ title: "Kampaň prepojená" });
    },
  });

  const unlinkCampaignMutation = useMutation({
    mutationFn: async ({ articleId, campaignId }: { articleId: string; campaignId: string }) => {
      await apiRequest("DELETE", `/api/sop/articles/${articleId}/campaigns/${campaignId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sop/articles", linkingArticleId, "campaigns"] });
      toast({ title: "Prepojenie zrušené" });
    },
  });

  const openNewCategory = () => {
    setEditingCategory(null);
    setCategoryForm({ name: "", description: "", icon: "", sortOrder: 0, countryCode: "", isActive: true });
    setShowCategoryDialog(true);
  };

  const openEditCategory = (cat: SopCategory) => {
    setEditingCategory(cat);
    setCategoryForm({
      name: cat.name,
      description: cat.description || "",
      icon: cat.icon || "",
      sortOrder: cat.sortOrder || 0,
      countryCode: cat.countryCode || "",
      isActive: cat.isActive ?? true,
    });
    setShowCategoryDialog(true);
  };

  const saveCategory = () => {
    const data = { ...categoryForm, countryCode: categoryForm.countryCode || null, description: categoryForm.description || null, icon: categoryForm.icon || null };
    if (editingCategory) {
      updateCategoryMutation.mutate({ id: editingCategory.id, data });
    } else {
      createCategoryMutation.mutate(data);
    }
  };

  const openNewArticle = () => {
    setEditingArticle(null);
    setArticleForm({ title: "", content: "", summary: "", categoryId: categories[0]?.id || "", priority: "normal", countryCode: "", isPublished: true, isPinned: false, tags: "" });
    setShowArticleDialog(true);
  };

  const openEditArticle = (art: SopArticle) => {
    setEditingArticle(art);
    setArticleForm({
      title: art.title,
      content: art.content,
      summary: art.summary || "",
      categoryId: art.categoryId,
      priority: (art.priority as "normal" | "high" | "critical") || "normal",
      countryCode: art.countryCode || "",
      isPublished: art.isPublished ?? true,
      isPinned: art.isPinned ?? false,
      tags: art.tags?.join(", ") || "",
    });
    setShowArticleDialog(true);
  };

  const saveArticle = () => {
    const tags = articleForm.tags ? articleForm.tags.split(",").map(t => t.trim()).filter(Boolean) : [];
    const data = {
      ...articleForm,
      tags,
      countryCode: articleForm.countryCode || null,
      summary: articleForm.summary || null,
    };
    if (editingArticle) {
      updateArticleMutation.mutate({ id: editingArticle.id, data });
    } else {
      createArticleMutation.mutate(data);
    }
  };

  const filteredArticles = articles.filter(a => {
    if (filterCategory && a.categoryId !== filterCategory) return false;
    if (filterPriority && a.priority !== filterPriority) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return a.title.toLowerCase().includes(q) || a.content.toLowerCase().includes(q);
    }
    return true;
  });

  const getCategoryName = (id: string) => categories.find(c => c.id === id)?.name || "—";
  const getUserName = (id: string) => {
    const u = users.find((u: any) => u.id?.toString() === id?.toString());
    return u ? `${u.firstName || ""} ${u.lastName || ""}`.trim() || u.username : id;
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6" data-testid="sop-management-page">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BookOpen className="h-6 w-6 text-amber-600" />
          <div>
            <h1 className="text-2xl font-bold" data-testid="sop-page-title">SOP & Pracovné postupy</h1>
            <p className="text-sm text-muted-foreground">Správa štandardných operačných postupov pre operátorov</p>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="articles" className="gap-1.5" data-testid="tab-sop-articles">
            <FileText className="h-4 w-4" />
            Články ({articles.length})
          </TabsTrigger>
          <TabsTrigger value="categories" className="gap-1.5" data-testid="tab-sop-categories">
            <FolderOpen className="h-4 w-4" />
            Kategórie ({categories.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="articles" className="space-y-4 mt-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Hľadať v článkoch..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                data-testid="sop-admin-search"
              />
            </div>
            <Select value={filterCategory || "all"} onValueChange={(v) => setFilterCategory(v === "all" ? null : v)}>
              <SelectTrigger className="w-[180px]" data-testid="sop-filter-category">
                <SelectValue placeholder="Kategória" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Všetky kategórie</SelectItem>
                {categories.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterPriority || "all"} onValueChange={(v) => setFilterPriority(v === "all" ? null : v)}>
              <SelectTrigger className="w-[140px]" data-testid="sop-filter-priority">
                <SelectValue placeholder="Priorita" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Všetky</SelectItem>
                <SelectItem value="normal">Normálna</SelectItem>
                <SelectItem value="high">Vysoká</SelectItem>
                <SelectItem value="critical">Kritická</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={openNewArticle} className="gap-1.5" data-testid="btn-new-article">
              <Plus className="h-4 w-4" />
              Nový článok
            </Button>
          </div>

          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">Načítavam...</div>
          ) : filteredArticles.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <BookOpen className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
                <p className="text-muted-foreground">Žiadne SOP články</p>
                <Button onClick={openNewArticle} variant="outline" className="mt-3" data-testid="btn-new-article-empty">
                  <Plus className="h-4 w-4 mr-1" /> Vytvoriť prvý článok
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3">
              {filteredArticles.map(article => (
                <Card key={article.id} className={`${!article.isPublished ? "opacity-60" : ""}`} data-testid={`sop-card-${article.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          {article.isPinned && <Pin className="h-3.5 w-3.5 text-blue-500" />}
                          <h3 className="font-semibold text-sm" data-testid={`sop-title-${article.id}`}>{article.title}</h3>
                          {article.priority === "critical" && (
                            <Badge variant="destructive" className="text-[10px] h-5 gap-0.5"><AlertCircle className="h-3 w-3" />Kritická</Badge>
                          )}
                          {article.priority === "high" && (
                            <Badge className="text-[10px] h-5 gap-0.5 bg-orange-500"><AlertTriangle className="h-3 w-3" />Vysoká</Badge>
                          )}
                          {!article.isPublished && (
                            <Badge variant="secondary" className="text-[10px] h-5 gap-0.5"><EyeOff className="h-3 w-3" />Skrytý</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1"><FolderOpen className="h-3 w-3" />{getCategoryName(article.categoryId)}</span>
                          {article.countryCode && <Badge variant="outline" className="text-[10px] h-4">{article.countryCode}</Badge>}
                          <span>v{article.version}</span>
                          <span>{new Date(article.updatedAt).toLocaleDateString("sk-SK")}</span>
                          {article.createdBy && <span>Autor: {getUserName(article.createdBy)}</span>}
                        </div>
                        {article.summary && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{article.summary}</p>
                        )}
                        {article.tags && article.tags.length > 0 && (
                          <div className="flex gap-1 mt-1.5 flex-wrap">
                            {article.tags.map((tag, i) => (
                              <Badge key={i} variant="secondary" className="text-[9px] h-4">{tag}</Badge>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => { setReadsArticleId(article.id); setShowReadsDialog(true); }}
                          title="Kto prečítal"
                          data-testid={`btn-reads-${article.id}`}
                        >
                          <Users className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => { setLinkingArticleId(article.id); setShowCampaignLinkDialog(true); }}
                          title="Prepojiť s kampaňami"
                          data-testid={`btn-campaigns-${article.id}`}
                        >
                          <Tag className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => openEditArticle(article)}
                          data-testid={`btn-edit-${article.id}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-destructive"
                          onClick={() => { if (confirm("Naozaj vymazať tento článok?")) deleteArticleMutation.mutate(article.id); }}
                          data-testid={`btn-delete-${article.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="categories" className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Kategórie organizujú SOP články do logických skupín</p>
            <Button onClick={openNewCategory} className="gap-1.5" data-testid="btn-new-category">
              <Plus className="h-4 w-4" />
              Nová kategória
            </Button>
          </div>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {categories.map(cat => {
              const articleCount = articles.filter(a => a.categoryId === cat.id).length;
              return (
                <Card key={cat.id} className={`${!cat.isActive ? "opacity-50" : ""}`} data-testid={`category-card-${cat.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{cat.icon || "📁"}</span>
                        <div>
                          <h3 className="font-semibold text-sm" data-testid={`category-name-${cat.id}`}>{cat.name}</h3>
                          {cat.description && <p className="text-xs text-muted-foreground">{cat.description}</p>}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEditCategory(cat)} data-testid={`btn-edit-cat-${cat.id}`}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-destructive"
                          onClick={() => { if (articleCount > 0) { toast({ title: "Nemožno vymazať", description: "Kategória obsahuje články", variant: "destructive" }); return; } if (confirm("Vymazať kategóriu?")) deleteCategoryMutation.mutate(cat.id); }}
                          data-testid={`btn-delete-cat-${cat.id}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
                      <span>{articleCount} článkov</span>
                      {cat.countryCode && <Badge variant="outline" className="text-[10px] h-4">{cat.countryCode}</Badge>}
                      <span>Poradie: {cat.sortOrder}</span>
                      {!cat.isActive && <Badge variant="secondary" className="text-[10px] h-4">Neaktívna</Badge>}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            {categories.length === 0 && (
              <Card className="col-span-full">
                <CardContent className="py-12 text-center">
                  <FolderOpen className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
                  <p className="text-muted-foreground">Žiadne kategórie</p>
                  <Button onClick={openNewCategory} variant="outline" className="mt-3" data-testid="btn-new-category-empty">
                    <Plus className="h-4 w-4 mr-1" /> Vytvoriť prvú kategóriu
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={showCategoryDialog} onOpenChange={setShowCategoryDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingCategory ? "Upraviť kategóriu" : "Nová kategória"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Názov *</Label>
              <Input
                value={categoryForm.name}
                onChange={(e) => setCategoryForm(p => ({ ...p, name: e.target.value }))}
                placeholder="Napr. Odberové postupy"
                data-testid="input-category-name"
              />
            </div>
            <div>
              <Label>Popis</Label>
              <Textarea
                value={categoryForm.description}
                onChange={(e) => setCategoryForm(p => ({ ...p, description: e.target.value }))}
                placeholder="Stručný popis kategórie"
                rows={2}
                data-testid="input-category-description"
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Ikona (emoji)</Label>
                <Input
                  value={categoryForm.icon}
                  onChange={(e) => setCategoryForm(p => ({ ...p, icon: e.target.value }))}
                  placeholder="📋"
                  data-testid="input-category-icon"
                />
              </div>
              <div>
                <Label>Poradie</Label>
                <Input
                  type="number"
                  value={categoryForm.sortOrder}
                  onChange={(e) => setCategoryForm(p => ({ ...p, sortOrder: parseInt(e.target.value) || 0 }))}
                  data-testid="input-category-order"
                />
              </div>
              <div>
                <Label>Krajina</Label>
                <Select value={categoryForm.countryCode || "all"} onValueChange={(v) => setCategoryForm(p => ({ ...p, countryCode: v === "all" ? "" : v }))}>
                  <SelectTrigger data-testid="select-category-country">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Všetky</SelectItem>
                    <SelectItem value="SK">SK</SelectItem>
                    <SelectItem value="CZ">CZ</SelectItem>
                    <SelectItem value="HU">HU</SelectItem>
                    <SelectItem value="RO">RO</SelectItem>
                    <SelectItem value="IT">IT</SelectItem>
                    <SelectItem value="DE">DE</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={categoryForm.isActive}
                onCheckedChange={(v) => setCategoryForm(p => ({ ...p, isActive: v }))}
                data-testid="switch-category-active"
              />
              <Label>Aktívna</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCategoryDialog(false)}>Zrušiť</Button>
            <Button
              onClick={saveCategory}
              disabled={!categoryForm.name || createCategoryMutation.isPending || updateCategoryMutation.isPending}
              data-testid="btn-save-category"
            >
              {editingCategory ? "Uložiť" : "Vytvoriť"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showArticleDialog} onOpenChange={setShowArticleDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>{editingArticle ? "Upraviť SOP článok" : "Nový SOP článok"}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-4">
              <div>
                <Label>Názov *</Label>
                <Input
                  value={articleForm.title}
                  onChange={(e) => setArticleForm(p => ({ ...p, title: e.target.value }))}
                  placeholder="Napr. Postup pri odbere pupočníkovej krvi"
                  data-testid="input-article-title"
                />
              </div>
              <div>
                <Label>Zhrnutie</Label>
                <Textarea
                  value={articleForm.summary}
                  onChange={(e) => setArticleForm(p => ({ ...p, summary: e.target.value }))}
                  placeholder="Stručný popis obsahu (voliteľné)"
                  rows={2}
                  data-testid="input-article-summary"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Kategória *</Label>
                  <Select value={articleForm.categoryId} onValueChange={(v) => setArticleForm(p => ({ ...p, categoryId: v }))}>
                    <SelectTrigger data-testid="select-article-category">
                      <SelectValue placeholder="Vybrať..." />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Priorita</Label>
                  <Select value={articleForm.priority} onValueChange={(v: any) => setArticleForm(p => ({ ...p, priority: v }))}>
                    <SelectTrigger data-testid="select-article-priority">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="normal">Normálna</SelectItem>
                      <SelectItem value="high">Vysoká</SelectItem>
                      <SelectItem value="critical">Kritická</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Krajina</Label>
                  <Select value={articleForm.countryCode || "all"} onValueChange={(v) => setArticleForm(p => ({ ...p, countryCode: v === "all" ? "" : v }))}>
                    <SelectTrigger data-testid="select-article-country">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Všetky</SelectItem>
                      <SelectItem value="SK">SK</SelectItem>
                      <SelectItem value="CZ">CZ</SelectItem>
                      <SelectItem value="HU">HU</SelectItem>
                      <SelectItem value="RO">RO</SelectItem>
                      <SelectItem value="IT">IT</SelectItem>
                      <SelectItem value="DE">DE</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Obsah (HTML) *</Label>
                <Textarea
                  value={articleForm.content}
                  onChange={(e) => setArticleForm(p => ({ ...p, content: e.target.value }))}
                  placeholder="<h2>Krok 1</h2><p>Popis kroku...</p>"
                  rows={12}
                  className="font-mono text-xs"
                  data-testid="input-article-content"
                />
                <p className="text-[10px] text-muted-foreground mt-1">Podporované: HTML formátovanie (h2, h3, p, ul, ol, li, strong, em, a, table)</p>
              </div>
              <div>
                <Label>Tagy (oddelené čiarkou)</Label>
                <Input
                  value={articleForm.tags}
                  onChange={(e) => setArticleForm(p => ({ ...p, tags: e.target.value }))}
                  placeholder="odber, pupočníková krv, postup"
                  data-testid="input-article-tags"
                />
              </div>
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={articleForm.isPublished}
                    onCheckedChange={(v) => setArticleForm(p => ({ ...p, isPublished: v }))}
                    data-testid="switch-article-published"
                  />
                  <Label>Publikovaný</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={articleForm.isPinned}
                    onCheckedChange={(v) => setArticleForm(p => ({ ...p, isPinned: v }))}
                    data-testid="switch-article-pinned"
                  />
                  <Label>Pripnutý (zobrazí sa na vrchu)</Label>
                </div>
              </div>
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowArticleDialog(false)}>Zrušiť</Button>
            <Button
              onClick={saveArticle}
              disabled={!articleForm.title || !articleForm.content || !articleForm.categoryId || createArticleMutation.isPending || updateArticleMutation.isPending}
              data-testid="btn-save-article"
            >
              {editingArticle ? "Uložiť zmeny" : "Vytvoriť článok"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showReadsDialog} onOpenChange={(v) => { setShowReadsDialog(v); if (!v) setReadsArticleId(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Users className="h-4 w-4" /> Kto prečítal</DialogTitle>
          </DialogHeader>
          {articleReads.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Zatiaľ nikto neprečítal</p>
          ) : (
            <ScrollArea className="max-h-[300px]">
              <div className="space-y-2">
                {articleReads.map((read: any) => (
                  <div key={read.id} className="flex items-center justify-between p-2 rounded border">
                    <span className="text-sm font-medium">{getUserName(read.userId)}</span>
                    <span className="text-xs text-muted-foreground">{new Date(read.readAt).toLocaleString("sk-SK")}</span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showCampaignLinkDialog} onOpenChange={(v) => { setShowCampaignLinkDialog(v); if (!v) setLinkingArticleId(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Tag className="h-4 w-4" /> Prepojenie s kampaňami</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[400px]">
            <div className="space-y-1">
              {campaigns.map((camp: any) => {
                const isLinked = articleCampaignLinks.includes(camp.id);
                return (
                  <div key={camp.id} className="flex items-center justify-between p-2 rounded border">
                    <span className="text-sm">{camp.name}</span>
                    <Button
                      variant={isLinked ? "destructive" : "outline"}
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => {
                        if (isLinked) {
                          unlinkCampaignMutation.mutate({ articleId: linkingArticleId!, campaignId: camp.id });
                        } else {
                          linkCampaignMutation.mutate({ articleId: linkingArticleId!, campaignId: camp.id });
                        }
                      }}
                      data-testid={`btn-toggle-campaign-${camp.id}`}
                    >
                      {isLinked ? "Odpojiť" : "Prepojiť"}
                    </Button>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
