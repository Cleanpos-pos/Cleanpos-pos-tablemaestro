
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarCheck, Users, BarChart3, PlusCircle, Edit, AlertTriangle, Info, Loader2 } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { getBookings } from "@/services/bookingService";
import type { Booking } from "@/lib/types";
import { format, parseISO, formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface DashboardStats {
  upcomingBookings: number;
  availableTables: string; // Remains string for "N/A" or placeholder
  occupancyRate: string;   // Remains string for "N/A" or placeholder
  guestsToday: number;
}

interface ActivityItem {
  id: string;
  message: string;
  time: string;
  type: 'booking' | 'cancellation' | 'system' | 'update';
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    upcomingBookings: 0,
    availableTables: "-",
    occupancyRate: "-",
    guestsToday: 0,
  });
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetchDashboardData = async () => {
      setIsLoading(true);
      try {
        const allBookings = await getBookings();
        const todayFormatted = format(new Date(), 'yyyy-MM-dd');

        const todaysBookings = allBookings.filter(b => b.date === todayFormatted);

        const upcomingBookingsCount = todaysBookings.filter(
          b => b.status === 'confirmed' || b.status === 'pending'
        ).length;

        const guestsTodayCount = todaysBookings
          .filter(b => b.status === 'confirmed' || b.status === 'pending' || b.status === 'seated')
          .reduce((sum, b) => sum + b.partySize, 0);

        const recentActivityItems = allBookings
          .slice(0, 5) // Get the 5 most recent bookings (assuming getBookings sorts by createdAt desc)
          .map((booking): ActivityItem => {
            let message = `Booking for ${booking.guestName} (${booking.partySize}) on ${format(parseISO(booking.date + 'T00:00:00'), 'MMM d')} at ${booking.time}. Status: ${booking.status}.`;
            if (booking.status === 'cancelled') {
              message = `Booking for ${booking.guestName} was cancelled.`;
            } else if (booking.status === 'confirmed') {
              message = `Booking for ${booking.guestName} confirmed for ${format(parseISO(booking.date + 'T00:00:00'), 'MMM d')}.`;
            }
            return {
              id: booking.id,
              message: message,
              time: `${formatDistanceToNow(parseISO(booking.createdAt))} ago`,
              type: booking.status === 'cancelled' ? 'cancellation' : 'booking',
            };
          });
        
        setStats({
          upcomingBookings: upcomingBookingsCount,
          availableTables: "N/A", // Placeholder: Real data needed
          occupancyRate: "N/A",   // Placeholder: Real data needed
          guestsToday: guestsTodayCount,
        });
        setActivity(recentActivityItems);

      } catch (error) {
        console.error("Failed to fetch dashboard data:", error);
        toast({
          title: "Error Loading Dashboard",
          description: "Could not retrieve dashboard data. Please try again.",
          variant: "destructive",
        });
        // Set to default/error state
        setStats({
          upcomingBookings: 0,
          availableTables: "Error",
          occupancyRate: "Error",
          guestsToday: 0,
        });
        setActivity([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, [toast]);


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
            {isLoading ? (
              <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
            ) : (
              <div className="text-3xl font-bold font-headline">{stats.upcomingBookings}</div>
            )}
            <p className="text-xs text-muted-foreground font-body">Today's confirmed/pending.</p>
          </CardContent>
        </Card>
        <Card className="shadow-lg rounded-xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium font-body">Available Tables</CardTitle>
            {/* Using a generic Users icon as table icon might not be available or suitable */}
            <Users className="h-5 w-5 text-green-500" /> 
          </CardHeader>
          <CardContent>
             {isLoading ? (
              <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
            ) : (
              <div className="text-3xl font-bold font-headline">{stats.availableTables}</div>
            )}
            <p className="text-xs text-muted-foreground font-body">Currently (Data N/A).</p>
          </CardContent>
        </Card>
        <Card className="shadow-lg rounded-xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium font-body">Occupancy Rate</CardTitle>
            <BarChart3 className="h-5 w-5 text-accent" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
            ) : (
              <div className="text-3xl font-bold font-headline">{stats.occupancyRate}{stats.occupancyRate !== "N/A" && stats.occupancyRate !== "-" && stats.occupancyRate !== "Error" ? "%" : ""}</div>
            )}
            <p className="text-xs text-muted-foreground font-body">Current (Data N/A).</p>
          </CardContent>
        </Card>
        <Card className="shadow-lg rounded-xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium font-body">Guests Expected Today</CardTitle>
            <Users className="h-5 w-5 text-purple-500" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
            ) : (
              <div className="text-3xl font-bold font-headline">{stats.guestsToday}</div>
            )}
            <p className="text-xs text-muted-foreground font-body">Total guests with bookings.</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="shadow-lg rounded-xl">
          <CardHeader>
            <CardTitle className="font-headline">Recent Activity</CardTitle>
            <CardDescription className="font-body">Latest booking updates.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <div className="flex items-center text-muted-foreground font-body">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading activity...
              </div>
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
          "Available Tables" and "Occupancy Rate" statistics, and the "Table Overview" visual are currently placeholders.
          Full implementation requires a dedicated `tables` collection in Firestore and restaurant capacity settings.
        </p>
      </div>
    </div>
  );
}

