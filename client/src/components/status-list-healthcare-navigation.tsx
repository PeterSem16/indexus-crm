import { createContext, useContext, type ReactNode } from "react";

type StatusListHealthcareNavigation = {
  openContentGroup: (groupId: string) => Promise<boolean>;
  addCustomQuestion?: () => Promise<boolean>;
};

const StatusListHealthcareNavigationContext = createContext<StatusListHealthcareNavigation | null>(null);

export function StatusListHealthcareNavigationProvider({
  value,
  children,
}: {
  value: StatusListHealthcareNavigation;
  children: ReactNode;
}) {
  return <StatusListHealthcareNavigationContext.Provider value={value}>
    {children}
  </StatusListHealthcareNavigationContext.Provider>;
}

export function useStatusListHealthcareNavigation() {
  return useContext(StatusListHealthcareNavigationContext);
}
