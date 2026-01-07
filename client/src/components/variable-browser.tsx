import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { 
  Search, 
  ChevronDown, 
  ChevronRight,
  Copy,
  Plus,
  User,
  UserPlus,
  Baby,
  Building2,
  FileText,
  Users,
  Briefcase,
  Hospital,
  Receipt,
  CreditCard,
  Package,
  Settings,
  Loader2,
  Info
} from "lucide-react";

interface Variable {
  id: string;
  blockId: string;
  key: string;
  label: string;
  labelEn: string | null;
  dataType: string;
  example: string | null;
  priority: number;
}

interface VariableKeyword {
  id: string;
  blockId: string;
  keyword: string;
  locale: string;
  weight: number;
}

interface VariableBlock {
  id: string;
  code: string;
  displayName: string;
  displayNameEn: string | null;
  icon: string;
  priority: number;
  variables: Variable[];
  keywords: VariableKeyword[];
}

interface VariableRegistry {
  blocks: VariableBlock[];
}

const iconMap: Record<string, React.FC<{ className?: string }>> = {
  User,
  UserPlus,
  Baby,
  Building2,
  FileText,
  Users,
  Briefcase,
  Hospital,
  Receipt,
  CreditCard,
  Package,
  Settings,
};

interface VariableBrowserProps {
  onInsertVariable?: (variableKey: string) => void;
  onCopyVariable?: (variableKey: string) => void;
  compact?: boolean;
  className?: string;
}

export function VariableBrowser({ 
  onInsertVariable, 
  onCopyVariable,
  compact = false,
  className = ""
}: VariableBrowserProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedBlocks, setExpandedBlocks] = useState<Set<string>>(new Set());

  const { data: registry, isLoading, error } = useQuery<VariableRegistry>({
    queryKey: ["/api/variables/registry"],
  });

  const filteredBlocks = useMemo(() => {
    if (!registry?.blocks) return [];
    if (!searchQuery.trim()) return registry.blocks;

    const query = searchQuery.toLowerCase();
    return registry.blocks
      .map(block => {
        const matchingVariables = block.variables.filter(
          v => v.key.toLowerCase().includes(query) ||
               v.label.toLowerCase().includes(query) ||
               (v.labelEn?.toLowerCase() || "").includes(query)
        );
        
        const blockMatches = 
          block.displayName.toLowerCase().includes(query) ||
          (block.displayNameEn?.toLowerCase() || "").includes(query) ||
          block.keywords.some(k => k.keyword.toLowerCase().includes(query));

        if (matchingVariables.length > 0 || blockMatches) {
          return {
            ...block,
            variables: matchingVariables.length > 0 ? matchingVariables : block.variables,
          };
        }
        return null;
      })
      .filter((b): b is VariableBlock => b !== null);
  }, [registry, searchQuery]);

  const toggleBlock = (blockId: string) => {
    const newExpanded = new Set(expandedBlocks);
    if (newExpanded.has(blockId)) {
      newExpanded.delete(blockId);
    } else {
      newExpanded.add(blockId);
    }
    setExpandedBlocks(newExpanded);
  };

  const handleCopy = async (variableKey: string) => {
    const placeholder = `{{${variableKey}}}`;
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(placeholder);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = placeholder;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      if (onCopyVariable) {
        onCopyVariable(variableKey);
      }
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  const handleInsert = (variableKey: string) => {
    if (onInsertVariable) {
      onInsertVariable(variableKey);
    }
  };

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center p-8 ${className}`}>
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Načítavam premenné...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`p-4 text-center text-destructive ${className}`}>
        Nepodarilo sa načítať premenné. Skúste stránku obnoviť.
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full ${className}`} data-testid="variable-browser">
      <div className="p-3 border-b">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Hľadať premenné..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="input-variable-search"
          />
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Kliknite na premennú pre vloženie do dokumentu
        </p>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {filteredBlocks.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchQuery ? "Žiadne výsledky pre vyhľadávanie" : "Žiadne bloky premenných"}
            </div>
          ) : (
            filteredBlocks.map((block) => {
              const Icon = iconMap[block.icon] || FileText;
              const isExpanded = expandedBlocks.has(block.id) || searchQuery.length > 0;

              return (
                <Collapsible
                  key={block.id}
                  open={isExpanded}
                  onOpenChange={() => toggleBlock(block.id)}
                >
                  <CollapsibleTrigger
                    className="flex items-center gap-2 w-full p-2 rounded-md hover-elevate active-elevate-2 text-left"
                    data-testid={`button-block-${block.code}`}
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    )}
                    <Icon className="h-4 w-4 flex-shrink-0" />
                    <span className="font-medium text-sm flex-1">{block.displayName}</span>
                    <Badge variant="secondary" className="text-xs">
                      {block.variables.length}
                    </Badge>
                  </CollapsibleTrigger>

                  <CollapsibleContent>
                    <div className="ml-6 pl-4 border-l space-y-1 py-1">
                      {block.variables.map((variable) => (
                        <div
                          key={variable.id}
                          className="group flex items-center gap-2 p-2 rounded-md hover-elevate cursor-pointer"
                          onClick={() => handleInsert(variable.key)}
                          data-testid={`variable-${variable.key}`}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-mono text-primary truncate">
                                {`{{${variable.key}}}`}
                              </span>
                              {variable.example && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Info className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                  </TooltipTrigger>
                                  <TooltipContent side="right">
                                    <p className="text-xs">Príklad: {variable.example}</p>
                                  </TooltipContent>
                                </Tooltip>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground truncate">
                              {variable.label}
                            </p>
                          </div>
                          
                          <div className="flex gap-1 invisible group-hover:visible">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCopy(variable.key);
                                  }}
                                  data-testid={`button-copy-${variable.key}`}
                                >
                                  <Copy className="h-3 w-3" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Kopírovať do schránky</p>
                              </TooltipContent>
                            </Tooltip>
                            {onInsertVariable && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleInsert(variable.key);
                                    }}
                                    data-testid={`button-insert-${variable.key}`}
                                  >
                                    <Plus className="h-3 w-3" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Vložiť do dokumentu</p>
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
