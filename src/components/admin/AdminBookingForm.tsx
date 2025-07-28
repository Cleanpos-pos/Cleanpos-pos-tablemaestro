
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { CalendarIcon, User, Mail, Phone, Clock, Users, StickyNote, Save, Loader2, CheckCircle, SquareStack } from "lucide-react";
import { format, parseISO, isValid } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import type { Booking, BookingInput, Table, TableStatus } from "@/lib/types";
import { addBookingToFirestore, updateBookingInFirestore } from "@/services/bookingService";
import { updateTable as updateTableService, getTables } from "@/services/tableService";
import { useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";
import { auth } from "@/config/firebase";

interface AdminBookingFormProps {
  existingBooking?: Booking;
}

const adminBookingFormSchema = z.object({
  guestName: z.string().min(2, "Name must be at least 2 characters."),
  guestEmail: z.string().email("Invalid email address.").optional().or(z.literal('')),
  guestPhone: z.string().min(10, "Phone number seems too short.").optional().or(z.literal('')),
  date: z.date({ required_error: "A date is required." }).optional(),
  time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid time format (HH:MM)."),
  partySize: z.coerce.number().min(1, "At least 1 guest."),
  status: z.enum(['confirmed', 'pending', 'seated', 'completed', 'cancelled']),
  notes: z.string().max(200, "Notes cannot exceed 200 characters.").optional().or(z.literal('')),
  tableId: z.string().optional().or(z.literal('')),
});

type AdminBookingFormValues = z.infer<typeof adminBookingFormSchema>;

const CLEAR_TABLE_ID_SENTINEL = "__CLEAR_SELECTION__";
const NO_TABLES_DUMMY_VALUE = "__NO_TABLES_AVAILABLE__";

const getInitialDate = (dateString?: string): Date | undefined => {
  if (dateString) {
    try {
      const parsedDate = parseISO(dateString);
      if (isValid(parsedDate)) {
        return parsedDate;
      }
    } catch(e) { /* fall through */ }
    console.warn(`Invalid date string from existing booking: ${dateString}. Setting date to undefined.`);
    return undefined;
  }
  return undefined;
};

export default function AdminBookingForm({ existingBooking }: AdminBookingFormProps) {
  const { toast } = useToast();
  const router = useRouter();
  const isEditMode = !!existingBooking;
  const [tables, setTables] = useState<Table[]>([]);
  const [isLoadingTables, setIsLoadingTables] = useState(true);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

  const defaultValues: Partial<AdminBookingFormValues> = {
    guestName: existingBooking?.guestName || "",
    guestEmail: existingBooking?.guestEmail || "",
    guestPhone: existingBooking?.guestPhone || "",
    date: getInitialDate(existingBooking?.date),
    time: existingBooking?.time || "19:00",
    partySize: existingBooking?.partySize || 1,
    status: existingBooking?.status || "pending",
    notes: existingBooking?.notes || "",
    tableId: existingBooking?.tableId || "",
  };

  const form = useForm<AdminBookingFormValues>({
    resolver: zodResolver(adminBookingFormSchema),
    defaultValues,
  });

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
        setIsLoadingTables(true);
        try {
          const fetchedTables = await getTables();
          setTables(fetchedTables);
        } catch (error) {
          console.error("Failed to fetch tables for dropdown:", error);
          toast({
            title: "Error Loading Tables",
            description: "Could not load tables for selection. Manual ID entry might be needed if issue persists.",
            variant: "destructive",
          });
          setTables([]);
        } finally {
          setIsLoadingTables(false);
        }
      } else {
        setTables([]);
        setIsLoadingTables(false);
      }
    });
    return () => unsubscribe();
  }, [toast]);
  

  async function onSubmit(values: AdminBookingFormValues) {
    if (!values.date) {
      toast({
        title: "Validation Error",
        description: "A date is required for the booking.",
        variant: "destructive",
      });
      return;
    }

    const bookingDataForFirestore: Omit<BookingInput, 'communicationHistory'> = {
      ...values,
      date: format(values.date, "yyyy-MM-dd"),
      tableId: values.tableId || undefined, 
    };

    const oldTableId = existingBooking?.tableId;
    const oldStatus = existingBooking?.status;
    const newTableId = bookingDataForFirestore.tableId;
    const newStatus = bookingDataForFirestore.status;

    try {
      let bookingIdToWatch: string | undefined = isEditMode ? existingBooking!.id : undefined;

      if (isEditMode && existingBooking) {
        await updateBookingInFirestore(existingBooking.id, bookingDataForFirestore);
        toast({
          title: "Booking Updated",
          description: `Reservation for ${values.guestName} has been successfully updated.`,
          action: <CheckCircle className="text-green-500" />,
        });
      } else {
        const newBookingId = await addBookingToFirestore(bookingDataForFirestore as BookingInput);
        bookingIdToWatch = newBookingId;
        toast({
          title: "Booking Created",
          description: `New reservation for ${values.guestName} has been successfully created.`,
           action: <CheckCircle className="text-green-500" />,
        });
      }

      // --- Table Status Automation Logic ---
      
      const tableStatusMap: { [key in Booking['status']]?: TableStatus } = {
        pending: 'pending',
        confirmed: 'reserved',
        seated: 'occupied',
      };
      
      const newTableStatus = newTableId ? tableStatusMap[newStatus] : undefined;

      // Case 1: A table was previously assigned
      if (oldTableId) {
        // If the table is different OR the new status doesn't require a hold, free the old table
        if (oldTableId !== newTableId || !newTableStatus) {
            console.log(`[AdminBookingForm] Releasing old table ${oldTableId} to 'available'.`);
            await updateTableService(oldTableId, { status: 'available' });
        }
      }
      
      // Case 2: A new table is being assigned with a status that holds it
      if (newTableId && newTableStatus) {
        console.log(`[AdminBookingForm] Assigning new table ${newTableId} with status '${newTableStatus}'.`);
        await updateTableService(newTableId, { status: newTableStatus });
      }


      router.push("/admin/bookings"); 
      router.refresh(); 
    } catch (error) {
      console.error("Failed to save booking or update table status:", error);
      toast({
        title: isEditMode ? "Update Failed" : "Creation Failed",
        description: `Could not save the booking for ${values.guestName}. Please try again. Error: ${error instanceof Error ? error.message : String(error)}`,
        variant: "destructive",
      });
    }
  }
  
  const bookingStatuses: Booking['status'][] = ['pending', 'confirmed', 'seated', 'completed', 'cancelled'];

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
          <FormField
            control={form.control}
            name="guestName"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="font-body flex items-center"><User className="mr-2 h-4 w-4 text-muted-foreground" />Guest Name</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. Jane Smith" {...field} className="font-body" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="partySize"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="font-body flex items-center"><Users className="mr-2 h-4 w-4 text-muted-foreground" />Party Size</FormLabel>
                <FormControl>
                  <Input type="number" min="1" {...field} className="font-body" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="date"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel className="font-body mb-1 flex items-center"><CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />Date</FormLabel>
                <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant={"outline"}
                        className={cn(
                          "w-full pl-3 text-left font-normal font-body",
                          !field.value && "text-muted-foreground"
                        )}
                      >
                        {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={field.value}
                      onSelect={(date) => {
                        field.onChange(date);
                        setIsDatePickerOpen(false);
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="time"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="font-body flex items-center"><Clock className="mr-2 h-4 w-4 text-muted-foreground" />Time (HH:MM)</FormLabel>
                <FormControl>
                  <Input type="time" {...field} className="font-body" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="guestEmail"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="font-body flex items-center"><Mail className="mr-2 h-4 w-4 text-muted-foreground" />Guest Email (Optional)</FormLabel>
                <FormControl>
                  <Input type="email" placeholder="e.g. jane.smith@example.com" {...field} className="font-body" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="guestPhone"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="font-body flex items-center"><Phone className="mr-2 h-4 w-4 text-muted-foreground" />Guest Phone (Optional)</FormLabel>
                <FormControl>
                  <Input type="tel" placeholder="e.g. (555) 987-6543" {...field} className="font-body" />
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
                      <SelectValue placeholder="Select booking status" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {bookingStatuses.map(status => (
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
          <FormField
            control={form.control}
            name="tableId"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="font-body flex items-center"><SquareStack className="mr-2 h-4 w-4 text-muted-foreground" />Assign Table (Optional)</FormLabel>
                <Select 
                  onValueChange={(selectedValue) => {
                    if (selectedValue === CLEAR_TABLE_ID_SENTINEL) {
                      field.onChange(""); // Set react-hook-form field to empty string
                    } else {
                      field.onChange(selectedValue);
                    }
                  }} 
                  value={field.value || ""} // If field.value is "", Select shows placeholder
                  disabled={isLoadingTables}
                >
                  <FormControl>
                    <SelectTrigger className="font-body">
                      <SelectValue placeholder={isLoadingTables ? "Loading tables..." : "Select a table"} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {isLoadingTables ? (
                      <div className="flex items-center justify-center p-2">
                        <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading...
                      </div>
                    ) : tables.length === 0 ? (
                      <SelectItem value={NO_TABLES_DUMMY_VALUE} disabled className="font-body text-muted-foreground">
                        No tables available or configured.
                      </SelectItem>
                    ) : (
                      <>
                        <SelectItem value={CLEAR_TABLE_ID_SENTINEL} className="font-body">
                          None (Unassign Table)
                        </SelectItem>
                        {tables.map((table) => (
                          <SelectItem key={table.id} value={table.id} className="font-body">
                            {table.name} (Capacity: {table.capacity}, Status: {table.status})
                          </SelectItem>
                        ))}
                      </>
                    )}
                  </SelectContent>
                </Select>
                <FormDescription className="font-body text-xs">Select a table to assign to this booking.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="font-body flex items-center"><StickyNote className="mr-2 h-4 w-4 text-muted-foreground" />Notes (Optional)</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="e.g. Birthday celebration, allergy information, etc."
                    className="resize-none font-body"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        <Button type="submit" className="w-full md:w-auto font-body text-lg py-3 btn-subtle-animate bg-accent hover:bg-accent/90 text-accent-foreground" disabled={form.formState.isSubmitting || isLoadingTables}>
          {form.formState.isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Saving...
            </>
          ) : (
            <>
              <Save className="mr-2 h-5 w-5" /> {isEditMode ? "Save Changes" : "Create Booking"}
            </>
          )}
        </Button>
      </form>
    </Form>
  );
}
