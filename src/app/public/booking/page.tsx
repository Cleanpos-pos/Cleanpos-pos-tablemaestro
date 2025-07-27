
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Utensils, Calendar as CalendarIcon, Clock, Users, User, Mail, Phone, StickyNote, Loader2, AlertTriangle } from "lucide-react";
import { format, add, set } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import type { BookingInput, RestaurantSchedule, CombinedSettings } from "@/lib/types";
import { addBookingToFirestore } from "@/services/bookingService";
import { useRouter } from "next/navigation";
import React, { useEffect, useState, useMemo } from "react";
import { getPublicRestaurantSchedule, getPublicRestaurantSettings } from "@/services/settingsService";
import Link from "next/link";


const publicBookingFormSchema = z.object({
  guestName: z.string().min(2, "Name must be at least 2 characters."),
  partySize: z.coerce.number().min(1, "At least 1 guest."),
  date: z.date({
    required_error: "A date for your booking is required.",
  }),
  time: z.string({ required_error: "Please select a time."}),
  guestEmail: z.string().email("Invalid email address.").optional().or(z.literal('')),
  guestPhone: z.string().min(10, "Phone number seems too short.").optional().or(z.literal('')),
  notes: z.string().max(200, "Notes cannot exceed 200 characters.").optional().or(z.literal('')),
}).refine(data => data.guestEmail || data.guestPhone, {
    message: "Either an email or a phone number is required.",
    path: ["guestEmail"],
});

type PublicBookingFormValues = z.infer<typeof publicBookingFormSchema>;

