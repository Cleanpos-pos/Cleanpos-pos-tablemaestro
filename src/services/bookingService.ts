
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
  type DocumentSnapshot, // Explicitly import DocumentSnapshot
} from 'firebase/firestore';

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
