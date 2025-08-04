

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
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Save, Settings as SettingsIcon, Clock, Users, CalendarDays, Percent, Image as ImageIcon, Building, Loader2, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { CombinedSettings } from "@/lib/types";
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
  restaurantName: z.string().max(100, "Name cannot exceed 100 characters.")
    .transform(val => val === "" ? null : val)
    .nullable()
    .optional()
    .default(null),
  restaurantImageUrl: z.string().url("Invalid URL for main image.").nullable().optional(),
  seoH1: z.string().max(70, "H1 tag should be concise.").transform(val => val === "" ? null : val).nullable().optional(),
  seoMetaDescription: z.string().max(160, "Description should be under 160 characters.").transform(val => val === "" ? null : val).nullable().optional(),
  seoKeywords: z.string().max(250, "Keywords list is too long.").transform(val => val === "" ? null : val).nullable().optional(),
});

const combinedSettingsSchema = reservationSettingsSchema.merge(restaurantProfileSchema);

const defaultSettingsData: CombinedSettings = {
  minAdvanceReservationHours: 2,
  maxReservationDurationHours: 2.5,
  maxGuestsPerBooking: 10,
  timeSlotIntervalMinutes: 30,
  bookingLeadTimeDays: 90,
  restaurantName: "My Restaurant",
  restaurantImageUrl: null,
  seoH1: null,
  seoMetaDescription: null,
  seoKeywords: null,
};

