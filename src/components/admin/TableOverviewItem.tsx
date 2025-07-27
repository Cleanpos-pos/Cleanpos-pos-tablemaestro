
"use client";
import type { FC } from 'react';
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import TableStatusBadge from "./TableStatusBadge";
import type { Table, TableStatus, Booking } from "@/lib/types";
import { Users, SquareStack, Eye, CalendarClock, User, StickyNote, Info, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { getActiveBookingsForTable } from "@/services/bookingService";
import { format, parseISO, isToday } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface TableOverviewItemProps {
  table: Table;
  onStatusChange: (tableId: string, newStatus: TableStatus) => void;
}

const tableStatuses: TableStatus[] = ['available', 'pending', 'occupied', 'reserved', 'cleaning', 'unavailable'];

const TableOverviewItem: FC<TableOverviewItemProps> = ({ table, onStatusChange }) => {
  const [associatedBooking, setAssociatedBooking] = useState<Booking | null>(null);
  const [isLoadingBooking, setIsLoadingBooking] = useState(false);
  const [isBookingDialogOpen, setIsBookingDialogOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const fetchBookingForTable = async () => {
      if (table.status === 'occupied' || table.status === 'reserved' || table.status === 'pending') {
        setIsLoadingBooking(true);
        setAssociatedBooking(null); // Reset before fetching
        try {
          console.log(`[TableOverviewItem: ${table.name}] Fetching bookings for table ID: ${table.id}, Current Table Status: ${table.status}`);
          const activeBookings = await getActiveBookingsForTable(table.id); // Already sorted by service
          console.log(`[TableOverviewItem: ${table.name}] Active bookings returned by service:`, activeBookings.length > 0 ? activeBookings : 'None');
          let relevantBooking: Booking | null = null;

          if (activeBookings.length > 0) {
            if (table.status === 'occupied') {
              // Prefer a 'seated' booking if table is occupied
              relevantBooking = activeBookings.find(b => b.status === 'seated') || activeBookings[0];
            } else if (table.status === 'reserved') {
              // Prefer a 'confirmed' booking
              relevantBooking = activeBookings.find(b => b.status === 'confirmed') || activeBookings[0];
            } else if (table.status === 'pending') {
                // Prefer a 'pending' booking
              relevantBooking = activeBookings.find(b => b.status === 'pending') || activeBookings[0];
            }
          } else {
            console.log(`[TableOverviewItem: ${table.name}] No active bookings found for this table.`);
          }
          setAssociatedBooking(relevantBooking);
        } catch (error) {
          console.error(`[TableOverviewItem: ${table.name}] Failed to fetch booking for table ${table.id}:`, error);
          toast({
            title: "Error Loading Booking Info",
            description: `Could not load booking details for table ${table.name}.`,
            variant: "destructive"
          });
          setAssociatedBooking(null);
        } finally {
          setIsLoadingBooking(false);
        }
      } else {
        // Clear booking if table is not occupied/reserved/pending, or if it becomes available etc.
        if(associatedBooking !== null) setAssociatedBooking(null); 
        console.log(`[TableOverviewItem: ${table.name}] Table status is '${table.status}', not 'occupied' or 'reserved'. Associated booking cleared if previously set.`);
      }
    };

    fetchBookingForTable();
  }, [table.id, table.name, table.status, toast]); // Ensure all dependencies used in effect are listed

  return (
    <Card className="shadow-md hover:shadow-lg transition-shadow duration-200 flex flex-col h-full">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="font-headline text-lg flex items-center">
              <SquareStack className="mr-2 h-5 w-5 text-primary" />
              {table.name}
            </CardTitle>
            {table.location && <CardDescription className="text-xs font-body">{table.location}</CardDescription>}
          </div>
          <div className="flex items-center text-sm text-muted-foreground font-body">
            <Users className="mr-1 h-4 w-4" /> {table.capacity}
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col flex-grow justify-between pt-2">
        <div className="mb-3">
            <Select
                value={table.status}
                onValueChange={(newStatus: TableStatus) => onStatusChange(table.id, newStatus)}
            >
                <SelectTrigger className="w-full font-body text-sm capitalize">
                    <TableStatusBadge status={table.status} />
                </SelectTrigger>
                <SelectContent>
                {tableStatuses.map(status => (
                    <SelectItem key={status} value={status} className="font-body capitalize">
                    {status}
                    </SelectItem>
                ))}
                </SelectContent>
            </Select>
        </div>
        
        {isLoadingBooking && (
          <div className="text-xs p-2 bg-muted/30 rounded-md mt-auto text-center">
            <Loader2 className="h-4 w-4 animate-spin inline mr-1" />
            <span className="font-body text-muted-foreground">Loading booking...</span>
          </div>
        )}

        {!isLoadingBooking && associatedBooking && (
          <div className="text-xs p-2 bg-muted/50 rounded-md mt-auto space-y-1">
            <p className="font-body text-foreground font-semibold truncate">
              <User className="inline h-3 w-3 mr-1 text-muted-foreground" />
              {associatedBooking.guestName}
            </p>
            <p className="font-body text-muted-foreground">
              <CalendarClock className="inline h-3 w-3 mr-1" /> 
              {associatedBooking.date ? format(parseISO(associatedBooking.date), "MMM d") : "N/A"} at {associatedBooking.time} ({associatedBooking.partySize} ppl)
            </p>
             <Dialog open={isBookingDialogOpen} onOpenChange={setIsBookingDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="w-full mt-2 text-xs h-7 btn-subtle-animate">
                  <Eye className="mr-1 h-3 w-3" /> View Booking
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle className="font-headline">Booking Details: {associatedBooking.guestName}</DialogTitle>
                  <DialogDescription className="font-body">
                    For Table: {table.name}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-3 py-4 font-body">
                  <p><User className="inline h-4 w-4 mr-2 text-primary" /><strong>Guest:</strong> {associatedBooking.guestName}</p>
                  <p><Users className="inline h-4 w-4 mr-2 text-primary" /><strong>Party Size:</strong> {associatedBooking.partySize}</p>
                  <p><CalendarClock className="inline h-4 w-4 mr-2 text-primary" /><strong>Date & Time:</strong> {associatedBooking.date ? format(parseISO(associatedBooking.date), "MMM d, yyyy") : "N/A"} at {associatedBooking.time}</p>
                  <p><Info className="inline h-4 w-4 mr-2 text-primary" /><strong>Status:</strong> <span className="capitalize">{associatedBooking.status}</span></p>
                  {associatedBooking.notes && <p className="text-sm"><StickyNote className="inline h-4 w-4 mr-2 text-primary" /><strong>Notes:</strong> {associatedBooking.notes}</p>}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsBookingDialogOpen(false)} className="font-body">Close</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        )}
        {!isLoadingBooking && !associatedBooking && (table.status === 'occupied' || table.status === 'reserved' || table.status === 'pending') && (
           <div className="text-xs p-2 bg-muted/30 rounded-md mt-auto">
             <p className="font-body text-muted-foreground">No active booking linked.</p>
           </div>
        )}

      </CardContent>
    </Card>
  );
};

export default TableOverviewItem;
