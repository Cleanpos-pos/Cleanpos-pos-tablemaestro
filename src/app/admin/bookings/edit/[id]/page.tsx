
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
  const [adminRestaurantName, setAdminRestaurantName] = useState<string>("My Restaurant"); // Initial fallback
  const { toast } = useToast();

  const fetchAdminRestaurantNameInternal = useCallback(async (userId: string) => {
    try {
      const settings = await getSettingsById(userId);
      // getSettingsById should guarantee settings and settings.restaurantName are valid strings
      setAdminRestaurantName(settings.restaurantName); 
    } catch (err) {
      console.error("[EditBookingPage] Error fetching admin's restaurant name:", err);
      setAdminRestaurantName("My Restaurant"); // Consistent fallback on error
    }
  }, []);

  useEffect(() => {
    setIsLoading(true); // Set loading true at the start of the effect
    const unsubscribe = auth.onAuthStateChanged(user => {
      if (user && bookingId) {
        const fetchData = async () => {
          setError(null);
          try {
            // Fetch booking
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
              setBooking(null);
            }

            // Fetch admin restaurant name (now that user is confirmed)
            await fetchAdminRestaurantNameInternal(user.uid);

          } catch (err) {
            console.error("[EditBookingPage] Failed to fetch booking or admin name:", err);
            setError(err instanceof Error ? err.message : "An unknown error occurred.");
            setAdminRestaurantName("My Restaurant"); // Fallback on error
            setBooking(null);
          } finally {
            setIsLoading(false);
          }
        };
        fetchData();
      } else if (!user && bookingId) {
        // Booking ID exists, but user logged out or auth state changed to null
        setIsLoading(false);
        setError("User not authenticated. Cannot load booking details or admin info.");
        setAdminRestaurantName("My Restaurant"); // Reset/fallback
        setBooking(null);
      } else if (!bookingId) {
        // No booking ID
        setIsLoading(false);
        setError("No booking ID provided.");
        setAdminRestaurantName("My Restaurant");
        setBooking(null);
      } else {
        // User is null and no bookingId (less likely path if component mounts with bookingId)
         setIsLoading(false);
      }
    });

    return () => unsubscribe(); // Cleanup the auth listener
  }, [bookingId, fetchAdminRestaurantNameInternal]);


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

    // adminRestaurantName state should now be correctly set by fetchAdminRestaurantNameInternal
    const params = {
      recipientEmail: booking.guestEmail,
      adminUserUID: auth.currentUser.uid,
      adminRestaurantName: adminRestaurantName, // Uses the state variable
      bookingDetails: {
        guestName: booking.guestName,
        date: booking.date, 
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
