
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
  Table as TableIcon, // Added TableIcon
} from "lucide-react";

const menuItems = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/bookings", label: "Bookings", icon: BookOpenText },
  { href: "/admin/tables", label: "Tables", icon: TableIcon }, // New Tables item
  { href: "/admin/data", label: "Data", icon: LineChart },
  { href: "/admin/schedule", label: "Schedule", icon: CalendarClock },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export default function AdminSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="icon" variant="sidebar" side="left" className="border-r">
      <SidebarHeader className="flex items-center justify-between p-4">
        <Logo size="md" colorClassName="text-sidebar-foreground" showText={true} href="/admin/dashboard" />
        <SidebarTrigger className="text-sidebar-foreground hover:text-sidebar-accent-foreground data-[state=open]:bg-sidebar-accent" />
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
                <Link href={item.href}>
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
                    <SidebarMenuButton asChild className="font-body" tooltip="Logout">
                        <Link href="/">
                            <LogOut className="h-5 w-5" />
                            <span>Logout</span>
                        </Link>
                    </SidebarMenuButton>
                </SidebarMenuItem>
            </SidebarMenu>
        </SidebarGroup>
      </SidebarFooter>
    </Sidebar>
  );
}
