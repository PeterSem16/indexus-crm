import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth-context";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Inbox,
  Send,
  FileText,
  Trash2,
  Mail,
  MailOpen,
  RefreshCw,
  Reply,
  ReplyAll,
  Forward,
  Loader2,
  AlertCircle,
  PenSquare,
  X,
  Paperclip,
  Star,
  ChevronLeft,
  ChevronRight,
  Settings,
  User,
  Search,
} from "lucide-react";
import Editor from "react-simple-wysiwyg";

interface Mailbox {
  id: string;
  email: string;
  displayName: string;
  type: "personal" | "shared";
  isDefault: boolean;
}

interface MailFolder {
  id: string;
  displayName: string;
  unreadItemCount: number;
  totalItemCount: number;
}

interface EmailMessage {
  id: string;
  subject: string;
  from: { emailAddress: { name: string; address: string } };
  toRecipients: { emailAddress: { name: string; address: string } }[];
  ccRecipients?: { emailAddress: { name: string; address: string } }[];
  receivedDateTime: string;
  sentDateTime?: string;
  isRead: boolean;
  bodyPreview: string;
  body?: { content: string; contentType: string };
  hasAttachments: boolean;
  importance: string;
}

interface EmailSignature {
  id?: string;
  userId: string;
  mailboxEmail: string;
  htmlContent: string;
  isActive: boolean;
}

const folderIcons: Record<string, React.ReactNode> = {
  Inbox: <Inbox className="h-4 w-4" />,
  "Sent Items": <Send className="h-4 w-4" />,
  Drafts: <FileText className="h-4 w-4" />,
  "Deleted Items": <Trash2 className="h-4 w-4" />,
};

