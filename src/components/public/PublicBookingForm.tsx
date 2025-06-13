
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, Controller } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription, // Added FormDescription here
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { CalendarIcon, User, Mail, Phone, Clock, Users, StickyNote, Send, Loader2, AlertCircle, Info } from "lucide-react";
import { format, parse, addHours, isBefore, startOfDay, getDay, set } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import type { BookingInput, CombinedSettings, DaySchedule, RestaurantSchedule } from "@/lib/types";
import { addBookingToFirestore } from "@/services/bookingService";
import { getPublicRestaurantSchedule, getPublicRestaurantSettings } from "@/services/settingsService";
import React, { useEffect, useState, useCallback } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const publicBookingFormSchema = z.object({
  guestName: z.string().min(2, "Name must be at least 2 characters."),
  guestEmail: z.string().email("Invalid email address.").optional().or(z.literal('')),
  guestPhone: z.string().min(10, "Phone number seems too short.").optional().or(z.literal('')),
  date: z.date({ required_error: "Please select a date for your booking." }),
  time: z.string({ required_error: "Please select an available time slot."}).regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid time format."),
  partySize: z.coerce.number().min(1, "At least 1 guest.").max(20, "For parties larger than 20, please contact us directly."), // Max will be dynamically set
  notes: z.string().max(200, "Notes cannot exceed 200 characters.").optional().or(z.literal('')),
}).refine(data => {
    if (data.date && data.time) {
        const bookingDateTime = parse(`${format(data.date, 'yyyy-MM-dd')} ${data.time}`, 'yyyy-MM-dd HH:mm', new Date());
        // Basic check: booking date and time should not be in the past. More advanced check with minAdvanceReservationHours happens later.
        return !isBefore(bookingDateTime, new Date());
    }
    return true;
}, {
    message: "Booking date and time cannot be in the past.",
    path: ["time"],
});


type PublicBookingFormValues = z.infer<typeof publicBookingFormSchema>;

