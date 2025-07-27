
import { db, auth } from '@/config/firebase';
import type { CombinedSettings, RestaurantSchedule, DaySchedule, TimeSlot } from '@/lib/types';
import { PUBLIC_RESTAURANT_ID } from '@/config/constants';
import {
  doc,
  setDoc,
  getDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';

// Default settings, useful for new users or if data is somehow missing
const defaultCombinedSettings: CombinedSettings = {
  minAdvanceReservationHours: 2,
  maxReservationDurationHours: 2.5,
  maxGuestsPerBooking: 10,
  timeSlotIntervalMinutes: 30,
  bookingLeadTimeDays: 90,
  restaurantName: "My Restaurant",
  restaurantImageUrl: null,
  restaurantGalleryUrls: Array(6).fill(null),
  seoH1: null,
  seoMetaDescription: null,
  seoKeywords: null,
};

const defaultTimeSlot: TimeSlot = { name: 'Dinner', startTime: '17:00', endTime: '22:00' };
const defaultScheduleData: RestaurantSchedule = [
  { dayOfWeek: 'monday', isOpen: true, timeSlots: [{...defaultTimeSlot}] },
  { dayOfWeek: 'tuesday', isOpen: true, timeSlots: [{...defaultTimeSlot}] },
  { dayOfWeek: 'wednesday', isOpen: true, timeSlots: [{...defaultTimeSlot}] },
  { dayOfWeek: 'thursday', isOpen: true, timeSlots: [{...defaultTimeSlot}] },
  { dayOfWeek: 'friday', isOpen: true, timeSlots: [{ name: 'Dinner', startTime: '17:00', endTime: '23:00' }] },
  { dayOfWeek: 'saturday', isOpen: true, timeSlots: [{ name: 'Lunch', startTime: '12:00', endTime: '15:00' }, { name: 'Dinner', startTime: '17:00', endTime: '23:00' }] },
  { dayOfWeek: 'sunday', isOpen: false, timeSlots: [] },
];


export const saveRestaurantSettings = async (settings: CombinedSettings): Promise<void> => {
  const user = auth.currentUser;
  if (!user) {
    console.error("[settingsService] No authenticated user found. Cannot save settings.");
    throw new Error("User not authenticated. Cannot save settings.");
  }
  const settingsDocId = user.uid;
  const settingsRef = doc(db, SETTINGS_COLLECTION, settingsDocId);
  console.log(`[settingsService] Saving settings for user ${user.uid} to doc ID ${settingsDocId}`);

  try {
    const dataToSave: CombinedSettings = {
      ...defaultCombinedSettings,
      ...settings
    };

    dataToSave.restaurantName = settings.restaurantName ?? null;
    dataToSave.restaurantImageUrl = settings.restaurantImageUrl ?? null;
    dataToSave.seoH1 = settings.seoH1 ?? null;
    dataToSave.seoMetaDescription = settings.seoMetaDescription ?? null;
    dataToSave.seoKeywords = settings.seoKeywords ?? null;


    if (settings.restaurantGalleryUrls && Array.isArray(settings.restaurantGalleryUrls)) {
      dataToSave.restaurantGalleryUrls = settings.restaurantGalleryUrls.map(url => url ?? null);
    } else {
      dataToSave.restaurantGalleryUrls = Array(6).fill(null);
    }

    if (dataToSave.restaurantGalleryUrls.length < 6) {
        dataToSave.restaurantGalleryUrls = [...dataToSave.restaurantGalleryUrls, ...Array(6 - dataToSave.restaurantGalleryUrls.length).fill(null)];
    } else if (dataToSave.restaurantGalleryUrls.length > 6) {
        dataToSave.restaurantGalleryUrls = dataToSave.restaurantGalleryUrls.slice(0, 6);
    }

    (Object.keys(defaultCombinedSettings) as Array<keyof CombinedSettings>).forEach(key => {
        if (dataToSave[key] === undefined) {
            (dataToSave as any)[key] = (defaultCombinedSettings as any)[key];
             if (key === 'restaurantName' || key === 'restaurantImageUrl' || key === 'seoH1' || key === 'seoMetaDescription' || key === 'seoKeywords') {
                (dataToSave as any)[key] = null;
            }
            if (key === 'restaurantGalleryUrls' && !(dataToSave[key])) {
                (dataToSave as any)[key] = Array(6).fill(null);
            }
        }
    });

    await setDoc(settingsRef, {
      ...dataToSave,
      updatedAt: serverTimestamp(),
      ownerUID: user.uid,
    }, { merge: true });

  } catch (error) {
    console.error(`[settingsService] Error saving restaurant settings for doc ${settingsDocId}: `, error);
    throw error;
  }
};

export const getSettingsById = async (settingsDocId: string): Promise<CombinedSettings> => {
  const settingsPath = `${SETTINGS_COLLECTION}/${settingsDocId}`;
  
  if (settingsDocId === PUBLIC_RESTAURANT_ID) {
    console.log(`[settingsService][getSettingsById] Attempting to fetch PUBLIC restaurant settings from doc ID: ${settingsDocId} (Path: ${settingsPath})`);
  } else {
    console.log(`[settingsService][getSettingsById] Fetching settings for user/doc ID: ${settingsDocId} (Path: ${settingsPath})`);
  }

  try {
    const settingsRef = doc(db, SETTINGS_COLLECTION, settingsDocId);
    const docSnap = await getDoc(settingsRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      const dbGalleryUrls = (data.restaurantGalleryUrls && Array.isArray(data.restaurantGalleryUrls)) ? data.restaurantGalleryUrls : [];

      const mergedSettings: CombinedSettings = {
        ...defaultCombinedSettings,
        ...data,
        restaurantName: data.restaurantName ?? defaultCombinedSettings.restaurantName,
        restaurantImageUrl: data.restaurantImageUrl ?? defaultCombinedSettings.restaurantImageUrl,
        restaurantGalleryUrls: Array.from({ length: 6 }).map((_, i) => dbGalleryUrls[i] || null),
        seoH1: data.seoH1 ?? defaultCombinedSettings.seoH1,
        seoMetaDescription: data.seoMetaDescription ?? defaultCombinedSettings.seoMetaDescription,
        seoKeywords: data.seoKeywords ?? defaultCombinedSettings.seoKeywords,
      };

      if (settingsDocId === PUBLIC_RESTAURANT_ID) {
        console.log(`[settingsService][getSettingsById] Found PUBLIC restaurant settings document (${settingsPath}). Effective restaurantName: "${mergedSettings.restaurantName}" (from DB: "${data.restaurantName}", default: "${defaultCombinedSettings.restaurantName}")`);
      } else {
        console.log(`[settingsService][getSettingsById] Found USER settings document (${settingsPath}). Effective restaurantName: "${mergedSettings.restaurantName}" (from DB: "${data.restaurantName}", default: "${defaultCombinedSettings.restaurantName}")`);
      }
      return mergedSettings;
    } else {
      const notFoundMsg = `[settingsService][getSettingsById] Settings document NOT FOUND for path ${settingsPath}. Returning default settings (restaurantName: "${defaultCombinedSettings.restaurantName}").`;
      if (settingsDocId === PUBLIC_RESTAURANT_ID) {
        console.warn(`${notFoundMsg} You should create this document for public-facing details.`);
      } else {
         console.warn(`${notFoundMsg} This user may need to save their settings first.`);
      }
      return { ...defaultCombinedSettings }; 
    }
  } catch (error) {
    console.error(`[settingsService][getSettingsById] Error fetching restaurant settings from ${settingsPath}: `, error);
    console.warn(`[settingsService][getSettingsById] Error resulted in returning default settings (restaurantName: "${defaultCombinedSettings.restaurantName}").`);
    return { ...defaultCombinedSettings }; 
  }
};

export const getRestaurantSettings = async (): Promise<CombinedSettings> => {
  const user = auth.currentUser;
  if (!user) {
    console.warn("[settingsService][getRestaurantSettings] No authenticated user. Returning general default settings (name: My Restaurant).");
    return { ...defaultCombinedSettings, restaurantName: "My Restaurant" };
  }
  console.log(`[settingsService][getRestaurantSettings] Authenticated user found: ${user.uid}. Fetching their specific settings.`);
  return getSettingsById(user.uid);
};

export const getPublicRestaurantSettings = async (): Promise<CombinedSettings> => {
  console.log("[settingsService][getPublicRestaurantSettings] Fetching public restaurant settings.");
  return getSettingsById(PUBLIC_RESTAURANT_ID);
};


const getScheduleById = async (settingsDocId: string): Promise<RestaurantSchedule> => {
  const schedulePath = `${SETTINGS_COLLECTION}/${settingsDocId} (schedule field)`;
  console.log(`[settingsService] Fetching schedule from doc ID ${settingsDocId}`);
  try {
    const settingsRef = doc(db, SETTINGS_COLLECTION, settingsDocId);
    const docSnap = await getDoc(settingsRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      if (data.schedule && Array.isArray(data.schedule)) {
        const sanitizedSchedule = (data.schedule as DaySchedule[]).map(day => ({
          ...day,
          timeSlots: day.timeSlots && Array.isArray(day.timeSlots) ? day.timeSlots : []
        }));
        return sanitizedSchedule;
      }
      console.warn(`[settingsService] Settings document found for ${settingsDocId}, but 'schedule' field is missing/invalid. Returning default.`);
      return [...defaultScheduleData];
    } else {
      console.warn(`[settingsService] No settings document found (for schedule) for ${settingsDocId}. Returning default schedule.`);
      return [...defaultScheduleData];
    }
  } catch (error) {
    console.error(`[settingsService] Error fetching restaurant schedule from ${schedulePath}: `, error);
    return [...defaultScheduleData];
  }
};


export const saveRestaurantSchedule = async (schedule: RestaurantSchedule): Promise<void> => {
  const user = auth.currentUser;
  if (!user) {
    console.error("[settingsService] No authenticated user found. Cannot save schedule.");
    throw new Error("User not authenticated. Cannot save schedule.");
  }
  const settingsDocId = user.uid;
  const settingsRef = doc(db, SETTINGS_COLLECTION, settingsDocId);
  console.log(`[settingsService] Saving schedule for user ${user.uid} to doc ID ${settingsDocId}`);

  try {
    const scheduleToSave = schedule.map(day => ({
      ...day,
      timeSlots: day.timeSlots && Array.isArray(day.timeSlots) ? day.timeSlots : []
    }));
    await setDoc(settingsRef, {
      schedule: scheduleToSave,
      scheduleUpdatedAt: serverTimestamp(),
      ownerUID: user.uid,
    }, { merge: true });
  } catch (error) {
    console.error(`[settingsService] Error saving restaurant schedule for doc ${settingsDocId}: `, error);
    throw error;
  }
};

export const getRestaurantSchedule = async (): Promise<RestaurantSchedule> => {
  const user = auth.currentUser;
  if (!user) {
    console.warn("[settingsService] No authenticated user for getRestaurantSchedule. Returning default schedule.");
    return [...defaultScheduleData];
  }
  return getScheduleById(user.uid);
};

export const getPublicRestaurantSchedule = async (): Promise<RestaurantSchedule> => {
  return getScheduleById(PUBLIC_RESTAURANT_ID);
};
