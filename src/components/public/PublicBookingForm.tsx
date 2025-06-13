
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
import { CalendarIcon, User, Mail, Phone, Clock, Users, StickyNote, Send, Loader2, AlertCircle } from "lucide-react";
import { format, add, parse, set, getDay, isBefore, startOfDay, addDays, eachMinuteOfInterval, isSameDay } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import type { CombinedSettings, RestaurantSchedule, DaySchedule, TimeSlot as ScheduleTimeSlot, BookingInput } from "@/lib/types";
import { getPublicRestaurantSettings, getPublicRestaurantSchedule } from "@/services/settingsService";
import { addBookingToFirestore } from "@/services/bookingService";
import { useRouter } from "next/navigation";
import { useEffect, useState, useMemo, useCallback } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const publicBookingFormSchema = (settings: CombinedSettings | null) => z.object({
  guestName: z.string().min(2, "Name must be at least 2 characters."),
  guestEmail: z.string().email("Invalid email address.").optional().or(z.literal('')),
  guestPhone: z.string().min(10, "Phone number seems too short.").optional().or(z.literal('')),
  partySize: z.coerce.number().min(1, "At least 1 guest.").max(settings?.maxGuestsPerBooking || 20, `Maximum ${settings?.maxGuestsPerBooking || 20} guests.`),
  date: z.date({ required_error: "A date is required." }),
  notes: z.string().max(200, "Notes cannot exceed 200 characters.").optional().or(z.literal('')),
});

type PublicBookingFormValues = z.infer<ReturnType<typeof publicBookingFormSchema>>;

