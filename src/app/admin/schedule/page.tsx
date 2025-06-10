
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray } from "react-hook-form";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Save, RotateCcw, CalendarDays, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { RestaurantSchedule } from "@/lib/types";
import { useEffect, useState, useCallback } from "react";
import { getRestaurantSchedule, saveRestaurantSchedule } from "@/services/settingsService";

const timeRegex = /^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/; // HH:MM format

const dayScheduleSchema = z.object({
  dayOfWeek: z.enum(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']),
  isOpen: z.boolean(),
  openTime: z.string().regex(timeRegex, "Invalid time format. Use HH:MM").optional(),
  closeTime: z.string().regex(timeRegex, "Invalid time format. Use HH:MM").optional(),
}).refine(data => {
  if (data.isOpen) {
    return !!data.openTime && !!data.closeTime;
  }
  return true;
}, { message: "Open and close times are required if open.", path: ["openTime"] })
.refine(data => {
  if (data.isOpen && data.openTime && data.closeTime) {
    // Ensure direct string comparison works for HH:MM format
    return data.openTime < data.closeTime;
  }
  return true;
}, { message: "Open time must be before close time.", path: ["closeTime"] });

const restaurantScheduleSchema = z.object({
  schedule: z.array(dayScheduleSchema).length(7),
});

const defaultScheduleData: RestaurantSchedule = [
  { dayOfWeek: 'monday', isOpen: true, openTime: '17:00', closeTime: '22:00' },
  { dayOfWeek: 'tuesday', isOpen: true, openTime: '17:00', closeTime: '22:00' },
  { dayOfWeek: 'wednesday', isOpen: true, openTime: '17:00', closeTime: '22:00' },
  { dayOfWeek: 'thursday', isOpen: true, openTime: '17:00', closeTime: '22:00' },
  { dayOfWeek: 'friday', isOpen: true, openTime: '17:00', closeTime: '23:00' },
  { dayOfWeek: 'saturday', isOpen: true, openTime: '12:00', closeTime: '23:00' },
  { dayOfWeek: 'sunday', isOpen: false, openTime: '12:00', closeTime: '21:00' },
];

export default function RestaurantSchedulePage() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<z.infer<typeof restaurantScheduleSchema>>({
    resolver: zodResolver(restaurantScheduleSchema),
    defaultValues: {
      schedule: defaultScheduleData, // Initialize with defaults, will be overwritten
    },
  });

  const fetchSchedule = useCallback(async () => {
    setIsLoading(true);
    try {
      const scheduleData = await getRestaurantSchedule();
      if (scheduleData) {
        form.reset({ schedule: scheduleData });
      } else {
        form.reset({ schedule: defaultScheduleData }); // Reset to defaults if no schedule found
      }
    } catch (error) {
      console.error("Failed to fetch schedule:", error);
      toast({
        title: "Error Loading Schedule",
        description: "Could not load schedule. Using default values.",
        variant: "destructive",
      });
      form.reset({ schedule: defaultScheduleData });
    } finally {
      setIsLoading(false);
    }
  }, [form, toast]);

  useEffect(() => {
    fetchSchedule();
  }, [fetchSchedule]);

  const { fields } = useFieldArray({
    control: form.control,
    name: "schedule",
  });

  async function onSubmit(values: z.infer<typeof restaurantScheduleSchema>) {
    setIsSubmitting(true);
    try {
      await saveRestaurantSchedule(values.schedule);
      toast({
        title: "Schedule Updated",
        description: "The restaurant's operating hours have been successfully saved.",
      });
    } catch (error) {
      console.error("Failed to save schedule:", error);
      toast({
        title: "Save Failed",
        description: "Could not save schedule. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }
  
  const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-lg font-body">Loading schedule...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-headline text-foreground">Restaurant Schedule</h1>
        <Button 
          variant="outline" 
          onClick={() => form.reset({ schedule: defaultScheduleData })} 
          className="font-body btn-subtle-animate"
          disabled={isSubmitting}
        >
          <RotateCcw className="mr-2 h-4 w-4" /> Reset to Default
        </Button>
      </div>

      <Card className="shadow-lg rounded-xl form-interaction-animate">
        <CardHeader>
          <CardTitle className="font-headline flex items-center"><CalendarDays className="mr-3 h-6 w-6 text-primary" />Operating Hours</CardTitle>
          <CardDescription className="font-body">
            Specify the opening hours for each day of the week. Uncheck 'Open' to mark a day as closed.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              {fields.map((field, index) => {
                const dayIsOpen = form.watch(`schedule.${index}.isOpen`);
                return (
                  <Card key={field.id} className="p-6 rounded-lg border shadow-sm">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-center">
                      <FormLabel className="text-lg font-medium font-body md:col-span-1 capitalize">
                        {capitalize(field.dayOfWeek)}
                      </FormLabel>
                      
                      <FormField
                        control={form.control}
                        name={`schedule.${index}.isOpen`}
                        render={({ field: checkboxField }) => (
                          <FormItem className="flex flex-row items-center space-x-3 space-y-0 md:col-span-1">
                            <FormControl>
                              <Checkbox
                                checked={checkboxField.value}
                                onCheckedChange={checkboxField.onChange}
                                disabled={isSubmitting}
                              />
                            </FormControl>
                            <FormLabel className="font-normal font-body">
                              Open
                            </FormLabel>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name={`schedule.${index}.openTime`}
                        render={({ field: timeField }) => (
                          <FormItem className="md:col-span-1">
                            <FormLabel className="sr-only font-body">Open Time</FormLabel>
                            <FormControl>
                              <Input 
                                type="time" 
                                {...timeField} 
                                value={timeField.value || ""}
                                disabled={!dayIsOpen || isSubmitting} 
                                className="font-body"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`schedule.${index}.closeTime`}
                        render={({ field: timeField }) => (
                          <FormItem className="md:col-span-1">
                            <FormLabel className="sr-only font-body">Close Time</FormLabel>
                            <FormControl>
                              <Input 
                                type="time" 
                                {...timeField} 
                                value={timeField.value || ""}
                                disabled={!dayIsOpen || isSubmitting} 
                                className="font-body"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                     {form.formState.errors.schedule?.[index]?.openTime?.message && (
                        <p className="text-sm font-medium text-destructive mt-2 md:ml-[calc(25%+1.5rem)]">
                          {form.formState.errors.schedule[index]?.openTime?.message}
                        </p>
                      )}
                      {form.formState.errors.schedule?.[index]?.closeTime?.message && (
                        <p className="text-sm font-medium text-destructive mt-2 md:ml-[calc(25%+1.5rem)]">
                          {form.formState.errors.schedule[index]?.closeTime?.message}
                        </p>
                      )}
                  </Card>
                );
              })}
              <Button type="submit" className="w-full md:w-auto font-body text-lg py-3 btn-subtle-animate bg-accent hover:bg-accent/90 text-accent-foreground" disabled={isSubmitting || isLoading}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-5 w-5" /> Save Schedule
                  </>
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
