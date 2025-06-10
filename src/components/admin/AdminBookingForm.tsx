
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
import { CalendarIcon, User, Mail, Phone, Clock, Users, StickyNote, Save, Loader2, CheckCircle } from "lucide-react";
import { format, parseISO, isValid } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import type { Booking, BookingInput } from "@/lib/types";
import { addBookingToFirestore, updateBookingInFirestore } from "@/services/bookingService";
import { useRouter } from "next/navigation";

interface AdminBookingFormProps {
  existingBooking?: Booking;
}

const adminBookingFormSchema = z.object({
  guestName: z.string().min(2, "Name must be at least 2 characters."),
  guestEmail: z.string().email("Invalid email address.").optional().or(z.literal('')),
  guestPhone: z.string().min(10, "Phone number seems too short.").optional().or(z.literal('')),
  date: z.date({ required_error: "A date is required." }),
  time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid time format (HH:MM)."),
  partySize: z.coerce.number().min(1, "At least 1 guest."),
  status: z.enum(['confirmed', 'pending', 'seated', 'completed', 'cancelled']),
  notes: z.string().max(200, "Notes cannot exceed 200 characters.").optional().or(z.literal('')),
  tableId: z.string().optional().or(z.literal('')),
});

type AdminBookingFormValues = z.infer<typeof adminBookingFormSchema>;

export default function AdminBookingForm({ existingBooking }: AdminBookingFormProps) {
  const { toast } = useToast();
  const router = useRouter();
  const isEditMode = !!existingBooking;

  const defaultValues: Partial<AdminBookingFormValues> = {
    guestName: existingBooking?.guestName || "",
    guestEmail: existingBooking?.guestEmail || "",
    guestPhone: existingBooking?.guestPhone || "",
    date: existingBooking?.date ? parseISO(existingBooking.date) : undefined,
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
  
  // Ensure date is valid after parsing
  if (existingBooking?.date) {
    const parsedDate = parseISO(existingBooking.date);
    if (isValid(parsedDate)) {
      form.setValue('date', parsedDate);
    } else {
       console.warn(`Invalid date string from existing booking: ${existingBooking.date}. Setting date to undefined.`);
       form.setValue('date', undefined); // Or handle error appropriately
    }
  }


  async function onSubmit(values: AdminBookingFormValues) {
    const bookingDataForFirestore = {
      ...values,
      date: format(values.date, "yyyy-MM-dd"), // Format date for Firestore
    };

    try {
      if (isEditMode && existingBooking) {
        await updateBookingInFirestore(existingBooking.id, bookingDataForFirestore);
        toast({
          title: "Booking Updated",
          description: `Reservation for ${values.guestName} has been successfully updated.`,
          action: <CheckCircle className="text-green-500" />,
        });
      } else {
        await addBookingToFirestore(bookingDataForFirestore as BookingInput); // Type assertion needed as id and createdAt are handled by service
        toast({
          title: "Booking Created",
          description: `New reservation for ${values.guestName} has been successfully created.`,
           action: <CheckCircle className="text-green-500" />,
        });
      }
      router.push("/admin/bookings"); // Redirect to bookings list
      router.refresh(); // Force refresh of the bookings list page data
    } catch (error) {
      console.error("Failed to save booking:", error);
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
                <Popover>
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
                      onSelect={field.onChange}
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
                <FormLabel className="font-body flex items-center">Table ID (Optional)</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. T5, P2" {...field} className="font-body" />
                </FormControl>
                <FormDescription className="font-body text-xs">Assign a specific table if known.</FormDescription>
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
        <Button type="submit" className="w-full md:w-auto font-body text-lg py-3 btn-subtle-animate bg-accent hover:bg-accent/90 text-accent-foreground" disabled={form.formState.isSubmitting}>
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

