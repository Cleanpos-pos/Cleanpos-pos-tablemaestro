
"use client";

import AdminSidebar from "@/components/admin/AdminSidebar";
import { SidebarProvider, SidebarInset, useSidebar } from "@/components/ui/sidebar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { PanelLeft, Loader2 } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/config/firebase";

function AdminLayoutContent({ children }: { children: React.ReactNode }) {
  const { isMobile, toggleSidebar, openMobile } = useSidebar(); // Removed 'openMobile' as it's not directly used here for rendering decision
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loadingAuthState, setLoadingAuthState] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoadingAuthState(false);
      if (!currentUser && pathname !== "/admin/login") {
        console.log("[AdminLayout] No user, redirecting to /admin/login from:", pathname);
        router.replace("/admin/login");
      } else if (currentUser && pathname === "/admin/login") {
        console.log("[AdminLayout] User authenticated, redirecting from /admin/login to /admin/dashboard");
        router.replace("/admin/dashboard");
      }
    });
    return () => unsubscribe();
  }, [pathname, router]);

  const showMobileTrigger = isMobile && pathname !== "/admin/login";

  if (loadingAuthState) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="ml-3 text-lg font-body text-foreground">Authenticating...</p>
      </div>
    );
  }

  // If not authenticated and not on login page, this component might briefly render before redirect.
  // Or, if redirect fails for some reason, it prevents showing admin content.
  if (!user && pathname !== "/admin/login") {
    // Typically, the redirect in useEffect handles this.
    // You could show a "Redirecting..." message or null.
    return (
       <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="ml-3 text-lg font-body text-foreground">Redirecting to login...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      {showMobileTrigger && (
        <Button
          variant="ghost"
          size="icon"
          className="fixed top-4 left-4 z-50 md:hidden bg-background/80 backdrop-blur-sm"
          onClick={toggleSidebar}
          aria-label="Toggle sidebar"
        >
          <PanelLeft className="h-5 w-5" />
        </Button>
      )}
      <AdminSidebar />
      <SidebarInset className="flex flex-col flex-1 overflow-hidden">
        <ScrollArea className="flex-grow">
          <main 
            className={`container mx-auto px-4 py-8 sm:px-6 lg:px-8 ${showMobileTrigger ? 'pt-16 md:pt-8' : 'pt-8'}`}
          >
            {children}
          </main>
        </ScrollArea>
      </SidebarInset>
    </div>
  );
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  if (pathname === "/admin/login") {
    // For login page, render children directly without sidebar context or auth checks here
    // The auth check for redirecting *from* login if already authenticated is inside AdminLayoutContent
    return <>{children}</>;
  }

  // All other admin pages are wrapped by SidebarProvider and AdminLayoutContent (which includes auth checks)
  return (
    <SidebarProvider defaultOpen={true}>
      <AdminLayoutContent>{children}</AdminLayoutContent>
    </SidebarProvider>
  );
}
