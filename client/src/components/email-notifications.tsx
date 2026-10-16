import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Mail, Bell, X, ChevronDown, ExternalLink, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/contexts/auth-context";
import { useOmniEmailUnread } from "@/hooks/use-omni-email-unread";
import { formatDistanceToNow } from "date-fns";
import { sk } from "date-fns/locale";

interface Email {
  id: string;
  subject: string;
  from: {
    emailAddress: {
      name: string;
      address: string;
    };
  };
  receivedDateTime: string;
  isRead: boolean;
  bodyPreview: string;
}

interface RecentEmailsResponse {
  connected: boolean;
  emails: Email[];
  requiresReauth?: boolean;
}

export function EmailNotifications() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [previousTotal, setPreviousTotal] = useState<number | null>(null);
  const [hasNewEmails, setHasNewEmails] = useState(false);

  const { data: unreadData } = useOmniEmailUnread();

  const { data: recentEmails, refetch: refetchEmails } = useQuery<RecentEmailsResponse>({
    queryKey: ["/api/users", user?.id, "ms365-recent-emails", "unread"],
    queryFn: async () => {
      if (!user?.id) return { connected: false, emails: [] };
      const res = await fetch(`/api/users/${user.id}/ms365-recent-emails?top=5&unread=true`, { credentials: "include" });
      if (!res.ok) return { connected: false, emails: [] };
      return res.json();
    },
    enabled: !!user?.id,
    refetchInterval: isOpen ? 30000 : false,
    staleTime: 10000,
  });

  useEffect(() => {
    const currentTotal = unreadData?.totalUnread ?? 0;
    if (previousTotal !== null && currentTotal > previousTotal) {
      setHasNewEmails(true);
      setTimeout(() => setHasNewEmails(false), 5000);
    }
    if (unreadData?.totalUnread !== undefined) {
      setPreviousTotal(currentTotal);
    }
  }, [unreadData?.totalUnread, previousTotal]);

  useEffect(() => {
    if (isOpen) {
      refetchEmails();
    }
  }, [isOpen, refetchEmails]);

  if (!unreadData?.connected) {
    return null;
  }

  const totalUnread = unreadData.totalUnread || 0;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={`relative ${hasNewEmails ? "animate-pulse" : ""}`}
          data-testid="button-email-notifications"
        >
          <Mail className="h-5 w-5" />
          {totalUnread > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 min-w-5 p-0 flex items-center justify-center text-xs"
            >
              {totalUnread > 99 ? "99+" : totalUnread}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        <div className="flex items-center justify-between p-3 border-b">
          <div className="flex items-center gap-2">
            <Inbox className="h-4 w-4" />
            <span className="font-semibold">Neprečítané emaily</span>
            {totalUnread > 0 && (
              <Badge variant="secondary">{totalUnread}</Badge>
            )}
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-6 w-6"
            onClick={() => setIsOpen(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {unreadData.counts && unreadData.counts.length > 1 && (
          <div className="px-3 py-2 border-b bg-muted/50">
            <div className="flex flex-wrap gap-2">
              {unreadData.counts.map((count) => (
                <Badge 
                  key={count.mailbox} 
                  variant={count.unreadCount > 0 ? "default" : "outline"}
                  className="text-xs"
                >
                  {count.mailbox === "personal" ? "Osobná" : count.mailbox.split("@")[0]}
                  {count.unreadCount > 0 && `: ${count.unreadCount}`}
                </Badge>
              ))}
            </div>
          </div>
        )}

        <ScrollArea className="h-80">
          {recentEmails?.emails && recentEmails.emails.length > 0 ? (
            <div className="divide-y">
              {recentEmails.emails.map((email) => (
                <div 
                  key={email.id} 
                  className="p-3 hover-elevate cursor-pointer"
                  data-testid={`email-item-${email.id}`}
                >
                  <div className="flex items-start gap-2">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-medium text-primary">
                        {email.from?.emailAddress?.name?.[0]?.toUpperCase() || "?"}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium truncate">
                          {email.from?.emailAddress?.name || email.from?.emailAddress?.address || "Neznámy"}
                        </p>
                        <span className="text-xs text-muted-foreground flex-shrink-0">
                          {formatDistanceToNow(new Date(email.receivedDateTime), { 
                            addSuffix: true, 
                            locale: sk 
                          })}
                        </span>
                      </div>
                      <p className="text-sm font-medium truncate mt-0.5">
                        {email.subject || "(bez predmetu)"}
                      </p>
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                        {email.bodyPreview || ""}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Mail className="h-8 w-8 mb-2 opacity-50" />
              <p className="text-sm">Žiadne neprečítané emaily</p>
            </div>
          )}
        </ScrollArea>

        <div className="p-2 border-t">
          <Button 
            variant="ghost" 
            className="w-full justify-center text-sm"
            onClick={() => window.open("https://outlook.office.com/mail/inbox", "_blank")}
            data-testid="button-open-outlook"
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Otvoriť Outlook
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
