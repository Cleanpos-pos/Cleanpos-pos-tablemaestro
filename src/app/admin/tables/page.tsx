
"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table as ShadcnTable, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PlusCircle, Edit3, Trash2, Loader2, MoreHorizontal, AlertTriangle, Users, MapPin, Calendar as CalendarIconLucide } from "lucide-react";
import type { Table, Booking } from "@/lib/types";
import { getTables, deleteTable } from "@/services/tableService";
import { getBookings } from "@/services/bookingService";
import { useToast } from "@/hooks/use-toast";
import AdminTableForm from "@/components/admin/AdminTableForm";
import TableStatusBadge from "@/components/admin/TableStatusBadge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, startOfDay } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { auth } from "@/config/firebase";
import { cn } from "@/lib/utils";

export default function TableManagementPage() {
  const [tables, setTables] = useState<Table[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [editingTable, setEditingTable] = useState<Table | undefined>(undefined);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [tableToDelete, setTableToDelete] = useState<Table | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(startOfDay(new Date()));
  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    setIsLoading(true);
     if (!auth.currentUser) {
      console.warn("[TablesPage] Attempted to fetch data without an authenticated user.");
      setIsLoading(false);
      return;
    }
    try {
      const [fetchedTables, fetchedBookings] = await Promise.all([
        getTables(),
        getBookings() // Fetch all bookings
      ]);
      setTables(fetchedTables);
      setBookings(fetchedBookings);
    } catch (error) {
      console.error("Failed to fetch tables or bookings:", error);
      toast({
        title: "Error Loading Data",
        description: `Could not retrieve tables or bookings: ${error instanceof Error ? error.message : String(error)}.`,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(user => {
      if (user) {
        fetchData();
      } else {
        setIsLoading(false);
        setTables([]);
        setBookings([]);
      }
    });
    return () => unsubscribe();
  }, [fetchData]);

  const handleFormSubmit = () => {
    setIsFormOpen(false);
    setEditingTable(undefined);
    if (auth.currentUser) fetchData();
  };

  const handleEdit = (table: Table) => {
    setEditingTable(table);
    setIsFormOpen(true);
  };

  const openDeleteDialog = (table: Table) => {
    setTableToDelete(table);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteTable = async () => {
    if (tableToDelete) {
      if (!auth.currentUser) {
        toast({ title: "Not Logged In", description: "You must be logged in to delete tables.", variant: "destructive"});
        setIsDeleteDialogOpen(false);
        return;
      }
      try {
        await deleteTable(tableToDelete.id);
        toast({ title: "Table Deleted", description: `Table "${tableToDelete.name}" has been deleted.` });
        fetchData();
      } catch (error) {
        console.error("Failed to delete table:", error);
        toast({
          title: "Error Deleting Table",
          description: `${error instanceof Error ? error.message : String(error)}`,
          variant: "destructive",
        });
      } finally {
        setTableToDelete(null);
        setIsDeleteDialogOpen(false);
      }
    }
  };

  const getReservationForTable = (tableId: string, date: Date): Booking | undefined => {
    const formattedDate = format(date, "yyyy-MM-dd");
    return bookings.find(b =>
        b.tableId === tableId &&
        b.date === formattedDate &&
        b.status !== 'cancelled' &&
        b.status !== 'completed'
    );
  };


  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-headline text-foreground">Table Management</h1>
          <p className="text-muted-foreground font-body mt-1">View table status and reservations for a specific day.</p>
        </div>
        <Dialog open={isFormOpen} onOpenChange={(open) => {
          setIsFormOpen(open);
          if (!open) setEditingTable(undefined);
        }}>
          <DialogTrigger asChild>
            <Button className="btn-subtle-animate bg-primary hover:bg-primary/90 text-primary-foreground" onClick={() => { setEditingTable(undefined); setIsFormOpen(true);}}>
              <PlusCircle className="mr-2 h-4 w-4" /> Add New Table
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[550px]">
            <DialogHeader>
              <DialogTitle className="font-headline">{editingTable ? "Edit Table" : "Add New Table"}</DialogTitle>
              <DialogDescription className="font-body">
                {editingTable ? `Update details for table "${editingTable.name}".` : "Enter details for a new restaurant table."}
              </DialogDescription>
            </DialogHeader>
            <AdminTableForm
                existingTable={editingTable}
                onFormSubmit={handleFormSubmit}
                onCancel={() => { setIsFormOpen(false); setEditingTable(undefined); }}
            />
          </DialogContent>
        </Dialog>
      </div>

      <Card className="shadow-lg rounded-xl">
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-baseline gap-4">
            <div>
                <CardTitle className="font-headline">Table Reservations</CardTitle>
                <CardDescription className="font-body mt-1">Select a date to view reservations. The "Live Status" reflects the real-time state.</CardDescription>
            </div>
            <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant={"outline"}
                  className={cn(
                    "w-full sm:w-[280px] justify-start text-left font-normal btn-subtle-animate",
                    !selectedDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIconLucide className="mr-2 h-4 w-4" />
                  {selectedDate ? format(selectedDate, "PPP") : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => {
                    setSelectedDate(date || new Date());
                    setIsDatePickerOpen(false);
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-2 font-body">Loading tables and bookings...</p>
            </div>
          ) : tables.length === 0 && auth.currentUser ? (
            <div className="text-center py-10">
              <AlertTriangle className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-medium font-body">No Tables Found</h3>
              <p className="mt-1 text-sm text-muted-foreground font-body">
                Get started by adding your first table.
              </p>
               <Button className="mt-4" onClick={() => {setEditingTable(undefined); setIsFormOpen(true);}}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Add Table
                </Button>
            </div>
          ) : !auth.currentUser && !isLoading ? (
             <div className="text-center py-10">
                <AlertTriangle className="mx-auto h-12 w-12 text-destructive" />
                <h3 className="mt-4 text-lg font-medium font-body">Authentication Required</h3>
                <p className="mt-1 text-sm text-muted-foreground font-body">
                    Please log in to manage tables.
                </p>
            </div>
          ) : (
            <ShadcnTable>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-body">Name</TableHead>
                  <TableHead className="font-body text-center">Capacity</TableHead>
                  <TableHead className="font-body text-center">Live Status</TableHead>
                  <TableHead className="font-body">Reservation for {format(selectedDate, "MMM d")}</TableHead>
                  <TableHead className="font-body text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tables.map((table) => {
                  const reservation = getReservationForTable(table.id, selectedDate);
                  return (
                      <TableRow key={table.id}>
                        <TableCell className="font-medium font-body">{table.name}</TableCell>
                        <TableCell className="text-center font-body">{table.capacity}</TableCell>
                        <TableCell className="text-center font-body">
                           <TableStatusBadge status={table.status} />
                        </TableCell>
                        <TableCell className="font-body">
                          {reservation ? (
                            <div className="flex flex-col">
                                <span className="font-semibold text-primary">{reservation.guestName}</span>
                                <span className="text-xs text-muted-foreground">{reservation.time} for {reservation.partySize}</span>
                            </div>
                           ) : (
                            <span className="text-sm text-green-600">Available</span>
                           )}
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
                              <DropdownMenuItem className="font-body cursor-pointer" onClick={() => handleEdit(table)}>
                                <Edit3 className="mr-2 h-4 w-4" /> Edit Details
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="font-body text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer"
                                onClick={() => openDeleteDialog(table)}
                              >
                                <Trash2 className="mr-2 h-4 w-4" /> Delete Table
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                  );
                })}
              </TableBody>
            </ShadcnTable>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-headline">Are you sure?</AlertDialogTitle>
            <AlertDialogDescription className="font-body">
              This action cannot be undone. This will permanently delete table "{tableToDelete?.name}".
              Make sure this table is not currently assigned to any active bookings.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="font-body">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTable} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground font-body">
              Delete Table
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
