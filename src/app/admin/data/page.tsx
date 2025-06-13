
"use client";

import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Pie, PieChart, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis, Cell } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertTriangle, Database, PieChart as PieChartIcon, BarChartBig, CalendarDays } from "lucide-react";
import type { Booking } from "@/lib/types";
import { getBookings } from "@/services/bookingService";
import { format, subDays, parseISO, isValid as isValidDate } from "date-fns";
import { ChartContainer, ChartTooltipContent, ChartLegend, ChartLegendContent, type ChartConfig } from "@/components/ui/chart";
import { useToast } from "@/hooks/use-toast";

interface BookingStatusData {
  name: string;
  value: number;
  fill: string;
}

interface BookingsOverTimeData {
  date: string;
  count: number;
}

const statusColors: Record<Booking['status'], string> = {
  confirmed: "hsl(var(--chart-1))", // Greenish
  pending: "hsl(var(--chart-2))",   // Yellowish
  seated: "hsl(var(--chart-3))",    // Bluish
  completed: "hsl(var(--chart-4))", // Grayish
  cancelled: "hsl(var(--chart-5))", // Reddish
};

const statusDisplayNames: Record<Booking['status'], string> = {
  confirmed: "Confirmed",
  pending: "Pending",
  seated: "Seated",
  completed: "Completed",
  cancelled: "Cancelled",
};


