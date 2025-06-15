
import { db, auth } from '@/config/firebase';
import type { Booking, BookingInput } from '@/lib/types';
import {
  collection,
  getDocs,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  Timestamp,
  query,
  orderBy,
  where,
  serverTimestamp,
  DocumentData,
  QueryDocumentSnapshot,
  getDoc, // Added getDoc
} from 'firebase/firestore';

// Imports for email sending
import { sendEmail, type SendEmailInput } from '@/ai/flows/sendEmailFlow';
import { getEmailTemplate, BOOKING_ACCEPTED_TEMPLATE_ID } from '@/services/templateService';
import { renderSimpleTemplate } from '@/lib/templateUtils';
import { getSettingsById } from '@/services/settingsService';
import { format as formatDateFns, parseISO } from 'date-fns';

const BOOKINGS_COLLECTION = 'bookings';

// Helper to convert Firestore Timestamps to ISO strings and include doc ID
const mapDocToBooking = (docSnap: QueryDocumentSnapshot<DocumentData> | DocumentSnapshot<DocumentData>): Booking => {
  const data = docSnap.data();
  if (!data) {
    // This case should ideally not happen if docSnap.exists() is checked before calling,
    // but as a safeguard for type DocumentSnapshot which might not exist.
    throw new Error(`Document data not found for doc ID: ${docSnap.id}`);
  }
  return {
    id: docSnap.id,
    guestName: data.guestName,
    date: data.date, 
    time: data.time,
    partySize: data.partySize,
    status: data.status,
    createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : (typeof data.createdAt === 'string' ? data.createdAt : new Date().toISOString()),
    guestEmail: data.guestEmail,
    guestPhone: data.guestPhone,
    notes: data.notes,
    tableId: data.tableId,
    ownerUID: data.ownerUID, 
  } as Booking;
};


async function triggerBookingConfirmationEmail(
  bookingDetails: BookingInput | Booking, 
  ownerUID: string,
  bookingIdForLog: string 
) {
  if (!bookingDetails.guestEmail) {
    console.log(`[BookingService][ConfirmationEmail] No guest email for booking ${bookingIdForLog}. Skipping confirmation email.`);
    return;
  }
  if (bookingDetails.status !== 'confirmed') {
    console.log(`[BookingService][ConfirmationEmail] Booking ${bookingIdForLog} status is not 'confirmed' (it's ${bookingDetails.status}). Skipping confirmation email.`);
    return;
  }

  console.log(`[BookingService][ConfirmationEmail] Attempting to send confirmation for booking ${bookingIdForLog} to ${bookingDetails.guestEmail}`);

  try {
    const ownerSettings = await getSettingsById(ownerUID);
    const restaurantName = ownerSettings?.restaurantName || "Our Restaurant"; 

    const template = await getEmailTemplate(BOOKING_ACCEPTED_TEMPLATE_ID);
    if (!template || !template.subject || !template.body) {
      console.error(`[BookingService][ConfirmationEmail] Booking Accepted template (ID: ${BOOKING_ACCEPTED_TEMPLATE_ID}) not found or incomplete for booking ${bookingIdForLog}.`);
      return;
    }
    
    let formattedBookingDate = 'N/A';
    if (bookingDetails.date) {
        try {
            // Date is expected to be 'YYYY-MM-DD' string from BookingInput or Booking
            const parsedDate = parseISO(bookingDetails.date); 
            formattedBookingDate = formatDateFns(parsedDate, 'MMMM d, yyyy');
        } catch (e) {
            console.warn(`[BookingService][ConfirmationEmail] Could not parse date "${bookingDetails.date}" for booking ${bookingIdForLog}. Error: ${e instanceof Error ? e.message : String(e)}. Using "N/A".`);
        }
    }

    const templateData = {
      guestName: bookingDetails.guestName,
      bookingDate: formattedBookingDate,
      bookingTime: bookingDetails.time, 
      partySize: bookingDetails.partySize,
      restaurantName: restaurantName,
      notes: bookingDetails.notes || '', 
    };

    const subject = renderSimpleTemplate(template.subject, templateData);
    const htmlContent = renderSimpleTemplate(template.body, templateData);

    if (!subject.trim() || !htmlContent.trim()) {
        console.error(`[BookingService][ConfirmationEmail] Rendered subject or body is empty for booking ${bookingIdForLog} using template ID ${BOOKING_ACCEPTED_TEMPLATE_ID}. Aborting email.`);
        return;
    }

    const emailInput: SendEmailInput = {
      to: bookingDetails.guestEmail,
      subject,
      htmlContent,
      senderName: restaurantName, 
    };

    const emailResult = await sendEmail(emailInput);
    if (emailResult.success) {
      console.log(`[BookingService][ConfirmationEmail] Confirmation email sent successfully for booking ${bookingIdForLog} to ${bookingDetails.guestEmail}. Message ID: ${emailResult.messageId}`);
    } else {
      console.error(`[BookingService][ConfirmationEmail] Failed to send confirmation email for booking ${bookingIdForLog}: ${emailResult.error}`);
    }
  } catch (error) {
    console.error(`[BookingService][ConfirmationEmail] Error sending confirmation email for booking ${bookingIdForLog}:`, error);
  }
}


