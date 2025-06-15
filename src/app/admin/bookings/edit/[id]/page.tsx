
"use client";

import AdminBookingForm from "@/components/admin/AdminBookingForm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { ArrowLeft, Loader2, AlertCircle, MailWarning, Clock4, Send } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useParams } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import type { Booking } from "@/lib/types";
import { getDoc, doc } from "firebase/firestore";
import { db, auth } from "@/config/firebase";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { sendNoAvailabilityEmailForBookingAction, sendWaitingListEmailForBookingAction } from "@/app/actions/emailActions";
import { getSettingsById } from "@/services/settingsService";

export default function EditBookingPage() {
  const params = useParams();
  const bookingId = params.id as string;
  const [booking, setBooking] = useState<Booking | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [adminRestaurantName, setAdminRestaurantName] = useState<string>("Your Restaurant");
  const { toast } = useToast();

  const fetchAdminRestaurantName = useCallback(async () => {
    if (auth.currentUser) {
      try {
        const settings = await getSettingsById(auth.currentUser.uid);
        setAdminRestaurantName(settings?.restaurantName || "Your Restaurant");
      } catch (err) {
        console.warn("Could not fetch admin's restaurant name for edit booking page.", err);
        setAdminRestaurantName("Your Restaurant"); // Fallback
      }
    }
  }, []);

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
              date: data.date, 
              createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : new Date().toISOString(),
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
      fetchAdminRestaurantName();
    }
  }, [bookingId, fetchAdminRestaurantName]);

  const handleSendBookingRelatedEmail = async (type: 'no-availability' | 'waiting-list') => {
    if (!booking || !booking.guestEmail) {
      toast({ title: "Error", description: "Booking data or guest email is missing.", variant: "destructive" });
      return;
    }
    if (!auth.currentUser) {
      toast({ title: "Error", description: "Admin not authenticated.", variant: "destructive" });
      return;
    }

    setIsSendingEmail(true);
    toast({ title: "Sending Email...", description: `Preparing to send ${type === 'no-availability' ? 'No Availability' : 'Waiting List'} email.`});

    const params = {
      recipientEmail: booking.guestEmail,
      adminUserUID: auth.currentUser.uid,
      adminRestaurantName: adminRestaurantName,
      bookingDetails: {
        guestName: booking.guestName,
        date: booking.date, // This is already YYYY-MM-DD string from Booking type
        time: booking.time,
        partySize: booking.partySize,
      },
    };

    try {
      let result;
      if (type === 'no-availability') {
        result = await sendNoAvailabilityEmailForBookingAction(params);
      } else {
        result = await sendWaitingListEmailForBookingAction(params);
      }

      if (result.success) {
        toast({ title: "Email Sent", description: result.message });
      } else {
        toast({ title: "Email Failed", description: result.message, variant: "destructive" });
      }
    } catch (err) {
      console.error(`Error sending ${type} email:`, err);
      toast({ title: "Error", description: `Failed to send email: ${err instanceof Error ? err.message : 'Unknown error'}`, variant: "destructive" });
    } finally {
      setIsSendingEmail(false);
    }
  };

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
            <>
              <AdminBookingForm existingBooking={booking} />
              <CardFooter className="mt-6 border-t pt-6 flex flex-col sm:flex-row gap-3 justify-start">
                <Button 
                  variant="outline" 
                  onClick={() => handleSendBookingRelatedEmail('no-availability')} 
                  disabled={isSendingEmail || !booking.guestEmail}
                  className="font-body btn-subtle-animate"
                >
                  {isSendingEmail ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MailWarning className="mr-2 h-4 w-4" />}
                  Send 'No Availability'
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => handleSendBookingRelatedEmail('waiting-list')} 
                  disabled={isSendingEmail || !booking.guestEmail}
                  className="font-body btn-subtle-animate"
                >
                  {isSendingEmail ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Clock4 className="mr-2 h-4 w-4" />}
                   Advise 'Added to Waitlist'
                </Button>
              </CardFooter>
              {!booking.guestEmail && (
                <Alert variant="default" className="mt-4 bg-yellow-50 border-yellow-300">
                    <AlertCircle className="h-4 w-4 text-yellow-700" />
                    <AlertTitle className="font-headline text-yellow-800">Guest Email Missing</AlertTitle>
                    <AlertDescription className="font-body text-yellow-700">
                        This booking does not have a guest email address. Email notifications cannot be sent.
                    </AlertDescription>
                </Alert>
              )}
            </>
          ) : (
             <p className="font-body text-center">Booking data could not be loaded.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
