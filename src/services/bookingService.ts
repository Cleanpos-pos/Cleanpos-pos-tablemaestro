
import { db, auth } from '@/config/firebase';
import type { Booking } from '@/lib/types';
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


export const getBookings = async (): Promise<Booking[]> => {
  const user = auth.currentUser;
  if (!user) {
    // If rules require ownerUID for reads, this might still fail if not all bookings have it.
    // Or, if a general "list" is disallowed, this needs to be user-specific.
    // For now, assuming the rules allow list for owner if bookings have ownerUID.
    console.warn("[bookingService] getBookings called without an authenticated user. Depending on rules, this might return empty or fail.");
    // Depending on rules for listing /bookings, you might want to return [] or throw.
    // If rules are `allow list: if request.auth.uid == resource.data.ownerUID;` this would be complex.
    // A more common pattern is `allow list: if request.auth != null;` then filter client-side,
    // or query with `where('ownerUID', '==', user.uid)`.
    // For now, just attempt the query. If rules require ownerUID for all list items, it may fail.
    // Assuming for now the list rule is permissive enough for an admin to see their bookings.
  }
  
  try {
    let q;
    if (user) {
        // Fetch bookings where ownerUID matches the current user's UID
        q = query(collection(db, BOOKINGS_COLLECTION), where('ownerUID', '==', user.uid), orderBy('createdAt', 'desc'));
    } else {
        // If no user, perhaps fetch no bookings or handle as per app's public requirements (if any for bookings)
        // For an admin app, typically no user means no data.
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

export type BookingInput = Omit<Booking, 'id' | 'createdAt'> & { createdAt?: Timestamp };

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

export type BookingUpdateData = Partial<Omit<Booking, 'id' | 'createdAt'>>;

export const updateBookingInFirestore = async (bookingId: string, bookingData: BookingUpdateData): Promise<void> => {
  const user = auth.currentUser;
  if (!user) {
    console.error("Error updating booking: User not authenticated.");
    throw new Error("User not authenticated. Cannot update booking.");
  }
  // Add check: does this user own this booking? Not strictly needed if ID is unguessable AND rules enforce owner.
  // However, it's good practice if IDs might be known.
  // For now, relying on Firestore rules for write authorization.
  try {
    const bookingRef = doc(db, BOOKINGS_COLLECTION, bookingId);
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
  // Similar to update, relying on Firestore rules for delete authorization.
  try {
    const bookingRef = doc(db, BOOKINGS_COLLECTION, bookingId);
    await deleteDoc(bookingRef);
  } catch (error) {
    console.error("Error deleting booking: ", error);
    throw error;
  }
};

// Firestore Composite Index Required for this query:
// Collection ID: bookings
// Fields:
// 1. tableId ASC
// 2. status ASC (or status IN for multiple statuses)
// 3. date ASC
// 4. time ASC
// (Potentially with ownerUID as the first field if all queries are user-specific)
// e.g., ownerUID ASC, tableId ASC, status ASC, date ASC, time ASC
export const getActiveBookingsForTable = async (tableId: string): Promise<Booking[]> => {
  const user = auth.currentUser;
  if (!user) {
    console.warn("[bookingService] getActiveBookingsForTable called without user. Returning empty array.");
    return [];
  }
  try {
    const q = query(
      collection(db, BOOKINGS_COLLECTION),
      where('ownerUID', '==', user.uid), // Ensure user only sees their bookings
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