export const getBookings = async (): Promise<Booking[]> => {
  const user = auth.currentUser;
  if (!user) {
    console.warn("[bookingService] getBookings called without an authenticated user. Returning empty array.");
    return [];
  }
  
  try {
    const q = query(collection(db, BOOKINGS_COLLECTION), where('ownerUID', '==', user.uid), orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(mapDocToBooking);
  } catch (error) {
    console.error("Error fetching bookings: ", error);
    throw error; 
  }
};


export const addBookingToFirestore = async (bookingData: BookingInput): Promise<string> => {
  const user = auth.currentUser;
  if (!user) {
    console.error("Error adding booking: User not authenticated.");
    throw new Error("User not authenticated. Cannot create booking.");
  }
  try {
    const docRef = await addDoc(collection(db, BOOKINGS_COLLECTION), {
      ...bookingData,
      ownerUID: user.uid, 
      createdAt: serverTimestamp(), 
    });

    if (bookingData.status === 'confirmed') {
      triggerBookingConfirmationEmail(bookingData, user.uid, docRef.id).catch(err => {
        console.error(`[BookingService][addBooking] Background confirmation email trigger failed for new booking ${docRef.id}:`, err);
      });
    }
    return docRef.id;
  } catch (error) {
    console.error("Error adding booking: ", error);
    throw error;
  }
};

export type BookingUpdateData = Partial<Omit<Booking, 'id' | 'createdAt' | 'ownerUID'>>;

export const updateBookingInFirestore = async (bookingId: string, bookingData: BookingUpdateData): Promise<void> => {
  const user = auth.currentUser;
  if (!user) {
    console.error("Error updating booking: User not authenticated.");
    throw new Error("User not authenticated. Cannot update booking.");
  }
  try {
    const bookingRef = doc(db, BOOKINGS_COLLECTION, bookingId);
    await updateDoc(bookingRef, {
        ...bookingData,
        updatedAt: serverTimestamp()
    });

    if (bookingData.status === 'confirmed') {
      const updatedDocSnap = await getDoc(bookingRef); 
      if (updatedDocSnap.exists()) {
        const fullBookingDetailsForEmail = mapDocToBooking(updatedDocSnap); 
        triggerBookingConfirmationEmail(fullBookingDetailsForEmail, user.uid, bookingId).catch(err => {
            console.error(`[BookingService][updateBooking] Background confirmation email trigger failed for updated booking ${bookingId}:`, err);
        });
      } else {
         console.warn(`[BookingService][updateBooking] Booking document ${bookingId} not found after update. Cannot send confirmation email.`);
      }
    }
  } catch (error) {
    console.error("Error updating booking: ", error);
    throw error;
  }
};

export const deleteBookingFromFirestore = async (bookingId: string): Promise<void> => {
   const user = auth.currentUser;
   if (!user) {
    console.error("Error deleting booking: User not authenticated.");
    throw new Error("User not authenticated. Cannot delete booking.");
  }
  try {
    const bookingRef = doc(db, BOOKINGS_COLLECTION, bookingId);
    await deleteDoc(bookingRef);
  } catch (error) {
    console.error("Error deleting booking: ", error);
    throw error;
  }
};

export const getActiveBookingsForTable = async (tableId: string): Promise<Booking[]> => {
  const user = auth.currentUser;
  if (!user) {
    console.warn("[bookingService] getActiveBookingsForTable called without user. Returning empty array.");
    return [];
  }
  try {
    const q = query(
      collection(db, BOOKINGS_COLLECTION),
      where('ownerUID', '==', user.uid), 
      where('tableId', '==', tableId),
      where('status', 'in', ['seated', 'confirmed', 'pending']),
      orderBy('date', 'asc'), 
      orderBy('time', 'asc')  
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(mapDocToBooking);
  } catch (error) {
    console.error(`Error fetching active bookings for table ${tableId}: `, error);
    throw error;
  }
};


    