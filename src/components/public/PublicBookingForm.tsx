
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
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { CalendarIcon, User, Mail, Phone, Clock, Users, StickyNote, Send, Loader2, AlertCircle } from "lucide-react";
import { format, parse, addMinutes, isBefore, startOfDay, isEqual, set } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import type { RestaurantSchedule, ReservationSettings, DaySchedule, TimeSlot } from "@/lib/types";
import { getPublicRestaurantSettings, getPublicRestaurantSchedule } from "@/services/settingsService";
import React, { useEffect, useState, useMemo, useCallback } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

// Schema generator function
const createPublicBookingFormSchema = (settings?: ReservationSettings | null) => {
  let baseSchema = z.object({
    guestName: z.string().min(2, "Name must be at least 2 characters.").max(100, "Name too long."),
    guestEmail: z.string().email("Invalid email address.").optional().or(z.literal('')),
    guestPhone: z.string().min(7, "Phone number seems too short.").max(20, "Phone number too long.").optional().or(z.literal('')),
    partySize: z.coerce.number().min(1, "At least 1 guest.")
                   .max(settings?.maxGuestsPerBooking || 20, `Maximum ${settings?.maxGuestsPerBooking || 20} guests allowed for online booking.`),
    date: z.date({ required_error: "Please select a date." }),
    notes: z.string().max(200, "Notes cannot exceed 200 characters.").optional().or(z.literal('')),
  });

  // Conditionally add time if slots are available, otherwise make it optional/not strictly required by base
  // This gets tricky with dynamic schemas. Better to have 'time' always and validate based on availableTimeSlots.
   return baseSchema.extend({
    time: z.string({ required_error: "Please select a time."}).regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid time format."),
  });
};


type PublicBookingFormValues = z.infer<ReturnType<typeof createPublicBookingFormSchema>>;

