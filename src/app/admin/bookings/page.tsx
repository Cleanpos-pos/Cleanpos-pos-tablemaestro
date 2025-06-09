"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Search, Filter, Edit3, Trash2, MoreHorizontal, PlusCircle, FileDown } from "lucide-react";
import type { Booking } from "@/lib/types";
import { format } from "date-fns";
import Link from "next/link";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useToast } from "@/hooks/use-toast";

// Mock data - replace with actual data fetching
const initialBookings: Booking[] = [
  { id: "1", guestName: "Alice Wonderland", date: "2024-07-20", time: "19:00", partySize: 2, status: "confirmed", createdAt: new Date().toISOString() },
  { id: "2", guestName: "Bob The Builder", date: "2024-07-20", time: "20:30", partySize: 4, status: "pending", createdAt: new Date().toISOString() },
  { id: "3", guestName: "Charlie Chaplin", date: "2024-07-21", time: "18:00", partySize: 3, status: "seated", createdAt: new Date().toISOString() },
  { id: "4", guestName: "Diana Prince", date: "2024-07-21", time: "21:00", partySize: 2, status: "completed", createdAt: new Date().toISOString() },
  { id: "5", guestName: "Edward Scissorhands", date: "2024-07-22", time: "19:30", partySize: 1, status: "cancelled", createdAt: new Date().toISOString() },
];

export default function BookingManagementPage() {
  const [bookings, setBookings] = useState<Booking[]>(initialBookings);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<Booking['status'][]>([]);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [bookingToDelete, setBookingToDelete] = useState<Booking | null>(null);
  const { toast } = useToast();

  const filteredBookings = useMemo(() => {
    return bookings
      .filter((booking) =>
        booking.guestName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        booking.id.toLowerCase().includes(searchTerm.toLowerCase())
      )
      .filter((booking) =>
        statusFilter.length === 0 || statusFilter.includes(booking.status)
      )
      .sort((a, b) => new Date(a.date + 'T' + a.time).getTime() - new Date(b.date + 'T' + b.time).getTime());
  }, [bookings, searchTerm, statusFilter]);

  const handleStatusFilterChange = (status: Booking['status']) => {
    setStatusFilter((prev) =>
      prev.includes(status)
        ? prev.filter((s) => s !== status)
        : [...prev, status]
    );
  };
  
  const handleDeleteBooking = () => {
    if (bookingToDelete) {
      setBookings(prev => prev.filter(b => b.id !== bookingToDelete.id));
      toast({ title: "Booking Deleted", description: `Booking for ${bookingToDelete.guestName} has been deleted.`});
      setBookingToDelete(null);
    }
    setIsDeleteDialogOpen(false);
  };

  const openDeleteDialog = (booking: Booking) => {
    setBookingToDelete(booking);
    setIsDeleteDialogOpen(true);
  };

  const statusColors: Record<Booking['status'], string> = {
    confirmed: "bg-green-500 hover:bg-green-600",
    pending: "bg-yellow-500 hover:bg-yellow-600",
    seated: "bg-blue-500 hover:bg-blue-600",
    completed: "bg-gray-500 hover:bg-gray-600",
    cancelled: "bg-red-500 hover:bg-red-600",
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-headline text-foreground">Booking Management</h1>
        <div className="flex gap-2">
          <Link href="/admin/bookings/new" passHref> {/* Placeholder for new booking page */}
            <Button className="btn-subtle-animate bg-primary hover:bg-primary/90 text-primary-foreground">
              <PlusCircle className="mr-2 h-4 w-4" /> New Booking
            </Button>
          </Link>
          <Button variant="outline" className="btn-subtle-animate">
            <FileDown className="mr-2 h-4 w-4" /> Export Data
          </Button>
        </div>
      </div>

      <Card className="shadow-lg rounded-xl">
        <CardHeader>
          <CardTitle className="font-headline">All Reservations</CardTitle>
          <CardDescription className="font-body">View, search, and manage all bookings.</CardDescription>
          <div className="flex flex-col sm:flex-row gap-4 pt-4">
            <div className="relative flex-grow">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 font-body w-full"
              />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="font-body shrink-0">
                  <Filter className="mr-2 h-4 w-4" /> Status Filter ({statusFilter.length > 0 ? statusFilter.length : 'All'})
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-body">Filter by Status</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {(['confirmed', 'pending', 'seated', 'completed', 'cancelled'] as Booking['status'][]).map((status) => (
                  <DropdownMenuCheckboxItem
                    key={status}
                    checked={statusFilter.includes(status)}
                    onCheckedChange={() => handleStatusFilterChange(status)}
                    className="capitalize font-body"
                  >
                    {status}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="font-body">Guest Name</TableHead>
                <TableHead className="font-body">Date & Time</TableHead>
                <TableHead className="font-body text-center">Party Size</TableHead>
                <TableHead className="font-body text-center">Status</TableHead>
                <TableHead className="font-body text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredBookings.length > 0 ? (
                filteredBookings.map((booking) => (
                  <TableRow key={booking.id}>
                    <TableCell className="font-medium font-body">{booking.guestName}</TableCell>
                    <TableCell className="font-body">
                      {format(new Date(booking.date + 'T00:00:00'), "MMM d, yyyy")} at {booking.time}
                    </TableCell>
                    <TableCell className="text-center font-body">{booking.partySize}</TableCell>
                    <TableCell className="text-center font-body">
                      <Badge className={`${statusColors[booking.status]} text-white capitalize`}>{booking.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Open menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel className="font-body">Actions</DropdownMenuLabel>
                          <Link href={`/admin/bookings/edit/${booking.id}`} passHref>
                            <DropdownMenuItem className="font-body cursor-pointer">
                              <Edit3 className="mr-2 h-4 w-4" /> Edit
                            </DropdownMenuItem>
                          </Link>
                          <DropdownMenuItem 
                            className="font-body text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer"
                            onClick={() => openDeleteDialog(booking)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center font-body">
                    No bookings found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-headline">Are you sure?</AlertDialogTitle>
            <AlertDialogDescription className="font-body">
              This action cannot be undone. This will permanently delete the booking for {bookingToDelete?.guestName}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="font-body">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteBooking} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground font-body">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
