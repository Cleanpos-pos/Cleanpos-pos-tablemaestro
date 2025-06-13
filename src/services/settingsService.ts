
import { db, auth } from '@/config/firebase'; // Added auth
import type { CombinedSettings, RestaurantSchedule, DaySchedule, TimeSlot } from '@/lib/types';
import {
  doc,
  setDoc,
  getDoc,
  serverTimestamp,
} from 'firebase/firestore';

const SETTINGS_COLLECTION = 'restaurantConfig';

// Default settings, useful for new users or if data is somehow missing
const defaultCombinedSettings: CombinedSettings = {
  minAdvanceReservationHours: 2,
  maxReservationDurationHours: 2.5,
  maxGuestsPerBooking: 10,
  timeSlotIntervalMinutes: 30,
  bookingLeadTimeDays: 90,
  restaurantName: "My Restaurant", // Default name
  restaurantImageUrl: null,
  restaurantGalleryUrls: Array(6).fill(null),
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
    // Create a deep copy to avoid modifying the input 'settings' object directly
    // and ensure all fields are present, defaulting from `defaultCombinedSettings` if necessary.
    const dataToSave: CombinedSettings = {
      ...defaultCombinedSettings, // Start with defaults
      ...settings // Override with provided settings
    };
    
    // Explicitly ensure potentially undefined optional fields are null for Firestore
    dataToSave.restaurantName = settings.restaurantName ?? null;
    dataToSave.restaurantImageUrl = settings.restaurantImageUrl ?? null;
    
    if (settings.restaurantGalleryUrls && Array.isArray(settings.restaurantGalleryUrls)) {
      dataToSave.restaurantGalleryUrls = settings.restaurantGalleryUrls.map(url => url ?? null);
    } else {
      dataToSave.restaurantGalleryUrls = Array(6).fill(null);
    }
    // Ensure it's exactly 6 elements
    if (dataToSave.restaurantGalleryUrls.length < 6) {
        dataToSave.restaurantGalleryUrls = [...dataToSave.restaurantGalleryUrls, ...Array(6 - dataToSave.restaurantGalleryUrls.length).fill(null)];
    } else if (dataToSave.restaurantGalleryUrls.length > 6) {
        dataToSave.restaurantGalleryUrls = dataToSave.restaurantGalleryUrls.slice(0, 6);
    }


    // Sanitize all top-level keys in dataToSave. If a key from CombinedSettings is missing
    // or undefined in dataToSave (after spread), set it to its default or null.
    (Object.keys(defaultCombinedSettings) as Array<keyof CombinedSettings>).forEach(key => {
        if (dataToSave[key] === undefined) {
            console.warn(`[settingsService] dataToSave.${key} was undefined, setting to default or null.`);
            (dataToSave as any)[key] = (defaultCombinedSettings as any)[key]; // Use default
             if (key === 'restaurantName' || key === 'restaurantImageUrl') {
                (dataToSave as any)[key] = null; // Explicitly null for these if somehow still undefined
            }
            if (key === 'restaurantGalleryUrls' && !(dataToSave[key])) {
                (dataToSave as any)[key] = Array(6).fill(null);
            }
        }
    });
    
    console.log("[settingsService] Data being sent to Firestore:", JSON.stringify(dataToSave));

    await setDoc(settingsRef, {
      ...dataToSave,
      updatedAt: serverTimestamp(),
      ownerUID: user.uid,
    }, { merge: true });
    console.log("[settingsService] Settings saved successfully for doc:", settingsDocId);

  } catch (error) {
    console.error(`[settingsService] Error saving restaurant settings for doc ${settingsDocId}: `, error);
    throw error;
  }
};

export const getRestaurantSettings = async (): Promise<CombinedSettings> => { // Changed to always return CombinedSettings
  const user = auth.currentUser;
  if (!user) {
    console.warn("[settingsService] No authenticated user for getRestaurantSettings. Returning default settings template.");
    return { ...defaultCombinedSettings, restaurantName: "Please Log In" }; // Indicate user needs to log in
  }
  const settingsDocId = user.uid;
  const settingsPath = `${SETTINGS_COLLECTION}/${settingsDocId}`;
  console.log(`[settingsService] Fetching settings for user ${user.uid} from doc ID ${settingsDocId}`);

  try {
    const settingsRef = doc(db, SETTINGS_COLLECTION, settingsDocId);
    const docSnap = await getDoc(settingsRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      // Merge fetched data with defaults to ensure all keys are present
      const mergedSettings: CombinedSettings = {
        ...defaultCombinedSettings, // Base defaults
        ...data, // Fetched data overrides defaults
        restaurantName: data.restaurantName ?? defaultCombinedSettings.restaurantName, // Explicit null handling
        restaurantImageUrl: data.restaurantImageUrl ?? defaultCombinedSettings.restaurantImageUrl,
        restaurantGalleryUrls: (data.restaurantGalleryUrls && Array.isArray(data.restaurantGalleryUrls) 
                                ? data.restaurantGalleryUrls 
                                : defaultCombinedSettings.restaurantGalleryUrls
                              ).map((url: string | null | undefined) => url ?? null).slice(0,6),
      };
      // Ensure gallery has 6 slots
      if (mergedSettings.restaurantGalleryUrls.length < 6) {
        mergedSettings.restaurantGalleryUrls = [
            ...mergedSettings.restaurantGalleryUrls, 
            ...Array(6 - mergedSettings.restaurantGalleryUrls.length).fill(null)
        ];
      }
      console.log("[settingsService] Fetched and merged settings:", JSON.stringify(mergedSettings));
      return mergedSettings;
    } else {
      console.warn(`[settingsService] No settings document found at: ${settingsPath}. Returning defaults for new user.`);
      return { ...defaultCombinedSettings, restaurantName: `${user.email}'s Restaurant` }; // Personalize default for new user
    }
  } catch (error) {
    console.error(`[settingsService] Error fetching restaurant settings from ${settingsPath}: `, error);
    // In case of error, return defaults to prevent breaking the form
    return { ...defaultCombinedSettings, restaurantName: "Error Loading Settings" };
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
    console.log("[settingsService] Schedule saved successfully for doc:", settingsDocId);
  } catch (error) {
    console.error(`[settingsService] Error saving restaurant schedule for doc ${settingsDocId}: `, error);
    throw error;
  }
};

export const getRestaurantSchedule = async (): Promise<RestaurantSchedule> => { // Changed to always return RestaurantSchedule
  const user = auth.currentUser;
  if (!user) {
    console.warn("[settingsService] No authenticated user for getRestaurantSchedule. Returning default schedule.");
    return [...defaultScheduleData]; 
  }
  const settingsDocId = user.uid;
  const schedulePath = `${SETTINGS_COLLECTION}/${settingsDocId} (schedule field)`;
  console.log(`[settingsService] Fetching schedule for user ${user.uid} from doc ID ${settingsDocId}`);

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
        console.log("[settingsService] Fetched schedule:", JSON.stringify(sanitizedSchedule));
        return sanitizedSchedule;
      }
      console.warn(`[settingsService] Settings document found for ${settingsDocId}, but 'schedule' field is missing/invalid. Returning default.`);
      return [...defaultScheduleData];
    } else {
      console.warn(`[settingsService] No settings document found (for schedule) for user ${settingsDocId}. Returning default schedule.`);
      return [...defaultScheduleData];
    }
  } catch (error) {
    console.error(`[settingsService] Error fetching restaurant schedule from ${schedulePath}: `, error);
    return [...defaultScheduleData]; // Return default on error
  }
};

