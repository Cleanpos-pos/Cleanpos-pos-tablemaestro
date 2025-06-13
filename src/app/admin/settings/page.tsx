
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
import { Save, Settings as SettingsIcon, Clock, Users, CalendarDays, Percent, Image as ImageIcon, Building, Loader2, GalleryHorizontalEnd } from "lucide-react";
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
  restaurantGalleryUrls: z.array(z.string().url("Invalid URL for gallery image.").nullable()).max(6, "Maximum 6 gallery images.").optional().default(Array(6).fill(null)),
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
  restaurantGalleryUrls: Array(6).fill(null),
};

export default function SettingsPage() {
  const { toast } = useToast();
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [galleryImageFiles, setGalleryImageFiles] = useState<(File | null)[]>(Array(6).fill(null));
  const [galleryImagePreviews, setGalleryImagePreviews] = useState<(string | null)[]>(Array(6).fill(null));
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  const form = useForm<CombinedSettings>({
    resolver: zodResolver(combinedSettingsSchema),
    defaultValues: defaultSettingsData,
  });

  const fetchSettings = useCallback(async () => {
    setIsLoading(true);
    console.log("[fetchSettings] Auth state before fetching settings:", auth.currentUser ? auth.currentUser.uid : 'No user logged in');
    if (!auth.currentUser) {
        console.warn("[fetchSettings] No user logged in, using default settings template.");
        // Provide a version of default settings that indicates the user state
        const placeholderSettings = { ...defaultCombinedSettings, restaurantName: "Please Log In" };
        form.reset(placeholderSettings);
        setImagePreview(placeholderSettings.restaurantImageUrl);
        setGalleryImagePreviews([...(placeholderSettings.restaurantGalleryUrls || Array(6).fill(null))]);
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
            restaurantGalleryUrls: (settings.restaurantGalleryUrls && settings.restaurantGalleryUrls.length <= 6 ? settings.restaurantGalleryUrls : Array(6).fill(null)).map(url => url ?? null),
        };
        // Ensure gallery always has 6 slots, filling with null if needed
        if (sanitizedSettings.restaurantGalleryUrls.length < 6) {
            sanitizedSettings.restaurantGalleryUrls = [
                ...sanitizedSettings.restaurantGalleryUrls, 
                ...Array(6 - sanitizedSettings.restaurantGalleryUrls.length).fill(null)
            ];
        } else if (sanitizedSettings.restaurantGalleryUrls.length > 6) {
            sanitizedSettings.restaurantGalleryUrls = sanitizedSettings.restaurantGalleryUrls.slice(0, 6);
        }

        form.reset(sanitizedSettings);
        console.log("[fetchSettings] Settings loaded and form reset:", JSON.stringify(sanitizedSettings));
        setImagePreview(sanitizedSettings.restaurantImageUrl);
        setGalleryImagePreviews([...(sanitizedSettings.restaurantGalleryUrls || Array(6).fill(null))]);
      } else {
        console.warn("[fetchSettings] getRestaurantSettings returned falsy, but should return defaults. Resetting form to defaultSettingsData for safety.");
        const personalizedDefaults = { ...defaultSettingsData, restaurantName: auth.currentUser?.email ? `${auth.currentUser.email}'s Restaurant` : "My New Restaurant" };
        form.reset(personalizedDefaults);
        setImagePreview(personalizedDefaults.restaurantImageUrl);
        setGalleryImagePreviews(Array(6).fill(null));
        toast({
          title: "Using Default Settings",
          description: "No saved settings found. You can configure and save new settings.",
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("[fetchSettings] Error fetching restaurant settings: ", error);
      toast({
        title: "Error Loading Settings",
        description: `Could not retrieve settings: ${errorMessage}. Using default values.`,
        variant: "destructive",
      });
      const errorFallbackSettings = { ...defaultSettingsData, restaurantName: "Error Loading Settings" };
      form.reset(errorFallbackSettings); 
      setImagePreview(errorFallbackSettings.restaurantImageUrl);
      setGalleryImagePreviews(Array(6).fill(null));
    } finally {
      setIsLoading(false);
      console.log("[fetchSettings] Finished loading settings, isLoading set to false.");
    }
  }, [form, toast]);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(user => {
      if (user) {
        console.log("[useEffect onAuthStateChanged] User is authenticated, fetching settings.");
        fetchSettings();
      } else {
        console.log("[useEffect onAuthStateChanged] No user authenticated. Resetting form, clearing previews.");
        setIsLoading(false);
        const placeholderSettings = { ...defaultSettingsData, restaurantName: "Please Log In To Manage Settings" };
        form.reset(placeholderSettings); 
        setImagePreview(null);
        setGalleryImagePreviews(Array(6).fill(null));
      }
    });
    return () => unsubscribe();
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
      if (!form.formState.isDirty) {
        form.setValue("restaurantName", form.getValues("restaurantName"), { shouldDirty: true });
      }
    } else {
        setImageFile(null);
        setImagePreview(null); 
        form.setValue("restaurantImageUrl", null, { shouldDirty: true });
    }
  };

  const handleGalleryImageChange = (event: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const file = event.target.files?.[0];
    const newGalleryImageFiles = [...galleryImageFiles];
    const newGalleryImagePreviews = [...galleryImagePreviews];

    if (file) {
      newGalleryImageFiles[index] = file;
      const reader = new FileReader();
      reader.onloadend = () => {
        newGalleryImagePreviews[index] = reader.result as string;
        setGalleryImagePreviews(newGalleryImagePreviews);
      };
      reader.readAsDataURL(file);
      if (!form.formState.isDirty) {
         form.setValue("restaurantName", form.getValues("restaurantName"), { shouldDirty: true });
      }
    } else { 
      newGalleryImageFiles[index] = null;
      newGalleryImagePreviews[index] = null; 
      setGalleryImagePreviews(newGalleryImagePreviews);
      const currentGalleryUrls = [...(form.getValues("restaurantGalleryUrls") || Array(6).fill(null))];
      currentGalleryUrls[index] = null;
      form.setValue("restaurantGalleryUrls", currentGalleryUrls, { shouldDirty: true });
    }
    setGalleryImageFiles(newGalleryImageFiles);
  };

  async function onSubmit(values: CombinedSettings) {
    console.log("[onSubmit] Triggered. Raw form values:", JSON.stringify(values));
    console.log("[onSubmit] Current imageFile:", imageFile ? imageFile.name : 'null');
    console.log("[onSubmit] Current galleryImageFiles:", galleryImageFiles.map(f => f ? f.name : 'null'));

    if (!auth.currentUser) {
      toast({
        title: "Authentication Error",
        description: "You must be logged in as an admin to save settings. Please log in again.",
        variant: "destructive",
      });
      console.error("[onSubmit] Save settings failed: User not authenticated.");
      setIsSaving(false); // Explicitly stop saving indication
      return;
    }
    const userId = auth.currentUser.uid;
    console.log("[onSubmit] Authenticated user for save:", userId);

    setIsSaving(true);
    console.log("[onSubmit] setIsSaving(true)");
    
    const settingsToSave: CombinedSettings = { ...values };
    settingsToSave.restaurantName = values.restaurantName ?? null;
    settingsToSave.restaurantImageUrl = values.restaurantImageUrl ?? null; // Keep existing URL if no new file & not cleared
    settingsToSave.restaurantGalleryUrls = (values.restaurantGalleryUrls ?? Array(6).fill(null)).map(url => url ?? null);


    try {
      console.log("[onSubmit] Entering try block. Main imageFile:", imageFile ? imageFile.name : 'null');
      if (imageFile) {
        console.log("[onSubmit] Attempting to upload new main restaurant image...");
        const timestamp = Date.now();
        const uniqueFileName = `profileImage_${timestamp}.${imageFile.name.split('.').pop()}`;
        const imagePath = `restaurant/${userId}/${uniqueFileName}`;
        console.log("[onSubmit] Uploading main image to path:", imagePath);
        const newUploadedUrl = await uploadImageAndGetURL(imageFile, imagePath);
        console.log("[onSubmit] Main image uploaded successfully. New URL:", newUploadedUrl);
        settingsToSave.restaurantImageUrl = newUploadedUrl;
      } else if (imagePreview === null && values.restaurantImageUrl !== null) { 
        // User cleared the preview and there was an existing image URL, so set to null
        console.log("[onSubmit] Main image preview cleared, setting restaurantImageUrl to null.");
        settingsToSave.restaurantImageUrl = null;
      }
      // If imageFile is null AND imagePreview has a value, means existing image is kept (already in settingsToSave.restaurantImageUrl from form values).

      console.log("[onSubmit] Processing gallery images. GalleryImageFiles:", galleryImageFiles.map(f => f ? f.name : 'null'));
      const finalGalleryUrls: (string | null)[] = [...settingsToSave.restaurantGalleryUrls]; 
      
      let galleryUploadOccurred = false;
      for (let i = 0; i < 6; i++) {
        const file = galleryImageFiles[i];
        console.log(`[onSubmit] Gallery slot ${i}: File present - ${!!file}, Current form URL - ${finalGalleryUrls[i]}`);
        if (file) { 
          galleryUploadOccurred = true;
          const timestamp = Date.now();
          const uniqueFileName = `gallery_slot_${i}_${timestamp}_${file.name.replace(/\s+/g, '_')}`;
          const galleryImagePath = `restaurant/${userId}/gallery/${uniqueFileName}`;
          try {
            console.log(`[onSubmit] Uploading gallery image for slot ${i} to path: ${galleryImagePath}`);
            const uploadedUrl = await uploadImageAndGetURL(file, galleryImagePath);
            finalGalleryUrls[i] = uploadedUrl;
            console.log(`[onSubmit] Gallery slot ${i} uploaded: ${uploadedUrl}`);
          } catch (uploadError) {
            console.error(`[onSubmit] Failed to upload gallery image for slot ${i}:`, uploadError);
            toast({
              title: `Gallery Image Slot ${i + 1} Upload Failed`,
              description: uploadError instanceof Error ? uploadError.message : "Could not upload image.",
              variant: "destructive",
            });
            // Keep original URL from form if upload fails
            // finalGalleryUrls[i] is already settingsToSave.restaurantGalleryUrls[i]
          }
        } else if (settingsToSave.restaurantGalleryUrls[i] === null && galleryImagePreviews[i] === null) {
           // This means the slot was explicitly cleared by the user
           finalGalleryUrls[i] = null;
        }
      }
      settingsToSave.restaurantGalleryUrls = finalGalleryUrls;
      
      console.log("[onSubmit] Attempting to save settings to Firestore with data:", JSON.stringify(settingsToSave));
      await saveRestaurantSettings(settingsToSave); 
      console.log("[onSubmit] Settings saved successfully to Firestore.");
      toast({
        title: "Settings Updated",
        description: "Restaurant settings have been successfully saved.",
      });

      const newFormValues = { ...settingsToSave };
      form.reset(newFormValues, { keepDirty: false, keepValues: false }); 
      console.log("[onSubmit] Form reset with new values:", JSON.stringify(newFormValues));
      
      setImageFile(null); 
      setImagePreview(newFormValues.restaurantImageUrl); // Update preview to saved URL
      setGalleryImageFiles(Array(6).fill(null)); 
      setGalleryImagePreviews([...(newFormValues.restaurantGalleryUrls || Array(6).fill(null))]); // Update previews to saved URLs
      console.log("[onSubmit] Local file and preview states reset.");

    } catch (error) {
      const errMessage = error instanceof Error ? error.message : String(error);
      console.error("[onSubmit] Error caught in main try-catch:", errMessage, error);
      toast({
        title: "Save Failed",
        description: `Could not save settings: ${errMessage}. Please check logs and Firebase Storage rules.`,
        variant: "destructive",
      });
    } finally {
      console.log("[onSubmit] Entering finally block. Setting setIsSaving(false).");
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

              <FormField
                control={form.control}
                name="restaurantGalleryUrls"
                render={() => ( 
                <FormItem className="md:col-span-2 pt-4">
                  <FormLabel className="font-body text-lg flex items-center">
                    <GalleryHorizontalEnd className="mr-2 h-5 w-5 text-muted-foreground" />
                    Restaurant Gallery (Up to 6 images)
                  </FormLabel>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-2">
                    {Array.from({ length: 6 }).map((_, index) => (
                      <div key={index} className="space-y-2">
                        <FormControl>
                          <Input
                            type="file"
                            accept="image/png, image/jpeg, image/webp"
                            onChange={(e) => handleGalleryImageChange(e, index)}
                            className="font-body file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                          />
                        </FormControl>
                        {galleryImagePreviews[index] ? (
                          <div className="relative w-full aspect-video rounded-md overflow-hidden border shadow-sm">
                            <Image src={galleryImagePreviews[index]!} alt={`Gallery image ${index + 1} preview`} layout="fill" objectFit="cover" data-ai-hint="food interior" />
                          </div>
                        ) : (
                          <div className="relative w-full aspect-video rounded-md overflow-hidden border shadow-sm flex items-center justify-center bg-muted/30">
                            <ImageIcon className="h-12 w-12 text-muted-foreground" />
                          </div>
                        )}
                        {form.formState.errors.restaurantGalleryUrls && typeof form.formState.errors.restaurantGalleryUrls === 'object' && (form.formState.errors.restaurantGalleryUrls as any)[index] && (
                            <FormMessage>
                                {(form.formState.errors.restaurantGalleryUrls as any)[index]?.message}
                            </FormMessage>
                        )}
                      </div>
                    ))}
                  </div>
                  <FormDescription className="font-body mt-2">Upload images for your restaurant's gallery. Max 5MB each. Clear an input to remove an image.</FormDescription>
                   <FormMessage> 
                    {typeof form.formState.errors.restaurantGalleryUrls?.message === 'string' && form.formState.errors.restaurantGalleryUrls.message}
                   </FormMessage>
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

