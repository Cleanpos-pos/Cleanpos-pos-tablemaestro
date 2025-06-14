
"use client";

import AdminSidebar from "@/components/admin/AdminSidebar";
import { SidebarProvider, SidebarInset, useSidebar } from "@/components/ui/sidebar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { PanelLeft } from "lucide-react";
import { usePathname } from "next/navigation";

// New inner component to access sidebar context
function AdminLayoutContent({ children }: { children: React.ReactNode }) {
  const { isMobile, toggleSidebar, openMobile } = useSidebar();
  const pathname = usePathname(); // Pathname needed here if padding depends on it

  // Determine if the mobile trigger should be visible.
  // It should not be visible on the login page even on mobile.
  const showMobileTrigger = isMobile && pathname !== "/admin/login";

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
    // For login page, render children directly without sidebar context or structure
    return <>{children}</>;
  }

  return (
    <SidebarProvider defaultOpen={true}>
      <AdminLayoutContent>{children}</AdminLayoutContent>
    </SidebarProvider>
  );
}
