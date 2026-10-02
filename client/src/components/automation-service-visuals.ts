import {
  Bell, ClipboardList, Mail, MessageSquare, Webhook, Wrench,
  UserRoundCheck, Tag, PhoneIncoming, PhoneOutgoing, PhoneMissed,
  PhoneCall, Clock3, Sparkles, AlertTriangle, type LucideIcon,
} from "lucide-react";

type Visual = { icon: LucideIcon; accent: string; tile: string; border: string };

const blue = { accent: "text-blue-700 dark:text-blue-300", tile: "bg-blue-50 dark:bg-blue-950/50", border: "hover:border-blue-300 dark:hover:border-blue-700" };
const emerald = { accent: "text-emerald-700 dark:text-emerald-300", tile: "bg-emerald-50 dark:bg-emerald-950/50", border: "hover:border-emerald-300 dark:hover:border-emerald-700" };
const violet = { accent: "text-violet-700 dark:text-violet-300", tile: "bg-violet-50 dark:bg-violet-950/50", border: "hover:border-violet-300 dark:hover:border-violet-700" };
const amber = { accent: "text-amber-700 dark:text-amber-300", tile: "bg-amber-50 dark:bg-amber-950/50", border: "hover:border-amber-300 dark:hover:border-amber-700" };
const cyan = { accent: "text-cyan-700 dark:text-cyan-300", tile: "bg-cyan-50 dark:bg-cyan-950/50", border: "hover:border-cyan-300 dark:hover:border-cyan-700" };
const rose = { accent: "text-rose-700 dark:text-rose-300", tile: "bg-rose-50 dark:bg-rose-950/50", border: "hover:border-rose-300 dark:hover:border-rose-700" };

/** Shared visual vocabulary: new services get a safe icon until assigned a specific one. */
export const serviceVisuals: Record<string, Visual> = {
  create_task: { icon: ClipboardList, ...blue },
  notify_user: { icon: Bell, ...amber },
  send_email: { icon: Mail, ...emerald },
  send_sms: { icon: MessageSquare, ...cyan },
  webhook: { icon: Webhook, ...rose },
  update_entity: { icon: Wrench, ...violet },
  assign_user: { icon: UserRoundCheck, ...blue },
  add_tag: { icon: Tag, ...violet },
  remove_tag: { icon: Tag, ...rose },
  assign_task: { icon: ClipboardList, ...blue },
  send_email_group: { icon: Mail, ...emerald },
  notify_email: { icon: Mail, ...violet },
  set_contact_status: { icon: Tag, ...violet },
  set_callback: { icon: Clock3, ...cyan },
  send_contact_email: { icon: Mail, ...emerald },
  assigned_notice: { icon: PhoneIncoming, ...blue },
  missed_agent_notice: { icon: PhoneMissed, ...rose },
  missed_group_task: { icon: ClipboardList, ...amber },
  completed_review_task: { icon: PhoneCall, ...emerald },
  long_wait_notice: { icon: Clock3, ...cyan },
  started_notice: { icon: PhoneOutgoing, ...blue },
  unanswered_agent_notice: { icon: PhoneMissed, ...rose },
  unanswered_followup_task: { icon: ClipboardList, ...amber },
  notification_rules: { icon: Bell, ...amber },
  metric_alerts: { icon: AlertTriangle, ...rose },
};

export const serviceVisual = (id: string): Visual => serviceVisuals[id] || { icon: Sparkles, ...violet };