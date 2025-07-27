
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar, 
} from "@/components/ui/sidebar";
import Logo from "@/components/shared/Logo";
import {
  LayoutDashboard,
  BookOpenText,
  CalendarClock,
  Settings,
  LogOut,
  UserCircle,
  LineChart,
  Table as TableIcon,
  FileText,
  MessageSquare,
} from "lucide-react";
import { auth } from "@/config/firebase";
import { signOut } from "firebase/auth";
import { useToast } from "@/hooks/use-toast";

const menuItems = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/bookings", label: "Bookings", icon: BookOpenText },
  { href: "/admin/tables", label: "Tables", icon: TableIcon },
  { href: "/admin/data", label: "Data", icon: LineChart },
  { href: "/admin/schedule", label: "Schedule", icon: CalendarClock },
  { href: "/admin/templates/email", label: "Email Templates", icon: FileText },
  { href: "/admin/forum", label: "Forum", icon: MessageSquare },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export default function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { toast } = useToast();
  const { isMobile, setOpenMobile } = useSidebar(); 

  const handleLogout = async () => {
    try {
      await signOut(auth);
      toast({
        title: "Logged Out",
        description: "You have been successfully logged out.",
      });
      if (isMobile) {
        setOpenMobile(false); // Close sidebar on mobile after logout
      }
      router.push("/admin/login");
    } catch (error) {
      console.error("Error signing out: ", error);
      toast({
        title: "Logout Failed",
        description: "An error occurred while trying to log out.",
        variant: "destructive",
      });
    }
  };

  const handleLinkClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  return (
    <Sidebar collapsible="icon" variant="sidebar" side="left" className="border-r">
      <SidebarHeader className="flex items-center justify-between p-4">
        <Logo size="md" colorClassName="text-sidebar-foreground" showText={true} href="/admin/dashboard" />
        
        {!isMobile && (
          <SidebarTrigger className="text-sidebar-foreground hover:text-sidebar-accent-foreground data-[state=open]:bg-sidebar-accent" />
        )}
      </SidebarHeader>

      <SidebarContent className="flex-grow p-2">
        <SidebarMenu>
          {menuItems.map((item) => (
            <SidebarMenuItem key={item.href}>
              <SidebarMenuButton
                asChild
                isActive={pathname.startsWith(item.href)}
                tooltip={item.label}
                className="font-body"
              >
                <Link href={item.href} onClick={handleLinkClick}>
                  <item.icon className="h-5 w-5" />
                  <span>{item.label}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>

      <SidebarSeparator />

      <SidebarFooter className="p-2">
        <SidebarGroup>
            <SidebarGroupLabel className="font-body">Account</SidebarGroupLabel>
            <SidebarMenu>
                <SidebarMenuItem>
                    <SidebarMenuButton className="font-body" tooltip="Profile">
                        <UserCircle className="h-5 w-5" />
                        <span>Admin User</span>
                    </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                    <SidebarMenuButton 
                        onClick={handleLogout} 
                        className="font-body" 
                        tooltip="Logout"
                    >
                        <LogOut className="h-5 w-5" />
                        <span>Logout</span>
                    </SidebarMenuButton>
                </SidebarMenuItem>
            </SidebarMenu>
        </SidebarGroup>
      </SidebarFooter>
    </Sidebar>
  );
}