export default function PublicBookingForm() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<ReservationSettings | null>(null);
  const [schedule, setSchedule] = useState<RestaurantSchedule | null>(null);
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const [errorLoading, setErrorLoading] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

  useEffect(() => {
    const fetchRestaurantInfo = async () => {
      setIsLoadingSettings(true);
      setErrorLoading(null);
      try {
        const [fetchedSettings, fetchedSchedule] = await Promise.all([
          getPublicRestaurantSettings(),
          getPublicRestaurantSchedule(),
        ]);
        setSettings(fetchedSettings);
        setSchedule(fetchedSchedule);
         if (!fetchedSettings || !fetchedSchedule) {
            setErrorLoading("Essential restaurant information (settings or schedule) could not be loaded. Please try again later.");
        }
      } catch (err) {
        console.error("Failed to load restaurant info:", err);
        const errorMessage = err instanceof Error ? err.message : "An unknown error occurred.";
        setErrorLoading(`Could not load restaurant information: ${errorMessage}. Please try again later.`);
        toast({
          title: "Error Loading Information",
          description: `Could not retrieve restaurant details: ${errorMessage}`,
          variant: "destructive",
        });
      } finally {
        setIsLoadingSettings(false);
      }
    };
    fetchRestaurantInfo();
  }, [toast]);
  
  // Memoize the form schema based on settings
  const formSchemaInstance = useMemo(() => createPublicBookingFormSchema(settings), [settings]);

  const form = useForm<PublicBookingFormValues>({
    resolver: zodResolver(formSchemaInstance),
    defaultValues: {
      guestName: "",
      guestEmail: "",
      guestPhone: "",
      partySize: 1,
      date: undefined,
      time: "",
      notes: "",
    },
  });

  // Reset form if settings change (e.g. maxPartySize)
  useEffect(() => {
    if (settings) {
      form.reset({
        ...form.getValues(), // keep existing values if any
        partySize: Math.min(form.getValues("partySize") || 1, settings.maxGuestsPerBooking || 20),
      }, { keepDefaultValues: false }); // Update resolver context
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings, form.reset]);


  const handleDateSelect = (date?: Date) => {
    setSelectedDate(date);
    form.setValue("date", date, { shouldValidate: true });
    form.setValue("time", "", {shouldValidate: false}); // Clear time when date changes
    if (date) {
        setIsDatePickerOpen(false); // Close date picker on select
    }
  };
  
  const dayOfWeekMap: Record<number, DaySchedule['dayOfWeek']> = {
    0: 'sunday', 1: 'monday', 2: 'tuesday', 3: 'wednesday', 4: 'thursday', 5: 'friday', 6: 'saturday',
  };

  const availableTimeSlots = useMemo(() => {
    const today = new Date();
    const selectedDateOnly = selectedDate ? startOfDay(selectedDate) : null;
    const todayDateOnly = startOfDay(today);

    if (!selectedDate || !schedule || !settings || (selectedDateOnly && isBefore(selectedDateOnly, todayDateOnly))) {
      return [];
    }

    const dayIndex = selectedDate.getDay();
    const dayKey = dayOfWeekMap[dayIndex];
    const daySchedule = schedule.find(d => d.dayOfWeek === dayKey);

    if (!daySchedule || !daySchedule.isOpen || !daySchedule.timeSlots || daySchedule.timeSlots.length === 0) {
      return [];
    }

    const slots = daySchedule.timeSlots.flatMap((activeSlot) => {
      const intermediateSlots: { label: string; value: string }[] = [];
      if (!activeSlot.startTime || !activeSlot.endTime || !settings.timeSlotIntervalMinutes) {
        return []; // Skip if essential info is missing
      }
      
      const slotStartTime = parse(activeSlot.startTime, 'HH:mm', new Date());
      const servicePeriodEndTime = parse(activeSlot.endTime, 'HH:mm', new Date());
      
      let currentTime = slotStartTime;

      // If selectedDate is today, adjust currentTime to be after the current time + minAdvanceReservationHours
      if (selectedDateOnly && isEqual(selectedDateOnly, todayDateOnly)) {
        let earliestBookingTime = addMinutes(new Date(), settings.minAdvanceReservationHours * 60);
        
        // If earliestBookingTime is before current activeSlot's start time, use slot's start time.
        if (isBefore(earliestBookingTime, slotStartTime)){
            earliestBookingTime = slotStartTime;
        }

        // Advance currentTime past 'earliestBookingTime' according to interval
        // This ensures currentTime starts at a valid slot after the lead time.
        currentTime = slotStartTime; // Reset current time to slot start time
        while(isBefore(currentTime, earliestBookingTime)) {
            if (settings.timeSlotIntervalMinutes === 0) break; 
            currentTime = addMinutes(currentTime, settings.timeSlotIntervalMinutes);
        }
      }
      
      while (isBefore(currentTime, servicePeriodEndTime)) {
        intermediateSlots.push({
          value: format(currentTime, "HH:mm"),
          label: format(currentTime, "p"), // e.g., 5:00 PM
        });
        if (settings.timeSlotIntervalMinutes === 0) break; // Should not happen based on schema
        currentTime = addMinutes(currentTime, settings.timeSlotIntervalMinutes);
      }
      return intermediateSlots;
    });

    return slots.filter(
      (slot, index, self) =>
        index === self.findIndex((s) => s.value === slot.value)
    ); // Unique slots
  }, [selectedDate, schedule, settings, form]);


  async function onSubmit(values: PublicBookingFormValues) {
    setIsSubmitting(true);
    // TODO: Implement actual booking submission logic (e.g., to Firestore)
    console.log("Public Booking Form Submitted:", values);
    toast({
      title: "Booking Request Received!",
      description: `Thank you, ${values.guestName}. We've received your request for ${values.partySize} on ${format(values.date, "PPP")} at ${values.time}. You'll receive a confirmation soon.`,
    });
    form.reset();
    setSelectedDate(undefined);
    setIsSubmitting(false);
  }

  if (isLoadingSettings) {
    return (
      <div className="flex flex-col items-center justify-center p-8 space-y-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="font-body text-muted-foreground">Loading booking information...</p>
      </div>
    );
  }

  if (errorLoading) {
     return (
      <Alert variant="destructive" className="max-w-md mx-auto my-8">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle className="font-headline">Error</AlertTitle>
        <AlertDescription className="font-body">{errorLoading}</AlertDescription>
      </Alert>
    );
  }
  
  if (!settings || !schedule) {
     return (
      <Alert variant="destructive" className="max-w-md mx-auto my-8">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle className="font-headline">Information Unavailable</AlertTitle>
        <AlertDescription className="font-body">
            Restaurant booking information is currently unavailable. Please try again later.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="guestName"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="font-body flex items-center"><User className="mr-2 h-4 w-4 text-muted-foreground" />Full Name</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. Jane Doe" {...field} className="font-body" />
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
                 <FormDescription className="text-xs font-body">Max {settings?.maxGuestsPerBooking || 20} guests online.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="guestEmail"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="font-body flex items-center"><Mail className="mr-2 h-4 w-4 text-muted-foreground" />Email (Optional)</FormLabel>
                <FormControl>
                  <Input type="email" placeholder="e.g. jane.doe@example.com" {...field} className="font-body" />
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
                      disabled={(date) => {
                        const today = startOfDay(new Date());
                        const maxLeadDate = addMinutes(today, (settings?.bookingLeadTimeDays || 90) * 24 * 60); 
                                                
                        if (isBefore(date, today)) return true; // Disable past dates
                        if (isBefore(date, addMinutes(today, (settings?.minAdvanceReservationHours || 0) / 60 ) ) && settings?.minAdvanceReservationHours > 0) {
                           // This condition might be too complex for `disabled` if it depends on time.
                           // For now, just basic date check. Time-based disabling is more UX.
                        }
                        if (isBefore(maxLeadDate, date)) return true; // Disable dates too far in future


                        // Disable based on restaurant schedule (isOpen)
                        const dayIndex = date.getDay();
                        const dayKey = dayOfWeekMap[dayIndex];
                        const daySch = schedule?.find(d => d.dayOfWeek === dayKey);
                        return !daySch || !daySch.isOpen;
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
                <FormLabel className="font-body flex items-center"><Clock className="mr-2 h-4 w-4 text-muted-foreground" />Time</FormLabel>
                <Select 
                    onValueChange={field.onChange} 
                    value={field.value} 
                    disabled={availableTimeSlots.length === 0 || !selectedDate}
                >
                  <FormControl>
                    <SelectTrigger className="font-body">
                      <SelectValue placeholder={availableTimeSlots.length === 0 && selectedDate ? "No slots available" : "Select a time"} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {availableTimeSlots.length > 0 ? (
                        availableTimeSlots.map(slot => (
                        <SelectItem key={slot.value} value={slot.value} className="font-body">
                            {slot.label}
                        </SelectItem>
                        ))
                    ) : selectedDate ? (
                         <SelectItem value="no-slots" disabled className="font-body text-muted-foreground">
                            No slots available for this date.
                        </SelectItem>
                    ): (
                        <SelectItem value="pick-date" disabled className="font-body text-muted-foreground">
                            Please pick a date first.
                        </SelectItem>
                    )}
                  </SelectContent>
                </Select>
                 <FormDescription className="text-xs font-body">
                    {settings ? `Reservations require ${settings.minAdvanceReservationHours}h notice.` : ""}
                 </FormDescription>
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
                    placeholder="e.g. Celebrating an anniversary, dietary restrictions, preferred seating area (not guaranteed)."
                    className="resize-none font-body"
                    rows={3}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        <Button type="submit" className="w-full md:w-auto font-body text-lg py-3 btn-subtle-animate bg-accent hover:bg-accent/90 text-accent-foreground" disabled={isSubmitting || availableTimeSlots.length === 0}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Submitting...
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

