
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/config/firebase";
import type { Booking } from "@/lib/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Utensils, AlertTriangle } from "lucide-react";
import BookingStatusTimeline from "@/components/public/BookingStatusTimeline";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { getBookingById } from "@/services/bookingService";


export default function BookingStatusPage() {
  const params = useParams();
  const bookingId = params.id as string;
  const [booking, setBooking] = useState<Booking | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!bookingId) {
        setError("No booking ID provided.");
        setIsLoading(false);
        return;
    }

    // Initial fetch to get the booking data quickly
    const fetchInitialData = async () => {
        try {
            const initialBooking = await getBookingById(bookingId);
            if (initialBooking) {
                setBooking(initialBooking);
            } else {
                setError("Booking not found.");
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to fetch booking details.");
        } finally {
            setIsLoading(false);
        }
    };
    fetchInitialData();

    // Set up real-time listener for status updates
    const bookingRef = doc(db, "bookings", bookingId);
    const unsubscribe = onSnapshot(bookingRef, (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            setBooking({
                id: docSnap.id,
                ...data,
                date: data.date,
                createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : new Date().toISOString(),
            } as Booking);
            setError(null);
        } else {
            setError("Booking not found. It may have been deleted.");
            setBooking(null);
        }
        if (isLoading) setIsLoading(false); // Stop loading indicator after first snapshot
    }, (err) => {
        console.error("Error listening to booking status:", err);
        setError("Could not get real-time updates for your booking. Please refresh the page.");
        setIsLoading(false);
    });

    // Cleanup listener on component unmount
    return () => unsubscribe();
  }, [bookingId, isLoading]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4 sm:p-8">
      <Card className="w-full max-w-2xl shadow-2xl rounded-xl">
        <CardHeader className="text-center p-8 bg-primary text-primary-foreground">
          <div className="flex justify-center mb-4">
            <Utensils className="w-16 h-16 text-primary-foreground" />
          </div>
          <CardTitle className="text-4xl font-headline">Booking Status</CardTitle>
          <CardDescription className="font-body text-primary-foreground/90 mt-2">
            Track your reservation request in real-time.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-8">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-48">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="mt-4 font-body text-muted-foreground">Loading your booking details...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-48 text-center">
               <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
               <p className="font-headline text-xl text-destructive">Error</p>
               <p className="font-body text-muted-foreground">{error}</p>
            </div>
          ) : booking ? (
            <div className="space-y-6">
              <div className="text-center">
                <h2 className="text-2xl font-headline text-foreground">Hello, {booking.guestName}!</h2>
                <p className="font-body text-muted-foreground">
                  Here's the current status of your booking for {booking.partySize} guest(s) on <span className="font-semibold text-primary">{format(parseISO(booking.date), "MMMM d, yyyy")}</span> at <span className="font-semibold text-primary">{booking.time}</span>.
                </p>
              </div>
              <BookingStatusTimeline currentStatus={booking.status} />
              {booking.status === 'pending' && (
                  <p className="text-center font-body text-sm text-muted-foreground p-4 bg-muted rounded-md">
                      We have received your request and are checking our availability. This page will update automatically.
                  </p>
              )}
               {booking.status === 'confirmed' && (
                  <p className="text-center font-body text-sm text-green-700 p-4 bg-green-50 rounded-md border border-green-200">
                      Your booking is confirmed! We look forward to seeing you. You should also receive a confirmation email.
                  </p>
              )}
              {booking.status === 'cancelled' && (
                  <p className="text-center font-body text-sm text-red-700 p-4 bg-red-50 rounded-md border border-red-200">
                      This booking has been cancelled. If you believe this is an error, please contact us directly.
                  </p>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-48 text-center">
               <p className="font-body text-muted-foreground">Booking details could not be loaded.</p>
            </div>
          )}
        </CardContent>
      </Card>
      <footer className="mt-8 text-center text-muted-foreground text-sm font-body">
         <p>&copy; {new Date().getFullYear()} Your Restaurant Name. All rights reserved.</p>
        <Link href="/" className="text-primary hover:underline">Back to Home</Link>
      </footer>
    </div>
  );
}
