
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
} from 'firebase/firestore';

const BOOKINGS_COLLECTION = 'bookings';

// Helper to convert Firestore Timestamps to ISO strings and include doc ID
const mapDocToBooking = (docSnap: QueryDocumentSnapshot<DocumentData>): Booking => {
  const data = docSnap.data();
  return {
    id: docSnap.id,
    guestName: data.guestName,
    date: data.date, // Should be YYYY-MM-DD string
    time: data.time,
    partySize: data.partySize,
    status: data.status,
    // Ensure createdAt is handled: Firestore Timestamp or existing ISO string
    createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : (typeof data.createdAt === 'string' ? data.createdAt : new Date().toISOString()),
    guestEmail: data.guestEmail,
    guestPhone: data.guestPhone,
    notes: data.notes,
    tableId: data.tableId,
    ownerUID: data.ownerUID, // Map ownerUID
  } as Booking;
};

// Potential Firestore Composite Index for this query:
// Collection: bookings
// Fields:
// 1. ownerUID (Ascending/Descending)
// 2. createdAt (Descending)
export const getBookings = async (): Promise<Booking[]> => {
  const user = auth.currentUser;
  if (!user) {
    console.warn("[bookingService] getBookings called without an authenticated user. Returning empty array.");
    return [];
  }
  
  try {
    let q;
    if (user) {
        // Fetch bookings where ownerUID matches the current user's UID
        q = query(collection(db, BOOKINGS_COLLECTION), where('ownerUID', '==', user.uid), orderBy('createdAt', 'desc'));
    } else {
        console.log("[bookingService] No user logged in, returning empty bookings array from getBookings.");
        return [];
    }
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
      ownerUID: user.uid, // Add ownerUID
      createdAt: serverTimestamp(), 
    });
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
    // Firestore rules should verify that user.uid matches the booking's ownerUID for updates.
    await updateDoc(bookingRef, bookingData);
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
  // Firestore rules should verify that user.uid matches the booking's ownerUID for deletes.
  try {
    const bookingRef = doc(db, BOOKINGS_COLLECTION, bookingId);
    await deleteDoc(bookingRef);
  } catch (error) {
    console.error("Error deleting booking: ", error);
    throw error;
  }
};

// Potential Firestore Composite Index for this query:
// Collection: bookings
// Fields:
// 1. ownerUID (Ascending/Descending)
// 2. tableId (Ascending/Descending)
// 3. status (Ascending/Descending - or for 'in' queries, this might affect indexing strategy)
// 4. date (Ascending)
// 5. time (Ascending)
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
