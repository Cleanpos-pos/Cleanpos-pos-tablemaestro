
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
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { CalendarIcon, User, Mail, Phone, Clock, Users, StickyNote, Send, Loader2, CheckCircle } from "lucide-react";
import { format, parse, setHours, setMinutes, setSeconds, setMilliseconds, getDay, addMinutes, isBefore, isEqual } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import type { BookingInput, RestaurantSchedule, CombinedSettings, DaySchedule, TimeSlot as ScheduleTimeSlot } from "@/lib/types";
import { addBookingToFirestore } from "@/services/bookingService";
import { getPublicRestaurantSchedule, getPublicRestaurantSettings } from "@/services/settingsService";
import React, { useEffect, useState, useCallback } from "react";

const publicBookingFormSchema = z.object({
  guestName: z.string().min(2, "Name must be at least 2 characters."),
  guestEmail: z.string().email("Invalid email address.").optional().or(z.literal('')),
  guestPhone: z.string().min(10, "Phone number seems too short.").optional().or(z.literal('')),
  partySize: z.coerce.number().min(1, "At least 1 guest.").max(20, "For parties larger than 20, please call us."), // Max guest constraint
  date: z.date({ required_error: "A date is required."}),
  time: z.string({ required_error: "A time is required."}).regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid time format (HH:MM)."),
  notes: z.string().max(200, "Notes cannot exceed 200 characters.").optional().or(z.literal('')),
});

type PublicBookingFormValues = z.infer<typeof publicBookingFormSchema>;

const dayMapping = [
  'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'
] as const;