export default function PublicBookingPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [schedule, setSchedule] = useState<RestaurantSchedule | null>(null);
  const [settings, setSettings] = useState<CombinedSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const form = useForm<PublicBookingFormValues>({
    resolver: zodResolver(publicBookingFormSchema),
    defaultValues: {
      guestName: "",
      partySize: 2,
      guestEmail: "",
      guestPhone: "",
      notes: "",
    },
  });

  useEffect(() => {
    const fetchInitialData = async () => {
      setIsLoading(true);
      try {
        const [fetchedSchedule, fetchedSettings] = await Promise.all([
            getPublicRestaurantSchedule(),
            getPublicRestaurantSettings()
        ]);
        setSchedule(fetchedSchedule);
        setSettings(fetchedSettings);
        form.setValue("partySize", Math.min(2, fetchedSettings.maxGuestsPerBooking));
      } catch (error) {
        console.error("Failed to fetch public restaurant data:", error);
        toast({
          title: "Error",
          description: "Could not load restaurant information. Please try again later.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };
    fetchInitialData();
  }, [toast, form]);

  const selectedDate = form.watch("date");

  const availableTimeSlots = useMemo(() => {
    if (!selectedDate || !schedule || !settings) return [];
    
    const dayOfWeek = format(selectedDate, "EEEE").toLowerCase() as DaySchedule['dayOfWeek'];
    const daySchedule = schedule.find(d => d.dayOfWeek === dayOfWeek);

    if (!daySchedule || !daySchedule.isOpen) return [];

    const now = new Date();
    const minBookingDateTime = add(now, { hours: settings.minAdvanceReservationHours });

    const slots: string[] = [];
    daySchedule.timeSlots.forEach(slot => {
        let currentTime = set(selectedDate, { hours: parseInt(slot.startTime.split(':')[0]), minutes: parseInt(slot.startTime.split(':')[1])});
        const endTime = set(selectedDate, { hours: parseInt(slot.endTime.split(':')[0]), minutes: parseInt(slot.endTime.split(':')[1])});

        while(currentTime < endTime) {
            if (currentTime > minBookingDateTime) {
                slots.push(format(currentTime, "HH:mm"));
            }
            currentTime = add(currentTime, { minutes: settings.timeSlotIntervalMinutes });
        }
    });
    return slots;
  }, [selectedDate, schedule, settings]);


  async function onSubmit(values: PublicBookingFormValues) {
    const bookingDataForFirestore: BookingInput = {
      ...values,
      date: format(values.date, "yyyy-MM-dd"),
      status: 'pending', 
    };

    try {
      const newBookingId = await addBookingToFirestore(bookingDataForFirestore);
      toast({
        title: "Booking Request Sent!",
        description: "Your request has been sent to the restaurant. You will be redirected to a status page.",
      });
      router.push(`/public/booking/${newBookingId}/status`);
    } catch (error) {
      console.error("Failed to submit booking:", error);
      toast({
        title: "Submission Failed",
        description: `Could not submit your booking request. Error: ${error instanceof Error ? error.message : "Unknown error"}`,
        variant: "destructive",
      });
    }
  }
  
  if (isLoading) {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-background">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="mt-4 font-body text-muted-foreground">Loading restaurant details...</p>
        </div>
    );
  }
  
  if (!settings || !schedule) {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4 text-center">
            <AlertTriangle className="h-12 w-12 text-destructive" />
            <h2 className="mt-4 text-xl font-headline text-destructive">Could Not Load Restaurant Information</h2>
            <p className="mt-2 font-body text-muted-foreground">
                The booking form can't be displayed right now. This is likely due to a configuration issue.
                Please try again later.
            </p>
        </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-primary/10 via-background to-background p-4 sm:p-8">
      <Card className="w-full max-w-2xl shadow-2xl rounded-xl form-interaction-animate">
        <CardHeader className="text-center p-8 bg-primary/5">
          <div className="inline-block mx-auto mb-4">
            <Utensils className="h-12 w-12 text-primary" />
          </div>
          <CardTitle className="text-3xl font-headline">Book a Table at {settings.restaurantName || "Our Restaurant"}</CardTitle>
          <CardDescription className="font-body">
            We look forward to hosting you. Please fill out the form below.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-8">
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
                                <Input type="number" min="1" max={settings.maxGuestsPerBooking} {...field} className="font-body" />
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
                                disabled={(date) =>
                                    date < new Date(new Date().setHours(0,0,0,0)) || date > add(new Date(), { days: settings.bookingLeadTimeDays })
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
                            <Select onValueChange={field.onChange} defaultValue={field.value} disabled={availableTimeSlots.length === 0}>
                            <FormControl>
                                <SelectTrigger className="font-body">
                                <SelectValue placeholder={availableTimeSlots.length === 0 ? "Select a date first" : "Select a time slot"} />
                                </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                {availableTimeSlots.map(time => (
                                <SelectItem key={time} value={time} className="font-body">
                                    {time}
                                </SelectItem>
                                ))}
                                {availableTimeSlots.length === 0 && selectedDate && <p className="p-2 text-xs text-muted-foreground">No available slots for this day.</p>}
                            </SelectContent>
                            </Select>
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
                                <Input type="email" placeholder="e.g. jane.smith@example.com" {...field} className="font-body" />
                            </FormControl>
                            <FormDescription className="text-xs">Required for confirmation.</FormDescription>
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
                            <Input type="tel" placeholder="e.g. (555) 987-6543" {...field} className="font-body" />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                     <FormField
                        control={form.control}
                        name="notes"
                        render={({ field }) => (
                        <FormItem className="md:col-span-2">
                            <FormLabel className="font-body flex items-center"><StickyNote className="mr-2 h-4 w-4 text-muted-foreground" />Special Requests (Optional)</FormLabel>
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
                </div>
              <Button type="submit" className="w-full font-body text-lg py-6 btn-subtle-animate bg-accent hover:bg-accent/90 text-accent-foreground" disabled={form.formState.isSubmitting || isLoading}>
                {form.formState.isSubmitting ? (
                    <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Submitting Request...
                    </>
                ) : (
                  "Request Reservation"
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
       <footer className="mt-8 text-center text-muted-foreground text-sm font-body">
        <p>&copy; {new Date().getFullYear()} Your Restaurant Name. All rights reserved.</p>
        <Link href="/" className="text-primary hover:underline">Back to Home</Link>
      </footer>
    </div>
  );
}

