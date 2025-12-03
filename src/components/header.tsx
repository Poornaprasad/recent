"use client";

import Link from "next/link";
import { Sidebar as SidebarIcon } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { UserNav } from "@/components/user-nav";
import { ThemeToggle } from "./theme-toggle";

export function Header() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 max-w-screen-2xl items-center">
        <div className="mr-4 hidden md:flex items-center">
          <Link href="/" className="mr-6 flex items-center space-x-2">
            <SidebarIcon className="h-6 w-6 text-primary" />
            <span className="font-bold sm:inline-block">Invoice AP</span>
          </Link>
        </div>
        <SidebarTrigger className="md:hidden mr-2" />
        <div className="ml-auto flex items-center gap-2">
           <ThemeToggle />
          <UserNav />
        </div>
      </div>
    </header>
  );
}
