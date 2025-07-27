
"use client";

import AdminBookingForm from "@/components/admin/AdminBookingForm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { ArrowLeft, Loader2, AlertCircle, MailWarning, Clock4, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useParams } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import type { Booking } from "@/lib/types";
import { getDoc, doc } from "firebase/firestore";
import { db, auth } from "@/config/firebase";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import {
  sendNoAvailabilityEmailForBookingAction,
  sendWaitingListEmailForBookingAction,
  sendBookingConfirmationEmailAction,
  type BookingEmailParams
} from "@/app/actions/emailActions";
import { getRestaurantSettings } from "@/services/settingsService";
import { Badge } from "@/components/ui/badge";

export default function EditBookingPage() {
  const params = useParams();
  const bookingId = params.id as string;
  const [booking, setBooking] = useState<Booking | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [adminRestaurantName, setAdminRestaurantName] = useState<string>("My Restaurant");
  const { toast } = useToast();

  const fetchAdminRestaurantName = useCallback(async (userId: string) => {
    try {
      // getRestaurantSettings implicitly uses auth.currentUser.uid via getSettingsById(user.uid)
      // It's important that getRestaurantSettings itself correctly handles the case where auth.currentUser might be null
      // or fetches settings for the given userId if modified to accept one.
      // For this page, we assume getRestaurantSettings works based on the current auth.currentUser.
      const settings = await getRestaurantSettings();
      setAdminRestaurantName(settings?.restaurantName || "My Restaurant");
    } catch (err) {
      console.error("[EditBookingPage] Error fetching admin's restaurant name:", err);
      setAdminRestaurantName("My Restaurant"); // Fallback
    }
  }, []); // Empty dependency array for useCallback as getRestaurantSettings relies on global auth state.

  useEffect(() => {
    setIsLoading(true);
    const unsubscribe = auth.onAuthStateChanged(user => {
      if (user && bookingId) {
        const fetchData = async () => {
          setError(null);
          try {
            const bookingRef = doc(db, "bookings", bookingId);
            const docSnap = await getDoc(bookingRef);

            if (docSnap.exists()) {
              const data = docSnap.data();
              setBooking({
                id: docSnap.id,
                ...data,
                date: data.date, // Expects string
                createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : new Date().toISOString(),
              } as Booking);
            } else {
              setError("Booking not found.");
              setBooking(null);
            }
            await fetchAdminRestaurantName(user.uid); // Pass user.uid for clarity, though fetchAdminRestaurantName uses global auth
          } catch (err) {
            console.error("[EditBookingPage] Failed to fetch booking or admin name:", err);
            setError(err instanceof Error ? err.message : "An unknown error occurred while fetching data.");
            setAdminRestaurantName("My Restaurant");
            setBooking(null);
          } finally {
            setIsLoading(false);
          }
        };
        fetchData();
      } else if (!user && bookingId) {
        setIsLoading(false);
        setError("User not authenticated. Cannot load booking details or admin info.");
        setAdminRestaurantName("My Restaurant");
        setBooking(null);
      } else if (!bookingId) {
        setIsLoading(false);
        setError("No booking ID provided.");
        setAdminRestaurantName("My Restaurant");
        setBooking(null);
      } else { // Handles user is null and no bookingId, or other initial states
        setIsLoading(false);
        // Potentially set error if user is null and was expected
        if (!user) {
            setError("User not authenticated.");
        }
      }
    });

    return () => unsubscribe();
  }, [bookingId, fetchAdminRestaurantName]);


  const handleSendBookingRelatedEmail = async (type: 'no-availability' | 'waiting-list' | 'confirmation') => {
    if (!booking || !booking.guestEmail) {
      toast({ title: "Error", description: "Booking data or guest email is missing.", variant: "destructive" });
      return;
    }
    if (!auth.currentUser) {
      toast({ title: "Error", description: "Admin not authenticated.", variant: "destructive" });
      return;
    }

    setIsSendingEmail(true);
    let emailTypeDescription = "";
    switch(type) {
      case 'no-availability': emailTypeDescription = 'No Availability'; break;
      case 'waiting-list': emailTypeDescription = 'Waiting List'; break;
      case 'confirmation': emailTypeDescription = 'Booking Confirmation'; break;
      default:
        // This case should ideally not be reached if types are handled correctly
        toast({ title: "Internal Error", description: "Invalid email type specified.", variant: "destructive" });
        setIsSendingEmail(false);
        return;
    }
    toast({ title: "Sending Email...", description: `Preparing to send ${emailTypeDescription} email.`});

    const emailParams: BookingEmailParams = {
      recipientEmail: booking.guestEmail,
      adminUserUID: auth.currentUser.uid,
      adminRestaurantName: adminRestaurantName, // Uses state variable
      bookingDetails: {
        guestName: booking.guestName,
        date: booking.date, // Expected YYYY-MM-DD
        time: booking.time, // Expected HH:MM
        partySize: booking.partySize,
        notes: booking.notes || '', // Ensure notes is always a string, not undefined
      },
    };

    try {
      let result;
      if (type === 'no-availability') {
        result = await sendNoAvailabilityEmailForBookingAction(emailParams);
      } else if (type === 'waiting-list') {
        result = await sendWaitingListEmailForBookingAction(emailParams);
      } else if (type === 'confirmation') {
        result = await sendBookingConfirmationEmailAction(emailParams);
      }
      // 'result' could be undefined if an invalid type was passed and caught by the default switch case above,
      // however, the return there should prevent reaching this point.
      // Adding a check for result to be safe.
      if (result) {
        if (result.success) {
            toast({
              title: (
                <div className="flex items-center gap-2">
                  Email Sent
                  <Badge className="bg-green-500 text-white">Sent</Badge>
                </div>
              ),
              description: `Note: ${emailTypeDescription} email sent to ${booking.guestEmail}.`,
            });
        } else {
            toast({ title: "Email Failed", description: result.message, variant: "destructive" });
        }
      } else {
        // This path implies the email action didn't return a result, which is unexpected
        // if the type was valid.
        toast({ title: "Error", description: "Could not determine email sending outcome for a valid type.", variant: "destructive" });
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
                  onClick={() => handleSendBookingRelatedEmail('confirmation')}
                  disabled={isSendingEmail || !booking.guestEmail}
                  className="font-body btn-subtle-animate"
                >
                  {isSendingEmail ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                  Send Confirmation
                </Button>
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
