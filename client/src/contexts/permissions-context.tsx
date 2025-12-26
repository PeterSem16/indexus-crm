import { createContext, useContext, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "./auth-context";

type ModuleAccess = "visible" | "hidden";
type FieldAccess = "editable" | "readonly" | "hidden";

interface ModulePermission {
  moduleKey: string;
  access: ModuleAccess;
  canAdd?: boolean;
  canEdit?: boolean;
}

interface FieldPermission {
  moduleKey: string;
  fieldKey: string;
  permission: FieldAccess;
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
  canAdd: (moduleKey: string) => boolean;
  canEdit: (moduleKey: string) => boolean;
  getFieldAccess: (moduleKey: string, fieldKey: string) => FieldAccess;
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
    
    if (!user.roleId) {
      return user.role === "admin";
    }
    
    if (!roleData) {
      return user.role === "admin";
    }
    
    if (roleData.legacyRole === "admin") {
      return true;
    }
    
    const modulePerm = roleData.modulePermissions.find(p => p.moduleKey === moduleKey);
    
    if (!modulePerm) {
      return true;
    }
    
    return modulePerm.access === "visible";
  };
  
  const canAdd = (moduleKey: string): boolean => {
    if (!user) return false;
    
    if (!user.roleId) {
      return user.role === "admin";
    }
    
    if (!roleData) {
      return user.role === "admin";
    }
    
    if (roleData.legacyRole === "admin") {
      return true;
    }
    
    const modulePerm = roleData.modulePermissions.find(p => p.moduleKey === moduleKey);
    
    if (!modulePerm) {
      return true;
    }
    
    return modulePerm.canAdd !== false;
  };
  
  const canEdit = (moduleKey: string): boolean => {
    if (!user) return false;
    
    if (!user.roleId) {
      return user.role === "admin";
    }
    
    if (!roleData) {
      return user.role === "admin";
    }
    
    if (roleData.legacyRole === "admin") {
      return true;
    }
    
    const modulePerm = roleData.modulePermissions.find(p => p.moduleKey === moduleKey);
    
    if (!modulePerm) {
      return true;
    }
    
    return modulePerm.canEdit !== false;
  };
  
  const getFieldAccess = (moduleKey: string, fieldKey: string): FieldAccess => {
    if (!user) return "hidden";
    
    if (!user.roleId || !roleData) {
      return user.role === "admin" ? "editable" : "editable";
    }
    
    if (roleData.legacyRole === "admin") {
      return "editable";
    }
    
    const fieldPerm = roleData.fieldPermissions.find(
      p => p.moduleKey === moduleKey && p.fieldKey === fieldKey
    );
    
    if (!fieldPerm) {
      return "editable";
    }
    
    return fieldPerm.permission;
  };
  
  return (
    <PermissionsContext.Provider value={{ canAccessModule, canAdd, canEdit, getFieldAccess, isLoading, roleData: roleData ?? null }}>
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
