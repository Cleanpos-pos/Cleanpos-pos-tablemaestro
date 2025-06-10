
import { db } from '@/config/firebase';
import type { CombinedSettings, RestaurantSchedule } from '@/lib/types';
import {
  doc,
  setDoc,
  getDoc,
  serverTimestamp,
  updateDoc, // Added updateDoc to imports, though not used in this snippet, good practice
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
    console.error("[settingsService] Error saving restaurant settings: ", error);
    throw error;
  }
};

export const getRestaurantSettings = async (): Promise<CombinedSettings | null> => {
  const settingsPath = `${SETTINGS_COLLECTION}/${MAIN_SETTINGS_DOC_ID}`;
  try {
    console.log(`[settingsService] Attempting to fetch settings from: ${settingsPath}`);
    const settingsRef = doc(db, SETTINGS_COLLECTION, MAIN_SETTINGS_DOC_ID);
    const docSnap = await getDoc(settingsRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      console.log(`[settingsService] Successfully fetched settings from: ${settingsPath}`);
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
      console.warn(`[settingsService] No settings document found at: ${settingsPath}`);
      return null;
    }
  } catch (error) {
    console.error(`[settingsService] Error fetching restaurant settings from ${settingsPath}: `, error);
    throw error; // Re-throw to be caught by the calling function
  }
};

export const saveRestaurantSchedule = async (schedule: RestaurantSchedule): Promise<void> => {
  try {
    const settingsRef = doc(db, SETTINGS_COLLECTION, MAIN_SETTINGS_DOC_ID);
    await setDoc(settingsRef, {
      schedule: schedule,
      scheduleUpdatedAt: serverTimestamp(),
    }, { merge: true });
  } catch (error) {
    console.error("[settingsService] Error saving restaurant schedule: ", error);
    throw error;
  }
};

export const getRestaurantSchedule = async (): Promise<RestaurantSchedule | null> => {
  const schedulePath = `${SETTINGS_COLLECTION}/${MAIN_SETTINGS_DOC_ID} (schedule field)`;
  try {
    console.log(`[settingsService] Attempting to fetch schedule from: ${schedulePath}`);
    const settingsRef = doc(db, SETTINGS_COLLECTION, MAIN_SETTINGS_DOC_ID);
    const docSnap = await getDoc(settingsRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      if (data.schedule) {
        console.log(`[settingsService] Successfully fetched schedule from: ${schedulePath}`);
        return data.schedule as RestaurantSchedule;
      }
      console.warn(`[settingsService] Settings document found, but no 'schedule' field at: ${schedulePath}`);
      return null; 
    } else {
      console.warn(`[settingsService] No settings document found (for schedule) at: ${SETTINGS_COLLECTION}/${MAIN_SETTINGS_DOC_ID}`);
      return null; 
    }
  } catch (error) {
    console.error(`[settingsService] Error fetching restaurant schedule from ${schedulePath}: `, error);
    throw error;
  }
};
