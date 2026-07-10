import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, startOfDay, endOfDay, startOfWeek, startOfMonth, parseISO } from "date-fns";
import { useI18n } from "@/i18n";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter,
} from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { HelpCircle, Users } from "lucide-react";

interface AgentProductivityRow {
  agentId: string;
  agentName: string;
  newCalls: number;
  repeatCalls: number;
  nonstandardTasks: number;
  twSeconds: number;
  talkSeconds: number;
  ringSeconds: number;
  totalSeconds: number;
}

function fmtDur(seconds: number): string {
  const s = Math.max(0, Math.round(seconds || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export default function CampaignAgentProductivity({ campaignId }: { campaignId: string }) {
  const { t } = useI18n();
  const ap = t.agentProductivity;
  const today = format(new Date(), "yyyy-MM-dd");
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);

  const validRange =
    !!from && !!to && !isNaN(parseISO(from).getTime()) && !isNaN(parseISO(to).getTime());
  const fromISO = validRange ? startOfDay(parseISO(from)).toISOString() : "";
  const toISO = validRange ? endOfDay(parseISO(to)).toISOString() : "";

  const { data: rows = [], isLoading } = useQuery<AgentProductivityRow[]>({
    queryKey: ["/api/campaigns", campaignId, "agent-productivity", fromISO, toISO],
    enabled: validRange && !!campaignId,
    queryFn: async () => {
      const res = await fetch(
        `/api/campaigns/${campaignId}/agent-productivity?from=${encodeURIComponent(fromISO)}&to=${encodeURIComponent(toISO)}`,
        { credentials: "include" },
      );
      if (!res.ok) throw new Error("Failed to load agent productivity");
      return res.json();
    },
  });

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, r) => ({
        newCalls: acc.newCalls + r.newCalls,
        repeatCalls: acc.repeatCalls + r.repeatCalls,
        nonstandardTasks: acc.nonstandardTasks + r.nonstandardTasks,
        twSeconds: acc.twSeconds + r.twSeconds,
        talkSeconds: acc.talkSeconds + r.talkSeconds,
        ringSeconds: acc.ringSeconds + r.ringSeconds,
        totalSeconds: acc.totalSeconds + r.totalSeconds,
      }),
      { newCalls: 0, repeatCalls: 0, nonstandardTasks: 0, twSeconds: 0, talkSeconds: 0, ringSeconds: 0, totalSeconds: 0 },
    );
  }, [rows]);

  const setRange = (kind: "today" | "week" | "month") => {
    const now = new Date();
    setTo(format(now, "yyyy-MM-dd"));
    if (kind === "today") setFrom(format(now, "yyyy-MM-dd"));
    else if (kind === "week") setFrom(format(startOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd"));
    else setFrom(format(startOfMonth(now), "yyyy-MM-dd"));
  };

  return (
    <Card data-testid="card-campaign-agent-productivity">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <h3 className="text-base font-semibold" data-testid="text-productivity-title">{ap.title}</h3>
              <p className="text-sm text-muted-foreground">{ap.subtitle}</p>
            </div>
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" data-testid="button-how-calculated">
                <HelpCircle className="h-4 w-4 mr-2" />
                {ap.howCalculated}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-96 text-sm" data-testid="popover-formula">
              <h4 className="font-bold mb-2">{ap.formulaTitle}</h4>
              <p className="text-muted-foreground mb-3">{ap.formulaIntro}</p>
              <ul className="space-y-1.5 mb-3 list-disc pl-4">
                <li>{ap.formulaNewCall}</li>
                <li>{ap.formulaRepeatCall}</li>
                <li>{ap.formulaTask}</li>
              </ul>
              <div className="rounded-md bg-muted p-2 font-mono text-xs space-y-1 mb-3">
                <div>{ap.formulaTw}</div>
                <div>{ap.formulaTotal}</div>
              </div>
              <p className="text-xs text-muted-foreground">{ap.formulaNote}</p>
            </PopoverContent>
          </Popover>
        </div>
        <div className="flex flex-wrap items-end gap-3 pt-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">{ap.from}</label>
            <Input
              type="date"
              value={from}
              max={to}
              onChange={(e) => setFrom(e.target.value)}
              className="w-40"
              data-testid="input-from"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">{ap.to}</label>
            <Input
              type="date"
              value={to}
              min={from}
              onChange={(e) => setTo(e.target.value)}
              className="w-40"
              data-testid="input-to"
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setRange("today")} data-testid="button-range-today">{ap.today}</Button>
            <Button variant="outline" size="sm" onClick={() => setRange("week")} data-testid="button-range-week">{ap.thisWeek}</Button>
            <Button variant="outline" size="sm" onClick={() => setRange("month")} data-testid="button-range-month">{ap.thisMonth}</Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground" data-testid="text-no-data">
            <Users className="h-10 w-10 mb-3 opacity-40" />
            <p>{ap.noData}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{ap.agent}</TableHead>
                  <TableHead className="text-right">{ap.newCalls}</TableHead>
                  <TableHead className="text-right">{ap.repeatCalls}</TableHead>
                  <TableHead className="text-right">{ap.nonstandardTasks}</TableHead>
                  <TableHead className="text-right">{ap.nonCallTime}</TableHead>
                  <TableHead className="text-right">{ap.talkTime}</TableHead>
                  <TableHead className="text-right">{ap.ringTime}</TableHead>
                  <TableHead className="text-right font-bold">{ap.totalEstimated}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.agentId} data-testid={`row-agent-${r.agentId}`}>
                    <TableCell className="font-medium" data-testid={`text-agent-name-${r.agentId}`}>{r.agentName}</TableCell>
                    <TableCell className="text-right" data-testid={`text-new-calls-${r.agentId}`}>{r.newCalls}</TableCell>
                    <TableCell className="text-right" data-testid={`text-repeat-calls-${r.agentId}`}>{r.repeatCalls}</TableCell>
                    <TableCell className="text-right" data-testid={`text-tasks-${r.agentId}`}>{r.nonstandardTasks}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{fmtDur(r.twSeconds)}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{fmtDur(r.talkSeconds)}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{fmtDur(r.ringSeconds)}</TableCell>
                    <TableCell className="text-right tabular-nums font-bold" data-testid={`text-total-${r.agentId}`}>{fmtDur(r.totalSeconds)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow data-testid="row-totals">
                  <TableCell className="font-bold">{ap.totals}</TableCell>
                  <TableCell className="text-right font-bold">{totals.newCalls}</TableCell>
                  <TableCell className="text-right font-bold">{totals.repeatCalls}</TableCell>
                  <TableCell className="text-right font-bold">{totals.nonstandardTasks}</TableCell>
                  <TableCell className="text-right tabular-nums font-bold">{fmtDur(totals.twSeconds)}</TableCell>
                  <TableCell className="text-right tabular-nums font-bold">{fmtDur(totals.talkSeconds)}</TableCell>
                  <TableCell className="text-right tabular-nums font-bold">{fmtDur(totals.ringSeconds)}</TableCell>
                  <TableCell className="text-right tabular-nums font-bold" data-testid="text-total-all">{fmtDur(totals.totalSeconds)}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
