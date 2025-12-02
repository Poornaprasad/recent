
'use server';

import React from "react";
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
import { Check, X, ShieldAlert, ScanSearch, UserCheck, UserCheck2, Headset } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const roles: { name: string; icon: LucideIcon }[] = [
    { name: 'Administrator', icon: ShieldAlert },
    { name: 'OCR Reviewer', icon: ScanSearch },
    { name: 'Invoice Approver L1', icon: UserCheck },
    { name: 'Invoice Approver L2', icon: UserCheck2 },
    { name: 'Support', icon: Headset },
];

const permissionsData = [
  {
    category: 'Invoices',
    permissions: [
      { name: 'View', access: [true, true, true, true, true] },
      { name: 'Edit', access: [true, false, false, false, false] },
      { name: 'Approve (<$5K)', access: [true, false, true, true, false] },
      { name: 'Approve (Any)', access: [true, false, false, true, false] },
      { name: 'Delete', access: [true, false, false, false, false] },
    ],
  },
  {
    category: 'OCR Fields',
    permissions: [
      { name: 'View', access: [true, true, false, false, false] },
      { name: 'Edit', access: [true, true, false, false, false] },
      { name: 'Validate', access: [true, true, false, false, false] },
      { name: 'Mark Verified', access: [true, true, false, false, false] },
    ],
  },
  {
    category: 'Users',
    permissions: [
      { name: 'View', access: [true, false, false, false, true] },
      { name: 'Create', access: [true, false, false, false, false] },
      { name: 'Edit', access: [true, false, false, false, false] },
      { name: 'Delete', access: [true, false, false, false, false] },
      { name: 'Impersonate', access: [true, false, false, false, false] },
    ],
  },
  {
    category: 'Reports',
    permissions: [
      { name: 'View All', access: [true, false, false, false, false] },
      { name: 'View OCR', access: [true, false, false, false, true] },
    ],
  },
];


export default async function RolesPermissionsPage() {
  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Roles &amp; Permissions</h2>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Permission Matrix</CardTitle>
          <CardDescription>
            Overview of all permissions across different roles.
          </CardDescription>
        </CardHeader>
        <CardContent>
           <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-1/4 font-bold text-lg">Permission</TableHead>
                  {roles.map((role) => (
                    <TableHead key={role.name} className="text-center">
                        <div className="flex items-center justify-center gap-2">
                            <role.icon className="h-4 w-4 text-muted-foreground" />
                            {role.name}
                        </div>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {permissionsData.map((categoryData) => (
                    <React.Fragment key={categoryData.category}>
                        <TableRow>
                            <TableCell colSpan={roles.length + 1} className="py-3 bg-muted/50">
                                <h4 className="font-semibold text-md text-foreground">{categoryData.category}</h4>
                            </TableCell>
                        </TableRow>
                        {categoryData.permissions.map((permission, pIndex) => (
                            <TableRow key={`${categoryData.category}-${pIndex}`}>
                                <TableCell>{permission.name}</TableCell>
                                {permission.access.map((hasAccess, rIndex) => (
                                    <TableCell key={`${categoryData.category}-${pIndex}-${rIndex}`} className="text-center">
                                        {hasAccess ? (
                                            <Check className="h-5 w-5 text-green-500 mx-auto" />
                                        ) : (
                                            <X className="h-5 w-5 text-red-500 mx-auto" />
                                        )}
                                    </TableCell>
                                ))}
                            </TableRow>
                        ))}
                    </React.Fragment>
                ))}
              </TableBody>
            </Table>
        </CardContent>
      </Card>
    </div>
  );
}