export default function PublicBookingForm() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [schedule, setSchedule] = useState<RestaurantSchedule | null>(null);
  const [settings, setSettings] = useState<CombinedSettings | null>(null);
  const [availableTimeSlots, setAvailableTimeSlots] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);


  const form = useForm<PublicBookingFormValues>({
    resolver: zodResolver(publicBookingFormSchema),
    defaultValues: {
      guestName: "",
      guestEmail: "",
      guestPhone: "",
      date: undefined,
      time: "",
      partySize: 1,
      notes: "",
    },
  });
  
  const { watch, setValue } = form;
  const watchedDate = watch("date");
  const watchedPartySize = watch("partySize");

  const loadConfig = useCallback(async () => {
    setIsLoading(true);
    setGeneralError(null);
    try {
      const [fetchedSettings, fetchedSchedule] = await Promise.all([
        getPublicRestaurantSettings(),
        getPublicRestaurantSchedule()
      ]);
      setSettings(fetchedSettings);
      setSchedule(fetchedSchedule);

      // Update party size validation based on fetched settings
      const newSchema = publicBookingFormSchema.extend({
        partySize: z.coerce.number().min(1, "At least 1 guest.").max(fetchedSettings.maxGuestsPerBooking || 20, `For parties larger than ${fetchedSettings.maxGuestsPerBooking || 20}, please contact us directly.`),
      });
      form.reset(form.getValues(), {
        // @ts-ignore TODO: Fix this type issue with zodResolver update if possible
        resolver: zodResolver(newSchema),
      });


    } catch (error) {
      console.error("Failed to load restaurant configuration:", error);
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
      setGeneralError(`Could not load restaurant information: ${errorMessage}. Please try again later.`);
      toast({
        title: "Error",
        description: `Could not load restaurant information: ${errorMessage}`,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [form, toast]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  useEffect(() => {
    if (watchedDate && schedule && settings) {
      const dayOfWeekIndex = getDay(watchedDate); // Sunday = 0, Monday = 1, ...
      const dayNames: DaySchedule['dayOfWeek'][] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const currentDaySchedule = schedule.find(day => day.dayOfWeek.toLowerCase() === dayNames[dayOfWeekIndex]);

      const slots: string[] = [];
      if (currentDaySchedule && currentDaySchedule.isOpen && currentDaySchedule.timeSlots) {
        const minAdvanceDateTime = addHours(new Date(), settings.minAdvanceReservationHours || 0);

        currentDaySchedule.timeSlots.forEach(slot => {
          let currentTime = parse(slot.startTime, "HH:mm", watchedDate);
          const endTime = parse(slot.endTime, "HH:mm", watchedDate);
          
          while (isBefore(currentTime, endTime)) {
            const slotDateTime = set(watchedDate, { hours: currentTime.getHours(), minutes: currentTime.getMinutes(), seconds: 0, milliseconds: 0 });
            if (isBefore(minAdvanceDateTime, slotDateTime)) {
               slots.push(format(currentTime, "HH:mm"));
            }
            currentTime = addHours(currentTime, settings.timeSlotIntervalMinutes / 60);
          }
        });
      }
      setAvailableTimeSlots(slots);
      if (slots.length > 0 && !slots.includes(form.getValues("time"))) {
         setValue("time", ""); // Reset time if current selection is no longer valid or if slots appeared
      } else if (slots.length === 0) {
         setValue("time", ""); // No slots available, clear time
      }
    } else {
      setAvailableTimeSlots([]);
      setValue("time", "");
    }
  }, [watchedDate, schedule, settings, setValue, form]);


  async function onSubmit(values: PublicBookingFormValues) {
    setIsSubmitting(true);
    setGeneralError(null);

    if (!settings) {
      setGeneralError("Restaurant settings are not loaded. Cannot proceed.");
      setIsSubmitting(false);
      return;
    }

    const bookingDateTime = parse(`${format(values.date, 'yyyy-MM-dd')} ${values.time}`, 'yyyy-MM-dd HH:mm', new Date());
    const minAdvanceDateTime = addHours(new Date(), settings.minAdvanceReservationHours);

    if (isBefore(bookingDateTime, minAdvanceDateTime)) {
      form.setError("time", { 
        type: "manual", 
        message: `Booking must be at least ${settings.minAdvanceReservationHours} hours in advance. Earliest time: ${format(minAdvanceDateTime, "HH:mm")}` 
      });
      setIsSubmitting(false);
      return;
    }

    const bookingDataForFirestore: BookingInput = {
      guestName: values.guestName,
      guestEmail: values.guestEmail,
      guestPhone: values.guestPhone,
      date: format(values.date, "yyyy-MM-dd"),
      time: values.time,
      partySize: values.partySize,
      status: "pending", // Default status for public bookings
      notes: values.notes,
    };

    try {
      await addBookingToFirestore(bookingDataForFirestore);
      toast({
        title: "Booking Request Sent!",
        description: "Your reservation request has been received. We will confirm shortly.",
      });
      form.reset();
      setSelectedDate(undefined);
      setAvailableTimeSlots([]);
    } catch (error) {
      console.error("Failed to create booking:", error);
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
      setGeneralError(`Failed to send booking request: ${errorMessage}. Please try again.`);
      toast({
        title: "Booking Failed",
        description: `Could not process your booking: ${errorMessage}`,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }
  
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-6 space-y-4 bg-card text-card-foreground rounded-lg shadow-xl">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="font-body text-lg">Loading booking information...</p>
        <p className="font-body text-sm text-muted-foreground">Please wait a moment.</p>
      </div>
    );
  }

  if (generalError) {
     return (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle className="font-headline">Error</AlertTitle>
          <AlertDescription className="font-body">{generalError}</AlertDescription>
        </Alert>
     );
  }


  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
          <FormField
            control={form.control}
            name="guestName"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="font-body flex items-center"><User className="mr-2 h-4 w-4 text-muted-foreground" />Full Name</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. John Doe" {...field} className="font-body" />
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
                      onSelect={(date) => {
                        field.onChange(date);
                        setSelectedDate(date);
                        setIsDatePickerOpen(false); // Auto-close picker
                      }}
                      disabled={(date) => isBefore(date, startOfDay(new Date())) || (settings?.bookingLeadTimeDays ? isBefore(startOfDay(new Date(Date.now() + (settings.bookingLeadTimeDays + 1) * 24 * 60 * 60 * 1000)), date) : false) }
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
                <FormLabel className="font-body flex items-center"><Clock className="mr-2 h-4 w-4 text-muted-foreground" />Time</FormLabel>
                <Select onValueChange={field.onChange} value={field.value} disabled={!watchedDate || availableTimeSlots.length === 0}>
                  <FormControl>
                    <SelectTrigger className="font-body">
                      <SelectValue placeholder={!watchedDate ? "Pick a date first" : (availableTimeSlots.length === 0 ? "No slots available" : "Select a time")} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {availableTimeSlots.map(slot => (
                      <SelectItem key={slot} value={slot} className="font-body">
                        {slot}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!watchedDate && <FormDescription className="text-xs">Please select a date to see available times.</FormDescription>}
                {watchedDate && availableTimeSlots.length === 0 && <FormDescription className="text-xs">No times available for this date. Try another date.</FormDescription>}
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="guestEmail"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="font-body flex items-center"><Mail className="mr-2 h-4 w-4 text-muted-foreground" />Email Address (Optional)</FormLabel>
                <FormControl>
                  <Input type="email" placeholder="e.g. john.doe@example.com" {...field} className="font-body" />
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
                <FormLabel className="font-body flex items-center"><Phone className="mr-2 h-4 w-4 text-muted-foreground" />Phone Number (Optional)</FormLabel>
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
            name="notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="font-body flex items-center"><StickyNote className="mr-2 h-4 w-4 text-muted-foreground" />Special Requests (Optional)</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="e.g. Celebrating an anniversary, dietary restrictions, preferred seating area."
                    className="resize-none font-body"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        
        {settings && (
            <Alert variant="default" className="bg-primary/5 border-primary/20">
                <Info className="h-4 w-4 text-primary" />
                <AlertTitle className="font-headline text-primary/90">Booking Information</AlertTitle>
                <AlertDescription className="font-body text-sm text-primary/80 space-y-1">
                   <p>Reservations can be made up to {settings.bookingLeadTimeDays} days in advance.</p>
                   <p>A minimum of {settings.minAdvanceReservationHours} hours notice is required for online bookings.</p>
                   <p>Standard reservation duration is {settings.maxReservationDurationHours} hours.</p>
                </AlertDescription>
            </Alert>
        )}

        <Button type="submit" className="w-full md:w-auto font-body text-lg py-3 btn-subtle-animate bg-accent hover:bg-accent/90 text-accent-foreground" disabled={isSubmitting || isLoading}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Sending Request...
            </>
          ) : (
            <>
              <Send className="mr-2 h-5 w-5" /> Request Booking
            </>
          )}
        </Button>
      </form>
    </Form>
  );
}

    