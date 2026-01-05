"use client";

import { SidebarTrigger } from "@/components/ui/sidebar";
import { UserNav } from "@/components/user-nav";
import { ThemeToggle } from "./theme-toggle";
import { SyncProgressIndicator } from "./document-sync/sync-progress-indicator";

export function Header() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/50 bg-background/95 backdrop-blur-xl supports-[backdrop-filter]:bg-background/80 transition-all shadow-sm">
      <div className="w-full flex h-16 items-center relative">
        <div className="flex-shrink-0 px-6">
          <SidebarTrigger className="h-9 w-9 transition-all hover:bg-accent hover:scale-105 active:scale-95" />
        </div>
        <div className="flex-1" />
        <div className="absolute right-6 top-1/2 -translate-y-1/2 flex items-center gap-2">
          <SyncProgressIndicator />
          <div className="flex-shrink-0">
            <ThemeToggle />
          </div>
          <div className="flex-shrink-0">
            <UserNav />
          </div>
        </div>
      </div>
    </header>
  );
}
