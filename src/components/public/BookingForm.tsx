
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
import { CalendarIcon, User, Mail, Phone, Clock, Users, StickyNote, Send, Loader2, Info } from "lucide-react";
import { format, addMinutes, setHours, setMinutes, isBefore, startOfDay, addDays, parse } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import type { BookingInput, RestaurantSchedule, ReservationSettings, RestaurantProfileSettings } from "@/lib/types";
import { addBookingToFirestore } from "@/services/bookingService";
import { getRestaurantSettings, getRestaurantSchedule } from "@/services/settingsService";
import { useEffect, useState, useMemo, useCallback } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import Image from "next/image";
import { auth } from "@/config/firebase"; // Import Firebase auth

const bookingFormSchema = z.object({
  guestName: z.string().min(2, "Name must be at least 2 characters."),
  guestEmail: z.string().email("Invalid email address.").optional().or(z.literal('')),
  guestPhone: z.string().min(10, "Phone number seems too short.").optional().or(z.literal('')),
  date: z.date({ required_error: "Please select a date." }),
  time: z.string({ required_error: "Please select a time." }).regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid time format."),
  partySize: z.coerce.number().min(1, "At least 1 guest.").max(20, "For parties larger than 20, please call."), // Default max, will be overridden by settings
  notes: z.string().max(200, "Notes cannot exceed 200 characters.").optional().or(z.literal('')),
});

type BookingFormValues = z.infer<typeof bookingFormSchema>;

interface RestaurantDataForBooking {
  settings: ReservationSettings | null;
  schedule: RestaurantSchedule | null;
  profile: RestaurantProfileSettings | null;
}

