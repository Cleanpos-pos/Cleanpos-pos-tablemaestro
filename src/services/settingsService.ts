
import { db } from '@/config/firebase';
import type { CombinedSettings, RestaurantSchedule, DaySchedule, TimeSlot } from '@/lib/types';
import {
  doc,
  setDoc,
  getDoc,
  serverTimestamp,
} from 'firebase/firestore';

const SETTINGS_COLLECTION = 'restaurantConfig';
const MAIN_SETTINGS_DOC_ID = 'main'; // Using a single document for all general settings

export const saveRestaurantSettings = async (settings: CombinedSettings): Promise<void> => {
  try {
    const settingsRef = doc(db, SETTINGS_COLLECTION, MAIN_SETTINGS_DOC_ID);

    const dataToSave: Partial<CombinedSettings> = {};
    Object.keys(settings).forEach(keyStr => {
      const key = keyStr as keyof CombinedSettings;
      if (settings[key] !== undefined) {
        (dataToSave as any)[key] = settings[key];
      }
    });
    
    if (dataToSave.restaurantName === undefined) dataToSave.restaurantName = null;
    if (dataToSave.restaurantImageUrl === undefined) dataToSave.restaurantImageUrl = null;
    if (dataToSave.restaurantGalleryUrls) {
      dataToSave.restaurantGalleryUrls = dataToSave.restaurantGalleryUrls.map(url => url === undefined ? null : url);
    } else {
      dataToSave.restaurantGalleryUrls = Array(6).fill(null);
    }

    await setDoc(settingsRef, {
      ...dataToSave,
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
        restaurantName: data.restaurantName ?? null,
        restaurantImageUrl: data.restaurantImageUrl ?? null,
        restaurantGalleryUrls: (data.restaurantGalleryUrls || Array(6).fill(null)).map((url: string | null | undefined) => url ?? null),
      } as CombinedSettings;
    } else {
      console.warn(`[settingsService] No settings document found at: ${settingsPath}`);
      return null;
    }
  } catch (error) {
    console.error(`[settingsService] Error fetching restaurant settings from ${settingsPath}: `, error);
    throw error;
  }
};

export const saveRestaurantSchedule = async (schedule: RestaurantSchedule): Promise<void> => {
  try {
    const settingsRef = doc(db, SETTINGS_COLLECTION, MAIN_SETTINGS_DOC_ID);
    // Ensure timeSlots is an array, even if empty, for each day
    const scheduleToSave = schedule.map(day => ({
      ...day,
      timeSlots: day.timeSlots || [] 
    }));
    await setDoc(settingsRef, {
      schedule: scheduleToSave,
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
    const settingsRef = doc(db, SETTINGS_COLLECTION, MAIN_SETTINGS_DOC_ID);
    const docSnap = await getDoc(settingsRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      if (data.schedule && Array.isArray(data.schedule)) {
        // Ensure each day in the fetched schedule has a timeSlots array
        const sanitizedSchedule = (data.schedule as DaySchedule[]).map(day => ({
          ...day,
          timeSlots: day.timeSlots || [] // Default to empty array if timeSlots is missing
        }));
        return sanitizedSchedule;
      }
      console.warn(`[settingsService] Settings document found, but 'schedule' field is missing or not an array at: ${schedulePath}`);
      return null; 
    } else {
      console.warn(`[settingsService] No settings document found (for schedule) at: ${SETTINGS_COLLECTION}/${MAIN_SETTINGS_DOC_ID}`);
      return null; 
    }
  } catch (error)
   {
    console.error(`[settingsService] Error fetching restaurant schedule from ${schedulePath}: `, error);
    throw error;
  }
};
