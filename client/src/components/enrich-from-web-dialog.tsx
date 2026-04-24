import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2, Globe } from "lucide-react";

type ScrapeSource = { id: string; key: string; name: string; countryCode: string; enabled: boolean };

interface EnrichFromWebDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetType: "clinic" | "hospital" | "person";
  targetId: string;
  targetName: string;
  targetCity?: string | null;
}

export function EnrichFromWebDialog({ open, onOpenChange, targetType, targetId, targetName, targetCity }: EnrichFromWebDialogProps) {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [sourceKey, setSourceKey] = useState<string>("evuc");

  const { data: sources = [] } = useQuery<ScrapeSource[]>({
    queryKey: ["/api/scraper/sources"],
    enabled: open,
  });

  const enrichMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/scraper/jobs/enrich", {
        sourceKey,
        targetType,
        targetId,
      });
      return await res.json();
    },
    onSuccess: (job: any) => {
      toast({
        title: "Doplnenie spustené",
        description: `Hľadám údaje pre "${targetName}" v zdroji ${sourceKey}. Po dokončení skontroluj v stagingu.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/scraper/jobs"] });
      onOpenChange(false);
      if (job?.id) {
        navigate(`/scraping?jobId=${job.id}`);
      } else {
        navigate("/scraping");
      }
    },
    onError: (e: any) => toast({ title: "Chyba", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="dialog-enrich-from-web">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Doplniť z webu
          </DialogTitle>
          <DialogDescription>
            Spustí scraper, ktorý sa pokúsi nájsť chýbajúce kontaktné údaje pre tento záznam vo verejných slovenských zdrojoch.
            Po dokončení uvidíš návrhy v stagingu, kde môžeš každú hodnotu schváliť alebo odmietnuť.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="rounded-md border p-3 bg-muted/30">
            <div className="text-xs text-muted-foreground mb-1">Záznam:</div>
            <div className="text-sm font-medium" data-testid="text-enrich-target-name">{targetName}</div>
            {targetCity && <div className="text-xs text-muted-foreground mt-0.5">Mesto: {targetCity}</div>}
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Zdroj scrapingu</Label>
            <Select value={sourceKey} onValueChange={setSourceKey}>
              <SelectTrigger data-testid="select-enrich-source"><SelectValue /></SelectTrigger>
              <SelectContent>
                {sources.map(s => (
                  <SelectItem key={s.key} value={s.key}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-enrich">Zrušiť</Button>
          <Button onClick={() => enrichMutation.mutate()} disabled={enrichMutation.isPending} data-testid="button-confirm-enrich">
            {enrichMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Globe className="h-4 w-4 mr-2" />}
            Spustiť doplnenie
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
