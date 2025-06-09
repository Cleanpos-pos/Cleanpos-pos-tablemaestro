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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarIcon, Clock, Users, User, Mail, Phone } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import type { RestaurantSchedule, ReservationSettings } from "@/lib/types";
import { useEffect, useState } from "react";

const bookingFormSchema = z.object({
  date: z.date({
    required_error: "A date is required.",
  }),
  time: z.string({
    required_error: "A time is required.",
  }),
  partySize: z.coerce.number().min(1, "Party size must be at least 1.").max(10, "Party size cannot exceed 10."), // Example max
  guestName: z.string().min(2, "Name must be at least 2 characters."),
  guestEmail: z.string().email("Invalid email address.").optional(),
  guestPhone: z.string().min(10, "Phone number seems too short.").optional(),
});

interface BookingFormProps {
  // In a real app, these would come from a DB or API
  schedule?: RestaurantSchedule; 
  settings?: ReservationSettings;
}

// Mock data if not provided
const defaultSchedule: RestaurantSchedule = [
  { dayOfWeek: 'monday', isOpen: true, openTime: '17:00', closeTime: '22:00' },
  { dayOfWeek: 'tuesday', isOpen: true, openTime: '17:00', closeTime: '22:00' },
  { dayOfWeek: 'wednesday', isOpen: true, openTime: '17:00', closeTime: '22:00' },
  { dayOfWeek: 'thursday', isOpen: true, openTime: '17:00', closeTime: '22:00' },
  { dayOfWeek: 'friday', isOpen: true, openTime: '17:00', closeTime: '23:00' },
  { dayOfWeek: 'saturday', isOpen: true, openTime: '12:00', closeTime: '23:00' },
  { dayOfWeek: 'sunday', isOpen: true, openTime: '12:00', closeTime: '21:00' },
];

const defaultSettings: ReservationSettings = {
  minAdvanceReservationHours: 1,
  maxReservationDurationHours: 2,
  maxGuestsPerBooking: 8,
  timeSlotIntervalMinutes: 30,
  bookingLeadTimeDays: 30,
};


export default function BookingForm({ schedule = defaultSchedule, settings = defaultSettings }: BookingFormProps) {
  const { toast } = useToast();
  const [availableTimes, setAvailableTimes] = useState<string[]>([]);
  
  const form = useForm<z.infer<typeof bookingFormSchema>>({
    resolver: zodResolver(bookingFormSchema),
    defaultValues: {
      partySize: 2,
      guestName: "",
    },
  });

  const selectedDate = form.watch("date");

  useEffect(() => {
    if (selectedDate) {
      const dayOfWeek = format(selectedDate, "eeee").toLowerCase() as typeof defaultSchedule[0]['dayOfWeek'];
      const daySchedule = schedule.find(s => s.dayOfWeek === dayOfWeek);

      if (daySchedule?.isOpen && daySchedule.openTime && daySchedule.closeTime) {
        const times: string[] = [];
        let currentTime = new Date(`${format(selectedDate, "yyyy-MM-dd")}T${daySchedule.openTime}`);
        const closeTimeDate = new Date(`${format(selectedDate, "yyyy-MM-dd")}T${daySchedule.closeTime}`);
        
        // Ensure bookings are made in the future, considering minAdvanceReservationHours
        const minBookingTime = new Date();
        minBookingTime.setHours(minBookingTime.getHours() + settings.minAdvanceReservationHours);

        while(currentTime < closeTimeDate) {
          if (currentTime > minBookingTime) {
            times.push(format(currentTime, "HH:mm"));
          }
          currentTime.setMinutes(currentTime.getMinutes() + settings.timeSlotIntervalMinutes);
        }
        setAvailableTimes(times);
      } else {
        setAvailableTimes([]);
      }
      form.setValue("time", ""); // Reset time if date changes
    }
  }, [selectedDate, schedule, settings.minAdvanceReservationHours, settings.timeSlotIntervalMinutes, form]);


  async function onSubmit(values: z.infer<typeof bookingFormSchema>) {
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log("Booking submitted:", values);
    toast({
      title: "Reservation Request Sent!",
      description: `Thank you, ${values.guestName}. We've received your request for ${format(values.date, "PPP")} at ${values.time} for ${values.partySize} guest(s). We'll confirm shortly.`,
      variant: "default",
    });
    form.reset();
  }

  const today = new Date();
  today.setHours(0,0,0,0); // Allow booking for today if within opening hours
  const maxBookingDate = new Date();
  maxBookingDate.setDate(today.getDate() + settings.bookingLeadTimeDays);

  return (
    <Card className="w-full shadow-xl rounded-xl form-interaction-animate">
      <CardHeader>
        <CardTitle className="text-2xl font-headline text-center">Make a Reservation</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel className="font-body">Date</FormLabel>
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
                            {field.value ? (
                              format(field.value, "PPP")
                            ) : (
                              <span>Pick a date</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          disabled={(date) =>
                            date < today || date > maxBookingDate || !schedule.find(s => s.dayOfWeek === format(date, "eeee").toLowerCase() as typeof defaultSchedule[0]['dayOfWeek'])?.isOpen
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
                    <FormLabel className="font-body">Time</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value} disabled={!selectedDate || availableTimes.length === 0}>
                      <FormControl>
                        <SelectTrigger className="font-body">
                          <Clock className="mr-2 h-4 w-4 opacity-50" />
                          <SelectValue placeholder="Select a time" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {availableTimes.length > 0 ? availableTimes.map(time => (
                          <SelectItem key={time} value={time} className="font-body">
                            {time}
                          </SelectItem>
                        )) : <SelectItem value="no-times" disabled>No times available</SelectItem>}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="partySize"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-body">Number of Guests</FormLabel>
                    <Select onValueChange={(value) => field.onChange(Number(value))} defaultValue={String(field.value)}>
                      <FormControl>
                        <SelectTrigger className="font-body">
                          <Users className="mr-2 h-4 w-4 opacity-50" />
                          <SelectValue placeholder="Select party size" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {[...Array(settings.maxGuestsPerBooking)].map((_, i) => (
                          <SelectItem key={i + 1} value={String(i + 1)} className="font-body">
                            {i + 1} guest{i + 1 > 1 ? 's' : ''}
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
              name="guestName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-body">Full Name</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input placeholder="e.g. John Doe" {...field} className="pl-10 font-body" />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                control={form.control}
                name="guestEmail"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel className="font-body">Email (Optional)</FormLabel>
                    <FormControl>
                        <div className="relative">
                        <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input type="email" placeholder="e.g. john.doe@example.com" {...field} className="pl-10 font-body" />
                        </div>
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
                    <FormLabel className="font-body">Phone (Optional)</FormLabel>
                    <FormControl>
                        <div className="relative">
                        <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input type="tel" placeholder="e.g. (555) 123-4567" {...field} className="pl-10 font-body" />
                        </div>
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
            </div>
            <Button type="submit" className="w-full font-body text-lg py-6 btn-subtle-animate bg-accent hover:bg-accent/90 text-accent-foreground" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Sending Request..." : "Request Reservation"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
