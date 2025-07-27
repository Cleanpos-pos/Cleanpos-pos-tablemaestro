
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Table, TableInput, TableStatus } from "@/lib/types";
import { Save, Loader2, SquareStack, Users, MapPin, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { addTable, updateTable } from "@/services/tableService";

interface AdminTableFormProps {
  existingTable?: Table;
  onFormSubmit: () => void; // Callback to refresh table list or close dialog
  onCancel?: () => void;
}

const tableFormSchema = z.object({
  name: z.string().min(1, "Table name is required.").max(50, "Name too long."),
  capacity: z.coerce.number().min(1, "Capacity must be at least 1.").max(50, "Max 50 guests."),
  status: z.enum(['available', 'occupied', 'reserved', 'cleaning', 'unavailable', 'pending']),
  location: z.string().max(50, "Location too long.").optional().or(z.literal('')),
});

type TableFormValues = z.infer<typeof tableFormSchema>;

const tableStatuses: TableStatus[] = ['available', 'pending', 'reserved', 'occupied', 'cleaning', 'unavailable'];

export default function AdminTableForm({ existingTable, onFormSubmit, onCancel }: AdminTableFormProps) {
  const { toast } = useToast();
  const isEditMode = !!existingTable;

  const defaultValues: TableFormValues = {
    name: existingTable?.name || "",
    capacity: existingTable?.capacity || 2,
    status: existingTable?.status || "available",
    location: existingTable?.location || "",
  };

  const form = useForm<TableFormValues>({
    resolver: zodResolver(tableFormSchema),
    defaultValues,
  });

  async function onSubmit(values: TableFormValues) {
    const tableDataForService: TableInput = {
      name: values.name,
      capacity: values.capacity,
      status: values.status,
      location: values.location || undefined, // Ensure empty string becomes undefined
    };

    try {
      if (isEditMode && existingTable) {
        await updateTable(existingTable.id, tableDataForService);
        toast({
          title: "Table Updated",
          description: `Table "${values.name}" has been successfully updated.`,
          action: <CheckCircle className="text-green-500" />,
        });
      } else {
        await addTable(tableDataForService);
        toast({
          title: "Table Created",
          description: `New table "${values.name}" has been successfully created.`,
          action: <CheckCircle className="text-green-500" />,
        });
      }
      onFormSubmit(); // Trigger refresh / close dialog
    } catch (error) {
      console.error("Failed to save table:", error);
      toast({
        title: isEditMode ? "Update Failed" : "Creation Failed",
        description: `Could not save table "${values.name}". ${error instanceof Error ? error.message : String(error)}`,
        variant: "destructive",
      });
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="font-body flex items-center"><SquareStack className="mr-2 h-4 w-4 text-muted-foreground" />Table Name/Identifier</FormLabel>
              <FormControl>
                <Input placeholder="e.g. T1, Patio Booth A" {...field} className="font-body" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="capacity"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="font-body flex items-center"><Users className="mr-2 h-4 w-4 text-muted-foreground" />Capacity</FormLabel>
                <FormControl>
                  <Input type="number" min="1" {...field} className="font-body" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="font-body">Status</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger className="font-body">
                      <SelectValue placeholder="Select table status" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {tableStatuses.map(status => (
                      <SelectItem key={status} value={status} className="font-body capitalize">
                        {status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="location"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="font-body flex items-center"><MapPin className="mr-2 h-4 w-4 text-muted-foreground" />Location (Optional)</FormLabel>
              <FormControl>
                <Input placeholder="e.g. Main Dining, Window, Patio" {...field} className="font-body" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex justify-end gap-2 pt-4">
          {onCancel && (
             <Button type="button" variant="outline" onClick={onCancel} disabled={form.formState.isSubmitting}>
                Cancel
             </Button>
          )}
          <Button type="submit" className="font-body btn-subtle-animate bg-accent hover:bg-accent/90 text-accent-foreground" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-5 w-5" /> {isEditMode ? "Save Changes" : "Create Table"}
              </>
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}
