
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
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { CalendarIcon, User, Mail, Phone, Clock, Users, StickyNote, Send, Loader2, Utensils } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import type { BookingInput } from "@/lib/types";
import { addBookingToFirestore } from "@/services/bookingService";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const publicBookingFormSchema = z.object({
  guestName: z.string().min(2, "Name must be at least 2 characters."),
  guestEmail: z.string().email("Invalid email address."),
  guestPhone: z.string().min(10, "Phone number seems too short.").optional().or(z.literal('')),
  date: z.date({ required_error: "A date is required." }),
  time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid time format (HH:MM)."),
  partySize: z.coerce.number().min(1, "At least 1 guest.").max(20, "For parties larger than 20, please contact us directly."),
  notes: z.string().max(200, "Notes cannot exceed 200 characters.").optional().or(z.literal('')),
});

type PublicBookingFormValues = z.infer<typeof publicBookingFormSchema>;

export default function PublicBookingPage() {
  const { toast } = useToast();
  const router = useRouter();

  const form = useForm<PublicBookingFormValues>({
    resolver: zodResolver(publicBookingFormSchema),
    defaultValues: {
      guestName: "",
      guestEmail: "",
      guestPhone: "",
      date: new Date(),
      time: "19:00",
      partySize: 2,
      notes: "",
    },
  });

  async function onSubmit(values: PublicBookingFormValues) {
    const bookingDataForFirestore: BookingInput = {
      ...values,
      date: format(values.date, "yyyy-MM-dd"),
      status: 'pending', // All public bookings start as pending
    };

    try {
      const newBookingId = await addBookingToFirestore(bookingDataForFirestore);
      toast({
        title: "Request Received!",
        description: "Your booking request has been sent. We will confirm it shortly.",
      });
      // Redirect to the new status page
      router.push(`/public/booking/${newBookingId}/status`);
    } catch (error) {
      console.error("Failed to create booking:", error);
      toast({
        title: "Submission Failed",
        description: `Could not submit your booking request. Please try again. Error: ${error instanceof Error ? error.message : String(error)}`,
        variant: "destructive",
      });
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4 sm:p-8">
      <Card className="w-full max-w-2xl shadow-2xl rounded-xl form-interaction-animate">
        <CardHeader className="text-center p-8 bg-primary text-primary-foreground">
           <div className="flex justify-center mb-4">
              <Utensils className="w-16 h-16 text-primary-foreground" />
            </div>
          <CardTitle className="text-4xl font-headline">Make a Reservation</CardTitle>
          <CardDescription className="font-body text-primary-foreground/90 mt-2">
            We're excited to have you dine with us. Please fill out the form below.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-8">
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
                      <FormLabel className="font-body flex items-center"><Users className="mr-2 h-4 w-4 text-muted-foreground" />Number of Guests</FormLabel>
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
                            disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
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
                      <FormLabel className="font-body flex items-center"><Mail className="mr-2 h-4 w-4 text-muted-foreground" />Email Address</FormLabel>
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
                      <FormLabel className="font-body flex items-center"><Phone className="mr-2 h-4 w-4 text-muted-foreground" />Phone Number (Optional)</FormLabel>
                      <FormControl>
                        <Input type="tel" placeholder="e.g. (555) 987-6543" {...field} className="font-body" />
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
                          placeholder="e.g. Birthday celebration, allergy information, etc."
                          className="resize-none font-body"
                          {...field}
                        />
                      </FormControl>
                       <FormDescription className="font-body text-xs">
                        Let us know if you have any special requirements.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

              <Button type="submit" className="w-full font-body text-lg py-6 btn-subtle-animate bg-accent hover:bg-accent/90 text-accent-foreground" disabled={form.formState.isSubmitting}>
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
        </CardContent>
      </Card>
       <footer className="mt-8 text-center text-muted-foreground text-sm font-body">
        <p>&copy; {new Date().getFullYear()} Your Restaurant Name. All rights reserved.</p>
        <Link href="/" className="text-primary hover:underline">Back to Home</Link>
      </footer>
    </div>
  );
}
