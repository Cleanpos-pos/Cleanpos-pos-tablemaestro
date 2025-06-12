
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray, Controller } from "react-hook-form";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Save, RotateCcw, CalendarDays, Loader2, PlusCircle, Trash2, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { RestaurantSchedule, DaySchedule, TimeSlot } from "@/lib/types";
import { useEffect, useState, useCallback } from "react";
import { getRestaurantSchedule, saveRestaurantSchedule } from "@/services/settingsService";
import { cn } from "@/lib/utils";

const timeRegex = /^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/; // HH:MM format

const timeSlotSchema = z.object({
  name: z.string().min(1, "Slot name is required.").max(50, "Slot name too long."),
  startTime: z.string().regex(timeRegex, "Invalid time format. Use HH:MM"),
  endTime: z.string().regex(timeRegex, "Invalid time format. Use HH:MM"),
}).refine(data => {
  if (data.startTime && data.endTime) {
    return data.startTime < data.endTime;
  }
  return true;
}, { message: "Start time must be before end time.", path: ["endTime"] });

const dayScheduleSchema = z.object({
  dayOfWeek: z.enum(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']),
  isOpen: z.boolean(),
  timeSlots: z.array(timeSlotSchema).optional(), // timeSlots are optional if day is closed
}).refine(data => {
  if (data.isOpen && (!data.timeSlots || data.timeSlots.length === 0)) {
    return false; // If day is open, at least one time slot is required
  }
  return true;
}, { message: "At least one time slot is required if the day is open.", path: ["timeSlots"] });


const restaurantScheduleSchema = z.object({
  schedule: z.array(dayScheduleSchema).length(7),
});

const defaultTimeSlot: TimeSlot = { name: 'Dinner', startTime: '17:00', endTime: '22:00' };

const defaultScheduleData: RestaurantSchedule = [
  { dayOfWeek: 'monday', isOpen: true, timeSlots: [{...defaultTimeSlot}] },
  { dayOfWeek: 'tuesday', isOpen: true, timeSlots: [{...defaultTimeSlot}] },
  { dayOfWeek: 'wednesday', isOpen: true, timeSlots: [{...defaultTimeSlot}] },
  { dayOfWeek: 'thursday', isOpen: true, timeSlots: [{...defaultTimeSlot}] },
  { dayOfWeek: 'friday', isOpen: true, timeSlots: [{ name: 'Dinner', startTime: '17:00', endTime: '23:00' }] },
  { dayOfWeek: 'saturday', isOpen: true, timeSlots: [{ name: 'Lunch', startTime: '12:00', endTime: '15:00' }, { name: 'Dinner', startTime: '17:00', endTime: '23:00' }] },
  { dayOfWeek: 'sunday', isOpen: false, timeSlots: [] },
];

export default function RestaurantSchedulePage() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<z.infer<typeof restaurantScheduleSchema>>({
    resolver: zodResolver(restaurantScheduleSchema),
    defaultValues: {
      schedule: defaultScheduleData,
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "schedule",
  });

  const fetchSchedule = useCallback(async () => {
    setIsLoading(true);
    try {
      const scheduleData = await getRestaurantSchedule();
      if (scheduleData && scheduleData.length === 7) { // Ensure fetched data is valid
        // Ensure all days have timeSlots array, even if empty
        const sanitizedSchedule = scheduleData.map(day => ({
          ...day,
          timeSlots: day.timeSlots || [] 
        }));
        form.reset({ schedule: sanitizedSchedule });
      } else {
        form.reset({ schedule: defaultScheduleData.map(day => ({...day, timeSlots: day.timeSlots || []})) });
        if (scheduleData) { // if data was fetched but invalid
             toast({
                title: "Invalid Schedule Data",
                description: "Fetched schedule data was incomplete. Using default operating hours.",
                variant: "default",
            });
        } else { // No data found
            toast({
                title: "No Saved Schedule Found",
                description: "Using default operating hours. You can save a new schedule.",
                variant: "default",
            });
        }
      }
    } catch (error) {
      console.error("Failed to fetch schedule:", error);
      toast({
        title: "Failed to Load Schedule",
        description: `An error occurred: ${error instanceof Error ? error.message : "Unknown error"}. Using defaults.`,
        variant: "destructive",
      });
      form.reset({ schedule: defaultScheduleData.map(day => ({...day, timeSlots: day.timeSlots || []})) });
    } finally {
      setIsLoading(false);
    }
  }, [form, toast]);

  useEffect(() => {
    fetchSchedule();
  }, [fetchSchedule]);

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
          onClick={() => form.reset({ schedule: defaultScheduleData.map(day => ({...day, timeSlots: day.timeSlots || []})) })} 
          className="font-body btn-subtle-animate"
          disabled={isSubmitting}
        >
          <RotateCcw className="mr-2 h-4 w-4" /> Reset to Default
        </Button>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          {fields.map((dayField, dayIndex) => {
            const dayIsOpen = form.watch(`schedule.${dayIndex}.isOpen`);
            return (
              <Card key={dayField.id} className="shadow-lg rounded-xl form-interaction-animate">
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <CardTitle className="font-headline flex items-center">
                      <CalendarDays className="mr-3 h-6 w-6 text-primary" />
                      {capitalize(dayField.dayOfWeek)}
                    </CardTitle>
                    <FormField
                      control={form.control}
                      name={`schedule.${dayIndex}.isOpen`}
                      render={({ field: checkboxField }) => (
                        <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                           <FormLabel className="font-normal font-body text-sm">
                            {checkboxField.value ? "Open" : "Closed"}
                          </FormLabel>
                          <FormControl>
                            <Checkbox
                              checked={checkboxField.value}
                              onCheckedChange={(checked) => {
                                checkboxField.onChange(checked);
                                if (!checked) {
                                  // Clear time slots if day is marked as closed
                                  form.setValue(`schedule.${dayIndex}.timeSlots`, []);
                                } else if (form.getValues(`schedule.${dayIndex}.timeSlots`).length === 0) {
                                  // Add a default time slot if day is marked open and has no slots
                                  const timeSlotsArray = form.getValues(`schedule.${dayIndex}.timeSlots`);
                                  form.setValue(`schedule.${dayIndex}.timeSlots`, [...timeSlotsArray, {...defaultTimeSlot, name: "New Slot"}]);
                                }
                              }}
                              disabled={isSubmitting}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                   <FormMessage>{form.formState.errors.schedule?.[dayIndex]?.timeSlots?.message}</FormMessage>
                </CardHeader>
                {dayIsOpen && (
                  <CardContent className="space-y-4">
                    <TimeSlotsControl dayIndex={dayIndex} form={form} isSubmitting={isSubmitting} />
                  </CardContent>
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
    </div>
  );
}

// Component to manage time slots for a given day
function TimeSlotsControl({ dayIndex, form, isSubmitting }: { dayIndex: number; form: any; isSubmitting: boolean }) {
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: `schedule.${dayIndex}.timeSlots`,
  });

  return (
    <div className="space-y-4">
      {fields.map((slotField, slotIndex) => (
        <Card key={slotField.id} className="p-4 border rounded-md shadow-sm bg-muted/30">
          <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-4 gap-4 items-end">
            <FormField
              control={form.control}
              name={`schedule.${dayIndex}.timeSlots.${slotIndex}.name`}
              render={({ field }) => (
                <FormItem className="sm:col-span-3 md:col-span-1">
                  <FormLabel className="font-body text-sm">Slot Name</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="e.g. Lunch, Dinner" className="font-body" disabled={isSubmitting} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name={`schedule.${dayIndex}.timeSlots.${slotIndex}.startTime`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-body text-sm flex items-center"><Clock className="mr-1 h-3 w-3" />Start Time</FormLabel>
                  <FormControl>
                    <Input type="time" {...field} className="font-body" disabled={isSubmitting} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name={`schedule.${dayIndex}.timeSlots.${slotIndex}.endTime`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-body text-sm flex items-center"><Clock className="mr-1 h-3 w-3" />End Time</FormLabel>
                  <FormControl>
                    <Input type="time" {...field} className="font-body" disabled={isSubmitting} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => remove(slotIndex)}
              disabled={isSubmitting || fields.length <= 0} 
              className="font-body h-9 btn-subtle-animate"
            >
              <Trash2 className="mr-1 h-4 w-4" /> Remove
            </Button>
          </div>
           {/* Display slot-level specific errors from refine */}
            {form.formState.errors.schedule?.[dayIndex]?.timeSlots?.[slotIndex]?.endTime?.message && (
             <FormMessage className="mt-1 text-xs">
                {form.formState.errors.schedule?.[dayIndex]?.timeSlots?.[slotIndex]?.endTime?.message}
            </FormMessage>
            )}
        </Card>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => append({ name: 'New Slot', startTime: '09:00', endTime: '17:00' })}
        disabled={isSubmitting}
        className="font-body btn-subtle-animate"
      >
        <PlusCircle className="mr-2 h-4 w-4" /> Add Time Slot
      </Button>
    </div>
  );
}
