'use client';

import React, { useState, useEffect, useMemo } from "react";
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
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Check, 
  X, 
  Shield, 
  UserCog, 
  Briefcase, 
  Calculator, 
  MapPin, 
  Building2,
  Search,
  Filter,
  RefreshCw,
  Info,
  Lock,
  Unlock,
  AlertCircle
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { getAllPermissionMappingsAction, updatePermissionAction } from "@/lib/actions/permission-matrix.actions";
import { Permission, UserRole } from "@/lib/core/auth/rbac.types";
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuthStore } from "@/hooks/use-auth-store";
import { getUserAccessibleStates, getUserPrimaryState, getUserSecondaryState } from "@/hooks/use-state-filter";

const roles: { name: string; value: string; icon: LucideIcon; color: string; description: string }[] = [
  { 
    name: 'Admin', 
    value: UserRole.ADMIN, 
    icon: Shield, 
    color: 'text-red-600 dark:text-red-400',
    description: 'Full system access with all permissions'
  },
  { 
    name: 'Director', 
    value: UserRole.DIRECTOR, 
    icon: UserCog, 
    color: 'text-blue-600 dark:text-blue-400',
    description: 'Management access with most permissions'
  },
  { 
    name: 'Manager', 
    value: UserRole.MANAGER, 
    icon: Briefcase, 
    color: 'text-purple-600 dark:text-purple-400',
    description: 'Team management with approval permissions'
  },
  { 
    name: 'Senior Accountant', 
    value: UserRole.SENIOR_ACCOUNTANT, 
    icon: Calculator, 
    color: 'text-green-600 dark:text-green-400',
    description: 'Senior accounting operations access'
  },
  { 
    name: 'NY Accountant', 
    value: UserRole.NY_ACCOUNTANT, 
    icon: MapPin, 
    color: 'text-orange-600 dark:text-orange-400',
    description: 'New York state accounting access'
  },
  { 
    name: 'CA Accountant', 
    value: UserRole.CA_ACCOUNTANT, 
    icon: Building2, 
    color: 'text-cyan-600 dark:text-cyan-400',
    description: 'California state accounting access'
  },
];

const permissionCategories = [
  {
    category: 'Invoices',
    icon: '📄',
    permissions: [
      { name: 'View Invoices', value: Permission.VIEW_INVOICES, description: 'View and browse invoice list and details' },
      { name: 'Edit Invoices', value: Permission.EDIT_INVOICES, description: 'Edit invoice fields and extracted data' },
      { name: 'Delete Invoices', value: Permission.DELETE_INVOICES, description: 'Delete invoices from the system' },
      { name: 'Approve Invoices', value: Permission.APPROVE_INVOICES, description: 'Approve invoices for payment processing' },
    ],
  },
  {
    category: 'Users',
    icon: '👥',
    permissions: [
      { name: 'View Users', value: Permission.VIEW_USERS, description: 'View user list and user details' },
      { name: 'Edit Users', value: Permission.EDIT_USERS, description: 'Create, edit, and update user accounts' },
      { name: 'Delete Users', value: Permission.DELETE_USERS, description: 'Delete user accounts from the system' },
    ],
  },
  {
    category: 'Settings',
    icon: '⚙️',
    permissions: [
      { name: 'View Settings', value: Permission.VIEW_SETTINGS, description: 'View system settings and configuration' },
      { name: 'Edit Settings', value: Permission.EDIT_SETTINGS, description: 'Modify system settings and configuration' },
    ],
  },
  {
    category: 'Audit & Export',
    icon: '📊',
    permissions: [
      { name: 'View Audit Logs', value: Permission.VIEW_AUDIT_LOGS, description: 'View system audit logs and activity history' },
      { name: 'Export Data', value: Permission.EXPORT_DATA, description: 'Export data to external formats (CSV, Excel, etc.)' },
    ],
  },
  {
    category: 'Dashboard',
    icon: '📈',
    permissions: [
      { name: 'View Dashboard', value: Permission.VIEW_DASHBOARD, description: 'View dashboard with statistics and metrics' },
      { name: 'View All Dashboards', value: Permission.VIEW_ALL_DASHBOARDS, description: 'View dashboards for all states and cases' },
    ],
  },
  {
    category: 'Vendors & W9 Management',
    icon: '🏢',
    permissions: [
      { name: 'View Vendors', value: Permission.VIEW_VENDORS, description: 'View vendor list and vendor information' },
      { name: 'Edit Vendors', value: Permission.EDIT_VENDORS, description: 'Create, edit, and update vendor records' },
      { name: 'Manage W9 Status', value: Permission.MANAGE_W9_STATUS, description: 'Update W9 form status for vendors (Required, Received, Pending, Expired, Not Required)' },
    ],
  },
];

