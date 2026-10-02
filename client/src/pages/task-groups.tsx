import { Redirect } from "wouter";
import { useTaskSettingsAccess } from "@/hooks/use-task-settings-access";

export default function TaskGroupsPage() {
  const { canManage, isPending } = useTaskSettingsAccess();
  if (isPending) return null;
  return <Redirect to={canManage ? "/email?tab=tasks&taskSettings=1" : "/email?tab=tasks"} />;
}
