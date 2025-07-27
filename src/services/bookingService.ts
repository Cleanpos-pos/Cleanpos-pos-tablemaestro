

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
  FieldValue,
  arrayUnion,
} from 'firebase/firestore';
import { PUBLIC_RESTAURANT_ID } from '@/config/constants';

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
    communicationHistory: data.communicationHistory || [],
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

export const getBookingById = async (bookingId: string): Promise<Booking | null> => {
    try {
        const bookingRef = doc(db, BOOKINGS_COLLECTION, bookingId);
        const docSnap = await getDoc(bookingRef);
        if (docSnap.exists()) {
            return mapDocToBooking(docSnap);
        }
        return null;
    } catch (error) {
        console.error(`Error fetching booking with ID ${bookingId}: `, error);
        throw error;
    }
};


export const addBookingToFirestore = async (bookingData: BookingInput): Promise<string> => {
  const user = auth.currentUser;
  // If no user is logged in (i.e., a public booking), assign it to the public restaurant owner ID.
  // Otherwise, assign it to the logged-in admin.
  const ownerId = user ? user.uid : PUBLIC_RESTAURANT_ID;
  
  try {
    const docRef = await addDoc(collection(db, BOOKINGS_COLLECTION), {
      ...bookingData,
      ownerUID: ownerId, 
      createdAt: serverTimestamp(),
      communicationHistory: [], // Initialize with an empty array
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
    const dataToUpdate: { [key: string]: any } = { ...bookingData };
    if (dataToUpdate.communicationHistory) {
      delete dataToUpdate.communicationHistory;
    }
    
    await updateDoc(bookingRef, {
        ...dataToUpdate,
        updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error("Error updating booking: ", error);
    throw error;
  }
};

export const addCommunicationNoteToBooking = async (bookingId: string, note: string): Promise<void> => {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("User not authenticated. Cannot add note.");
  }
  const bookingRef = doc(db, BOOKINGS_COLLECTION, bookingId);
  try {
    await updateDoc(bookingRef, {
      communicationHistory: arrayUnion(note),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error(`Error adding communication note to booking ${bookingId}:`, error);
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
