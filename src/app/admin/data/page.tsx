
"use client";

import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Pie, PieChart, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis, Cell } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertTriangle, Database, PieChart as PieChartIcon, BarChartBig, CalendarDays, Calendar as CalendarIconLucide } from "lucide-react";
import type { Booking } from "@/lib/types";
import { getBookings } from "@/services/bookingService";
import { 
  format, 
  subDays, 
  parseISO, 
  isValid as isValidDate,
  startOfWeek,
  endOfWeek,
  subWeeks,
  startOfMonth,
  endOfMonth,
  subMonths,
  isWithinInterval,
  startOfDay,
  endOfDay
} from "date-fns";
import { ChartContainer, ChartTooltipContent, ChartLegend, ChartLegendContent, type ChartConfig } from "@/components/ui/chart";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";

interface BookingStatusData {
  name: string;
  value: number;
  fill: string;
}

interface BookingsOverTimeData {
  date: string; // Formatted date string for display
  count: number;
}

const statusColors: Record<Booking['status'], string> = {
  confirmed: "hsl(var(--chart-1))",
  pending: "hsl(var(--chart-2))",
  seated: "hsl(var(--chart-3))",
  completed: "hsl(var(--chart-4))",
  cancelled: "hsl(var(--chart-5))",
};

const statusDisplayNames: Record<Booking['status'], string> = {
  confirmed: "Confirmed",
  pending: "Pending",
  seated: "Seated",
  completed: "Completed",
  cancelled: "Cancelled",
};

const PREDEFINED_RANGES = [
  { label: "Last 30 Days", value: "last-30-days" },
  { label: "This Week", value: "this-week" },
  { label: "Last Week", value: "last-week" },
  { label: "This Month", value: "this-month" },
  { label: "Last Month", value: "last-month" },
  { label: "All Time", value: "all-time" },
];


