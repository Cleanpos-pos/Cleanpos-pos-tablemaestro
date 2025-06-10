
import { db } from '@/config/firebase';
import type { CombinedSettings } from '@/lib/types';
import {
  doc,
  setDoc,
  getDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';

const SETTINGS_COLLECTION = 'restaurantConfig';
const MAIN_SETTINGS_DOC_ID = 'main'; // Using a single document for all general settings

export const saveRestaurantSettings = async (settings: CombinedSettings): Promise<void> => {
  try {
    const settingsRef = doc(db, SETTINGS_COLLECTION, MAIN_SETTINGS_DOC_ID);
    await setDoc(settingsRef, {
      ...settings,
      updatedAt: serverTimestamp(),
    }, { merge: true }); // merge: true to avoid overwriting if document has other fields
  } catch (error) {
    console.error("Error saving restaurant settings: ", error);
    throw error;
  }
};

export const getRestaurantSettings = async (): Promise<CombinedSettings | null> => {
  try {
    const settingsRef = doc(db, SETTINGS_COLLECTION, MAIN_SETTINGS_DOC_ID);
    const docSnap = await getDoc(settingsRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      // Convert Timestamps if necessary, though not strictly needed for display of these settings
      return {
        minAdvanceReservationHours: data.minAdvanceReservationHours,
        maxReservationDurationHours: data.maxReservationDurationHours,
        maxGuestsPerBooking: data.maxGuestsPerBooking,
        timeSlotIntervalMinutes: data.timeSlotIntervalMinutes,
        bookingLeadTimeDays: data.bookingLeadTimeDays,
        restaurantName: data.restaurantName,
        restaurantImageUrl: data.restaurantImageUrl,
        // Add any other settings fields here
      } as CombinedSettings;
    } else {
      // No settings document found
      return null;
    }
  } catch (error) {
    console.error("Error fetching restaurant settings: ", error);
    throw error;
  }
};
