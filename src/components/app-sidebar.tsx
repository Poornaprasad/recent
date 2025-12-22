

'use client';

import { usePathname } from "next/navigation";
import {
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarContent,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuButton,
  SidebarFooter,
  sidebarMenuButtonVariants,
} from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  Upload,
  CheckSquare,
  Users,
  ShieldCheck,
  Activity,
  History,
  Copy,
  LayoutDashboard,
  Building,
  ChevronRight,
  Settings,
  LifeBuoy,
  FileText,
  AlertTriangle,
  Workflow,
  TrendingUp,
  FileCheck,
} from "lucide-react";
import { APP_NAME } from "@/lib/constants";
import Link from "next/link";
import * as Accordion from "@radix-ui/react-accordion";
import { cn } from '@/lib/utils/utils';
import React, { useState, useEffect } from "react";
import { Button } from "./ui/button";


const mainLinks = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/", label: "Upload", icon: Upload },
];

const managementLinks = [
    { href: "/invoices", label: "All Processed Invoices", icon: FileText },
    { href: "/approved-invoices", label: "Approved Invoices", icon: FileCheck },
    { href: "/approvals", label: "Review Pending Invoices", icon: CheckSquare },
    { href: "/escalations", label: "Escalations", icon: TrendingUp },
    { href: "/duplicates", label: "Duplicates", icon: Copy },
];

const vendorLinks = [
    { href: "/vendors", label: "Vendors", icon: Building },
    { href: "/w9-requests", label: "W9 Requests", icon: AlertTriangle },
];

const usersLinks = [
    { href: "/users", label: "All Users", icon: Users },
    { href: "/roles-permissions", label: "Roles & Permissions", icon: ShieldCheck },
    { href: "/user-activity", label: "User Activity", icon: Activity },
    { href: "/audit-logs", label: "Audit Logs", icon: History },
];