export default function PublicBookingForm() {
  const { toast } = useToast();
  const router = useRouter();
  const [settings, setSettings] = useState<CombinedSettings | null>(null);
  const [schedule, setSchedule] = useState<RestaurantSchedule | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

  const fetchRestaurantInfo = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [fetchedSettings, fetchedSchedule] = await Promise.all([
        getPublicRestaurantSettings(),
        getPublicRestaurantSchedule(),
      ]);
      setSettings(fetchedSettings);
      setSchedule(fetchedSchedule);
      if (!fetchedSettings || !fetchedSchedule) {
        setError("Could not load complete restaurant information. Please try again later.");
      }
    } catch (err) {
      console.error("Failed to fetch restaurant info:", err);
      const errorMessage = err instanceof Error ? err.message : "An unknown error occurred.";
      setError(`Could not load restaurant information: ${errorMessage}. Please try again later.`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRestaurantInfo();
  }, [fetchRestaurantInfo]);

  const formSchemaInstance = useMemo(() => publicBookingFormSchema(settings), [settings]);

  const finalSchema = useMemo(() => {
    if (selectedDate && settings && schedule) {
      const dayOfWeek = format(selectedDate, 'eeee').toLowerCase() as DaySchedule['dayOfWeek'];
      const daySchedule = schedule.find(d => d.dayOfWeek === dayOfWeek);
      if (daySchedule && daySchedule.isOpen && daySchedule.timeSlots.length > 0) {
        return formSchemaInstance.extend({
          time: z.string({ required_error: "Please select a time." }),
        });
      }
    }
    return formSchemaInstance;
  }, [selectedDate, settings, schedule, formSchemaInstance]);


  const form = useForm<PublicBookingFormValues & { time?: string }>({
    resolver: zodResolver(finalSchema),
    defaultValues: {
      guestName: "",
      guestEmail: "",
      guestPhone: "",
      partySize: 1,
      date: undefined,
      time: undefined,
      notes: "",
    },
  });

  const handleDateSelect = (date: Date | undefined) => {
    setSelectedDate(date);
    form.setValue("date", date!, { shouldValidate: true });
    form.setValue("time", undefined, { shouldValidate: true }); // Reset time when date changes
    if (date) {
      setIsDatePickerOpen(false); // Close picker after selection
    }
  };

  const availableTimeSlots = useMemo(() => {
    if (!selectedDate || !schedule || !settings) return [];

    const dayOfWeek = format(selectedDate, 'eeee').toLowerCase() as DaySchedule['dayOfWeek'];
    const daySchedule = schedule.find(d => d.dayOfWeek === dayOfWeek);

    if (!daySchedule || !daySchedule.isOpen || daySchedule.timeSlots.length === 0) return [];

    const slots: { value: string; label: string }[] = [];
    const now = new Date();
    const minAdvanceDate = add(now, { hours: settings.minAdvanceReservationHours });

    daySchedule.timeSlots.forEach((slot: ScheduleTimeSlot) => {
      const [startHour, startMinute] = slot.startTime.split(':').map(Number);
      const [endHour, endMinute] = slot.endTime.split(':').map(Number);

      let slotStartTime = set(selectedDate, { hours: startHour, minutes: startMinute, seconds: 0, milliseconds: 0 });
      const slotEndTime = set(selectedDate, { hours: endHour, minutes: endMinute, seconds: 0, milliseconds: 0 });
      
      // Adjust for minimum advance booking
      if (isBefore(slotStartTime, minAdvanceDate) && isSameDay(selectedDate, now)) {
         slotStartTime = minAdvanceDate;
         // Round up to the next interval
         const remainder = slotStartTime.getMinutes() % settings.timeSlotIntervalMinutes;
         if (remainder !== 0) {
            slotStartTime = add(slotStartTime, { minutes: settings.timeSlotIntervalMinutes - remainder});
         }
         // Ensure we don't exceed the original slot's start time
         const originalSlotStart = set(selectedDate, { hours: startHour, minutes: startMinute });
         if (isBefore(slotStartTime, originalSlotStart)) {
            slotStartTime = originalSlotStart;
         }
      }
      
      // Iterate through intervals if slotStartTime is valid and before slotEndTime
      if (isBefore(slotStartTime, slotEndTime)) {
          const intervals = eachMinuteOfInterval(
            { start: slotStartTime, end: slotEndTime },
            { step: settings.timeSlotIntervalMinutes }
          );

          intervals.forEach(intervalTime => {
            // Ensure the interval is not past the slot's end time (edge case if interval perfectly matches end)
            if (isBefore(intervalTime, slotEndTime) || intervalTime.getTime() === slotEndTime.getTime()) {
                 // Check if the interval is within the minAdvanceDate for today
                 if (isSameDay(selectedDate, now) && isBefore(intervalTime, minAdvanceDate)) {
                     return; // Skip this slot as it's too soon
                 }
                slots.push({
                    value: format(intervalTime, "HH:mm"),
                    label: format(intervalTime, "h:mm a"),
                });
            }
          });
      }
    });
    // Remove last slot if interval is greater than 0, as it would be the end time itself
    // which is typically not bookable. Only remove if it's not the only slot.
    if (settings.timeSlotIntervalMinutes > 0 && slots.length > 1 && slots[slots.length-1].value === format(slotEndTime, "HH:mm")) {
      // slots.pop();
    }
    return slots.filter((slot, index, self) => index === self.findIndex(s => s.value === slot.value)); // Unique slots
  }, [selectedDate, schedule, settings]);
  

  async function onSubmit(values: PublicBookingFormValues & { time?: string }) {
    if (!settings || !schedule) {
      toast({ title: "Error", description: "Restaurant configuration not loaded.", variant: "destructive" });
      return;
    }
    if (!values.time) {
        toast({ title: "Missing Time", description: "Please select an available time slot.", variant: "destructive" });
        form.setError("time", { type: "manual", message: "Please select a time." });
        return;
    }

    const bookingData: BookingInput = {
      guestName: values.guestName,
      guestEmail: values.guestEmail,
      guestPhone: values.guestPhone,
      partySize: values.partySize,
      date: format(values.date, "yyyy-MM-dd"),
      time: values.time,
      status: 'pending', // Default status for public bookings
      notes: values.notes,
    };

    try {
      await addBookingToFirestore(bookingData);
      toast({
        title: "Booking Request Sent!",
        description: "Your reservation request has been received. We'll confirm shortly.",
      });
      router.push("/"); // Redirect to homepage or a confirmation page
    } catch (error) {
      console.error("Failed to create booking:", error);
      toast({
        title: "Booking Failed",
        description: "Could not submit your booking request. Please try again.",
        variant: "destructive",
      });
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px] space-y-2">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="font-body text-muted-foreground">Loading booking information...</p>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive" className="max-w-md mx-auto">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle className="font-headline">Error</AlertTitle>
        <AlertDescription className="font-body">{error}</AlertDescription>
      </Alert>
    );
  }

  if (!settings || !schedule) {
     return (
      <Alert variant="destructive" className="max-w-md mx-auto">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle className="font-headline">Configuration Error</AlertTitle>
        <AlertDescription className="font-body">
          The restaurant's booking system is not fully configured. Please check back later.
          (Admin: Ensure 'mainRestaurant' document in 'restaurantConfig' is set up with schedule and settings).
        </AlertDescription>
      </Alert>
    );
  }
  
  const bookingLeadTimeDays = settings?.bookingLeadTimeDays || 90;
  const maxBookingDate = addDays(startOfDay(new Date()), bookingLeadTimeDays);


  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 max-w-lg mx-auto">
        <FormField
          control={form.control}
          name="guestName"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="font-body flex items-center"><User className="mr-2 h-4 w-4 text-muted-foreground" />Your Name</FormLabel>
              <FormControl>
                <Input placeholder="e.g. Jane Smith" {...field} className="font-body" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="guestEmail"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="font-body flex items-center"><Mail className="mr-2 h-4 w-4 text-muted-foreground" />Email (Optional)</FormLabel>
                <FormControl>
                  <Input type="email" placeholder="e.g. jane@example.com" {...field} className="font-body" />
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
                <FormLabel className="font-body flex items-center"><Phone className="mr-2 h-4 w-4 text-muted-foreground" />Phone (Optional)</FormLabel>
                <FormControl>
                  <Input type="tel" placeholder="e.g. (555) 123-4567" {...field} className="font-body" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="partySize"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="font-body flex items-center"><Users className="mr-2 h-4 w-4 text-muted-foreground" />Number of Guests</FormLabel>
              <FormControl>
                <Input type="number" min="1" max={settings?.maxGuestsPerBooking || 20} {...field} className="font-body" />
              </FormControl>
               <FormDescription className="text-xs">Max {settings?.maxGuestsPerBooking || 20} guests online.</FormDescription>
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
                    onSelect={handleDateSelect}
                    disabled={(date) => isBefore(date, startOfDay(new Date())) || isBefore(maxBookingDate, date) }
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <FormDescription className="text-xs">
                Bookings available up to {format(maxBookingDate, "MMM d, yyyy")}.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {selectedDate && (
          <FormField
            control={form.control}
            name="time"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="font-body flex items-center"><Clock className="mr-2 h-4 w-4 text-muted-foreground" />Available Times</FormLabel>
                {availableTimeSlots.length > 0 ? (
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className="font-body">
                        <SelectValue placeholder="Select a time slot" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {availableTimeSlots.map(slot => (
                        <SelectItem key={slot.value} value={slot.value} className="font-body">
                          {slot.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-sm text-muted-foreground font-body pt-2">
                    No available time slots for the selected date. Please try another date or contact us.
                  </p>
                )}
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="font-body flex items-center"><StickyNote className="mr-2 h-4 w-4 text-muted-foreground" />Special Requests (Optional)</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="e.g. Celebrating an anniversary, dietary restrictions, etc."
                  className="resize-none font-body"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full font-body text-lg py-3 btn-subtle-animate bg-accent hover:bg-accent/90 text-accent-foreground" disabled={form.formState.isSubmitting || isLoading || !settings}>
          {form.formState.isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Submitting Request...
            </>
          ) : (
            <>
              <Send className="mr-2 h-5 w-5" /> Request Reservation
            </>
          )}
        </Button>
      </form>
    </Form>
  );
}

