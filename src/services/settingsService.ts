
import { db } from '@/config/firebase';
import type { CombinedSettings, RestaurantSchedule } from '@/lib/types';
import {
  doc,
  setDoc,
  getDoc,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';

const SETTINGS_COLLECTION = 'restaurantConfig';
const MAIN_SETTINGS_DOC_ID = 'main'; // Using a single document for all general settings

export const saveRestaurantSettings = async (settings: CombinedSettings): Promise<void> => {
  try {
    const settingsRef = doc(db, SETTINGS_COLLECTION, MAIN_SETTINGS_DOC_ID);
    await setDoc(settingsRef, {
      ...settings,
      updatedAt: serverTimestamp(),
    }, { merge: true });
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
      return {
        minAdvanceReservationHours: data.minAdvanceReservationHours,
        maxReservationDurationHours: data.maxReservationDurationHours,
        maxGuestsPerBooking: data.maxGuestsPerBooking,
        timeSlotIntervalMinutes: data.timeSlotIntervalMinutes,
        bookingLeadTimeDays: data.bookingLeadTimeDays,
        restaurantName: data.restaurantName,
        restaurantImageUrl: data.restaurantImageUrl,
      } as CombinedSettings;
    } else {
      return null;
    }
  } catch (error) {
    console.error("Error fetching restaurant settings: ", error);
    throw error;
  }
};

export const saveRestaurantSchedule = async (schedule: RestaurantSchedule): Promise<void> => {
  try {
    const settingsRef = doc(db, SETTINGS_COLLECTION, MAIN_SETTINGS_DOC_ID);
    // Use updateDoc to add/update the schedule field specifically,
    // or setDoc with merge:true if the document might not exist yet.
    // Since 'main' doc is likely created by saveRestaurantSettings,
    // setDoc with merge is safer if this can be called independently.
    await setDoc(settingsRef, {
      schedule: schedule,
      scheduleUpdatedAt: serverTimestamp(),
    }, { merge: true });
  } catch (error) {
    console.error("Error saving restaurant schedule: ", error);
    throw error;
  }
};

export const getRestaurantSchedule = async (): Promise<RestaurantSchedule | null> => {
  try {
    const settingsRef = doc(db, SETTINGS_COLLECTION, MAIN_SETTINGS_DOC_ID);
    const docSnap = await getDoc(settingsRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      if (data.schedule) {
        return data.schedule as RestaurantSchedule;
      }
      return null; // Schedule field doesn't exist
    } else {
      return null; // Settings document doesn't exist
    }
  } catch (error) {
    console.error("Error fetching restaurant schedule: ", error);
    throw error;
  }
};
