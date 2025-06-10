
"use client";

import BookingForm from "@/components/public/BookingForm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Utensils } from "lucide-react";
import { getRestaurantSettings, getRestaurantSchedule } from "@/services/settingsService";
import type { CombinedSettings, RestaurantSchedule, RestaurantDetails } from "@/lib/types";
import { useEffect, useState } from "react";
import Image from "next/image";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, Loader2 } from "lucide-react";

export default function PublicBookingPage() {
  const [restaurantName, setRestaurantName] = useState<string | undefined>("Table Maestro Restaurant");
  const [restaurantImageUrl, setRestaurantImageUrl] = useState<string | null>(null);
  const [settings, setSettings] = useState<CombinedSettings | null>(null);
  const [schedule, setSchedule] = useState<RestaurantSchedule | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      setError(null);
      try {
        const fetchedSettings = await getRestaurantSettings();
        const fetchedSchedule = await getRestaurantSchedule();
        
        if (fetchedSettings) {
          setSettings(fetchedSettings);
          setRestaurantName(fetchedSettings.restaurantName || "Table Maestro Restaurant");
          setRestaurantImageUrl(fetchedSettings.restaurantImageUrl || null);
        } else {
           // Use default settings if none are fetched
          setSettings({
            minAdvanceReservationHours: 2,
            maxReservationDurationHours: 2,
            maxGuestsPerBooking: 10,
            timeSlotIntervalMinutes: 30,
            bookingLeadTimeDays: 90,
            restaurantName: "Table Maestro Restaurant",
            restaurantImageUrl: null,
          });
        }
        
        if (fetchedSchedule) {
          setSchedule(fetchedSchedule);
        } else {
          // Use default schedule if none are fetched
          setSchedule([
            { dayOfWeek: 'monday', isOpen: true, openTime: '17:00', closeTime: '22:00' },
            { dayOfWeek: 'tuesday', isOpen: true, openTime: '17:00', closeTime: '22:00' },
            { dayOfWeek: 'wednesday', isOpen: true, openTime: '17:00', closeTime: '22:00' },
            { dayOfWeek: 'thursday', isOpen: true, openTime: '17:00', closeTime: '22:00' },
            { dayOfWeek: 'friday', isOpen: true, openTime: '17:00', closeTime: '23:00' },
            { dayOfWeek: 'saturday', isOpen: true, openTime: '12:00', closeTime: '23:00' },
            { dayOfWeek: 'sunday', isOpen: false, openTime: '12:00', closeTime: '21:00' },
          ]);
        }

      } catch (err) {
        console.error("Failed to load restaurant data:", err);
        setError(err instanceof Error ? err.message : "An unknown error occurred while loading restaurant details.");
         // Set defaults on error as well
        setRestaurantName("Table Maestro Restaurant");
        setRestaurantImageUrl(null);
        setSettings({
            minAdvanceReservationHours: 2,
            maxReservationDurationHours: 2,
            maxGuestsPerBooking: 10,
            timeSlotIntervalMinutes: 30,
            bookingLeadTimeDays: 90,
            restaurantName: "Table Maestro Restaurant",
            restaurantImageUrl: null,
          });
        setSchedule([ /* default schedule */ ]);
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, []);

  return (
    <div className="flex flex-col items-center justify-start min-h-screen bg-background p-4 sm:p-8 pt-12">
      <Card className="w-full max-w-2xl shadow-2xl rounded-xl overflow-hidden">
        <CardHeader className="bg-primary text-center p-6">
          {restaurantImageUrl ? (
            <div className="relative w-full h-48 mb-4 rounded-t-md overflow-hidden">
              <Image src={restaurantImageUrl} alt={`${restaurantName} view`} layout="fill" objectFit="cover" data-ai-hint="restaurant interior" />
            </div>
          ) : (
            <div className="flex justify-center mb-4">
              <Utensils className="w-12 h-12 text-primary-foreground" />
            </div>
          )}
          <CardTitle className="text-3xl font-headline text-primary-foreground">{restaurantName || "Restaurant Booking"}</CardTitle>
          <CardDescription className="text-primary-foreground/80 mt-1 font-body">
            Book your table at {restaurantName || "our restaurant"} easily.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 sm:p-8">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-64">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="mt-4 font-body text-muted-foreground">Loading booking information...</p>
            </div>
          ) : error ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle className="font-headline">Error Loading</AlertTitle>
              <AlertDescription className="font-body">
                There was an issue loading restaurant details: {error} Please try again later.
              </AlertDescription>
            </Alert>
          ) : settings && schedule ? (
            <BookingForm settings={settings} schedule={schedule} />
          ) : (
             <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle className="font-headline">Information Unavailable</AlertTitle>
              <AlertDescription className="font-body">
                Booking information is currently unavailable. Please try again later.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
       <footer className="mt-12 text-center text-muted-foreground text-sm font-body">
        <p>&copy; {new Date().getFullYear()} {restaurantName || "Table Maestro V2"}. All rights reserved.</p>
      </footer>
    </div>
  );
}