export default function PublicBookingForm() {
  const { toast } = useToast();
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [availableTimeSlots, setAvailableTimeSlots] = useState<string[]>([]);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  
  const [settings, setSettings] = useState<CombinedSettings | null>(null);
  const [schedule, setSchedule] = useState<RestaurantSchedule | null>(null);
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);

  const form = useForm<PublicBookingFormValues>({
    resolver: zodResolver(publicBookingFormSchema),
    defaultValues: {
      guestName: "",
      guestEmail: "",
      guestPhone: "",
      partySize: 2,
      date: undefined,
      time: "",
      notes: "",
    },
  });

  const selectedDate = form.watch("date");

  useEffect(() => {
    const fetchConfig = async () => {
      setIsLoadingConfig(true);
      try {
        const [fetchedSettings, fetchedSchedule] = await Promise.all([
          getPublicRestaurantSettings(),
          getPublicRestaurantSchedule()
        ]);
        setSettings(fetchedSettings);
        setSchedule(fetchedSchedule);
        if (fetchedSettings?.maxGuestsPerBooking) {
          // Update partySize schema dynamically if needed, though Zod schema is static after definition.
          // For now, use the settings value in validation logic or UI hints.
        }
      } catch (error) {
        toast({ title: "Error", description: "Could not load restaurant configuration. Please try again later.", variant: "destructive" });
        console.error("Failed to load config:", error);
      } finally {
        setIsLoadingConfig(false);
      }
    };
    fetchConfig();
  }, [toast]);


  const generateTimeSlots = useCallback(() => {
    if (!selectedDate || !schedule || !settings) {
      setAvailableTimeSlots([]);
      return;
    }
    setIsLoadingSlots(true);

    const dayOfWeekIndex = getDay(selectedDate); // 0 for Sunday, 1 for Monday, etc.
    const dayName = dayMapping[dayOfWeekIndex];
    const daySchedule = schedule.find(d => d.dayOfWeek === dayName);

    if (!daySchedule || !daySchedule.isOpen || daySchedule.timeSlots.length === 0) {
      setAvailableTimeSlots([]);
      setIsLoadingSlots(false);
      return;
    }

    const slots: string[] = [];
    const now = new Date();
    const minBookingDateTime = addMinutes(now, settings.minAdvanceReservationHours * 60);
    
    // Ensure selectedDate is not in the past (ignoring time part for this check)
    const today = setHours(setMinutes(setSeconds(setMilliseconds(new Date(),0),0),0),0);
    if (isBefore(selectedDate, today)) {
        setAvailableTimeSlots([]);
        setIsLoadingSlots(false);
        return;
    }


    daySchedule.timeSlots.forEach((slot: ScheduleTimeSlot) => {
      let currentTime = parse(slot.startTime, "HH:mm", selectedDate);
      const endTime = parse(slot.endTime, "HH:mm", selectedDate);

      while (isBefore(currentTime, endTime) || isEqual(currentTime, endTime)) {
        // Check if slot is in the future based on minAdvanceReservationHours
        const slotDateTime = setHours(setMinutes(new Date(selectedDate), currentTime.getHours()), currentTime.getMinutes());
        
        if (isBefore(slotDateTime, minBookingDateTime)) {
          // Slot is too soon, advance to next slot
          currentTime = addMinutes(currentTime, settings.timeSlotIntervalMinutes);
          continue; 
        }
        
        slots.push(format(currentTime, "HH:mm"));
        currentTime = addMinutes(currentTime, settings.timeSlotIntervalMinutes);
        // Safety break for very small intervals / long durations, though unlikely with typical settings
        if (slots.length > 200) break; 
      }
    });
    
    setAvailableTimeSlots(slots);
    setIsLoadingSlots(false);
    form.setValue("time", ""); // Reset time selection when date changes
  }, [selectedDate, schedule, settings, form]);

  useEffect(() => {
    generateTimeSlots();
  }, [selectedDate, schedule, settings, generateTimeSlots]);


  async function onSubmit(values: PublicBookingFormValues) {
    const bookingDataForFirestore: BookingInput = {
      ...values,
      date: format(values.date, "yyyy-MM-dd"), // Format date for Firestore
      status: "pending", // Default status for public bookings
    };

    try {
      await addBookingToFirestore(bookingDataForFirestore);
      toast({
        title: "Booking Request Received!",
        description: `Your reservation request for ${values.guestName} on ${format(values.date, "PPP")} at ${values.time} has been received. We'll confirm shortly.`,
        action: <CheckCircle className="text-green-500" />,
      });
      form.reset();
      setAvailableTimeSlots([]);
    } catch (error) {
      console.error("Failed to create booking:", error);
      toast({
        title: "Booking Failed",
        description: `Could not submit your booking request. Please try again. ${error instanceof Error ? error.message : ""}`,
        variant: "destructive",
      });
    }
  }

  if (isLoadingConfig) {
    return (
      <div className="flex flex-col items-center justify-center p-8 space-y-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="font-body text-muted-foreground">Loading booking options...</p>
      </div>
    );
  }
  
  if (!settings || !schedule) {
     return (
      <div className="flex flex-col items-center justify-center p-8 space-y-4">
        <p className="font-body text-destructive text-center">Booking is currently unavailable. Restaurant configuration is missing. Please try again later.</p>
      </div>
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
                <FormLabel className="font-body flex items-center"><Users className="mr-2 h-4 w-4 text-muted-foreground" />Party Size</FormLabel>
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
                        setIsDatePickerOpen(false); // Auto-close date picker
                      }}
                      disabled={(date) => {
                        const today = new Date();
                        today.setHours(0,0,0,0); // Start of today
                        // Disable past dates
                        if (date < today) return true; 
                        // Disable dates beyond bookingLeadTimeDays
                        if (settings?.bookingLeadTimeDays) {
                            const maxDate = new Date(today);
                            maxDate.setDate(today.getDate() + settings.bookingLeadTimeDays);
                            if (date > maxDate) return true;
                        }
                        // Disable days restaurant is closed
                        if(schedule) {
                            const dayName = dayMapping[getDay(date)];
                            const dayInfo = schedule.find(d => d.dayOfWeek === dayName);
                            if (!dayInfo || !dayInfo.isOpen) return true;
                        }
                        return false;
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
                <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value} disabled={!selectedDate || isLoadingSlots || availableTimeSlots.length === 0}>
                  <FormControl>
                    <SelectTrigger className="font-body">
                      <SelectValue placeholder={
                        !selectedDate ? "Pick a date first" :
                        isLoadingSlots ? "Loading times..." :
                        availableTimeSlots.length === 0 && selectedDate ? "No slots available" :
                        "Select a time"
                      } />
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
                 {selectedDate && availableTimeSlots.length === 0 && !isLoadingSlots && (
                    <FormDescription className="text-xs text-destructive">No available time slots for the selected date. Please try another date.</FormDescription>
                )}
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
            name="notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="font-body flex items-center"><StickyNote className="mr-2 h-4 w-4 text-muted-foreground" />Special Requests (Optional)</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="e.g. Celebrating an anniversary, dietary restrictions..."
                    className="resize-none font-body"
                    rows={3}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        <Button 
            type="submit" 
            className="w-full md:w-auto font-body text-lg py-3 btn-subtle-animate bg-accent hover:bg-accent/90 text-accent-foreground" 
            disabled={form.formState.isSubmitting || isLoadingConfig || isLoadingSlots}
        >
          {form.formState.isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Submitting...
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
