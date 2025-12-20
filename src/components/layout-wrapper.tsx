"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  SidebarProvider,
  Sidebar,
  SidebarInset,
} from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Header } from "@/components/header";
import { useAuthStore } from "@/hooks/use-auth-store";

const AUTH_PAGES = ["/login"];

export function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthed, setIsAuthed] = useState(false);

  const isAuthPage = AUTH_PAGES.some((path) => pathname.startsWith(path));

  useEffect(() => {
    // Check authentication status
    const authenticated = isAuthenticated();
    setIsAuthed(authenticated);

    if (!isAuthPage && !authenticated) {
      // Redirect to login if not on auth page and not authenticated
      const returnUrl = encodeURIComponent(pathname);
      router.replace(`/login?redirect=${returnUrl}`);
    } else if (isAuthPage && authenticated) {
      // Redirect to dashboard if already authenticated and on login page
      router.replace('/dashboard');
    } else {
      setIsLoading(false);
    }
  }, [pathname, isAuthenticated, isAuthPage, router]);

  // Show loading spinner while checking auth
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Render auth pages without sidebar
  if (isAuthPage) {
    return <>{children}</>;
  }

  // Render protected pages with sidebar (only if authenticated)
  if (!isAuthed) {
    return null; // Will redirect via useEffect
  }

  return (
    <SidebarProvider defaultOpen={true}>
      <Sidebar collapsible="offcanvas" className="border-r border-sidebar-border/50">
        <AppSidebar />
      </Sidebar>
      <SidebarInset>
        <div className="relative flex min-h-screen flex-col">
          <Header />
          <main className="flex-1">{children}</main>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