export default function DataAnalyticsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 29), // Default to last 30 days
    to: new Date(),
  });
  const [selectedPreset, setSelectedPreset] = useState<string>("last-30-days");


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

  const handlePredefinedRangeChange = (value: string) => {
    setSelectedPreset(value);
    const now = new Date();
    let fromDate: Date | undefined;
    let toDate: Date | undefined = endOfDay(now);

    switch (value) {
      case "this-week":
        fromDate = startOfWeek(now, { weekStartsOn: 1 }); // Assuming week starts on Monday
        toDate = endOfWeek(now, { weekStartsOn: 1 });
        break;
      case "last-week":
        const lastWeekStart = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
        fromDate = lastWeekStart;
        toDate = endOfWeek(lastWeekStart, { weekStartsOn: 1 });
        break;
      case "this-month":
        fromDate = startOfMonth(now);
        toDate = endOfMonth(now);
        break;
      case "last-month":
        const lastMonthStart = startOfMonth(subMonths(now, 1));
        fromDate = lastMonthStart;
        toDate = endOfMonth(lastMonthStart);
        break;
      case "last-30-days":
        fromDate = subDays(now, 29);
        toDate = now; // end of today already set
        break;
      case "all-time":
        setDateRange(undefined);
        return;
      default:
        setDateRange(undefined); // Default to all time if unknown
        return;
    }
    setDateRange({ from: startOfDay(fromDate), to: endOfDay(toDate) });
  };
  
  const onDateRangeSelect = (range: DateRange | undefined) => {
    if (range?.from && range?.to) {
        setDateRange({ from: startOfDay(range.from), to: endOfDay(range.to) });
    } else if (range?.from) { // If only 'from' is selected, set 'to' to be the same day
        setDateRange({ from: startOfDay(range.from), to: endOfDay(range.from) });
    } else {
        setDateRange(range); // Allow clearing
    }
    setSelectedPreset(""); // Clear preset if custom range is selected
  }

  const filteredBookingsByDate = useMemo(() => {
    if (!bookings.length) return [];
    if (!dateRange || !dateRange.from) return bookings; // Return all if no range selected

    const fromDate = dateRange.from;
    const toDate = dateRange.to || dateRange.from; // If 'to' is not set, use 'from'

    return bookings.filter(booking => {
      if (!booking.createdAt) return false;
      const createdAtDate = parseISO(booking.createdAt);
      return isValidDate(createdAtDate) && isWithinInterval(createdAtDate, { start: fromDate, end: toDate });
    });
  }, [bookings, dateRange]);


  const bookingStatusDistribution = useMemo((): BookingStatusData[] => {
    if (!filteredBookingsByDate.length) return [];
    const counts = filteredBookingsByDate.reduce((acc, booking) => {
      acc[booking.status] = (acc[booking.status] || 0) + 1;
      return acc;
    }, {} as Record<Booking['status'], number>);

    return (Object.keys(counts) as Booking['status'][]).map(status => ({
      name: statusDisplayNames[status],
      value: counts[status],
      fill: statusColors[status],
    }));
  }, [filteredBookingsByDate]);
  
  const bookingStatusChartConfig = useMemo((): ChartConfig => {
    const config: ChartConfig = {};
    bookingStatusDistribution.forEach(item => {
      config[item.name] = { label: item.name, color: item.fill };
    });
    return config;
  }, [bookingStatusDistribution]);


  const bookingsOverTimeChartData = useMemo((): BookingsOverTimeData[] => {
    if (!filteredBookingsByDate.length) return [];
    const dailyCounts: Record<string, number> = {};

    filteredBookingsByDate.forEach(booking => {
      if (booking.createdAt) {
        const createdAtDate = parseISO(booking.createdAt);
        if (isValidDate(createdAtDate)) {
          const dateStr = format(createdAtDate, "yyyy-MM-dd");
          dailyCounts[dateStr] = (dailyCounts[dateStr] || 0) + 1;
        }
      }
    });
    
    // Generate date range for the chart based on selected dateRange or all bookings
    let chartStartDate: Date;
    let chartEndDate: Date;

    if (dateRange?.from) {
        chartStartDate = dateRange.from;
        chartEndDate = dateRange.to || dateRange.from;
    } else if (filteredBookingsByDate.length > 0) {
        // If no dateRange, find min/max from filtered bookings
        const sortedBookings = [...filteredBookingsByDate].sort((a,b) => parseISO(a.createdAt).getTime() - parseISO(b.createdAt).getTime());
        chartStartDate = parseISO(sortedBookings[0].createdAt);
        chartEndDate = parseISO(sortedBookings[sortedBookings.length-1].createdAt);
    } else {
        return []; // No data to chart
    }
    
    const result: BookingsOverTimeData[] = [];
    let currentDate = chartStartDate;
    while (currentDate <= chartEndDate) {
        const dateStr = format(currentDate, "yyyy-MM-dd");
        result.push({ date: format(currentDate, "MMM d"), count: dailyCounts[dateStr] || 0 });
        currentDate = subDays(currentDate, -1); // Iterate to next day
    }
    return result;
  }, [filteredBookingsByDate, dateRange]);

  const bookingsOverTimeChartConfig = {
    count: {
      label: "Bookings",
      color: "hsl(var(--primary))",
    },
  } satisfies ChartConfig;


  const recentBookingsTableData = useMemo(() => {
    return filteredBookingsByDate
      .sort((a, b) => {
         const dateA = a.createdAt ? parseISO(a.createdAt).getTime() : 0;
         const dateB = b.createdAt ? parseISO(b.createdAt).getTime() : 0;
         return dateB - dateA; 
      })
      .slice(0, 10);
  }, [filteredBookingsByDate]);

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
        {error.toLowerCase().includes("index") && (
          <p className="mt-2 font-body text-center text-sm text-orange-600">
            If this error mentions an 'index', it might be building in Firestore.
            Please wait a few minutes and refresh. You can check index status in the
            Firebase Console (Firestore Database &gt; Indexes).
          </p>
        )}
      </div>
    );
  }
  
  const noDataAfterFilter = bookings.length > 0 && filteredBookingsByDate.length === 0 && dateRange?.from;

  if ((bookings.length === 0 && !isLoading && !error) || noDataAfterFilter) {
    return (
      <div className="space-y-8">
        <h1 className="text-3xl font-headline text-foreground">Data Analytics</h1>
        <div className="flex flex-col sm:flex-row gap-4 items-center p-4 border-b mb-6">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  id="date"
                  variant={"outline"}
                  className={cn(
                    "w-[260px] justify-start text-left font-normal",
                    !dateRange && "text-muted-foreground"
                  )}
                >
                  <CalendarIconLucide className="mr-2 h-4 w-4" />
                  {dateRange?.from ? (
                    dateRange.to ? (
                      <>
                        {format(dateRange.from, "LLL dd, y")} - {format(dateRange.to, "LLL dd, y")}
                      </>
                    ) : (
                      format(dateRange.from, "LLL dd, y")
                    )
                  ) : (
                    <span>Pick a date range</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={dateRange?.from}
                  selected={dateRange}
                  onSelect={onDateRangeSelect}
                  numberOfMonths={2}
                />
              </PopoverContent>
            </Popover>
            <Select value={selectedPreset} onValueChange={handlePredefinedRangeChange}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Select period" />
              </SelectTrigger>
              <SelectContent>
                {PREDEFINED_RANGES.map(range => (
                  <SelectItem key={range.value} value={range.value}>{range.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
        </div>
        <div className="flex flex-col items-center justify-center h-[calc(100vh-20rem)] p-4">
            <Database className="h-12 w-12 text-muted-foreground" />
            <h2 className="mt-4 text-xl font-headline">No Booking Data Available</h2>
            <p className="mt-2 font-body text-center text-muted-foreground">
            {noDataAfterFilter 
                ? "There are no bookings matching the selected date range."
                : "There are no bookings yet to analyze. Once bookings are made, this page will populate with insights."}
            </p>
        </div>
      </div>
    );
  }


  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-headline text-foreground">Data Analytics</h1>

      <div className="flex flex-col sm:flex-row gap-4 items-center p-4 border-b mb-6">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              id="date"
              variant={"outline"}
              className={cn(
                "w-full sm:w-[260px] justify-start text-left font-normal",
                !dateRange && "text-muted-foreground"
              )}
            >
              <CalendarIconLucide className="mr-2 h-4 w-4" />
              {dateRange?.from ? (
                dateRange.to ? (
                  <>
                    {format(dateRange.from, "LLL dd, y")} -{" "}
                    {format(dateRange.to, "LLL dd, y")}
                  </>
                ) : (
                  format(dateRange.from, "LLL dd, y")
                )
              ) : (
                <span>Pick a date range</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              initialFocus
              mode="range"
              defaultMonth={dateRange?.from}
              selected={dateRange}
              onSelect={onDateRangeSelect}
              numberOfMonths={2}
            />
          </PopoverContent>
        </Popover>
        <Select value={selectedPreset} onValueChange={handlePredefinedRangeChange}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Select period" />
          </SelectTrigger>
          <SelectContent>
            {PREDEFINED_RANGES.map(range => (
              <SelectItem key={range.value} value={range.value}>{range.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>


      <Card className="shadow-lg rounded-xl">
        <CardHeader>
          <CardTitle className="font-headline flex items-center">
            <Database className="mr-3 h-6 w-6 text-primary" />
            Summary for Selected Period
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-center">
            <div className="p-4 bg-muted/50 rounded-lg">
              <p className="text-sm font-body text-muted-foreground">Total Bookings in Period</p>
              <p className="text-3xl font-bold font-headline text-primary">{filteredBookingsByDate.length}</p>
            </div>
            {/* Add more summary stats here as needed */}
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
            <CardDescription className="font-body">Proportion of bookings by status in the selected period.</CardDescription>
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
                 <p className="text-center font-body text-muted-foreground py-8">No status data for selected period.</p>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-lg rounded-xl">
          <CardHeader>
            <CardTitle className="font-headline flex items-center">
                <BarChartBig className="mr-3 h-5 w-5 text-primary" />
                Bookings Over Time
            </CardTitle>
            <CardDescription className="font-body">New bookings created per day in the selected period.</CardDescription>
          </CardHeader>
          <CardContent>
             {bookingsOverTimeChartData.length > 0 ? (
                <ChartContainer config={bookingsOverTimeChartConfig} className="aspect-video max-h-[300px]">
                    <BarChart data={bookingsOverTimeChartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
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
                <p className="text-center font-body text-muted-foreground py-8">No booking trend data for selected period.</p>
             )}
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-lg rounded-xl">
        <CardHeader>
          <CardTitle className="font-headline flex items-center">
            <CalendarDays className="mr-3 h-5 w-5 text-primary" />
            Recent Bookings in Period (Last 10)
          </CardTitle>
          <CardDescription className="font-body">A quick view of the latest reservations in the selected period.</CardDescription>
        </CardHeader>
        <CardContent>
          {recentBookingsTableData.length > 0 ? (
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
                {recentBookingsTableData.map((booking) => (
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
            <p className="text-center font-body text-muted-foreground py-8">No recent bookings to display for selected period.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

