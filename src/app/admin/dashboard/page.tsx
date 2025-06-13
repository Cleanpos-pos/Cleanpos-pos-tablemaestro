
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarCheck, Users, BarChart3, PlusCircle, Edit, AlertTriangle, Info, Loader2, Table as TableIconLucide, Percent } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { getBookings } from "@/services/bookingService";
import { getTables, updateTable as updateTableService, getAvailableTablesCount, getOccupancyRate } from "@/services/tableService";
import type { Booking, Table, TableStatus, ActivityItem as DashboardActivityItem } from "@/lib/types"; // Renamed ActivityItem to avoid conflict
import { format, parseISO, formatDistanceToNow, isToday } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import TableOverviewItem from "@/components/admin/TableOverviewItem";

interface DashboardStats {
  upcomingBookings: number;
  availableTables: number;
  occupancyRate: number;
  guestsToday: number;
  totalTables: number;
}

interface ActivityItem extends DashboardActivityItem { // Extends the base type if needed, or use directly
  // No changes needed if DashboardActivityItem already fits
}


export default function AdminDashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    upcomingBookings: 0,
    availableTables: 0,
    occupancyRate: 0,
    guestsToday: 0,
    totalTables: 0,
  });
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchDashboardData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [allBookings, allTables, availableTablesCount, occupancy] = await Promise.all([
        getBookings(),
        getTables(),
        getAvailableTablesCount(),
        getOccupancyRate()
      ]);
      
      setTables(allTables);

      const todaysBookings = allBookings.filter(b => {
        try {
            return isToday(parseISO(b.date));
        } catch (e) {
            // if date is invalid, it's not today
            return false;
        }
      });

      const upcomingBookingsCount = todaysBookings.filter(
        b => b.status === 'confirmed' || b.status === 'pending'
      ).length;

      const guestsTodayCount = todaysBookings
        .filter(b => b.status === 'confirmed' || b.status === 'pending' || b.status === 'seated')
        .reduce((sum, b) => sum + b.partySize, 0);

      const recentActivityItems = allBookings
        .sort((a, b) => parseISO(b.createdAt).getTime() - parseISO(a.createdAt).getTime())
        .slice(0, 5)
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
            type: booking.status === 'cancelled' ? 'cancellation' : (booking.status === 'confirmed' ? 'booking' : 'update'),
          };
        });
      
      setStats({
        upcomingBookings: upcomingBookingsCount,
        availableTables: availableTablesCount,
        occupancyRate: occupancy,
        guestsToday: guestsTodayCount,
        totalTables: allTables.length,
      });
      setActivity(recentActivityItems);

    } catch (error) {
      console.error("Failed to fetch dashboard data:", error);
      toast({
        title: "Error Loading Dashboard",
        description: `Could not retrieve dashboard data: ${error instanceof Error ? error.message : String(error)}. Please ensure you are logged in.`,
        variant: "destructive",
      });
      setStats({ upcomingBookings: 0, availableTables: 0, occupancyRate: 0, guestsToday: 0, totalTables: 0 });
      setActivity([]);
      setTables([]);
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const handleTableStatusChange = async (tableId: string, newStatus: TableStatus) => {
    try {
      await updateTableService(tableId, { status: newStatus });
      toast({
        title: "Table Status Updated",
        description: `Table status changed to ${newStatus}. Dashboard will refresh.`,
      });
      fetchDashboardData(); // Re-fetch all data to update stats and table overview
    } catch (error) {
      console.error("Failed to update table status from dashboard:", error);
      toast({
        title: "Error Updating Status",
        description: `Could not update table status: ${error instanceof Error ? error.message : String(error)}`,
        variant: "destructive",
      });
    }
  };

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
            <TableIconLucide className="h-5 w-5 text-green-500" /> 
          </CardHeader>
          <CardContent>
             {isLoading ? (
              <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
            ) : (
              <div className="text-3xl font-bold font-headline">{stats.availableTables} / {stats.totalTables}</div>
            )}
            <p className="text-xs text-muted-foreground font-body">Currently available.</p>
          </CardContent>
        </Card>
        <Card className="shadow-lg rounded-xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium font-body">Occupancy Rate</CardTitle>
            <Percent className="h-5 w-5 text-accent" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
            ) : (
              <div className="text-3xl font-bold font-headline">{stats.occupancyRate}%</div>
            )}
            <p className="text-xs text-muted-foreground font-body">Based on occupied/reserved.</p>
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

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="shadow-lg rounded-xl xl:col-span-2">
            <CardHeader>
                <CardTitle className="font-headline">Table Overview</CardTitle>
                <CardDescription className="font-body">Current status of all restaurant tables.</CardDescription>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                     <div className="flex items-center justify-center h-40">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        <p className="ml-2 font-body">Loading table overview...</p>
                    </div>
                ) : tables.length === 0 ? (
                    <div className="text-center py-10">
                        <TableIconLucide className="mx-auto h-12 w-12 text-muted-foreground" />
                        <h3 className="mt-4 text-lg font-medium font-body">No Tables Configured</h3>
                        <p className="mt-1 text-sm text-muted-foreground font-body">
                            Add tables in the <Link href="/admin/tables" className="text-primary hover:underline">Tables section</Link> to see an overview here.
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                        {tables.map(table => (
                            <TableOverviewItem 
                                key={table.id} 
                                table={table} 
                                onStatusChange={handleTableStatusChange}
                            />
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
        
        <Card className="shadow-lg rounded-xl xl:col-span-1">
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
      </div>
       <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-md shadow">
        <h3 className="font-headline text-lg text-blue-700">Note:</h3>
        <p className="font-body text-blue-600">
          The "Table Overview" allows quick status changes. For full table configuration (add, edit name/capacity, delete), please visit the dedicated <Link href="/admin/tables" className="font-semibold hover:underline">Tables Management page</Link>.
          Automated table status updates based on booking events (e.g., guest seated) can be implemented as a future enhancement.
        </p>
      </div>
    </div>
  );
}