export default function SettingsPage() {
  const { toast } = useToast();
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const form = useForm<CombinedSettings>({
    resolver: zodResolver(combinedSettingsSchema),
    defaultValues: defaultSettingsData,
  });

  const fetchSettings = useCallback(async () => {
    setIsLoading(true);
    console.log("[settingsPage][fetchSettings] Auth state before fetching settings:", auth.currentUser ? auth.currentUser.uid : 'No user logged in');
    if (!auth.currentUser) {
        console.warn("[settingsPage][fetchSettings] No user logged in, using default settings template.");
        const placeholderSettings = { ...defaultSettingsData, restaurantName: "Please Log In" };
        form.reset(placeholderSettings);
        setImagePreview(placeholderSettings.restaurantImageUrl);
        setIsLoading(false);
        return;
    }

    try {
      const settings = await getRestaurantSettings();
      if (settings) {
        const sanitizedSettings: CombinedSettings = {
            minAdvanceReservationHours: settings.minAdvanceReservationHours ?? defaultSettingsData.minAdvanceReservationHours,
            maxReservationDurationHours: settings.maxReservationDurationHours ?? defaultSettingsData.maxReservationDurationHours,
            maxGuestsPerBooking: settings.maxGuestsPerBooking ?? defaultSettingsData.maxGuestsPerBooking,
            timeSlotIntervalMinutes: settings.timeSlotIntervalMinutes ?? defaultSettingsData.timeSlotIntervalMinutes,
            bookingLeadTimeDays: settings.bookingLeadTimeDays ?? defaultSettingsData.bookingLeadTimeDays,
            restaurantName: settings.restaurantName ?? null,
            restaurantImageUrl: settings.restaurantImageUrl ?? null,
            seoH1: settings.seoH1 ?? null,
            seoMetaDescription: settings.seoMetaDescription ?? null,
            seoKeywords: settings.seoKeywords ?? null,
        };

        form.reset(sanitizedSettings);
        console.log("[settingsPage][fetchSettings] Settings loaded and form reset:", JSON.stringify(sanitizedSettings));
        setImagePreview(sanitizedSettings.restaurantImageUrl);
      } else {
        console.warn("[settingsPage][fetchSettings] getRestaurantSettings returned falsy, but should return defaults. Resetting form to defaultSettingsData for safety.");
        const personalizedDefaults = { ...defaultSettingsData, restaurantName: auth.currentUser?.email ? `${auth.currentUser.email}'s Restaurant` : "My New Restaurant" };
        form.reset(personalizedDefaults);
        setImagePreview(personalizedDefaults.restaurantImageUrl);
        toast({
          title: "Using Default Settings",
          description: "No saved settings found. You can configure and save new settings.",
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("[settingsPage][fetchSettings] Error fetching restaurant settings: ", error);
      toast({
        title: "Error Loading Settings",
        description: `Could not retrieve settings: ${errorMessage}. Using default values.`,
        variant: "destructive",
      });
      const errorFallbackSettings = { ...defaultSettingsData, restaurantName: "Error Loading Settings" };
      form.reset(errorFallbackSettings);
      setImagePreview(errorFallbackSettings.restaurantImageUrl);
    } finally {
      setIsLoading(false);
      console.log("[settingsPage][fetchSettings] Finished loading settings, isLoading set to false.");
    }
  }, [form, toast]);

  useEffect(() => {
    console.log("[settingsPage][useEffect] Setting up onAuthStateChanged listener.");
    const unsubscribe = auth.onAuthStateChanged(user => {
      if (user) {
        console.log("[settingsPage][useEffect onAuthStateChanged] User is authenticated, UID:", user.uid, "Fetching settings.");
        fetchSettings();
      } else {
        console.log("[settingsPage][useEffect onAuthStateChanged] No user authenticated. Resetting form, clearing previews.");
        setIsLoading(false);
        const placeholderSettings = { ...defaultSettingsData, restaurantName: "Please Log In To Manage Settings" };
        form.reset(placeholderSettings);
        setImagePreview(null);
      }
    });
    return () => {
      console.log("[settingsPage][useEffect] Unsubscribing from onAuthStateChanged listener.");
      unsubscribe();
    }
  }, [fetchSettings]);


  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      console.log("[settingsPage][handleImageChange] New main image selected:", file.name);
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      if (!form.formState.isDirty) {
        form.setValue("restaurantName", form.getValues("restaurantName"), { shouldDirty: true });
      }
    } else {
        console.log("[settingsPage][handleImageChange] Main image selection cancelled or no file.");
        setImageFile(null);
        setImagePreview(form.getValues("restaurantImageUrl")); // Revert to existing URL if file selection is cancelled
    }
  };

  async function onSubmit(values: CombinedSettings) {
    console.log("[settingsPage][onSubmit] Triggered. Raw form values:", JSON.stringify(values));
    console.log("[settingsPage][onSubmit] Current imageFile:", imageFile ? imageFile.name : 'null');

    if (!auth.currentUser) {
      toast({
        title: "Authentication Error",
        description: "You must be logged in as an admin to save settings. Please log in again.",
        variant: "destructive",
      });
      console.error("[settingsPage][onSubmit] Save settings failed: User not authenticated.");
      setIsSaving(false); // Ensure isSaving is reset
      return;
    }
    const userId = auth.currentUser.uid;
    console.log("[settingsPage][onSubmit] Authenticated user for save:", userId);

    setIsSaving(true);
    console.log("[settingsPage][onSubmit] setIsSaving(true)");

    const settingsToSave: CombinedSettings = { ...values };
    settingsToSave.restaurantName = values.restaurantName ?? null;
    settingsToSave.restaurantImageUrl = values.restaurantImageUrl ?? null;
    settingsToSave.seoH1 = values.seoH1 ?? null;
    settingsToSave.seoMetaDescription = values.seoMetaDescription ?? null;
    settingsToSave.seoKeywords = values.seoKeywords ?? null;

    try {
      console.log("[settingsPage][onSubmit] Entering try block for uploads and save. Main imageFile:", imageFile ? imageFile.name : 'null');
      if (imageFile) {
        console.log("[settingsPage][onSubmit] Attempting to upload new main restaurant image...");
        const timestamp = Date.now();
        const uniqueFileName = `profileImage_${timestamp}.${imageFile.name.split('.').pop()}`;
        const imagePath = `restaurant/${userId}/${uniqueFileName}`;
        console.log("[settingsPage][onSubmit] Uploading main image to path:", imagePath);
        const newUploadedUrl = await uploadImageAndGetURL(imageFile, imagePath);
        console.log("[settingsPage][onSubmit] Main image uploaded successfully. New URL:", newUploadedUrl);
        settingsToSave.restaurantImageUrl = newUploadedUrl;
      } else if (imagePreview === null && form.getValues("restaurantImageUrl") !== null) {
        console.log("[settingsPage][onSubmit] Main image preview cleared, setting restaurantImageUrl to null in settingsToSave.");
        settingsToSave.restaurantImageUrl = null;
      }

      console.log("[settingsPage][onSubmit] Attempting to save settings to Firestore with data:", JSON.stringify(settingsToSave));
      await saveRestaurantSettings(settingsToSave);
      console.log("[settingsPage][onSubmit] Settings saved successfully to Firestore.");
      toast({
        title: "Settings Updated",
        description: "Restaurant settings have been successfully saved.",
      });

      const newFormValues = { ...settingsToSave };
      form.reset(newFormValues, { keepDirty: false, keepValues: false });
      console.log("[settingsPage][onSubmit] Form reset with new values:", JSON.stringify(newFormValues));

      setImageFile(null);
      setImagePreview(newFormValues.restaurantImageUrl);
      console.log("[settingsPage][onSubmit] Local file and preview states reset.");

    } catch (error) {
      const errMessage = error instanceof Error ? error.message : String(error);
      console.error("[settingsPage][onSubmit] Error caught in main try-catch:", errMessage, error);
      toast({
        title: "Save Failed",
        description: `Could not save settings: ${errMessage}. Please check logs and Firebase rules.`,
        variant: "destructive",
      });
    } finally {
      console.log("[settingsPage][onSubmit] Entering finally block. Setting setIsSaving(false).");
      setIsSaving(false);
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
                Manage your restaurant's basic information and branding. This is chosen for display.
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
                      <Input {...field} value={field.value ?? ""} placeholder="Your Restaurant's Name" className="font-body" />
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
                {imagePreview ? (
                  <div className="mt-4 relative w-48 h-48 rounded-md overflow-hidden border shadow-sm">
                    <Image src={imagePreview} alt="Restaurant preview" layout="fill" objectFit="cover" data-ai-hint="logo restaurant" />
                  </div>
                ) : (
                  <div className="mt-4 relative w-48 h-48 rounded-md overflow-hidden border shadow-sm flex items-center justify-center bg-muted/30">
                    <ImageIcon className="h-16 w-16 text-muted-foreground" />
                  </div>
                )}
                <FormDescription className="font-body">Upload an image for your restaurant's main logo or photo. Max 5MB.</FormDescription>
                <FormField
                  control={form.control}
                  name="restaurantImageUrl"
                  render={() => <FormMessage />}
                />
              </FormItem>
            </CardContent>
          </Card>

          <Card className="shadow-lg rounded-xl form-interaction-animate">
            <CardHeader>
                <CardTitle className="font-headline flex items-center">
                    <Search className="mr-3 h-6 w-6 text-primary" />
                    SEO Settings
                </CardTitle>
                <CardDescription className="font-body">
                    Optimize how your restaurant appears on search engines like Google.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <FormField
                    control={form.control}
                    name="seoH1"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel className="font-body">Main Heading (H1)</FormLabel>
                            <FormControl>
                                <Input {...field} value={field.value ?? ""} placeholder="e.g. The Best Italian Restaurant in Town" className="font-body" />
                            </FormControl>
                            <FormDescription>This is the primary headline for your public page. Keep it short and impactful.</FormDescription>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="seoMetaDescription"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel className="font-body">Meta Description</FormLabel>
                            <FormControl>
                                <Textarea {...field} value={field.value ?? ""} placeholder="Describe your restaurant in 1-2 sentences." className="font-body" />
                            </FormControl>
                            <FormDescription>A short summary that appears in search results. Aim for ~155 characters.</FormDescription>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="seoKeywords"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel className="font-body">Keywords</FormLabel>
                            <FormControl>
                                <Input {...field} value={field.value ?? ""} placeholder="italian food, pasta, pizza, fine dining" className="font-body" />
                            </FormControl>
                            <FormDescription>Comma-separated keywords that describe your restaurant and cuisine.</FormDescription>
                            <FormMessage />
                        </FormItem>
                    )}
                />
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

          <Button type="submit" className="w-full md:w-auto font-body text-lg py-3 btn-subtle-animate bg-accent hover:bg-accent/90 text-accent-foreground" disabled={isSaving || isLoading || form.formState.isSubmitting}>
            {isSaving || form.formState.isSubmitting ? (
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
