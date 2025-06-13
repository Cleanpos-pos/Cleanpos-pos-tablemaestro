
"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table as ShadcnTable, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PlusCircle, Edit3, Trash2, Loader2, MoreHorizontal, AlertTriangle, Users, MapPin } from "lucide-react";
import type { Table, TableStatus } from "@/lib/types";
import { getTables, deleteTable, updateTable as updateTableService } from "@/services/tableService";
import { useToast } from "@/hooks/use-toast";
import AdminTableForm from "@/components/admin/AdminTableForm";
import TableStatusBadge from "@/components/admin/TableStatusBadge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
  DialogFooter,
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const tableStatuses: TableStatus[] = ['available', 'occupied', 'reserved', 'cleaning', 'unavailable'];

export default function TableManagementPage() {
  const [tables, setTables] = useState<Table[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTable, setEditingTable] = useState<Table | undefined>(undefined);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [tableToDelete, setTableToDelete] = useState<Table | null>(null);
  const { toast } = useToast();

  const fetchTables = useCallback(async () => {
    setIsLoading(true);
    try {
      const fetchedTables = await getTables();
      setTables(fetchedTables);
    } catch (error) {
      console.error("Failed to fetch tables:", error);
      toast({
        title: "Error Loading Tables",
        description: `Could not retrieve tables: ${error instanceof Error ? error.message : String(error)}. Please ensure you are logged in.`,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchTables();
  }, [fetchTables]);

  const handleFormSubmit = () => {
    setIsFormOpen(false);
    setEditingTable(undefined);
    fetchTables(); // Refresh the list
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
      try {
        await deleteTable(tableToDelete.id);
        toast({ title: "Table Deleted", description: `Table "${tableToDelete.name}" has been deleted.` });
        fetchTables(); // Refresh list
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
  
  const handleQuickStatusChange = async (tableId: string, newStatus: TableStatus) => {
    try {
      await updateTableService(tableId, { status: newStatus });
      toast({
        title: "Status Updated",
        description: `Table status changed to ${newStatus}.`,
      });
      fetchTables(); // Refresh tables to show updated status
    } catch (error) {
      console.error("Failed to update table status:", error);
      toast({
        title: "Error Updating Status",
        description: `${error instanceof Error ? error.message : String(error)}`,
        variant: "destructive",
      });
    }
  };


  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-headline text-foreground">Table Management</h1>
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
          <CardTitle className="font-headline">All Restaurant Tables</CardTitle>
          <CardDescription className="font-body">View, add, edit, or delete tables.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-2 font-body">Loading tables...</p>
            </div>
          ) : tables.length === 0 ? (
            <div className="text-center py-10">
              <AlertTriangle className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-medium font-body">No Tables Found</h3>
              <p className="mt-1 text-sm text-muted-foreground font-body">
                Get started by adding your first table.
              </p>
              <Dialog open={isFormOpen} onOpenChange={(open) => {
                setIsFormOpen(open);
                if (!open) setEditingTable(undefined);
              }}>
                <DialogTrigger asChild>
                  <Button className="mt-4" onClick={() => {setEditingTable(undefined); setIsFormOpen(true);}}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Add Table
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[550px]">
                  <DialogHeader>
                    <DialogTitle className="font-headline">Add New Table</DialogTitle>
                  </DialogHeader>
                  <AdminTableForm onFormSubmit={handleFormSubmit} onCancel={() => { setIsFormOpen(false); setEditingTable(undefined); }}/>
                </DialogContent>
              </Dialog>
            </div>
          ) : (
            <ShadcnTable>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-body">Name</TableHead>
                  <TableHead className="font-body text-center">Capacity</TableHead>
                  <TableHead className="font-body">Location</TableHead>
                  <TableHead className="font-body text-center">Status</TableHead>
                  <TableHead className="font-body text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tables.map((table) => (
                  <TableRow key={table.id}>
                    <TableCell className="font-medium font-body">{table.name}</TableCell>
                    <TableCell className="text-center font-body">{table.capacity}</TableCell>
                    <TableCell className="font-body">{table.location || "N/A"}</TableCell>
                    <TableCell className="text-center font-body">
                       <Select
                        value={table.status}
                        onValueChange={(newStatus: TableStatus) => handleQuickStatusChange(table.id, newStatus)}
                      >
                        <SelectTrigger className="h-8 w-[120px] text-xs capitalize">
                           <TableStatusBadge status={table.status} className="text-xs" />
                        </SelectTrigger>
                        <SelectContent>
                          {tableStatuses.map(status => (
                            <SelectItem key={status} value={status} className="font-body capitalize text-xs">
                              {status}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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
                            <Edit3 className="mr-2 h-4 w-4" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="font-body text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer"
                            onClick={() => openDeleteDialog(table)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
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
