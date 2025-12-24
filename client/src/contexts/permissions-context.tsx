import { createContext, useContext, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "./auth-context";

type ModuleAccess = "visible" | "hidden";
type FieldAccess = "editable" | "readonly" | "hidden";

interface ModulePermission {
  moduleKey: string;
  access: ModuleAccess;
}

interface FieldPermission {
  fieldKey: string;
  access: FieldAccess;
}

interface RoleWithPermissions {
  id: string;
  name: string;
  legacyRole: string | null;
  modulePermissions: ModulePermission[];
  fieldPermissions: FieldPermission[];
}

interface PermissionsContextType {
  canAccessModule: (moduleKey: string) => boolean;
  getFieldAccess: (fieldKey: string) => FieldAccess;
  isLoading: boolean;
  roleData: RoleWithPermissions | null;
}

const PermissionsContext = createContext<PermissionsContextType | undefined>(undefined);

export function PermissionsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  
  const { data: roleData, isLoading } = useQuery<RoleWithPermissions>({
    queryKey: ["/api/roles", user?.roleId],
    enabled: !!user?.roleId,
  });
  
  const canAccessModule = (moduleKey: string): boolean => {
    if (!user) return false;
    
    // Users without roleId: admins see everything, others see nothing
    if (!user.roleId) {
      return user.role === "admin";
    }
    
    // Still loading role data: show all for admin, nothing for others
    if (!roleData) {
      return user.role === "admin";
    }
    
    // Check if role has legacyRole "admin" - full access
    if (roleData.legacyRole === "admin") {
      return true;
    }
    
    // Find specific module permission
    const modulePerm = roleData.modulePermissions.find(p => p.moduleKey === moduleKey);
    
    // If no permission set for this module, default to VISIBLE
    if (!modulePerm) {
      return true;
    }
    
    // Check explicit permission
    return modulePerm.access === "visible";
  };
  
  const getFieldAccess = (fieldKey: string): FieldAccess => {
    if (!user) return "hidden";
    
    if (!user.roleId || !roleData) {
      return user.role === "admin" ? "editable" : "readonly";
    }
    
    const fieldPerm = roleData.fieldPermissions.find(p => p.fieldKey === fieldKey);
    if (!fieldPerm) {
      return user.role === "admin" ? "editable" : "readonly";
    }
    
    return fieldPerm.access;
  };
  
  return (
    <PermissionsContext.Provider value={{ canAccessModule, getFieldAccess, isLoading, roleData: roleData ?? null }}>
      {children}
    </PermissionsContext.Provider>
  );
}

export function usePermissions() {
  const context = useContext(PermissionsContext);
  if (context === undefined) {
    throw new Error("usePermissions must be used within a PermissionsProvider");
  }
  return context;
}
