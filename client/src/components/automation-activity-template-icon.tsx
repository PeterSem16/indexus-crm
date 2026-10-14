import { Bell, ClipboardList, Mail, MessageSquare, Phone, PhoneIncoming, PhoneOutgoing, UserRound, Stethoscope, Hospital, FileSignature, Receipt, Target, Droplets, Package, ChartNoAxesCombined } from "lucide-react";
import { activityTemplateIconKind } from "./automation-activity-template-utils";
import { templateVisualTone } from "@shared/automation-template-visual";

const icons = {
  phone: Phone,
  inbound: PhoneIncoming,
  outbound: PhoneOutgoing,
  email: Mail,
  message: MessageSquare,
  task: ClipboardList,
  notification: Bell,
  customer: UserRound, clinic: Stethoscope, hospital: Hospital, contract: FileSignature,
  invoice: Receipt, campaign: Target, collection: Droplets, product: Package, metric: ChartNoAxesCombined,
} as const;

export function AutomationActivityTemplateIcon({ templateId, type }: { templateId: string; type?: string }) {
  const kind = activityTemplateIconKind(templateId, type);
  if (!kind) return null;
  const Icon = icons[kind];
  const tone = templateVisualTone(templateId);
  const colors = { positive: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    negative: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
    urgent: "bg-amber-500/15 text-amber-800 dark:text-amber-300",
    deadline: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
    info: "bg-blue-500/15 text-blue-700 dark:text-blue-300" };
  return (
    <span className={`inline-flex size-7 shrink-0 items-center justify-center rounded-lg ${colors[tone]}`} data-template-tone={tone} aria-hidden="true">
      <Icon className="size-3.5" />
    </span>
  );
}
