
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
import { CalendarIcon, User, Mail, Phone, Clock, Users, StickyNote, Send, Loader2 } from "lucide-react";
import { format, addDays, parse, setHours, setMinutes, isBefore, startOfHour, addMinutes, eachMinuteOfInterval, isAfter, getDay } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import type { CombinedSettings, RestaurantSchedule, DaySchedule } from "@/lib/types";
import { addBookingToFirestore, type BookingInput } from "@/services/bookingService";
import { useState, useMemo } from "react";

interface BookingFormProps {
  settings: CombinedSettings;
  schedule: RestaurantSchedule;
}

export default function BookingForm({ settings, schedule }: BookingFormProps) {
  const { toast } = useToast();
  const [availableTimes, setAvailableTimes] = useState<Date[]>([]);
  const [isFetchingTimes, setIsFetchingTimes] = useState(false);

  const bookingFormSchema = z.object({
    guestName: z.string().min(2, "Name must be at least 2 characters."),
    guestEmail: z.string().email("Invalid email address."),
    guestPhone: z.string().min(10, "Phone number seems too short.").optional().or(z.literal('')),
    date: z.date({ required_error: "A date is required." }),
    time: z.string().min(1, "A time slot is required."),
    partySize: z.coerce.number().min(1, "At least 1 guest.").max(settings.maxGuestsPerBooking, `Maximum ${settings.maxGuestsPerBooking} guests.`),
    notes: z.string().max(200, "Notes cannot exceed 200 characters.").optional().or(z.literal('')),
  });
  
  type BookingFormValues = z.infer<typeof bookingFormSchema>;

  const form = useForm<BookingFormValues>({
    resolver: zodResolver(bookingFormSchema),
    defaultValues: {
      guestName: "",
      guestEmail: "",
      guestPhone: "",
      date: undefined, // Initialize date as undefined, user must pick
      time: "",
      partySize: 1,
      notes: "",
    },
  });

  const selectedDate = form.watch("date");

  const getDaySchedule = (date: Date): DaySchedule | undefined => {
    const dayIndex = getDay(date); // Sunday = 0, Monday = 1, ...
    const dayMap: (DaySchedule['dayOfWeek'])[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayKey = dayMap[dayIndex];
    return schedule.find(s => s.dayOfWeek === dayKey);
  };

  useMemo(() => {
    if (!selectedDate) {
      setAvailableTimes([]);
      form.setValue("time", ""); // Reset time if date is cleared
      return;
    }

    setIsFetchingTimes(true);
    const daySch = getDaySchedule(selectedDate);

    if (!daySch || !daySch.isOpen || !daySch.openTime || !daySch.closeTime) {
      setAvailableTimes([]);
      form.setValue("time", "");
      setIsFetchingTimes(false);
      return;
    }

    const openTimeParts = daySch.openTime.split(':').map(Number);
    const closeTimeParts = daySch.closeTime.split(':').map(Number);

    let openDateTime = setMinutes(setHours(new Date(selectedDate), openTimeParts[0]), openTimeParts[1]);
    const closeDateTime = setMinutes(setHours(new Date(selectedDate), closeTimeParts[0]), closeTimeParts[1]);
    
    // Ensure minAdvanceReservationHours is respected
    const now = new Date();
    const earliestBookingTime = addMinutes(now, settings.minAdvanceReservationHours * 60);

    if(isBefore(openDateTime, earliestBookingTime)) {
      openDateTime = startOfHour(addMinutes(earliestBookingTime, settings.timeSlotIntervalMinutes - (earliestBookingTime.getMinutes() % settings.timeSlotIntervalMinutes)));
      if (openDateTime.getMinutes() % settings.timeSlotIntervalMinutes !== 0) {
         openDateTime = addMinutes(openDateTime, settings.timeSlotIntervalMinutes - (openDateTime.getMinutes() % settings.timeSlotIntervalMinutes));
      }
    }
    
    const times: Date[] = [];
    if (isBefore(openDateTime, closeDateTime)) {
       try {
        const intervalTimes = eachMinuteOfInterval(
            { start: openDateTime, end: closeDateTime },
            { step: settings.timeSlotIntervalMinutes }
        );
        // Filter out times that are too close to closing considering maxReservationDurationHours
        const effectiveClosingTime = addMinutes(closeDateTime, -(settings.maxReservationDurationHours * 60));
        times.push(...intervalTimes.filter(t => isBefore(t, effectiveClosingTime) && isAfter(t, earliestBookingTime)));

      } catch (e) {
        console.error("Error generating time slots:", e);
      }
    }
    
    setAvailableTimes(times);
    form.setValue("time", ""); // Reset time when date changes
    setIsFetchingTimes(false);

  }, [selectedDate, schedule, settings, form]);


  async function onSubmit(values: BookingFormValues) {
    const bookingData: BookingInput = {
      guestName: values.guestName,
      guestEmail: values.guestEmail,
      guestPhone: values.guestPhone,
      date: format(values.date, "yyyy-MM-dd"),
      time: values.time,
      partySize: values.partySize,
      status: "pending", // Default status for new public bookings
      notes: values.notes,
    };

    try {
      await addBookingToFirestore(bookingData);
      toast({
        title: "Booking Request Sent!",
        description: "Your reservation request has been received. We'll confirm shortly.",
      });
      form.reset();
      setAvailableTimes([]); // Clear times after successful booking
    } catch (error) {
      console.error("Failed to submit booking:", error);
      toast({
        title: "Booking Failed",
        description: "Could not submit your booking. Please try again.",
        variant: "destructive",
      });
    }
  }

  const today = new Date();
  const minBookingDate = addDays(today, 0); // Can book for today if past minAdvance hours
  const maxBookingDate = addDays(today, settings.bookingLeadTimeDays);


  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
            name="guestEmail"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="font-body flex items-center"><Mail className="mr-2 h-4 w-4 text-muted-foreground" />Email Address</FormLabel>
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
          <FormField
            control={form.control}
            name="partySize"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="font-body flex items-center"><Users className="mr-2 h-4 w-4 text-muted-foreground" />Party Size</FormLabel>
                <FormControl>
                  <Input type="number" min="1" max={settings.maxGuestsPerBooking} {...field} className="font-body" />
                </FormControl>
                <FormDescription className="font-body text-xs">Max {settings.maxGuestsPerBooking} guests per online booking.</FormDescription>
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
                      onSelect={(date) => {
                        field.onChange(date);
                        form.setValue("time", ""); // Reset time when date changes
                      }}
                      disabled={(date) => 
                        isBefore(date, minBookingDate) || 
                        isAfter(date, maxBookingDate) ||
                        !getDaySchedule(date)?.isOpen
                      }
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
                <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value} disabled={!selectedDate || isFetchingTimes || availableTimes.length === 0}>
                  <FormControl>
                    <SelectTrigger className="font-body">
                      <SelectValue placeholder={
                        !selectedDate ? "Select a date first" :
                        isFetchingTimes ? "Loading times..." : 
                        availableTimes.length === 0 && selectedDate && getDaySchedule(selectedDate)?.isOpen ? "No slots available" :
                        availableTimes.length === 0 && selectedDate && !getDaySchedule(selectedDate)?.isOpen ? "Restaurant closed" :
                        "Select a time"
                      } />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {isFetchingTimes ? (
                      <SelectItem value="loading" disabled>Loading...</SelectItem>
                    ) : availableTimes.length > 0 ? (
                      availableTimes.map((timeOption) => (
                        <SelectItem key={format(timeOption, "HH:mm")} value={format(timeOption, "HH:mm")} className="font-body">
                          {format(timeOption, "p")}
                        </SelectItem>
                      ))
                    ) : (
                       <SelectItem value="no-slots" disabled>
                        {!selectedDate ? "Select a date first" : 
                         selectedDate && !getDaySchedule(selectedDate)?.isOpen ? "Restaurant closed on this day" :
                         "No available time slots"
                        }
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
                 <FormDescription className="font-body text-xs">
                  Slots are in {settings.timeSlotIntervalMinutes} min intervals. Duration approx. {settings.maxReservationDurationHours} hrs.
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
                    placeholder="e.g. Celebrating an anniversary, dietary restrictions..."
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
