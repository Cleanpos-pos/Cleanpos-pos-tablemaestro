
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
import { Save, Settings as SettingsIcon, Clock, Users, CalendarDays, Percent, Image as ImageIcon, Building, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { ReservationSettings, RestaurantProfileSettings, CombinedSettings } from "@/lib/types";
import Image from "next/image";
import React, { useState, useEffect, useCallback } from "react";
import { getRestaurantSettings, saveRestaurantSettings } from "@/services/settingsService";
import { uploadImageAndGetURL } from "@/services/storageService";
import { auth } from "@/config/firebase"; 

const reservationSettingsSchema = z.object({
  minAdvanceReservationHours: z.coerce.number().min(0, "Cannot be negative.").max(168, "Max 1 week."),
  maxReservationDurationHours: z.coerce.number().min(0.5, "Minimum 30 minutes.").max(8, "Max 8 hours."),
  maxGuestsPerBooking: z.coerce.number().min(1, "Minimum 1 guest.").max(50, "Max 50 guests."),
  timeSlotIntervalMinutes: z.coerce.number().min(5, "Minimum 5 minutes.").max(120, "Max 2 hours.").refine(val => [15,30,45,60,90,120].includes(val), {message: "Common intervals: 15, 30, 45, 60, 90, 120 min."}),
  bookingLeadTimeDays: z.coerce.number().min(1, "Minimum 1 day.").max(365, "Max 1 year."),
});

const restaurantProfileSchema = z.object({
  restaurantName: z.string().min(1, "Restaurant name is required.").max(100).optional(),
  restaurantImageUrl: z.string().url("Invalid URL.").optional().nullable(),
});

const combinedSettingsSchema = reservationSettingsSchema.merge(restaurantProfileSchema);

const defaultSettingsData: CombinedSettings = {
  minAdvanceReservationHours: 2,
  maxReservationDurationHours: 2.5,
  maxGuestsPerBooking: 10,
  timeSlotIntervalMinutes: 30,
  bookingLeadTimeDays: 90,
  restaurantName: "Table Maestro Restaurant",
  restaurantImageUrl: null,
};

export default function SettingsPage() {
  const { toast } = useToast();
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false); // Changed from isSubmitting to isUploading for clarity
  
  const form = useForm<CombinedSettings>({
    resolver: zodResolver(combinedSettingsSchema),
    defaultValues: defaultSettingsData,
  });

  const fetchSettings = useCallback(async () => {
    setIsLoading(true);
    console.log("Admin Settings Page: Auth state before fetching settings:", auth.currentUser ? auth.currentUser.uid : 'No user logged in');
    try {
      const settings = await getRestaurantSettings();
      if (settings) {
        form.reset(settings);
        if (settings.restaurantImageUrl) {
          setImagePreview(settings.restaurantImageUrl);
        } else {
          setImagePreview(null);
        }
      } else {
        form.reset(defaultSettingsData);
        setImagePreview(defaultSettingsData.restaurantImageUrl || null);
        toast({
          title: "No Saved Settings Found",
          description: "Using default settings. You can save new settings here.",
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("Error fetching restaurant settings: ", error);
      toast({
        title: "Error Loading Settings",
        description: `Could not retrieve settings: ${errorMessage}. Using default values.`,
        variant: "destructive",
      });
      form.reset(defaultSettingsData);
      setImagePreview(defaultSettingsData.restaurantImageUrl || null);
    } finally {
      setIsLoading(false);
    }
  }, [form, toast]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      // When a new file is selected, we anticipate its URL will replace the current one.
      // So, we set the form's restaurantImageUrl to null. It will be updated with the new URL after upload.
      form.setValue("restaurantImageUrl", null, { shouldValidate: true, shouldDirty: true });
    }
  };

  async function onSubmit(values: CombinedSettings) {
    console.log("onSubmit triggered. Form values:", values, "Selected image file:", imageFile);

    if (!auth.currentUser) {
      toast({
        title: "Authentication Error",
        description: "You must be logged in as an admin to save settings. Please log in again.",
        variant: "destructive",
      });
      console.error("Save settings failed: User not authenticated.");
      return; // Stop if not authenticated
    }
    console.log("Authenticated user for save:", auth.currentUser.uid);

    setIsUploading(true); // Indicate that an operation (upload or save) is in progress
    
    // Initialize settingsToSave with current form values
    const settingsToSave: CombinedSettings = { ...values };

    try {
      if (imageFile) {
        console.log("Attempting to upload new image...");
        const timestamp = Date.now();
        const uniqueFileName = `profileImage_${timestamp}.${imageFile.name.split('.').pop()}`;
        const newUploadedUrl = await uploadImageAndGetURL(imageFile, `restaurant/${uniqueFileName}`);
        console.log("Image uploaded successfully. New URL:", newUploadedUrl);
        settingsToSave.restaurantImageUrl = newUploadedUrl; // Update with new URL
        setImageFile(null); // Clear the file input state, as it's now uploaded
      } else {
        // No new file to upload. values.restaurantImageUrl already reflects the desired state:
        // - It's the existing URL if no changes were made to the image.
        // - It's null if the user selected a new file (which nulled it via handleImageChange) and then removed the selection without submitting.
        // - It's null if the user explicitly cleared an existing image (if such UI existed).
        // So, settingsToSave.restaurantImageUrl is already correctly set from `...values`.
        console.log("No new image file to upload. Using restaurantImageUrl from form values:", values.restaurantImageUrl);
      }

      console.log("Attempting to save settings to Firestore:", settingsToSave);
      await saveRestaurantSettings(settingsToSave);
      console.log("Settings saved successfully to Firestore.");
      toast({
        title: "Settings Updated",
        description: "Restaurant settings have been successfully saved.",
      });

      // Update preview to reflect the saved state
      setImagePreview(settingsToSave.restaurantImageUrl || null);
      form.reset(settingsToSave, { keepValues: false, keepDirty: false, keepDefaultValues: false }); // Reset form with new saved values

    } catch (error) {
      const errMessage = error instanceof Error ? error.message : String(error);
      console.error("Failed to save settings in onSubmit:", errMessage, error);
      toast({
        title: "Save Failed",
        description: `Could not save settings: ${errMessage}. Please check console for details.`,
        variant: "destructive",
      });
    } finally {
      console.log("onSubmit finally block. Resetting loading state.");
      setIsUploading(false); // Reset loading state
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-lg font-body">Loading settings...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-headline text-foreground">Restaurant Settings</h1>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-10">
          <Card className="shadow-lg rounded-xl form-interaction-animate">
            <CardHeader>
              <CardTitle className="font-headline flex items-center">
                <Building className="mr-3 h-6 w-6 text-primary" />
                Restaurant Profile
              </CardTitle>
              <CardDescription className="font-body">
                Manage your restaurant's basic information and branding.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <FormField
                control={form.control}
                name="restaurantName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-body">Restaurant Name</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Your Restaurant's Name" className="font-body" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormItem>
                <FormLabel className="font-body flex items-center"><ImageIcon className="mr-2 h-4 w-4 text-muted-foreground" />Restaurant Image/Logo</FormLabel>
                <FormControl>
                  <Input type="file" accept="image/png, image/jpeg, image/webp" onChange={handleImageChange} className="font-body file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20" />
                </FormControl>
                {imagePreview && (
                  <div className="mt-4 relative w-48 h-48 rounded-md overflow-hidden border shadow-sm">
                    <Image src={imagePreview} alt="Restaurant preview" layout="fill" objectFit="cover" />
                  </div>
                )}
                 {!imagePreview && ( // Show placeholder if no preview (could be initial or after clearing)
                  <div className="mt-4 relative w-48 h-48 rounded-md overflow-hidden border shadow-sm flex items-center justify-center bg-muted/30">
                    <ImageIcon className="h-16 w-16 text-muted-foreground" />
                  </div>
                )}
                <FormDescription className="font-body">Upload an image for your restaurant (e.g., logo or a representative photo). Max 2MB.</FormDescription>
                {/* This specific FormMessage might not be directly tied to a Zod field if URL is handled manually */}
                {form.formState.errors.restaurantImageUrl?.message && <p className="text-sm font-medium text-destructive">{form.formState.errors.restaurantImageUrl.message}</p>}
              </FormItem>
            </CardContent>
          </Card>
          
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
            </CardContent>
          </Card>

          <Button type="submit" className="w-full md:w-auto font-body text-lg py-3 btn-subtle-animate bg-accent hover:bg-accent/90 text-accent-foreground" disabled={isUploading || isLoading || form.formState.isSubmitting}>
            {isUploading || form.formState.isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-5 w-5" /> Save Settings
              </>
            )}
          </Button>
        </form>
      </Form>
    </div>
  );
}
