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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Save, Settings as SettingsIcon, Clock, Users, CalendarDays, Percent } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { ReservationSettings } from "@/lib/types";

const reservationSettingsSchema = z.object({
  minAdvanceReservationHours: z.coerce.number().min(0, "Cannot be negative.").max(168, "Max 1 week."), // Max 1 week (168 hours)
  maxReservationDurationHours: z.coerce.number().min(0.5, "Minimum 30 minutes.").max(8, "Max 8 hours."),
  maxGuestsPerBooking: z.coerce.number().min(1, "Minimum 1 guest.").max(50, "Max 50 guests."),
  timeSlotIntervalMinutes: z.coerce.number().min(5, "Minimum 5 minutes.").max(120, "Max 2 hours.").refine(val => [15,30,45,60,90,120].includes(val), {message: "Common intervals: 15, 30, 45, 60, 90, 120 min."}),
  bookingLeadTimeDays: z.coerce.number().min(1, "Minimum 1 day.").max(365, "Max 1 year."),
});

// Default settings data
const defaultSettingsData: ReservationSettings = {
  minAdvanceReservationHours: 2,
  maxReservationDurationHours: 2.5,
  maxGuestsPerBooking: 10,
  timeSlotIntervalMinutes: 30,
  bookingLeadTimeDays: 90,
};

export default function ReservationSettingsPage() {
  const { toast } = useToast();
  const form = useForm<z.infer<typeof reservationSettingsSchema>>({
    resolver: zodResolver(reservationSettingsSchema),
    defaultValues: defaultSettingsData,
  });

  async function onSubmit(values: z.infer<typeof reservationSettingsSchema>) {
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log("Reservation settings updated:", values);
    toast({
      title: "Settings Updated",
      description: "Reservation parameters have been successfully saved.",
    });
  }

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-headline text-foreground">Reservation Settings</h1>

      <Card className="shadow-lg rounded-xl form-interaction-animate">
        <CardHeader>
          <CardTitle className="font-headline flex items-center">
            <SettingsIcon className="mr-3 h-6 w-6 text-primary" />
            Configure Booking Parameters
          </CardTitle>
          <CardDescription className="font-body">
            Adjust these settings to control how reservations are made and managed.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                <FormField
                  control={form.control}
                  name="minAdvanceReservationHours"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-body flex items-center"><Clock className="mr-2 h-4 w-4 text-muted-foreground" />Minimum Advance Reservation (Hours)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.5" {...field} className="font-body" />
                      </FormControl>
                      <FormDescription className="font-body">Minimum hours before desired time a booking can be made.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="maxReservationDurationHours"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-body flex items-center"><Clock className="mr-2 h-4 w-4 text-muted-foreground" />Maximum Reservation Duration (Hours)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.5" {...field} className="font-body" />
                      </FormControl>
                      <FormDescription className="font-body">Maximum length of time a single booking can occupy a table.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="maxGuestsPerBooking"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-body flex items-center"><Users className="mr-2 h-4 w-4 text-muted-foreground" />Maximum Guests per Booking</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} className="font-body" />
                      </FormControl>
                      <FormDescription className="font-body">Largest party size allowed for a single online reservation.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="timeSlotIntervalMinutes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-body flex items-center"><Percent className="mr-2 h-4 w-4 text-muted-foreground" />Time Slot Interval (Minutes)</FormLabel>
                      <FormControl>
                        <Input type="number" step="15" {...field} className="font-body" />
                      </FormControl>
                      <FormDescription className="font-body">Intervals for available booking times (e.g., 15, 30, 60 minutes).</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="bookingLeadTimeDays"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel className="font-body flex items-center"><CalendarDays className="mr-2 h-4 w-4 text-muted-foreground" />Booking Lead Time (Days)</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} className="font-body" />
                      </FormControl>
                      <FormDescription className="font-body">How many days in advance guests can make a reservation.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <Button type="submit" className="w-full md:w-auto font-body text-lg py-3 btn-subtle-animate bg-accent hover:bg-accent/90 text-accent-foreground" disabled={form.formState.isSubmitting}>
                <Save className="mr-2 h-5 w-5" />
                {form.formState.isSubmitting ? "Saving..." : "Save Settings"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
