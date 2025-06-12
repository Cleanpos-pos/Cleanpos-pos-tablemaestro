
export interface RestaurantDetails {
  name: string;
  address: string;
  phone: string;
  cuisine: string;
  description: string;
  imageUrl: string;
  rating?: number; // Optional rating, e.g., 1-5
}

export interface Booking {
  id: string;
  guestName: string;
  guestEmail?: string;
  guestPhone?: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM (24-hour format)
  partySize: number;
  status: 'confirmed' | 'cancelled' | 'pending' | 'seated' | 'completed';
  notes?: string;
  createdAt: string; // ISO date string
  tableId?: string; // Optional: if assigned to a specific table
}

export interface DaySchedule {
  dayOfWeek: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
  isOpen: boolean;
  openTime?: string; // HH:MM
  closeTime?: string; // HH:MM
}

export type RestaurantSchedule = DaySchedule[];

export interface ReservationSettings {
  minAdvanceReservationHours: number;
  maxReservationDurationHours: number; // Max time a table can be booked for
  maxGuestsPerBooking: number;
  timeSlotIntervalMinutes: number; // e.g., 15, 30 for 15/30-minute slots
  bookingLeadTimeDays: number; // How many days in advance can bookings be made
}

export interface RestaurantProfileSettings {
  restaurantName?: string | null; // Changed to allow null
  restaurantImageUrl?: string | null;
  restaurantGalleryUrls?: (string | null)[]; // Array of up to 6 image URLs or nulls
}

// Combined type for the settings page form
export type CombinedSettings = ReservationSettings & RestaurantProfileSettings;

export interface Table {
  id: string;
  name: string; // e.g., "Table 1", "Patio Booth 2"
  capacity: number;
  status: 'available' | 'occupied' | 'reserved' | 'unavailable';
  location?: string; // e.g., "Main Dining", "Patio", "Bar"
}