export default function DataAnalyticsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const fetchDashboardData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const allBookings = await getBookings();
        setBookings(allBookings);
      } catch (err) {
        console.error("Failed to fetch booking data:", err);
        const errorMessage = err instanceof Error ? err.message : "An unknown error occurred while fetching data.";
        setError(errorMessage);
        toast({
          title: "Error Loading Data",
          description: errorMessage,
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };
    fetchDashboardData();
  }, [toast]);

  const bookingStatusDistribution = useMemo((): BookingStatusData[] => {
    if (!bookings.length) return [];
    const counts = bookings.reduce((acc, booking) => {
      acc[booking.status] = (acc[booking.status] || 0) + 1;
      return acc;
    }, {} as Record<Booking['status'], number>);

    return (Object.keys(counts) as Booking['status'][]).map(status => ({
      name: statusDisplayNames[status],
      value: counts[status],
      fill: statusColors[status],
    }));
  }, [bookings]);
  
  const bookingStatusChartConfig = useMemo((): ChartConfig => {
    const config: ChartConfig = {};
    bookingStatusDistribution.forEach(item => {
      config[item.name] = { label: item.name, color: item.fill };
    });
    return config;
  }, [bookingStatusDistribution]);


  const bookingsLast7Days = useMemo((): BookingsOverTimeData[] => {
    if (!bookings.length) return [];
    const dailyCounts: Record<string, number> = {};
    const sevenDaysAgo = subDays(new Date(), 6); // Include today

    bookings.forEach(booking => {
      if (booking.createdAt) {
        const createdAtDate = parseISO(booking.createdAt);
        if (isValidDate(createdAtDate) && createdAtDate >= sevenDaysAgo) {
          const dateStr = format(createdAtDate, "yyyy-MM-dd");
          dailyCounts[dateStr] = (dailyCounts[dateStr] || 0) + 1;
        }
      }
    });
    
    const result: BookingsOverTimeData[] = [];
    for (let i = 0; i < 7; i++) {
        const date = format(subDays(new Date(), i), "yyyy-MM-dd");
        result.push({ date: format(parseISO(date), "MMM d"), count: dailyCounts[date] || 0 });
    }
    return result.reverse(); // Show oldest to newest
  }, [bookings]);

  const bookingsOverTimeChartConfig = {
    count: {
      label: "Bookings",
      color: "hsl(var(--primary))",
    },
  } satisfies ChartConfig;


  const recentBookings = useMemo(() => {
    return bookings
      .sort((a, b) => {
         const dateA = a.createdAt ? parseISO(a.createdAt).getTime() : 0;
         const dateB = b.createdAt ? parseISO(b.createdAt).getTime() : 0;
         return dateB - dateA; // Sort by createdAt descending
      })
      .slice(0, 10);
  }, [bookings]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-10rem)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 font-body text-muted-foreground">Loading analytics data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-10rem)] p-4">
        <AlertTriangle className="h-12 w-12 text-destructive" />
        <h2 className="mt-4 text-xl font-headline text-destructive">Failed to Load Data</h2>
        <p className="mt-2 font-body text-center text-muted-foreground">{error}</p>
        <p className="mt-1 font-body text-center text-muted-foreground">Please try refreshing the page or check back later.</p>
      </div>
    );
  }
  
  if (bookings.length === 0 && !isLoading && !error) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-10rem)] p-4">
        <Database className="h-12 w-12 text-muted-foreground" />
        <h2 className="mt-4 text-xl font-headline">No Booking Data Available</h2>
        <p className="mt-2 font-body text-center text-muted-foreground">
          There are no bookings yet to analyze. Once bookings are made, this page will populate with insights.
        </p>
      </div>
    );
  }


  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-headline text-foreground">Data Analytics</h1>

      <Card className="shadow-lg rounded-xl">
        <CardHeader>
          <CardTitle className="font-headline flex items-center">
            <Database className="mr-3 h-6 w-6 text-primary" />
            Overall Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-center">
            <div className="p-4 bg-muted/50 rounded-lg">
              <p className="text-sm font-body text-muted-foreground">Total Bookings</p>
              <p className="text-3xl font-bold font-headline text-primary">{bookings.length}</p>
            </div>
            {/* Add more summary stats here as needed, e.g., Average Party Size */}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="shadow-lg rounded-xl">
          <CardHeader>
            <CardTitle className="font-headline flex items-center">
                <PieChartIcon className="mr-3 h-5 w-5 text-accent" />
                Booking Status Distribution
            </CardTitle>
            <CardDescription className="font-body">Proportion of bookings by their current status.</CardDescription>
          </CardHeader>
          <CardContent>
            {bookingStatusDistribution.length > 0 ? (
              <ChartContainer config={bookingStatusChartConfig} className="mx-auto aspect-square max-h-[300px]">
                <PieChart>
                  <RechartsTooltip content={<ChartTooltipContent hideLabel />} />
                  <Pie data={bookingStatusDistribution} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100}>
                    {bookingStatusDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <ChartLegend content={<ChartLegendContent nameKey="name" />} className="-translate-y-2 flex-wrap gap-2 [&>*]:basis-1/4 [&>*]:justify-center" />
                </PieChart>
              </ChartContainer>
            ) : (
                 <p className="text-center font-body text-muted-foreground py-8">No status data to display.</p>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-lg rounded-xl">
          <CardHeader>
            <CardTitle className="font-headline flex items-center">
                <BarChartBig className="mr-3 h-5 w-5 text-primary" />
                Bookings Over Last 7 Days
            </CardTitle>
            <CardDescription className="font-body">Number of new bookings created each day.</CardDescription>
          </CardHeader>
          <CardContent>
             {bookingsLast7Days.length > 0 ? (
                <ChartContainer config={bookingsOverTimeChartConfig} className="aspect-video max-h-[300px]">
                    <BarChart data={bookingsLast7Days} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                        <CartesianGrid vertical={false} strokeDasharray="3 3" />
                        <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} />
                        <YAxis allowDecimals={false} tickLine={false} axisLine={false} tickMargin={8} />
                        <RechartsTooltip 
                            cursor={false}
                            content={<ChartTooltipContent indicator="dot" hideLabel />}
                        />
                        <Bar dataKey="count" fill="var(--color-count)" radius={4} />
                    </BarChart>
                </ChartContainer>
             ) : (
                <p className="text-center font-body text-muted-foreground py-8">No booking trend data for the last 7 days.</p>
             )}
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-lg rounded-xl">
        <CardHeader>
          <CardTitle className="font-headline flex items-center">
            <CalendarDays className="mr-3 h-5 w-5 text-primary" />
            Recent Bookings (Last 10)
          </CardTitle>
          <CardDescription className="font-body">A quick view of the latest reservations.</CardDescription>
        </CardHeader>
        <CardContent>
          {recentBookings.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-body">Guest Name</TableHead>
                  <TableHead className="font-body">Date & Time</TableHead>
                  <TableHead className="font-body text-center">Party</TableHead>
                  <TableHead className="font-body text-center">Status</TableHead>
                  <TableHead className="font-body">Created At</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentBookings.map((booking) => (
                  <TableRow key={booking.id}>
                    <TableCell className="font-medium font-body">{booking.guestName}</TableCell>
                    <TableCell className="font-body">
                      {booking.date && booking.time ? `${format(parseISO(booking.date + 'T00:00:00'), "MMM d, yyyy")} at ${booking.time}` : 'N/A'}
                    </TableCell>
                    <TableCell className="text-center font-body">{booking.partySize}</TableCell>
                    <TableCell className="text-center font-body">
                      <Badge className={`${statusColors[booking.status].replace("hsl(var(--chart-", "bg-[hsl(var(--chart-").replace("))", "))]")} text-white capitalize`}>
                        {statusDisplayNames[booking.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-body">
                        {booking.createdAt ? format(parseISO(booking.createdAt), "MMM d, yyyy HH:mm") : 'N/A'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-center font-body text-muted-foreground py-8">No recent bookings to display.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