export default function RolesPermissionsPage() {
  const { user } = useAuthStore();
  const [permissions, setPermissions] = useState<Record<string, Record<string, boolean>>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const { toast } = useToast();

  // Get current user role - default to admin if not available
  const currentUserRole = user?.role || UserRole.ADMIN;
  const currentUserId = user?.id || 'current-user-id';
  const canEdit = currentUserRole === UserRole.ADMIN || currentUserRole === UserRole.DIRECTOR;

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
        currentUserRole,
        currentUserId
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

  // Calculate statistics
  const stats = useMemo(() => {
    const roleStats = roles.map(role => {
      const rolePermissions = permissions[role.value] || {};
      const totalPermissions = Object.keys(rolePermissions).length;
      const grantedPermissions = Object.values(rolePermissions).filter(Boolean).length;
      const percentage = totalPermissions > 0 ? Math.round((grantedPermissions / totalPermissions) * 100) : 0;
      
      return {
        role: role.name,
        roleValue: role.value,
        total: totalPermissions,
        granted: grantedPermissions,
        percentage,
      };
    });

    const allPermissions = permissionCategories.flatMap(cat => cat.permissions);
    const totalUniquePermissions = allPermissions.length;

    return {
      roleStats,
      totalUniquePermissions,
    };
  }, [permissions]);

  // Filter permissions based on search and category
  const filteredCategories = useMemo(() => {
    return permissionCategories.filter(category => {
      // Category filter
      if (selectedCategory !== 'all' && category.category !== selectedCategory) {
        return false;
      }

      // Search filter
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const matchesCategory = category.category.toLowerCase().includes(searchLower);
        const matchesPermissions = category.permissions.some(
          perm => perm.name.toLowerCase().includes(searchLower) ||
                   perm.description.toLowerCase().includes(searchLower)
        );
        return matchesCategory || matchesPermissions;
      }

      return true;
    });
  }, [searchTerm, selectedCategory]);

  // Get state access for each role
  const getRoleStateAccess = (roleValue: string) => {
    // Create a mock user object for the role to get state access
    const mockUser: any = {
      role: roleValue,
      assignedStates: null, // Default - no additional states assigned
    };

    const accessibleStates = getUserAccessibleStates(mockUser);
    const primaryState = getUserPrimaryState(mockUser);
    const secondaryState = getUserSecondaryState(mockUser);
    const isAllStates = accessibleStates.length === 2 && 
                       accessibleStates.includes('CA') && 
                       accessibleStates.includes('NY');
    
    // Check if role has root-level access (admin, director, manager, senior_accountant)
    const hasRootAccess = ['admin', 'director', 'manager', 'senior_accountant'].includes(roleValue);

    return {
      accessibleStates,
      primaryState,
      secondaryState,
      hasMultipleStates: accessibleStates.length > 1,
      isAllStates,
      hasRootAccess,
    };
  };

  return (
    <TooltipProvider>
      <div className="flex-1 space-y-6 p-4 md:p-8 pt-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Roles & Permissions</h2>
            <p className="text-muted-foreground mt-1">
              {canEdit 
                ? 'Manage role permissions. Changes take effect immediately.'
                : 'View role permissions. Only Admin and Director can edit.'}
            </p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={loadPermissions} 
              disabled={isLoading}
            >
              <RefreshCw className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Access Alert */}
        {!canEdit && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              You have view-only access. Contact an Administrator or Director to modify permissions.
            </AlertDescription>
          </Alert>
        )}

        {/* Role Summary Cards */}
        {!isLoading && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {stats.roleStats.map((stat) => {
              const roleInfo = roles.find(r => r.value === stat.roleValue);
              const RoleIcon = roleInfo?.icon || Shield;
              const stateAccess = getRoleStateAccess(stat.roleValue);
              return (
                <Card key={stat.roleValue} className="relative overflow-hidden">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={cn("p-2 rounded-lg bg-muted", roleInfo?.color)}>
                          <RoleIcon className="h-5 w-5" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">{stat.role}</CardTitle>
                          <CardDescription className="text-xs mt-0.5">
                            {stat.granted} of {stat.total} permissions
                          </CardDescription>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Access Level</span>
                          <Badge variant={stat.percentage === 100 ? "success" : stat.percentage >= 50 ? "secondary" : "outline"}>
                            {stat.percentage}%
                          </Badge>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2">
                          <div
                            className={cn(
                              "h-2 rounded-full transition-all",
                              stat.percentage === 100 && "bg-green-500",
                              stat.percentage >= 50 && stat.percentage < 100 && "bg-blue-500",
                              stat.percentage < 50 && "bg-orange-500"
                            )}
                            style={{ width: `${stat.percentage}%` }}
                          />
                        </div>
                      </div>
                      {/* State Access */}
                      <div className="pt-2 border-t">
                        <div className="flex items-center justify-between text-sm mb-1.5">
                          <span className="text-muted-foreground">State Access</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {stateAccess.accessibleStates.length > 0 ? (
                            stateAccess.accessibleStates.map((state, index) => {
                              // Only show primary/secondary labels for accountant roles (senior_accountant and below)
                              const isAccountantRole = ['senior_accountant', 'ny_accountant', 'ca_accountant'].includes(stat.roleValue);
                              return (
                                <Badge 
                                  key={state}
                                  variant={index === 0 ? "default" : "secondary"}
                                  className="text-xs"
                                >
                                  {state}
                                  {isAccountantRole && index === 0 && stateAccess.hasMultipleStates && (
                                    <span className="ml-1 text-[10px] opacity-75">(Primary)</span>
                                  )}
                                  {isAccountantRole && index === 1 && (
                                    <span className="ml-1 text-[10px] opacity-75">(Secondary)</span>
                                  )}
                                </Badge>
                              );
                            })
                          ) : (
                            <span className="text-xs text-muted-foreground">No state access</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Filters */}
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
            <div className="flex flex-col md:flex-row gap-4 mb-6">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search permissions..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              {/* Category Filter */}
              <div className="flex gap-2 flex-wrap">
                <Button
                  variant={selectedCategory === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedCategory('all')}
                >
                  All Categories
                </Button>
                {permissionCategories.map((category) => (
                  <Button
                    key={category.category}
                    variant={selectedCategory === category.category ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedCategory(category.category)}
                  >
                    {category.icon} {category.category}
                  </Button>
                ))}
              </div>
            </div>

            {isLoading ? (
              <div className="flex flex-col items-center justify-center h-64 space-y-4">
                <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                <p className="text-muted-foreground">Loading permissions...</p>
              </div>
            ) : filteredCategories.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 space-y-4">
                <Filter className="h-12 w-12 text-muted-foreground opacity-50" />
                <div className="text-center">
                  <p className="font-medium">No permissions found</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Try adjusting your search or filter criteria
                  </p>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="w-1/3 font-bold text-base sticky left-0 bg-muted/50 z-10">
                        <div className="flex items-center gap-2">
                          <span>Permission</span>
                          <Tooltip>
                            <TooltipTrigger>
                              <Info className="h-4 w-4 text-muted-foreground" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Hover over permissions for detailed descriptions</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      </TableHead>
                      {roles.map((role) => (
                        <TableHead key={role.value} className="text-center min-w-[140px]">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex flex-col items-center gap-2 cursor-help">
                                <div className={cn("p-2 rounded-lg bg-muted", role.color)}>
                                  <role.icon className="h-4 w-4" />
                                </div>
                                <span className="font-semibold text-sm">{role.name}</span>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <p className="font-semibold mb-1">{role.name}</p>
                              <p className="text-xs">{role.description}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCategories.map((categoryData) => (
                      <React.Fragment key={categoryData.category}>
                        <TableRow className="bg-muted/30 hover:bg-muted/40">
                          <TableCell colSpan={roles.length + 1} className="py-3 sticky left-0 bg-muted/30 z-10">
                            <div className="flex items-center gap-2">
                              <span className="text-lg">{categoryData.icon}</span>
                              <h4 className="font-semibold text-base">{categoryData.category}</h4>
                            </div>
                          </TableCell>
                        </TableRow>
                        {categoryData.permissions.map((permission) => (
                          <TableRow 
                            key={permission.value}
                            className="hover:bg-muted/30 transition-colors"
                          >
                            <TableCell className="font-medium sticky left-0 bg-background z-10 border-r">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="cursor-help">
                                    <div className="flex items-center gap-2">
                                      <span className="font-semibold">{permission.name}</span>
                                      <Info className="h-3.5 w-3.5 text-muted-foreground" />
                                    </div>
                                    {permission.description && (
                                      <div className="text-xs text-muted-foreground mt-1.5 line-clamp-2">
                                        {permission.description}
                                      </div>
                                    )}
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-sm">
                                  <p className="font-semibold mb-1">{permission.name}</p>
                                  <p className="text-sm">{permission.description}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TableCell>
                            {roles.map((role) => {
                              const isGranted = getPermissionValue(role.value, permission.value);
                              return (
                                <TableCell 
                                  key={`${role.value}-${permission.value}`} 
                                  className="text-center"
                                >
                                  {canEdit ? (
                                    <div className="flex items-center justify-center">
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <div className="relative">
                                            <Checkbox
                                              checked={isGranted}
                                              onCheckedChange={(checked) =>
                                                handlePermissionChange(role.value, permission.value, checked === true)
                                              }
                                              disabled={isSaving}
                                              className={cn(
                                                "h-5 w-5 transition-all",
                                                isGranted && "border-green-500 data-[state=checked]:bg-green-500",
                                                !isGranted && "border-gray-300"
                                              )}
                                            />
                                            {isSaving && (
                                              <div className="absolute inset-0 flex items-center justify-center bg-background/50 rounded">
                                                <RefreshCw className="h-3 w-3 animate-spin" />
                                              </div>
                                            )}
                                          </div>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <p>{isGranted ? 'Click to revoke' : 'Click to grant'} permission</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    </div>
                                  ) : (
                                    <div className="flex items-center justify-center">
                                      {isGranted ? (
                                        <Badge variant="success" className="gap-1">
                                          <Check className="h-3 w-3" />
                                          Granted
                                        </Badge>
                                      ) : (
                                        <Badge variant="outline" className="gap-1 text-muted-foreground">
                                          <X className="h-3 w-3" />
                                          Denied
                                        </Badge>
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

        {/* State Access Matrix */}
        <Card>
          <CardHeader>
            <CardTitle>State Access Matrix</CardTitle>
            <CardDescription>
              Overview of state access for each role. Primary and secondary states are shown for accountant roles.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex flex-col items-center justify-center h-32 space-y-4">
                <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                <p className="text-muted-foreground">Loading state access...</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="w-1/4 font-bold text-base">Role</TableHead>
                      <TableHead className="text-center">Primary State</TableHead>
                      <TableHead className="text-center">Secondary State</TableHead>
                      <TableHead className="text-center">All States</TableHead>
                      <TableHead className="text-center">Description</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {roles.map((role) => {
                      const stateAccess = getRoleStateAccess(role.value);
                      const RoleIcon = role.icon;
                      // Only show primary/secondary labels for accountant roles (senior_accountant and below)
                      const isAccountantRole = ['senior_accountant', 'ny_accountant', 'ca_accountant'].includes(role.value);
                      
                      return (
                        <TableRow key={role.value} className="hover:bg-muted/30 transition-colors">
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-3">
                              <div className={cn("p-2 rounded-lg bg-muted", role.color)}>
                                <RoleIcon className="h-4 w-4" />
                              </div>
                              <span className="font-semibold">{role.name}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            {stateAccess.primaryState ? (
                              <Badge variant="default" className="gap-1">
                                {stateAccess.primaryState}
                                {isAccountantRole && (
                                  <span className="text-[10px] opacity-75">Primary</span>
                                )}
                              </Badge>
                            ) : stateAccess.hasRootAccess ? (
                              <Badge variant="outline" className="text-muted-foreground">
                                All (Root)
                              </Badge>
                            ) : stateAccess.isAllStates ? (
                              <Badge variant="outline" className="text-muted-foreground">
                                N/A
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-sm">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {stateAccess.secondaryState ? (
                              <Badge variant="secondary" className="gap-1">
                                {stateAccess.secondaryState}
                                {isAccountantRole && (
                                  <span className="text-[10px] opacity-75">Secondary</span>
                                )}
                              </Badge>
                            ) : stateAccess.hasRootAccess ? (
                              <Badge variant="outline" className="text-muted-foreground">
                                All (Root)
                              </Badge>
                            ) : stateAccess.isAllStates ? (
                              <Badge variant="outline" className="text-muted-foreground">
                                N/A
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-sm">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {stateAccess.isAllStates ? (
                              <Badge variant="success" className="gap-1">
                                <Check className="h-3 w-3" />
                                All States
                                {stateAccess.hasRootAccess && (
                                  <span className="ml-1 text-[10px] opacity-75">(Root)</span>
                                )}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="gap-1">
                                <X className="h-3 w-3" />
                                Limited
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground max-w-md">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="cursor-help">
                                  {role.value === 'ny_accountant' ? (
                                    <p>NY Accountant has access to NY by default. CA can be added as secondary state if granted.</p>
                                  ) : role.value === 'ca_accountant' ? (
                                    <p>CA Accountant has access to CA by default. NY can be added as secondary state if granted.</p>
                                  ) : stateAccess.hasRootAccess ? (
                                    <p>Has complete access to all states (CA and NY) granted at root level. This is a default system permission.</p>
                                  ) : stateAccess.isAllStates ? (
                                    <p>Has access to all states (CA and NY).</p>
                                  ) : (
                                    <p>{role.description}</p>
                                  )}
                                </div>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-sm">
                                <p className="font-semibold mb-1">{role.name}</p>
                                <p className="text-sm">{role.description}</p>
                                {stateAccess.hasRootAccess && (
                                  <p className="text-xs mt-2 text-blue-600 dark:text-blue-400 font-semibold">
                                    ✓ Root-level access: All states (CA, NY)
                                  </p>
                                )}
                                {stateAccess.hasMultipleStates && !stateAccess.hasRootAccess && (
                                  <p className="text-xs mt-2 text-muted-foreground">
                                    States: {stateAccess.accessibleStates.join(', ')}
                                  </p>
                                )}
                              </TooltipContent>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
}