export function AppSidebar() {
  const pathname = usePathname();
  const [openAccordion, setOpenAccordion] = useState<string[]>([]);

  useEffect(() => {
      const isManagementSubMenuActive = managementLinks.some(link => pathname.startsWith(link.href));
      const isUsersSubMenuActive = usersLinks.some(link => pathname.startsWith(link.href));
      const isVendorSubMenuActive = pathname.startsWith('/vendors') || pathname.startsWith('/w9-requests');
      
      const newOpenState: string[] = [];
      if (isManagementSubMenuActive) {
        newOpenState.push('management-menu');
      }
      if (isUsersSubMenuActive) {
        newOpenState.push('users-menu');
      }
      if (isVendorSubMenuActive) {
        newOpenState.push('vendor-menu');
      }
      setOpenAccordion(newOpenState);
  }, [pathname]);

  const isManagementActive = managementLinks.some(link => pathname.startsWith(link.href));
  const isUsersActive = usersLinks.some(link => pathname.startsWith(link.href));
  const isVendorActive = pathname.startsWith('/vendors') || pathname.startsWith('/w9-requests');


  return (
    <TooltipProvider>
      <SidebarHeader className="border-b border-sidebar-border/50 pb-4 mb-3 px-3">
        <div className="flex items-center gap-3 px-3 py-3 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-2 transition-all hover:from-primary/15 hover:to-primary/10">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/20 text-primary shadow-sm group-data-[collapsible=icon]:mx-auto transition-transform group-hover:scale-105">
            <Workflow className="h-5 w-5" />
          </div>
          <div className="flex flex-col group-data-[collapsible=icon]:hidden min-w-0">
            <span className="font-bold text-sm leading-tight truncate">{APP_NAME}</span>
            <span className="text-xs text-muted-foreground mt-0.5 truncate">Invoice Management</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          {mainLinks.map(({ href, label, icon: Icon }) => (
            <SidebarMenuItem key={href}>
              <SidebarMenuButton
                asChild
                tooltip={label}
                isActive={pathname === href || (href === "/" && pathname.startsWith("/invoice/"))}
              >
                <Link href={href}>
                  <Icon />
                  <span>{label}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
           <Accordion.Root type="multiple" className="w-full" value={openAccordion} onValueChange={setOpenAccordion}>
                <Accordion.Item value="management-menu" className="border-none">
                     <Accordion.Trigger className={cn(sidebarMenuButtonVariants({size: 'default'}), 'h-10 p-3 justify-between w-full group')} data-active={isManagementActive}>
                        <div className="flex items-center">
                            <Copy className="mr-2 h-4 w-4" />
                            <span>Invoice Management</span>
                        </div>
                        <ChevronRight className="h-4 w-4 shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-90" />
                     </Accordion.Trigger>
                     <Accordion.Content>
                        <SidebarMenuSub>
                            {managementLinks.map(({ href, label, icon: Icon }) => (
                                <SidebarMenuSubItem key={href}>
                                     <Link href={href} className={cn(sidebarMenuButtonVariants({size: 'sm'}), 'h-auto p-2 justify-start w-full')} data-active={pathname.startsWith(href)}>
                                        <Icon className="mr-2 h-4 w-4" />
                                        {label}
                                    </Link>
                                </SidebarMenuSubItem>
                            ))}
                        </SidebarMenuSub>
                     </Accordion.Content>
                </Accordion.Item>
                <Accordion.Item value="vendor-menu" className="border-none">
                     <Accordion.Trigger className={cn(sidebarMenuButtonVariants({size: 'default'}), 'h-10 p-3 justify-between w-full group')} data-active={isVendorActive}>
                        <div className="flex items-center">
                            <Building className="mr-2 h-4 w-4" />
                            <span>Vendors</span>
                        </div>
                        <ChevronRight className="h-4 w-4 shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-90" />
                     </Accordion.Trigger>
                     <Accordion.Content>
                        <SidebarMenuSub>
                             {vendorLinks.map(({ href, label, icon: Icon }) => {
                                // Each link should only be active when on its own page
                                const isActive = pathname === href || pathname.startsWith(href + '/');
                                return (
                                  <SidebarMenuSubItem key={href}>
                                       <Link href={href} className={cn(sidebarMenuButtonVariants({size: 'sm'}), 'h-auto p-2 justify-start w-full')} data-active={isActive}>
                                          <Icon className="mr-2 h-4 w-4" />
                                          {label}
                                      </Link>
                                  </SidebarMenuSubItem>
                                );
                             })}
                        </SidebarMenuSub>
                     </Accordion.Content>
                </Accordion.Item>
                 <Accordion.Item value="users-menu" className="border-none">
                     <Accordion.Trigger className={cn(sidebarMenuButtonVariants({size: 'default'}), 'h-10 p-3 justify-between w-full group')} data-active={isUsersActive}>
                        <div className="flex items-center">
                            <Users className="mr-2 h-4 w-4" />
                            <span>Users</span>
                        </div>
                        <ChevronRight className="h-4 w-4 shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-90" />
                     </Accordion.Trigger>
                     <Accordion.Content>
                        <SidebarMenuSub>
                             {usersLinks.map(({ href, label, icon: Icon }) => (
                                <SidebarMenuSubItem key={href}>
                                     <Link href={href} className={cn(sidebarMenuButtonVariants({size: 'sm'}), 'h-auto p-2 justify-start w-full')} data-active={pathname.startsWith(href)}>
                                        <Icon className="mr-2 h-4 w-4" />
                                        {label}
                                    </Link>
                                </SidebarMenuSubItem>
                            ))}
                        </SidebarMenuSub>
                     </Accordion.Content>
                </Accordion.Item>
            </Accordion.Root>
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter className="mt-auto">
        <SidebarMenu>
            <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="Support">
                    <Link href="#">
                        <LifeBuoy />
                        <span>Support</span>
                    </Link>
                </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="Settings" isActive={pathname === '/settings'}>
                    <Link href="/settings">
                        <Settings />
                        <span>Settings</span>
                    </Link>
                </SidebarMenuButton>
            </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </TooltipProvider>
  );
}
