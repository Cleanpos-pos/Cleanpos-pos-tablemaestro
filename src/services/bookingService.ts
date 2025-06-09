
import { db } from '@/config/firebase';
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
    date: data.date,
    time: data.time,
    partySize: data.partySize,
    status: data.status,
    createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : data.createdAt,
    guestEmail: data.guestEmail,
    guestPhone: data.guestPhone,
    notes: data.notes,
    tableId: data.tableId,
  } as Booking;
};


export const getBookings = async (): Promise<Booking[]> => {
  try {
    const q = query(collection(db, BOOKINGS_COLLECTION), orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(mapDocToBooking);
  } catch (error) {
    console.error("Error fetching bookings: ", error);
    // It's good practice to throw the error or return an empty array/handle it appropriately
    throw error; 
  }
};

export type BookingInput = Omit<Booking, 'id' | 'createdAt'> & { createdAt?: Timestamp };

export const addBookingToFirestore = async (bookingData: BookingInput): Promise<string> => {
  try {
    const docRef = await addDoc(collection(db, BOOKINGS_COLLECTION), {
      ...bookingData,
      createdAt: serverTimestamp(), // Use server timestamp for creation
    });
    return docRef.id;
  } catch (error) {
    console.error("Error adding booking: ", error);
    throw error;
  }
};

export type BookingUpdateData = Partial<Omit<Booking, 'id' | 'createdAt'>>;

export const updateBookingInFirestore = async (bookingId: string, bookingData: BookingUpdateData): Promise<void> => {
  try {
    const bookingRef = doc(db, BOOKINGS_COLLECTION, bookingId);
    await updateDoc(bookingRef, bookingData);
  } catch (error) {
    console.error("Error updating booking: ", error);
    throw error;
  }
};

export const deleteBookingFromFirestore = async (bookingId: string): Promise<void> => {
  try {
    const bookingRef = doc(db, BOOKINGS_COLLECTION, bookingId);
    await deleteDoc(bookingRef);
  } catch (error) {
    console.error("Error deleting booking: ", error);
    throw error;
  }
};
