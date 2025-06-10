
"use client";

import AdminBookingForm from "@/components/admin/AdminBookingForm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Loader2, AlertCircle } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { Booking } from "@/lib/types";
import { getDoc, doc } from "firebase/firestore";
import { db } from "@/config/firebase";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function EditBookingPage() {
  const params = useParams();
  const bookingId = params.id as string;
  const [booking, setBooking] = useState<Booking | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (bookingId) {
      const fetchBooking = async () => {
        setIsLoading(true);
        setError(null);
        try {
          const bookingRef = doc(db, "bookings", bookingId);
          const docSnap = await getDoc(bookingRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            setBooking({ 
              id: docSnap.id,
              ...data,
              date: data.date, // Assuming date is stored as YYYY-MM-DD string
              createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : new Date().toISOString(), // Handle Timestamp
            } as Booking);
          } else {
            setError("Booking not found.");
          }
        } catch (err) {
          console.error("Failed to fetch booking:", err);
          setError(err instanceof Error ? err.message : "An unknown error occurred.");
        } finally {
          setIsLoading(false);
        }
      };
      fetchBooking();
    }
  }, [bookingId]);

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
         <Button variant="outline" size="icon" asChild className="btn-subtle-animate">
          <Link href="/admin/bookings">
            <ArrowLeft className="h-4 w-4" />
            <span className="sr-only">Back to Bookings</span>
          </Link>
        </Button>
        <h1 className="text-3xl font-headline text-foreground">Edit Booking</h1>
      </div>
      
      <Card className="shadow-lg rounded-xl">
        <CardHeader>
          <CardTitle className="font-headline">Modify Reservation</CardTitle>
          <CardDescription className="font-body">
            Update the details for booking ID: {bookingId}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-2 font-body">Loading booking details...</p>
            </div>
          ) : error ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle className="font-headline">Error</AlertTitle>
              <AlertDescription className="font-body">{error}</AlertDescription>
            </Alert>
          ) : booking ? (
            <AdminBookingForm existingBooking={booking} />
          ) : (
             <p className="font-body text-center">Booking data could not be loaded.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
