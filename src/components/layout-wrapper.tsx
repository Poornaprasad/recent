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
  const { isAuthenticated, token, clearAuth, setUser } = useAuthStore();
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthed, setIsAuthed] = useState(false);

  const isAuthPage = AUTH_PAGES.some((path) => pathname.startsWith(path));

  useEffect(() => {
    const validateAndCheckAuth = async () => {
      // Check authentication status
      const authenticated = isAuthenticated();

      if (!authenticated) {
        setIsAuthed(false);
        if (!isAuthPage) {
          // Redirect to login if not on auth page and not authenticated
          const returnUrl = encodeURIComponent(pathname);
          router.replace(`/login?redirect=${returnUrl}`);
          return;
        } else {
          setIsLoading(false);
          return;
        }
      }

      // If authenticated, validate user exists in database
      if (authenticated && token) {
        try {
          const response = await fetch('/api/auth/validate', {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          });

          if (!response.ok) {
            // User doesn't exist or is invalid - clear auth and redirect
            clearAuth();
            setIsAuthed(false);
            if (!isAuthPage) {
              const returnUrl = encodeURIComponent(pathname);
              router.replace(`/login?redirect=${returnUrl}`);
              return;
            }
            setIsLoading(false);
            return;
          }

          const data = await response.json();
          if (data.valid && data.user) {
            // User is valid - update user data in case it changed
            setUser(data.user);
            setIsAuthed(true);

            if (isAuthPage) {
              // Redirect to dashboard if already authenticated and on login page
              router.replace('/dashboard');
              return;
            }
          } else {
            // Invalid response - clear auth
            clearAuth();
            setIsAuthed(false);
            if (!isAuthPage) {
              const returnUrl = encodeURIComponent(pathname);
              router.replace(`/login?redirect=${returnUrl}`);
              return;
            }
          }
        } catch (error) {
          console.error('Error validating user:', error);
          // On error, clear auth to be safe
          clearAuth();
          setIsAuthed(false);
          if (!isAuthPage) {
            const returnUrl = encodeURIComponent(pathname);
            router.replace(`/login?redirect=${returnUrl}`);
            return;
          }
        }
      }

      setIsLoading(false);
    };

    validateAndCheckAuth();
  }, [pathname, isAuthenticated, isAuthPage, router, token, clearAuth, setUser]);

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
