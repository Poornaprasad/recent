

'use client';

import { usePathname } from "next/navigation";
import {
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarContent,
  SidebarMenuSub,
  SidebarMenuSubItem,
  sidebarMenuButtonVariants,
  SidebarFooter,
} from "@/components/ui/sidebar";
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
} from "lucide-react";
import Link from "next/link";
import * as Accordion from "@radix-ui/react-accordion";
import { cn } from "@/lib/utils";
import React, { useState, useEffect } from "react";
import { Button } from "./ui/button";


const mainLinks = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/", label: "Upload", icon: Upload },
];

const managementLinks = [
    { href: "/invoices", label: "All Invoices", icon: FileText },
    { href: "/approvals", label: "Approvals", icon: CheckSquare },
    { href: "/duplicates", label: "Duplicates", icon: Copy },
    { href: "/vendors", label: "Vendors", icon: Building },
    { href: "/1099-requests", label: "1099 Requests", icon: AlertTriangle },
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
      
      const newOpenState: string[] = [];
      if (isManagementSubMenuActive) {
        newOpenState.push('management-menu');
      }
      if (isUsersSubMenuActive) {
        newOpenState.push('users-menu');
      }
      setOpenAccordion(newOpenState);
  }, [pathname]);

  const isManagementActive = managementLinks.some(link => pathname.startsWith(link.href));
  const isUsersActive = usersLinks.some(link => pathname.startsWith(link.href));


  return (
    <>
      <SidebarHeader>
        {/* Can add a header here if needed */}
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          {mainLinks.map(({ href, label, icon: Icon }) => (
            <SidebarMenuItem key={href}>
              <Link href={href} className={cn(sidebarMenuButtonVariants({size: 'default'}), 'h-10 p-3 justify-start w-full')} data-active={pathname === href || (href === "/" && pathname.startsWith("/invoice/"))}>
                    <Icon className="mr-2 h-4 w-4" />
                    {label}
               </Link>
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
                <Link href="#" className={cn(sidebarMenuButtonVariants({size: 'default'}), 'h-10 p-3 justify-start w-full')}>
                    <LifeBuoy className="mr-2 h-4 w-4" />
                    Support
                </Link>
            </SidebarMenuItem>
            <SidebarMenuItem>
                <Link href="#" className={cn(sidebarMenuButtonVariants({size: 'default'}), 'h-10 p-3 justify-start w-full')}>
                    <Settings className="mr-2 h-4 w-4" />
                    Settings
                </Link>
            </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </>
  );
}
