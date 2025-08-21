

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
  getDoc, 
  type DocumentSnapshot, 
  arrayUnion,
} from 'firebase/firestore';
import { getRestaurantSettings } from './settingsService';
import { sendUpgradePlanEmailAction } from '@/app/actions/emailActions';
import { startOfWeek, endOfWeek } from 'date-fns';

const BOOKINGS_COLLECTION = 'bookings';

// Helper to convert Firestore Timestamps to ISO strings and include doc ID
const mapDocToBooking = (docSnap: QueryDocumentSnapshot<DocumentData> | DocumentSnapshot<DocumentData>): Booking => {
  const data = docSnap.data();
  if (!data) {
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
  // In a multi-tenant app, the ownerUID must be known. For guest-created bookings,
  // this would need to be passed from the tenant-specific booking page.
  // Admin-created bookings will use the logged-in admin's UID.
  const ownerId = user ? user.uid : bookingData.ownerUID;
  
  if (!ownerId) {
      throw new Error("Cannot create booking: Owner ID is missing. Bookings must be associated with a restaurant.");
  }

  if (user) { // Only check for upgrades if an admin is logged in and creating a booking
      await checkAndNotifyForUpgrade(user.uid);
  }

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

async function checkAndNotifyForUpgrade(userId: string) {
    try {
        const settings = await getRestaurantSettings();
        if (settings.plan !== 'starter') {
            return;
        }

        const now = new Date();
        const weekStart = startOfWeek(now, { weekStartsOn: 1 });
        const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
        
        const bookingsQuery = query(
            collection(db, BOOKINGS_COLLECTION),
            where('ownerUID', '==', userId),
            where('createdAt', '>=', weekStart),
            where('createdAt', '<=', weekEnd)
        );

        const snapshot = await getDocs(bookingsQuery);
        const weeklyBookings = snapshot.size;
        const bookingLimit = 30;
        const upgradeThreshold = 25;

        if (weeklyBookings === upgradeThreshold) {
            const user = auth.currentUser;
            if (user && user.email) {
                await sendUpgradePlanEmailAction(
                    user.email,
                    settings.restaurantName || "Your Restaurant",
                    weeklyBookings,
                    bookingLimit
                );
            }
        }
    } catch (error) {
        console.error("Error checking for plan upgrade notification:", error);
    }
}


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