export default function BookingForm() {
  const { toast } = useToast();
  const [restaurantData, setRestaurantData] = useState<RestaurantDataForBooking | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [availableTimes, setAvailableTimes] = useState<string[]>([]);

  const form = useForm<BookingFormValues>({
    resolver: zodResolver(bookingFormSchema),
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

  const selectedDate = form.watch("date");

  const fetchRestaurantData = useCallback(async () => {
    setIsLoadingData(true);
    console.log("Public Booking Form: Auth state before fetching restaurant data:", auth.currentUser);
    try {
      const settings = await getRestaurantSettings();
      const schedule = await getRestaurantSchedule();
      
      // Extract profile data from settings (assuming they are stored together)
      const profile: RestaurantProfileSettings | null = settings ? {
        restaurantName: settings.restaurantName,
        restaurantImageUrl: settings.restaurantImageUrl,
      } : null;

      setRestaurantData({ settings, schedule, profile });

      if (settings) {
        form.setValue("partySize", Math.min(form.getValues("partySize"), settings.maxGuestsPerBooking));
        // Update partySize validation dynamically
        bookingFormSchema.shape.partySize = z.coerce.number().min(1, "At least 1 guest.").max(settings.maxGuestsPerBooking, `Max party size is ${settings.maxGuestsPerBooking}. For larger parties, please call.`);
      }

    } catch (error) {
      console.error("Failed to load restaurant data:", error);
      toast({
        title: "Error Loading Restaurant Information",
        description: "Could not load restaurant details. Please try refreshing the page.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingData(false);
    }
  }, [form, toast]);

  useEffect(() => {
    fetchRestaurantData();
  }, [fetchRestaurantData]);

  const generateAvailableTimes = useCallback(() => {
    if (!selectedDate || !restaurantData?.schedule || !restaurantData?.settings) {
      return [];
    }

    const dayOfWeek = format(selectedDate, "eeee").toLowerCase() as keyof RestaurantSchedule[0]['dayOfWeek'];
    const daySchedule = restaurantData.schedule.find(s => s.dayOfWeek === dayOfWeek);

    if (!daySchedule || !daySchedule.isOpen || !daySchedule.openTime || !daySchedule.closeTime) {
      return [];
    }

    const times: string[] = [];
    const { timeSlotIntervalMinutes, minAdvanceReservationHours } = restaurantData.settings;
    
    let currentTime = parse(daySchedule.openTime, "HH:mm", selectedDate);
    const closeTime = parse(daySchedule.closeTime, "HH:mm", selectedDate);
    const now = new Date();
    const minBookingTime = addMinutes(now, minAdvanceReservationHours * 60);

    while (isBefore(currentTime, closeTime)) {
      const timeString = format(currentTime, "HH:mm");
      // Check if the slot is in the future and meets min advance reservation time
      if (isBefore(now, currentTime) && isBefore(minBookingTime, currentTime)) {
         times.push(timeString);
      }
      currentTime = addMinutes(currentTime, timeSlotIntervalMinutes);
    }
    return times;
  }, [selectedDate, restaurantData]);

  useEffect(() => {
    setAvailableTimes(generateAvailableTimes());
    form.setValue("time", ""); // Reset time when date changes
  }, [selectedDate, restaurantData, generateAvailableTimes, form]);


  async function onSubmit(values: BookingFormValues) {
    const bookingDataForFirestore: BookingInput = {
      ...values,
      date: format(values.date, "yyyy-MM-dd"),
      status: 'pending', // Default status for public bookings
    };

    try {
      await addBookingToFirestore(bookingDataForFirestore);
      toast({
        title: "Booking Request Sent!",
        description: "Your reservation request has been received. We'll confirm shortly.",
      });
      form.reset();
    } catch (error) {
      console.error("Failed to create booking:", error);
      toast({
        title: "Booking Failed",
        description: "Could not submit your booking. Please try again or call us directly.",
        variant: "destructive",
      });
    }
  }

  const today = startOfDay(new Date());
  const maxBookingDate = restaurantData?.settings?.bookingLeadTimeDays 
    ? addDays(today, restaurantData.settings.bookingLeadTimeDays) 
    : addDays(today, 90); // Default 90 days if not set

  if (isLoadingData) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="font-body text-lg text-muted-foreground">Loading restaurant information...</p>
      </div>
    );
  }
  
  if (!restaurantData?.settings || !restaurantData?.schedule) {
    return (
       <Alert variant="destructive" className="max-w-2xl mx-auto">
        <Info className="h-4 w-4" />
        <AlertTitle className="font-headline">Service Temporarily Unavailable</AlertTitle>
        <AlertDescription className="font-body">
          We're sorry, but the booking service is currently unavailable as we couldn't load essential restaurant information. Please try again later or contact the restaurant directly.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {restaurantData?.profile?.restaurantName && (
        <div className="text-center">
          {restaurantData.profile.restaurantImageUrl && (
            <Image 
              src={restaurantData.profile.restaurantImageUrl} 
              alt={restaurantData.profile.restaurantName} 
              width={150} 
              height={150} 
              className="mx-auto rounded-lg shadow-md mb-4 object-cover h-36 w-36"
              data-ai-hint="restaurant logo"
            />
          )}
          <h2 className="text-4xl font-headline text-primary">{restaurantData.profile.restaurantName}</h2>
          <p className="font-body text-muted-foreground mt-2">Make your reservation below.</p>
        </div>
      )}
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 p-4 sm:p-8 border rounded-xl shadow-lg bg-card">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
            <FormField
              control={form.control}
              name="guestName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-body flex items-center"><User className="mr-2 h-4 w-4 text-muted-foreground" />Full Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Alex Johnson" {...field} className="font-body" />
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
                    <Input 
                      type="number" 
                      min="1" 
                      max={restaurantData?.settings?.maxGuestsPerBooking || 20} 
                      {...field} 
                      className="font-body" 
                    />
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
                        disabled={(date) => isBefore(date, today) || isBefore(maxBookingDate,date) }
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
                   <Select onValueChange={field.onChange} defaultValue={field.value} disabled={!selectedDate || availableTimes.length === 0}>
                    <FormControl>
                      <SelectTrigger className="font-body">
                        <SelectValue placeholder={!selectedDate ? "Select a date first" : availableTimes.length === 0 ? "No times available" : "Select a time"} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {availableTimes.map(time => (
                        <SelectItem key={time} value={time} className="font-body">
                          {time}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription className="font-body text-xs">
                    {restaurantData?.settings ? `Slots are in ${restaurantData.settings.timeSlotIntervalMinutes}-minute intervals. Min. ${restaurantData.settings.minAdvanceReservationHours}hr advance booking.` : ""}
                  </FormDescription>
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
                    <Input type="email" placeholder="e.g. alex.johnson@example.com" {...field} className="font-body" />
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
                      placeholder="e.g. Celebrating an anniversary, dietary restrictions, etc."
                      className="resize-none font-body"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          <Button type="submit" className="w-full md:w-auto font-body text-lg py-3 btn-subtle-animate bg-accent hover:bg-accent/90 text-accent-foreground" disabled={form.formState.isSubmitting || isLoadingData}>
            {form.formState.isSubmitting ? (
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
    </div>
  );
}
