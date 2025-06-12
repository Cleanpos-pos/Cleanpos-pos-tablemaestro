
import { db } from '@/config/firebase';
import type { CombinedSettings, RestaurantSchedule } from '@/lib/types';
import {
  doc,
  setDoc,
  getDoc,
  serverTimestamp,
  // updateDoc, // Added updateDoc to imports, though not used in this snippet, good practice
} from 'firebase/firestore';

const SETTINGS_COLLECTION = 'restaurantConfig';
const MAIN_SETTINGS_DOC_ID = 'main'; // Using a single document for all general settings

export const saveRestaurantSettings = async (settings: CombinedSettings): Promise<void> => {
  try {
    const settingsRef = doc(db, SETTINGS_COLLECTION, MAIN_SETTINGS_DOC_ID);

    // Create a clean object for Firestore, ensuring no undefined values are passed
    const dataToSave: Partial<CombinedSettings> = {};
    Object.keys(settings).forEach(keyStr => {
      const key = keyStr as keyof CombinedSettings;
      if (settings[key] !== undefined) {
        (dataToSave as any)[key] = settings[key];
      } else {
        // If a field is undefined, and it's one that should be null (like optional strings/images)
        // Firestore's merge behavior handles missing keys, but explicit undefined is an error.
        // It's better to ensure the object sent to Firestore either has a valid value (e.g. null) or omits the key.
        // The Zod schema and form logic should ideally ensure `settings` doesn't have problematic `undefined`.
        // If `restaurantName` or image URLs could be undefined here, convert them to null.
        if (key === 'restaurantName' || key === 'restaurantImageUrl') {
          (dataToSave as any)[key] = null;
        } else if (key === 'restaurantGalleryUrls') {
           // Ensure gallery array elements are not undefined
          (dataToSave as any)[key] = (settings.restaurantGalleryUrls || []).map(url => url === undefined ? null : url);
        }
        // For other fields, if undefined means "don't change" or "remove", `merge:true` handles omission.
        // If it must be null, it should be explicitly set.
      }
    });
    // Ensure top-level optional fields that can be null are explicitly null if undefined
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
    console.log(`[settingsService] Attempting to fetch settings from: ${settingsPath}`);
    const settingsRef = doc(db, SETTINGS_COLLECTION, MAIN_SETTINGS_DOC_ID);
    const docSnap = await getDoc(settingsRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      console.log(`[settingsService] Successfully fetched settings from: ${settingsPath}`);
      // Ensure that fields that can be null are defaulted to null if missing from Firestore
      return {
        minAdvanceReservationHours: data.minAdvanceReservationHours,
        maxReservationDurationHours: data.maxReservationDurationHours,
        maxGuestsPerBooking: data.maxGuestsPerBooking,
        timeSlotIntervalMinutes: data.timeSlotIntervalMinutes,
        bookingLeadTimeDays: data.bookingLeadTimeDays,
        restaurantName: data.restaurantName ?? null,
        restaurantImageUrl: data.restaurantImageUrl ?? null,
        restaurantGalleryUrls: (data.restaurantGalleryUrls || Array(6).fill(null)).map((url: string | null | undefined) => url ?? null),
      } as CombinedSettings; // Type assertion is okay if we ensure all fields are covered
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
