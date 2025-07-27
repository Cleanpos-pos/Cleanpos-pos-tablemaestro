
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table as ShadcnTable, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlusCircle, Edit3, Trash2, Loader2, MoreHorizontal, AlertTriangle, Users, MapPin, Calendar as CalendarIconLucide, Tag, LayoutDashboard, List, Save } from "lucide-react";
import type { Table, Booking } from "@/lib/types";
import { getTables, deleteTable, batchUpdateTableLayout } from "@/services/tableService";
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
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import FloorPlan from "@/components/admin/FloorPlan";

type ViewMode = 'list' | 'layout';

export default function TableManagementPage() {
  const [tables, setTables] = useState<Table[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [areas, setAreas] = useState<string[]>(["All"]);
  const [newArea, setNewArea] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [editingTable, setEditingTable] = useState<Table | undefined>(undefined);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [tableToDelete, setTableToDelete] = useState<Table | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(startOfDay(new Date()));
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [updatedLayout, setUpdatedLayout] = useState<Record<string, {x: number, y: number}>>({});
  const [isSavingLayout, setIsSavingLayout] = useState(false);
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
        getBookings()
      ]);
      setTables(fetchedTables);
      setBookings(fetchedBookings);
      const uniqueAreas = ["All", ...Array.from(new Set(fetchedTables.map(t => t.location).filter(Boolean) as string[]))];
      setAreas(uniqueAreas);
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
        setAreas(["All"]);
      }
    });
    return () => unsubscribe();
  }, [fetchData]);

  const handleAddNewArea = () => {
    if (newArea && !areas.includes(newArea)) {
      setAreas([...areas, newArea]);
      setNewArea("");
      toast({ title: "Area Added", description: `Area "${newArea}" is now available for table assignment.` });
    }
  };

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
  
  const handleLayoutChange = (id: string, x: number, y: number) => {
    setUpdatedLayout(prev => ({...prev, [id]: {x, y}}));
  };

  const handleSaveLayout = async () => {
    setIsSavingLayout(true);
    const tablesToUpdate = Object.entries(updatedLayout).map(([id, coords]) => ({ id, ...coords }));
    
    try {
      await batchUpdateTableLayout(tablesToUpdate);
      toast({
        title: "Layout Saved",
        description: "The new positions of your tables have been saved.",
      });
      setUpdatedLayout({});
      fetchData(); // Re-fetch to get latest saved state
    } catch(error) {
       toast({
        title: "Error Saving Layout",
        description: `Could not save table positions: ${error instanceof Error ? error.message : String(error)}.`,
        variant: "destructive",
      });
    } finally {
        setIsSavingLayout(false);
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
  
  const isLayoutDirty = Object.keys(updatedLayout).length > 0;

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-headline text-foreground">Table Management</h1>
          <p className="text-muted-foreground font-body mt-1">Define areas, manage tables, and view daily assignments.</p>
        </div>
        <div className="flex items-center gap-2">
           {viewMode === 'layout' && isLayoutDirty && (
            <Button onClick={handleSaveLayout} disabled={isSavingLayout} className="bg-accent hover:bg-accent/90 text-accent-foreground">
              {isSavingLayout ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save Layout
            </Button>
          )}
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
                  availableAreas={areas.filter(a => a !== "All")}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>
      
      <Card className="shadow-lg rounded-xl">
        <CardHeader>
          <CardTitle className="font-headline">Table Areas</CardTitle>
          <CardDescription className="font-body">Define the different areas or sections of your restaurant.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2 items-center">
            {areas.filter(a => a !== 'All').map(area => (
              <Badge key={area} variant="secondary" className="text-base py-1 px-3 bg-green-100 text-green-800 border-green-200">{area}</Badge>
            ))}
          </div>
          <div className="flex gap-2 mt-4 max-w-sm">
            <Input
              value={newArea}
              onChange={(e) => setNewArea(e.target.value)}
              placeholder="e.g., Patio, Bar, Rooftop"
              className="font-body"
            />
            <Button onClick={handleAddNewArea}><PlusCircle className="mr-2 h-4 w-4" /> Add Area</Button>
          </div>
        </CardContent>
         <CardFooter>
            <p className="text-xs text-muted-foreground font-body">
              These areas will be available in the 'Location' dropdown when adding or editing a table.
            </p>
          </CardFooter>
      </Card>

      <Tabs defaultValue="All" className="w-full">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
            <div className="flex items-center gap-4">
              <TabsList>
                {areas.map(area => (
                  <TabsTrigger key={area} value={area} className="font-body">{area}</TabsTrigger>
                ))}
              </TabsList>
              <div className="flex items-center rounded-md bg-muted p-1">
                <Button variant={viewMode === 'list' ? "default": "ghost"} size="sm" onClick={() => setViewMode('list')} className="data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm">
                  <List className="mr-2 h-4 w-4" /> List
                </Button>
                <Button variant={viewMode === 'layout' ? "default": "ghost"} size="sm" onClick={() => setViewMode('layout')} className="data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm">
                  <LayoutDashboard className="mr-2 h-4 w-4" /> Layout
                </Button>
              </div>
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
                    if (date) {
                      setSelectedDate(date);
                    }
                    setIsDatePickerOpen(false);
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
        </div>
        {areas.map(area => (
          <TabsContent key={area} value={area}>
            <Card className="shadow-lg rounded-xl">
              <CardHeader>
                  <CardTitle className="font-headline">Tables in "{area}"</CardTitle>
                  <CardDescription className="font-body">Viewing in {viewMode} mode for {format(selectedDate, "MMM d, yyyy")}.</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex justify-center items-center h-64">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="ml-2 font-body">Loading tables...</p>
                  </div>
                ) : (
                  viewMode === 'list' ? (
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
                      {tables.filter(t => area === "All" || t.location === area).map((table) => {
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
                                  <div className="flex items-center gap-2">
                                      <Badge variant="secondary" className="bg-blue-100 text-blue-800 border-blue-200">Reserved</Badge>
                                      <div className="flex flex-col">
                                          <span className="font-semibold text-primary">{reservation.guestName}</span>
                                          <span className="text-xs text-muted-foreground">{reservation.time} for {reservation.partySize} guests</span>
                                      </div>
                                  </div>
                                ) : (
                                  <Badge variant="outline" className="bg-green-100 text-green-800 border-green-200">Available</Badge>
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
                       {tables.filter(t => area === "All" || t.location === area).length === 0 && (
                          <TableRow>
                            <TableCell colSpan={5} className="h-24 text-center font-body">
                              No tables found in this area.
                            </TableCell>
                          </TableRow>
                        )}
                    </TableBody>
                  </ShadcnTable>
                  ) : (
                    <FloorPlan 
                      tables={tables.filter(t => area === "All" || t.location === area)}
                      onLayoutChange={handleLayoutChange}
                      updatedLayout={updatedLayout}
                    />
                  )
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>


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
