import { createContext, useContext, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "./auth-context";
import { CRM_MODULES } from "@shared/permissions-config";

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
    
    if (user.role === "admin") return true;
    
    if (!user.roleId || !roleData) {
      const moduleDef = CRM_MODULES.find(m => m.key === moduleKey);
      const result = moduleDef?.defaultAccess !== "hidden";
      if (moduleKey === "nexusPulse") console.log("[PERM_DEBUG] nexusPulse: no roleId/roleData, defaultAccess:", moduleDef?.defaultAccess, "result:", result, "roleId:", user.roleId, "roleData:", !!roleData);
      return result;
    }
    
    if (roleData.legacyRole === "admin") {
      return true;
    }
    
    const modulePerm = roleData.modulePermissions.find(p => p.moduleKey === moduleKey);
    
    if (!modulePerm) {
      const moduleDef = CRM_MODULES.find(m => m.key === moduleKey);
      if (moduleKey === "nexusPulse") console.log("[PERM_DEBUG] nexusPulse: no modulePerm found, defaultAccess:", moduleDef?.defaultAccess);
      return moduleDef?.defaultAccess !== "hidden";
    }
    
    if (moduleKey === "nexusPulse") console.log("[PERM_DEBUG] nexusPulse: modulePerm.access:", modulePerm.access);
    return modulePerm.access === "visible";
  };
  
  const canAdd = (moduleKey: string): boolean => {
    if (!user) return false;
    if (user.role === "admin") return true;
    
    if (!user.roleId || !roleData) {
      return true;
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
    if (user.role === "admin") return true;
    
    if (!user.roleId || !roleData) {
      return true;
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
