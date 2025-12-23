import { useState, useEffect, useRef } from "react";
import { Search, X, User, Users, Package, FileText, Building, File } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useI18n } from "@/i18n";
import { useLocation } from "wouter";

interface SearchResult {
  type: string;
  id: string;
  title: string;
  subtitle: string;
  url: string;
}

export function GlobalSearch() {
  const { t } = useI18n();
  const [, setLocation] = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen(true);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    const searchTimer = setTimeout(async () => {
      if (query.length < 2) {
        setResults([]);
        return;
      }

      setIsLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`, { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          setResults(data.results || []);
        }
      } catch (error) {
        console.error("Search failed:", error);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => clearTimeout(searchTimer);
  }, [query]);

  const handleResultClick = (result: SearchResult) => {
    setIsOpen(false);
    setQuery("");
    setResults([]);
    setLocation(result.url);
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "customer":
        return <User className="h-4 w-4" />;
      case "collaborator":
        return <Users className="h-4 w-4" />;
      case "user":
        return <User className="h-4 w-4" />;
      case "product":
        return <Package className="h-4 w-4" />;
      case "invoice":
        return <FileText className="h-4 w-4" />;
      case "agreement":
        return <File className="h-4 w-4" />;
      default:
        return <Building className="h-4 w-4" />;
    }
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      customer: t.nav?.customers || "Customers",
      collaborator: t.nav?.collaborators || "Collaborators",
      user: t.nav?.users || "Users",
      product: t.nav?.products || "Products",
      invoice: t.nav?.invoices || "Invoices",
      agreement: t.globalSearch?.agreement || "Agreement",
    };
    return labels[type] || type;
  };

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setIsOpen(true)}
        data-testid="button-global-search"
      >
        <Search className="h-5 w-5" />
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>{t.globalSearch?.title || "Search"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t.globalSearch?.placeholder || "Search customers, collaborators, invoices..."}
                className="pl-10 pr-10"
                data-testid="input-global-search"
              />
              {query && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                  onClick={() => setQuery("")}
                  data-testid="button-clear-search"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>

            <div className="max-h-[400px] overflow-y-auto">
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  {t.common?.loading || "Loading..."}
                </div>
              ) : query.length < 2 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {t.globalSearch?.minChars || "Type at least 2 characters to search"}
                </div>
              ) : results.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {t.globalSearch?.noResults || "No results found"}
                </div>
              ) : (
                <div className="space-y-1">
                  {results.map((result) => (
                    <button
                      key={`${result.type}-${result.id}`}
                      onClick={() => handleResultClick(result)}
                      className="w-full flex items-center gap-3 p-3 rounded-md hover-elevate text-left"
                      data-testid={`search-result-${result.type}-${result.id}`}
                    >
                      <div className="flex-shrink-0 text-muted-foreground">
                        {getTypeIcon(result.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{result.title}</div>
                        <div className="text-sm text-muted-foreground truncate">{result.subtitle}</div>
                      </div>
                      <div className="flex-shrink-0">
                        <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                          {getTypeLabel(result.type)}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
