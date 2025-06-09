import AdminSidebar from "@/components/admin/AdminSidebar";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex min-h-screen bg-background">
        <AdminSidebar />
        <SidebarInset className="flex flex-col flex-1 overflow-hidden">
            <ScrollArea className="flex-grow">
              <main className="container mx-auto px-4 py-8 sm:px-6 lg:px-8">
                {children}
              </main>
            </ScrollArea>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
