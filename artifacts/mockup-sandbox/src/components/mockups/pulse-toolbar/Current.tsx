import { PhoneOff, Mail, MessageSquare, History } from "lucide-react";
import {Button} from "./_shared/button";
import {Badge} from "./_shared/badge";
import {Separator} from "./_shared/separator";
import "./_group.css";
export function Current(){
const onOpenAbandonedCalls=()=>{},onOpenMyActivity=()=>{};
const missedCommunicationCounts={calls:0,emails:0,sms:16};
const t={agentWorkspace:{missedLabel:"Missed",missedCallsTab:"Calls",missedEmailsTab:"Emails",missedSmsTab:"SMS",todayCallsButtonLabel:"My Shift"}};
return <div className="toolbar-current"><div className="toolbar-row">          {onOpenAbandonedCalls && (
            <>
              <Separator orientation="vertical" className="h-6 mx-1" />
              <Button
                variant="outline"
                size="sm"
                onClick={onOpenAbandonedCalls}
                className="gap-1.5 relative"
                data-testid="btn-open-abandoned-calls"
              >
                <PhoneOff className="h-3.5 w-3.5 text-destructive" />
                <span className="text-xs hidden xl:inline">{t.agentWorkspace.missedLabel}</span>
                <span className="flex items-center gap-0.5 ml-0.5" aria-label={t.agentWorkspace.missedLabel}>
                  <Badge
                    className="text-[9px] h-4 min-w-[18px] px-1 gap-0.5 border-0 bg-red-100 text-red-700 hover:bg-red-100 dark:bg-red-950/60 dark:text-red-300"
                    title={t.agentWorkspace.missedCallsTab}
                    aria-label={`${t.agentWorkspace.missedCallsTab}: ${missedCommunicationCounts?.calls || 0}`}
                    data-testid="badge-missed-calls"
                  >
                    <PhoneOff className="h-2.5 w-2.5" />
                    {missedCommunicationCounts?.calls || 0}
                  </Badge>
                  <Badge
                    className="text-[9px] h-4 min-w-[18px] px-1 gap-0.5 border-0 bg-green-100 text-green-700 hover:bg-green-100 dark:bg-green-950/60 dark:text-green-300"
                    title={t.agentWorkspace.missedEmailsTab}
                    aria-label={`${t.agentWorkspace.missedEmailsTab}: ${missedCommunicationCounts?.emails || 0}`}
                    data-testid="badge-missed-emails"
                  >
                    <Mail className="h-2.5 w-2.5" />
                    {missedCommunicationCounts?.emails || 0}
                  </Badge>
                  <Badge
                    className="text-[9px] h-4 min-w-[18px] px-1 gap-0.5 border-0 bg-orange-100 text-orange-700 hover:bg-orange-100 dark:bg-orange-950/60 dark:text-orange-300"
                    title={t.agentWorkspace.missedSmsTab}
                    aria-label={`${t.agentWorkspace.missedSmsTab}: ${missedCommunicationCounts?.sms || 0}`}
                    data-testid="badge-missed-sms"
                  >
                    <MessageSquare className="h-2.5 w-2.5" />
                    {missedCommunicationCounts?.sms || 0}
                  </Badge>
                </span>
              </Button>
            </>
          )}
          {onOpenMyActivity && (
            <>
              <Separator orientation="vertical" className="h-6 mx-1" />
              <Button
                variant="outline"
                size="sm"
                onClick={onOpenMyActivity}
                className="gap-1.5"
                data-testid="btn-open-my-activity"
              >
                <History className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs hidden xl:inline">{t.agentWorkspace.todayCallsButtonLabel}</span>
              </Button>
            </>
          )}
</div><span className="toolbar-caption">Súčasné tlačidlá · extrahované z aplikácie · 0 hovorov / 0 e-mailov / 16 SMS</span></div>;
}