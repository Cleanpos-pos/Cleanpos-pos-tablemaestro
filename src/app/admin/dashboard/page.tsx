import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarCheck, Users, BarChart3, PlusCircle, Edit, AlertTriangle } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

// Mock data - replace with actual data fetching in a real application
const dashboardStats = {
  upcomingBookings: 25,
  availableTables: 12,
  occupancyRate: 65, // percentage
  guestsToday: 85,
};

const recentActivity = [
  { id: 1, message: "New booking: John Doe, 4 guests at 7:00 PM", time: "10 mins ago" },
  { id: 2, message: "Table 5 marked as available", time: "25 mins ago" },
  { id: 3, message: "Jane Smith cancelled booking for 8:30 PM", time: "1 hour ago" },
];

export default function AdminDashboardPage() {
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
            <div className="text-3xl font-bold font-headline">{dashboardStats.upcomingBookings}</div>
            <p className="text-xs text-muted-foreground font-body">+5 from yesterday</p>
          </CardContent>
        </Card>
        <Card className="shadow-lg rounded-xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium font-body">Available Tables</CardTitle>
            <Users className="h-5 w-5 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-headline">{dashboardStats.availableTables}</div>
            <p className="text-xs text-muted-foreground font-body">Out of 30 total tables</p>
          </CardContent>
        </Card>
        <Card className="shadow-lg rounded-xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium font-body">Occupancy Rate</CardTitle>
            <BarChart3 className="h-5 w-5 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-headline">{dashboardStats.occupancyRate}%</div>
            <p className="text-xs text-muted-foreground font-body">Target: 75%</p>
          </CardContent>
        </Card>
        <Card className="shadow-lg rounded-xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium font-body">Guests Expected Today</CardTitle>
            <Users className="h-5 w-5 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-headline">{dashboardStats.guestsToday}</div>
            <p className="text-xs text-muted-foreground font-body">Updated live</p>
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
            {recentActivity.map((activity) => (
              <div key={activity.id} className="flex items-start space-x-3">
                <div className="flex-shrink-0 pt-1">
                  {activity.message.includes("cancelled") ? <AlertTriangle className="h-5 w-5 text-destructive" /> : <CalendarCheck className="h-5 w-5 text-primary" /> }
                </div>
                <div>
                  <p className="text-sm font-medium font-body text-foreground">{activity.message}</p>
                  <p className="text-xs text-muted-foreground font-body">{activity.time}</p>
                </div>
              </div>
            ))}
             <Button variant="link" className="p-0 h-auto text-primary font-body">View all activity</Button>
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
    </div>
  );
}
