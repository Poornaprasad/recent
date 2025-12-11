'use client';

import React, { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Check, X, Shield, UserCog, Briefcase, Calculator, MapPin, Building2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { getAllPermissionMappingsAction, updatePermissionAction } from "@/lib/actions/permission-matrix.actions";
import { Permission, UserRole } from "@/lib/core/auth/rbac.types";
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils/utils";

const roles: { name: string; value: string; icon: LucideIcon }[] = [
  { name: 'Admin', value: UserRole.ADMIN, icon: Shield },
  { name: 'Director', value: UserRole.DIRECTOR, icon: UserCog },
  { name: 'Manager', value: UserRole.MANAGER, icon: Briefcase },
  { name: 'Senior Accountant', value: UserRole.SENIOR_ACCOUNTANT, icon: Calculator },
  { name: 'NY Accountant', value: UserRole.NY_ACCOUNTANT, icon: MapPin },
  { name: 'CA Accountant', value: UserRole.CA_ACCOUNTANT, icon: Building2 },
];

const permissionCategories = [
  {
    category: 'Invoices',
    permissions: [
      { name: 'View Invoices', value: Permission.VIEW_INVOICES },
      { name: 'Edit Invoices', value: Permission.EDIT_INVOICES },
      { name: 'Delete Invoices', value: Permission.DELETE_INVOICES },
      { name: 'Approve Invoices', value: Permission.APPROVE_INVOICES },
    ],
  },
  {
    category: 'Users',
    permissions: [
      { name: 'View Users', value: Permission.VIEW_USERS },
      { name: 'Edit Users', value: Permission.EDIT_USERS },
      { name: 'Delete Users', value: Permission.DELETE_USERS },
    ],
  },
  {
    category: 'Settings',
    permissions: [
      { name: 'View Settings', value: Permission.VIEW_SETTINGS },
      { name: 'Edit Settings', value: Permission.EDIT_SETTINGS },
    ],
  },
  {
    category: 'Audit & Export',
    permissions: [
      { name: 'View Audit Logs', value: Permission.VIEW_AUDIT_LOGS },
      { name: 'Export Data', value: Permission.EXPORT_DATA },
    ],
  },
  {
    category: 'Dashboard',
    permissions: [
      { name: 'View Dashboard', value: Permission.VIEW_DASHBOARD },
      { name: 'View All Dashboards', value: Permission.VIEW_ALL_DASHBOARDS },
    ],
  },
];

// Mock current user - in production, get from auth context
// TODO: Replace with actual auth context
const CURRENT_USER_ROLE = UserRole.ADMIN; // This should come from auth
const CURRENT_USER_ID = 'current-user-id'; // This should come from auth

// Note: canEditPermissionMatrix is a server-only function, so we check here
// In production, this should come from auth context
const canEdit = CURRENT_USER_ROLE === UserRole.ADMIN || CURRENT_USER_ROLE === UserRole.DIRECTOR;

export default function RolesPermissionsPage() {
  const [permissions, setPermissions] = useState<Record<string, Record<string, boolean>>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadPermissions();
  }, []);

  const loadPermissions = async () => {
    setIsLoading(true);
    try {
      const result = await getAllPermissionMappingsAction();
      if (result.error) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: result.error,
        });
      } else if (result.data) {
        // Transform permissions into a nested object: permissions[role][permission] = isGranted
        const permissionsMap: Record<string, Record<string, boolean>> = {};
        
        roles.forEach(role => {
          permissionsMap[role.value] = {};
        });

        result.data.forEach(mapping => {
          if (!permissionsMap[mapping.role]) {
            permissionsMap[mapping.role] = {};
          }
          permissionsMap[mapping.role][mapping.permission] = mapping.isGranted;
        });

        setPermissions(permissionsMap);
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load permissions',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePermissionChange = async (role: string, permission: string, isGranted: boolean) => {
    if (!canEdit) {
      toast({
        variant: 'destructive',
        title: 'Access Denied',
        description: 'Only Admin and Director can edit permissions',
      });
      return;
    }

    // Optimistically update UI
    setPermissions(prev => ({
      ...prev,
      [role]: {
        ...prev[role],
        [permission]: isGranted,
      },
    }));

    setIsSaving(true);
    try {
      const result = await updatePermissionAction(
        { role, permission, isGranted },
        CURRENT_USER_ROLE,
        CURRENT_USER_ID
      );

      if (result.error) {
        // Revert on error
        loadPermissions();
        toast({
          variant: 'destructive',
          title: 'Error',
          description: result.error,
        });
      } else {
        toast({
          title: 'Permission Updated',
          description: `Permission ${isGranted ? 'granted' : 'revoked'} successfully`,
        });
      }
    } catch (error) {
      // Revert on error
      loadPermissions();
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to update permission',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const getPermissionValue = (role: string, permission: string): boolean => {
    return permissions[role]?.[permission] ?? false;
  };

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Roles &amp; Permissions</h2>
          <p className="text-muted-foreground">
            {canEdit 
              ? 'Manage role permissions. Changes take effect immediately.'
              : 'View role permissions. Only Admin and Director can edit.'}
          </p>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Permission Matrix</CardTitle>
          <CardDescription>
            {canEdit 
              ? 'Click checkboxes to grant or revoke permissions for each role.'
              : 'Overview of all permissions across different roles.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <p className="text-muted-foreground">Loading permissions...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-1/4 font-bold text-lg">Permission</TableHead>
                    {roles.map((role) => (
                      <TableHead key={role.value} className="text-center min-w-[150px]">
                        <div className="flex items-center justify-center gap-2">
                          <role.icon className="h-4 w-4 text-muted-foreground" />
                          {role.name}
                        </div>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {permissionCategories.map((categoryData) => (
                    <React.Fragment key={categoryData.category}>
                      <TableRow>
                        <TableCell colSpan={roles.length + 1} className="py-3 bg-muted/50">
                          <h4 className="font-semibold text-md text-foreground">{categoryData.category}</h4>
                        </TableCell>
                      </TableRow>
                      {categoryData.permissions.map((permission) => (
                        <TableRow key={permission.value}>
                          <TableCell className="font-medium">{permission.name}</TableCell>
                          {roles.map((role) => {
                            const isGranted = getPermissionValue(role.value, permission.value);
                            return (
                              <TableCell key={`${role.value}-${permission.value}`} className="text-center">
                                {canEdit ? (
                                  <div className="flex items-center justify-center">
                                    <Checkbox
                                      checked={isGranted}
                                      onCheckedChange={(checked) =>
                                        handlePermissionChange(role.value, permission.value, checked === true)
                                      }
                                      disabled={isSaving}
                                    />
                                  </div>
                                ) : (
                                  <div className="flex items-center justify-center">
                                    {isGranted ? (
                                      <Check className="h-5 w-5 text-green-500" />
                                    ) : (
                                      <X className="h-5 w-5 text-red-500" />
                                    )}
                                  </div>
                                )}
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      ))}
                    </React.Fragment>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
