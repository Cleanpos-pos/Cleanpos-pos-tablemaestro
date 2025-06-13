
"use client"; // This page uses client-side interactivity (Link, Button) but data should be fetched.

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarCheck, Users, BarChart3, PlusCircle, Edit, AlertTriangle, Info } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";

// TODO: Implement actual data fetching for dashboard statistics and recent activity.
// For now, demo data has been removed and placeholders are used.

interface DashboardStats {
  upcomingBookings: number | string;
  availableTables: number | string;
  occupancyRate: number | string; // percentage
  guestsToday: number | string;
}

interface ActivityItem {
  id: string | number;
  message: string;
  time: string;
  type: 'booking' | 'cancellation' | 'system';
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    upcomingBookings: "0",
    availableTables: "0",
    occupancyRate: "0",
    guestsToday: "0",
  });
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [isLoading, setIsLoading] = useState(true); // Simulate loading

  useEffect(() => {
    // Simulate data fetching
    const timer = setTimeout(() => {
      // In a real app, you would fetch data here and then:
      // setStats({ upcomingBookings: fetchedStats.upcoming, ... });
      // setActivity(fetchedActivity);
      setIsLoading(false); // Set loading to false after "fetching"
    }, 1500); // Simulate a 1.5 second load time

    return () => clearTimeout(timer);
  }, []);


  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-headline text-foreground">Admin Dashboard</h1>
        <div className="flex gap-2">
          <Link href="/admin/bookings/new" passHref>
             <Button className="btn-subtle-animate bg-primary hover:bg-primary/90 text-primary-foreground">
              <PlusCircle className="mr-2 h-4 w-4" /> New Booking
            </Button>
          </Link>
          <Link href="/admin/schedule" passHref>
            <Button variant="outline" className="btn-subtle-animate">
              <Edit className="mr-2 h-4 w-4" /> Manage Schedule
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="shadow-lg rounded-xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium font-body">Upcoming Bookings</CardTitle>
            <CalendarCheck className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-headline">{isLoading ? "-" : stats.upcomingBookings}</div>
            <p className="text-xs text-muted-foreground font-body">Today's upcoming reservations.</p>
          </CardContent>
        </Card>
        <Card className="shadow-lg rounded-xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium font-body">Available Tables</CardTitle>
            <Users className="h-5 w-5 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-headline">{isLoading ? "-" : stats.availableTables}</div>
            <p className="text-xs text-muted-foreground font-body">Currently available for booking.</p>
          </CardContent>
        </Card>
        <Card className="shadow-lg rounded-xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium font-body">Occupancy Rate</CardTitle>
            <BarChart3 className="h-5 w-5 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-headline">{isLoading ? "-" : stats.occupancyRate}{isLoading ? "" : "%"}</div>
            <p className="text-xs text-muted-foreground font-body">Current occupancy.</p>
          </CardContent>
        </Card>
        <Card className="shadow-lg rounded-xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium font-body">Guests Expected Today</CardTitle>
            <Users className="h-5 w-5 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-headline">{isLoading ? "-" : stats.guestsToday}</div>
            <p className="text-xs text-muted-foreground font-body">Total guests with bookings.</p>
          </CardContent>
        </Card>
      </div>

      {/* Placeholder for charts or more detailed views */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="shadow-lg rounded-xl">
          <CardHeader>
            <CardTitle className="font-headline">Recent Activity</CardTitle>
            <CardDescription className="font-body">Latest updates and notifications.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <p className="font-body text-muted-foreground">Loading activity...</p>
            ) : activity.length > 0 ? (
              activity.map((item) => (
                <div key={item.id} className="flex items-start space-x-3">
                  <div className="flex-shrink-0 pt-1">
                    {item.type === 'cancellation' ? <AlertTriangle className="h-5 w-5 text-destructive" /> : 
                     item.type === 'booking' ? <CalendarCheck className="h-5 w-5 text-primary" /> :
                     <Info className="h-5 w-5 text-blue-500" />
                    }
                  </div>
                  <div>
                    <p className="text-sm font-medium font-body text-foreground">{item.message}</p>
                    <p className="text-xs text-muted-foreground font-body">{item.time}</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="font-body text-muted-foreground">No recent activity to display.</p>
            )}
             {/* <Button variant="link" className="p-0 h-auto text-primary font-body">View all activity</Button> */}
          </CardContent>
        </Card>
        <Card className="shadow-lg rounded-xl">
          <CardHeader>
            <CardTitle className="font-headline">Table Overview</CardTitle>
             <CardDescription className="font-body">Visual representation of table status (Placeholder).</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-center h-48 bg-muted/30 rounded-md">
             <Image src="https://placehold.co/400x200.png" alt="Table Layout Placeholder" width={400} height={200} data-ai-hint="restaurant layout" className="opacity-50" />
          </CardContent>
        </Card>
      </div>
       <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-md shadow">
        <h3 className="font-headline text-lg text-blue-700">Note for Developers:</h3>
        <p className="font-body text-blue-600">
          The statistics and recent activity on this dashboard are currently placeholders.
          Please implement data fetching logic to display real-time information from your backend services.
        </p>
      </div>
    </div>
  );
}