export default function EmailClientPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [selectedMailbox, setSelectedMailbox] = useState<string>("personal");
  const [selectedFolderId, setSelectedFolderId] = useState<string>("");
  const [selectedEmail, setSelectedEmail] = useState<EmailMessage | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [replyMode, setReplyMode] = useState<"reply" | "replyAll" | "forward" | null>(null);
  const [signatureDialogOpen, setSignatureDialogOpen] = useState(false);
  const [page, setPage] = useState(0);
  const pageSize = 25;

  const [composeData, setComposeData] = useState({
    to: "",
    cc: "",
    bcc: "",
    subject: "",
    body: "",
  });

  const [signatureHtml, setSignatureHtml] = useState("");
  const [signatureActive, setSignatureActive] = useState(true);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchMailbox, setSearchMailbox] = useState<string>("all");

  const { data: mailboxes = [], isLoading: mailboxesLoading } = useQuery<Mailbox[]>({
    queryKey: ["/api/users", user?.id, "ms365-available-mailboxes"],
    queryFn: () => fetch(`/api/users/${user?.id}/ms365-available-mailboxes`).then(r => r.json()),
    enabled: !!user?.id,
  });

  const { data: foldersData, isLoading: foldersLoading, refetch: refetchFolders } = useQuery<{ connected: boolean; folders: MailFolder[] }>({
    queryKey: ["/api/users", user?.id, "ms365-folders", selectedMailbox],
    queryFn: () => fetch(`/api/users/${user?.id}/ms365-folders?mailbox=${selectedMailbox}`).then(r => r.json()),
    enabled: !!user?.id && !!selectedMailbox,
  });

  const { data: messagesData, isLoading: messagesLoading, refetch: refetchMessages } = useQuery<{ connected: boolean; emails: EmailMessage[]; totalCount: number }>({
    queryKey: ["/api/users", user?.id, "ms365-folder-messages", selectedFolderId, selectedMailbox, page],
    queryFn: () => fetch(`/api/users/${user?.id}/ms365-folder-messages/${selectedFolderId}?mailbox=${selectedMailbox}&top=${pageSize}&skip=${page * pageSize}`).then(r => r.json()),
    enabled: !!user?.id && !!selectedFolderId,
  });

  const { data: emailDetail, isLoading: detailLoading } = useQuery<EmailMessage>({
    queryKey: ["/api/users", user?.id, "ms365-email", selectedEmail?.id, selectedMailbox],
    queryFn: () => fetch(`/api/users/${user?.id}/ms365-email/${selectedEmail?.id}?mailbox=${selectedMailbox}`).then(r => r.json()),
    enabled: !!user?.id && !!selectedEmail?.id,
  });

  const { data: signatureData } = useQuery<EmailSignature>({
    queryKey: ["/api/users", user?.id, "email-signatures", selectedMailbox],
    queryFn: () => fetch(`/api/users/${user?.id}/email-signatures/${selectedMailbox}`).then(r => r.json()),
    enabled: !!user?.id && !!selectedMailbox,
  });

  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  
  const { data: searchResults, isLoading: searchLoading, refetch: refetchSearch } = useQuery<{ emails: EmailMessage[]; mailbox: string }[]>({
    queryKey: ["/api/users", user?.id, "ms365-search-emails", debouncedSearchQuery, searchMailbox],
    queryFn: async () => {
      if (!debouncedSearchQuery || debouncedSearchQuery.trim().length < 2) return [];
      
      const mailboxesToSearch = searchMailbox === "all" 
        ? mailboxes.map(m => m.type === "personal" ? "personal" : m.email)
        : [searchMailbox];
      
      const results: { emails: EmailMessage[]; mailbox: string }[] = [];
      for (const mbx of mailboxesToSearch) {
        try {
          const response = await fetch(`/api/users/${user?.id}/ms365-search-emails?q=${encodeURIComponent(debouncedSearchQuery)}&mailbox=${mbx}&top=50`);
          const data = await response.json();
          results.push({ 
            emails: data.emails || [], 
            mailbox: mbx === "personal" ? (mailboxes.find(m => m.type === "personal")?.email || "Osobná schránka") : mbx 
          });
        } catch {
          results.push({ emails: [], mailbox: mbx });
        }
      }
      return results;
    },
    enabled: !!user?.id && isSearching && !!debouncedSearchQuery && debouncedSearchQuery.trim().length >= 2,
  });

  const handleSearch = () => {
    if (searchQuery.trim().length >= 2) {
      setDebouncedSearchQuery(searchQuery.trim());
      setIsSearching(true);
      setSelectedEmail(null);
    }
  };

  const clearSearch = () => {
    setSearchQuery("");
    setDebouncedSearchQuery("");
    setIsSearching(false);
  };

  const sendEmailMutation = useMutation({
    mutationFn: async (data: { to: string[]; cc?: string[]; bcc?: string[]; subject: string; body: string; mailboxEmail: string }) => {
      return apiRequest("POST", `/api/users/${user?.id}/ms365-send-email`, data);
    },
    onSuccess: () => {
      toast({ title: "Odoslané", description: "Email bol úspešne odoslaný" });
      setComposeOpen(false);
      setComposeData({ to: "", cc: "", bcc: "", subject: "", body: "" });
      refetchMessages();
    },
    onError: () => {
      toast({ title: "Chyba", description: "Nepodarilo sa odoslať email", variant: "destructive" });
    },
  });

  const replyMutation = useMutation({
    mutationFn: async (data: { emailId: string; body: string; replyAll: boolean; mailboxEmail: string }) => {
      return apiRequest("POST", `/api/users/${user?.id}/ms365-reply/${data.emailId}`, data);
    },
    onSuccess: () => {
      toast({ title: "Odoslané", description: "Odpoveď bola úspešne odoslaná" });
      setReplyMode(null);
      setComposeData({ to: "", cc: "", bcc: "", subject: "", body: "" });
      refetchMessages();
    },
    onError: () => {
      toast({ title: "Chyba", description: "Nepodarilo sa odoslať odpoveď", variant: "destructive" });
    },
  });

  const forwardMutation = useMutation({
    mutationFn: async (data: { emailId: string; to: string[]; body: string; mailboxEmail: string }) => {
      return apiRequest("POST", `/api/users/${user?.id}/ms365-forward/${data.emailId}`, data);
    },
    onSuccess: () => {
      toast({ title: "Odoslané", description: "Email bol úspešne preposlaný" });
      setReplyMode(null);
      setComposeData({ to: "", cc: "", bcc: "", subject: "", body: "" });
      refetchMessages();
    },
    onError: () => {
      toast({ title: "Chyba", description: "Nepodarilo sa preposlať email", variant: "destructive" });
    },
  });

  const deleteEmailMutation = useMutation({
    mutationFn: async (emailId: string) => {
      return apiRequest("DELETE", `/api/users/${user?.id}/ms365-email/${emailId}?mailbox=${selectedMailbox}`);
    },
    onSuccess: () => {
      toast({ title: "Zmazané", description: "Email bol zmazaný" });
      setSelectedEmail(null);
      refetchMessages();
    },
    onError: () => {
      toast({ title: "Chyba", description: "Nepodarilo sa zmazať email", variant: "destructive" });
    },
  });

  const saveSignatureMutation = useMutation({
    mutationFn: async (data: { htmlContent: string; isActive: boolean }) => {
      return apiRequest("PUT", `/api/users/${user?.id}/email-signatures/${selectedMailbox}`, data);
    },
    onSuccess: () => {
      toast({ title: "Uložené", description: "Podpis bol uložený" });
      setSignatureDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/users", user?.id, "email-signatures", selectedMailbox] });
    },
    onError: () => {
      toast({ title: "Chyba", description: "Nepodarilo sa uložiť podpis", variant: "destructive" });
    },
  });

  const folders = foldersData?.folders || [];
  const emails = messagesData?.emails || [];
  const totalCount = messagesData?.totalCount || 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  // Select Inbox by default
  if (folders.length > 0 && !selectedFolderId) {
    const inbox = folders.find(f => f.displayName === "Inbox");
    if (inbox) {
      setSelectedFolderId(inbox.id);
    }
  }

  const handleSendEmail = () => {
    const toList = composeData.to.split(",").map(e => e.trim()).filter(Boolean);
    const ccList = composeData.cc ? composeData.cc.split(",").map(e => e.trim()).filter(Boolean) : [];
    const bccList = composeData.bcc ? composeData.bcc.split(",").map(e => e.trim()).filter(Boolean) : [];

    if (toList.length === 0) {
      toast({ title: "Chyba", description: "Zadajte príjemcu", variant: "destructive" });
      return;
    }

    sendEmailMutation.mutate({
      to: toList,
      cc: ccList,
      bcc: bccList,
      subject: composeData.subject,
      body: composeData.body,
      mailboxEmail: selectedMailbox,
    });
  };

  const handleReply = () => {
    if (!selectedEmail) return;
    replyMutation.mutate({
      emailId: selectedEmail.id,
      body: composeData.body,
      replyAll: replyMode === "replyAll",
      mailboxEmail: selectedMailbox,
    });
  };

  const handleForward = () => {
    if (!selectedEmail) return;
    const toList = composeData.to.split(",").map(e => e.trim()).filter(Boolean);
    if (toList.length === 0) {
      toast({ title: "Chyba", description: "Zadajte príjemcu", variant: "destructive" });
      return;
    }
    forwardMutation.mutate({
      emailId: selectedEmail.id,
      to: toList,
      body: composeData.body,
      mailboxEmail: selectedMailbox,
    });
  };

  const openSignatureEditor = () => {
    setSignatureHtml(signatureData?.htmlContent || "");
    setSignatureActive(signatureData?.isActive !== false);
    setSignatureDialogOpen(true);
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center h-96">
        <AlertCircle className="h-8 w-8 text-muted-foreground mr-2" />
        <span>Prihláste sa pre prístup k emailom</span>
      </div>
    );
  }

  if (mailboxes.length === 0 && !mailboxesLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-semibold">Emailový klient</h1>
          <p className="text-muted-foreground mt-1">Pripojte svoj MS365 účet pre čítanie a odosielanie emailov</p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Mail className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium mb-2">MS365 nie je pripojený</p>
            <p className="text-muted-foreground mb-4">Pre použitie emailového klienta pripojte svoj MS365 účet v nastaveniach profilu</p>
            <Button onClick={() => window.location.href = "/ms365"} data-testid="button-connect-ms365">
              Pripojiť MS365
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Emailový klient</h1>
          <p className="text-muted-foreground mt-1">Čítanie a odosielanie emailov cez MS365</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedMailbox} onValueChange={(v) => { setSelectedMailbox(v); setSelectedFolderId(""); setSelectedEmail(null); setPage(0); }}>
            <SelectTrigger className="w-64" data-testid="select-mailbox">
              <SelectValue placeholder="Vyberte schránku" />
            </SelectTrigger>
            <SelectContent>
              {mailboxes.map((mb) => (
                <SelectItem key={mb.id} value={mb.type === "personal" ? "personal" : mb.email}>
                  <div className="flex items-center gap-2">
                    {mb.type === "personal" ? <User className="h-4 w-4" /> : <Mail className="h-4 w-4" />}
                    <span>{mb.displayName || mb.email}</span>
                    {mb.isDefault && <Badge variant="secondary" className="text-xs">Predvolená</Badge>}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={() => { refetchFolders(); refetchMessages(); }} data-testid="button-refresh">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={openSignatureEditor} data-testid="button-signature">
            <Settings className="h-4 w-4" />
          </Button>
          <Button onClick={() => { setComposeOpen(true); setReplyMode(null); setComposeData({ to: "", cc: "", bcc: "", subject: "", body: "" }); }} data-testid="button-compose">
            <PenSquare className="h-4 w-4 mr-2" />
            Nový email
          </Button>
        </div>
      </div>

      {/* Search bar */}
      <Card className="p-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 flex-1">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Hľadať v emailoch (predmet, odosielateľ, obsah)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="flex-1"
              data-testid="input-search"
            />
          </div>
          <Select value={searchMailbox} onValueChange={setSearchMailbox}>
            <SelectTrigger className="w-48" data-testid="select-search-mailbox">
              <SelectValue placeholder="Schránka" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Všetky schránky</SelectItem>
              {mailboxes.map((mb) => (
                <SelectItem key={mb.id} value={mb.type === "personal" ? "personal" : mb.email}>
                  {mb.displayName || mb.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={handleSearch} disabled={searchQuery.trim().length < 2} data-testid="button-search">
            <Search className="h-4 w-4 mr-2" />
            Hľadať
          </Button>
          {isSearching && (
            <Button variant="outline" onClick={clearSearch} data-testid="button-clear-search">
              <X className="h-4 w-4 mr-2" />
              Zrušiť
            </Button>
          )}
        </div>
      </Card>

      {/* Search results */}
      {isSearching ? (
        <Card className="h-[calc(100vh-320px)]">
          <CardHeader className="py-3 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Search className="h-4 w-4" />
              Výsledky vyhľadávania: "{searchQuery}"
            </CardTitle>
            {searchLoading && <Loader2 className="h-4 w-4 animate-spin" />}
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[calc(100vh-420px)]">
              {searchLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span className="ml-2">Vyhľadávam...</span>
                </div>
              ) : searchResults && searchResults.length > 0 ? (
                <div className="divide-y">
                  {searchResults.map((result, idx) => (
                    <div key={idx}>
                      {result.emails.length > 0 && (
                        <>
                          <div className="px-4 py-2 bg-muted/50 text-sm font-medium flex items-center gap-2">
                            <Mail className="h-4 w-4" />
                            {result.mailbox}
                            <Badge variant="secondary" className="text-xs">{result.emails.length}</Badge>
                          </div>
                          {result.emails.map((email) => (
                            <button
                              key={email.id}
                              onClick={() => {
                                const mbx = mailboxes.find(m => 
                                  m.email === result.mailbox || 
                                  (m.type === "personal" && result.mailbox === (mailboxes.find(x => x.type === "personal")?.email || "Osobná schránka"))
                                );
                                if (mbx) {
                                  setSelectedMailbox(mbx.type === "personal" ? "personal" : mbx.email);
                                }
                                setSelectedEmail(email);
                              }}
                              className={`w-full text-left px-4 py-3 transition-colors hover-elevate ${
                                !email.isRead ? "bg-primary/5" : ""
                              } ${selectedEmail?.id === email.id ? "bg-primary/10" : ""}`}
                              data-testid={`search-result-${email.id}`}
                            >
                              <div className="flex items-start gap-3">
                                {email.isRead ? (
                                  <MailOpen className="h-4 w-4 mt-1 text-muted-foreground" />
                                ) : (
                                  <Mail className="h-4 w-4 mt-1 text-primary" />
                                )}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between gap-2 mb-1">
                                    <span className={`text-sm truncate ${!email.isRead ? "font-semibold" : ""}`}>
                                      {email.from?.emailAddress?.name || email.from?.emailAddress?.address}
                                    </span>
                                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                                      {format(new Date(email.receivedDateTime), "dd.MM.yyyy HH:mm")}
                                    </span>
                                  </div>
                                  <div className={`text-sm truncate ${!email.isRead ? "font-medium" : ""}`}>
                                    {email.subject || "(bez predmetu)"}
                                  </div>
                                  <div className="text-xs text-muted-foreground truncate mt-1">
                                    {email.bodyPreview}
                                  </div>
                                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                                    {email.hasAttachments && <Paperclip className="h-3 w-3 text-muted-foreground" />}
                                    {email.importance === "high" && (
                                      <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4">
                                        <Star className="h-2.5 w-2.5 mr-0.5" />
                                        Vysoká
                                      </Badge>
                                    )}
                                    {email.importance === "low" && (
                                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 opacity-60">
                                        Nízka
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </button>
                          ))}
                        </>
                      )}
                    </div>
                  ))}
                  {searchResults.every(r => r.emails.length === 0) && (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                      <Search className="h-8 w-8 mb-2" />
                      <span>Žiadne výsledky pre "{searchQuery}"</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Search className="h-8 w-8 mb-2" />
                  <span>Žiadne výsledky</span>
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-12 gap-4 h-[calc(100vh-280px)]">
        {/* Folders panel */}
        <Card className="col-span-2">
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-medium">Zložky</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {foldersLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : (
              <ScrollArea className="h-[calc(100vh-320px)]">
                <div className="space-y-1 p-2">
                  {folders.map((folder) => (
                    <button
                      key={folder.id}
                      onClick={() => { setSelectedFolderId(folder.id); setSelectedEmail(null); setPage(0); }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors hover-elevate ${
                        selectedFolderId === folder.id ? "bg-primary text-primary-foreground" : ""
                      }`}
                      data-testid={`folder-${folder.displayName.toLowerCase().replace(/\s/g, "-")}`}
                    >
                      <div className="flex items-center gap-2">
                        {folderIcons[folder.displayName] || <Mail className="h-4 w-4" />}
                        <span className="truncate">{folder.displayName}</span>
                      </div>
                      {folder.unreadItemCount > 0 && (
                        <Badge variant="secondary" className="text-xs">{folder.unreadItemCount}</Badge>
                      )}
                    </button>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {/* Emails list */}
        <Card className="col-span-4">
          <CardHeader className="py-3 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium">Emaily ({totalCount})</CardTitle>
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-xs">{page + 1}/{totalPages}</span>
                <Button variant="ghost" size="icon" className="h-7 w-7" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </CardHeader>
          <CardContent className="p-0">
            {messagesLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : emails.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Mail className="h-8 w-8 mb-2" />
                <span>Žiadne emaily</span>
              </div>
            ) : (
              <ScrollArea className="h-[calc(100vh-320px)]">
                <div className="divide-y">
                  {emails.map((email) => (
                    <button
                      key={email.id}
                      onClick={() => setSelectedEmail(email)}
                      className={`w-full text-left p-3 transition-colors hover-elevate ${
                        selectedEmail?.id === email.id ? "bg-accent" : ""
                      } ${!email.isRead ? "bg-accent/50" : ""}`}
                      data-testid={`email-item-${email.id}`}
                    >
                      <div className="flex items-start gap-2">
                        {email.isRead ? (
                          <MailOpen className="h-4 w-4 text-muted-foreground mt-1 shrink-0" />
                        ) : (
                          <Mail className="h-4 w-4 text-primary mt-1 shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className={`text-sm truncate ${!email.isRead ? "font-semibold" : ""}`}>
                              {email.from?.emailAddress?.name || email.from?.emailAddress?.address || "Neznámy odosielateľ"}
                            </span>
                            <span className="text-xs text-muted-foreground shrink-0">
                              {format(new Date(email.receivedDateTime), "d.M. HH:mm")}
                            </span>
                          </div>
                          <p className={`text-sm truncate ${!email.isRead ? "font-medium" : "text-muted-foreground"}`}>
                            {email.subject || "(Bez predmetu)"}
                          </p>
                          <p className="text-xs text-muted-foreground truncate mt-1">
                            {email.bodyPreview}
                          </p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            {email.hasAttachments && <Paperclip className="h-3 w-3 text-muted-foreground" />}
                            {email.importance === "high" && (
                              <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4">
                                <Star className="h-2.5 w-2.5 mr-0.5" />
                                Vysoká
                              </Badge>
                            )}
                            {email.importance === "low" && (
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 opacity-60">
                                Nízka
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {/* Email detail / Compose */}
        <Card className="col-span-6">
          <CardContent className="p-0 h-full">
            {detailLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : emailDetail && selectedEmail ? (
              <div className="flex flex-col h-full">
                <div className="p-4 border-b space-y-2">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-lg font-semibold">{emailDetail.subject || "(Bez predmetu)"}</h2>
                      {emailDetail.importance === "high" && (
                        <Badge variant="destructive" className="text-xs">
                          <Star className="h-3 w-3 mr-1" />
                          Vysoká dôležitosť
                        </Badge>
                      )}
                      {emailDetail.importance === "low" && (
                        <Badge variant="secondary" className="text-xs opacity-60">Nízka dôležitosť</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="ghost" size="icon" onClick={() => { setReplyMode("reply"); setComposeData({ ...composeData, body: "" }); }} data-testid="button-reply">
                        <Reply className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => { setReplyMode("replyAll"); setComposeData({ ...composeData, body: "" }); }} data-testid="button-reply-all">
                        <ReplyAll className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => { setReplyMode("forward"); setComposeData({ to: "", cc: "", bcc: "", subject: `Fwd: ${emailDetail.subject}`, body: "" }); }} data-testid="button-forward">
                        <Forward className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteEmailMutation.mutate(emailDetail.id)} data-testid="button-delete">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="text-sm">
                    <p><span className="text-muted-foreground">Od:</span> {emailDetail.from?.emailAddress?.name} &lt;{emailDetail.from?.emailAddress?.address}&gt;</p>
                    <p><span className="text-muted-foreground">Komu:</span> {emailDetail.toRecipients?.map(r => r.emailAddress?.address).join(", ")}</p>
                    {emailDetail.ccRecipients && emailDetail.ccRecipients.length > 0 && (
                      <p><span className="text-muted-foreground">Cc:</span> {emailDetail.ccRecipients?.map(r => r.emailAddress?.address).join(", ")}</p>
                    )}
                    <p className="text-muted-foreground text-xs mt-1">
                      {format(new Date(emailDetail.receivedDateTime), "d. MMMM yyyy, HH:mm")}
                    </p>
                  </div>
                </div>
                
                {replyMode ? (
                  <div className="flex-1 p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium">
                        {replyMode === "reply" && "Odpoveď"}
                        {replyMode === "replyAll" && "Odpoveď všetkým"}
                        {replyMode === "forward" && "Preposlať"}
                      </h3>
                      <Button variant="ghost" size="icon" onClick={() => setReplyMode(null)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    {replyMode === "forward" && (
                      <Input
                        placeholder="Komu (viac adries oddeľte čiarkou)"
                        value={composeData.to}
                        onChange={(e) => setComposeData({ ...composeData, to: e.target.value })}
                        data-testid="input-forward-to"
                      />
                    )}
                    <div className="border rounded-md">
                      <Editor
                        value={composeData.body}
                        onChange={(e) => setComposeData({ ...composeData, body: e.target.value })}
                        style={{ minHeight: "150px" }}
                        data-testid="editor-reply-body"
                      />
                    </div>
                    <div className="flex justify-end">
                      <Button 
                        onClick={replyMode === "forward" ? handleForward : handleReply}
                        disabled={replyMutation.isPending || forwardMutation.isPending}
                        data-testid="button-send-reply"
                      >
                        {(replyMutation.isPending || forwardMutation.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        <Send className="h-4 w-4 mr-2" />
                        Odoslať
                      </Button>
                    </div>
                  </div>
                ) : (
                  <ScrollArea className="flex-1">
                    <div className="p-4">
                      {emailDetail.body?.contentType === "html" ? (
                        <div 
                          className="prose dark:prose-invert max-w-none"
                          dangerouslySetInnerHTML={{ __html: emailDetail.body.content }}
                        />
                      ) : (
                        <pre className="whitespace-pre-wrap font-sans text-sm">
                          {emailDetail.body?.content || emailDetail.bodyPreview}
                        </pre>
                      )}
                    </div>
                  </ScrollArea>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <Mail className="h-12 w-12 mb-4" />
                <p>Vyberte email pre zobrazenie detailu</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      )}

      {/* Compose Dialog */}
      <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nový email</DialogTitle>
            <DialogDescription>
              Odoslať z: {mailboxes.find(m => (m.type === "personal" ? "personal" : m.email) === selectedMailbox)?.email || selectedMailbox}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Komu (viac adries oddeľte čiarkou)"
              value={composeData.to}
              onChange={(e) => setComposeData({ ...composeData, to: e.target.value })}
              data-testid="input-compose-to"
            />
            <Input
              placeholder="Cc (voliteľné)"
              value={composeData.cc}
              onChange={(e) => setComposeData({ ...composeData, cc: e.target.value })}
              data-testid="input-compose-cc"
            />
            <Input
              placeholder="Predmet"
              value={composeData.subject}
              onChange={(e) => setComposeData({ ...composeData, subject: e.target.value })}
              data-testid="input-compose-subject"
            />
            <div className="border rounded-md">
              <Editor
                value={composeData.body}
                onChange={(e) => setComposeData({ ...composeData, body: e.target.value })}
                style={{ minHeight: "200px" }}
                data-testid="editor-compose-body"
              />
            </div>
            {signatureData?.isActive && signatureData?.htmlContent && (
              <div className="text-xs text-muted-foreground">
                Podpis bude automaticky pridaný
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setComposeOpen(false)}>
              Zrušiť
            </Button>
            <Button onClick={handleSendEmail} disabled={sendEmailMutation.isPending} data-testid="button-send-compose">
              {sendEmailMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <Send className="h-4 w-4 mr-2" />
              Odoslať
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Signature Editor Dialog */}
      <Dialog open={signatureDialogOpen} onOpenChange={setSignatureDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nastavenie podpisu</DialogTitle>
            <DialogDescription>
              Podpis pre: {mailboxes.find(m => (m.type === "personal" ? "personal" : m.email) === selectedMailbox)?.email || selectedMailbox}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="signature-active"
                checked={signatureActive}
                onChange={(e) => setSignatureActive(e.target.checked)}
                className="rounded border-gray-300"
              />
              <label htmlFor="signature-active" className="text-sm">Aktívny podpis</label>
            </div>
            <div className="border rounded-md">
              <Editor
                value={signatureHtml}
                onChange={(e) => setSignatureHtml(e.target.value)}
                style={{ minHeight: "200px" }}
                data-testid="editor-signature"
              />
            </div>
            <div className="text-xs text-muted-foreground">
              Môžete použiť HTML formátovanie pre váš podpis
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSignatureDialogOpen(false)}>
              Zrušiť
            </Button>
            <Button 
              onClick={() => saveSignatureMutation.mutate({ htmlContent: signatureHtml, isActive: signatureActive })}
              disabled={saveSignatureMutation.isPending}
              data-testid="button-save-signature"
            >
              {saveSignatureMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Uložiť podpis
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
