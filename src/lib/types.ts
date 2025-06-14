
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

export interface TimeSlot {
  // id field is managed by useFieldArray, not part of stored data model typically
  name: string; // e.g., "Lunch", "Dinner", "Brunch"
  startTime: string; // HH:MM
  endTime: string; // HH:MM
}

export interface DaySchedule {
  dayOfWeek: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
  isOpen: boolean;
  timeSlots: TimeSlot[];
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
  restaurantName?: string | null;
  restaurantImageUrl?: string | null;
  restaurantGalleryUrls?: (string | null)[]; // Array of up to 6 image URLs or nulls
}

// Combined type for the settings page form
export type CombinedSettings = ReservationSettings & RestaurantProfileSettings;

export type TableStatus = 'available' | 'occupied' | 'reserved' | 'cleaning' | 'unavailable';

export interface Table {
  id: string;
  name: string; // e.g., "Table 1", "Patio Booth 2"
  capacity: number;
  status: TableStatus;
  location?: string; // e.g., "Main Dining", "Patio", "Bar" - Optional for now
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
}

export type TableInput = Omit<Table, 'id' | 'createdAt' | 'updatedAt'>;
export type TableUpdateData = Partial<TableInput>;

export interface ActivityItem {
  id: string;
  message: string;
  time: string;
  type: 'booking' | 'cancellation' | 'update' | 'system';
}

export interface EmailTemplate {
  id: string; 
  subject: string;
  body: string; 
  placeholders?: string[]; 
  updatedAt?: string; 
}

export type EmailTemplateInput = Pick<EmailTemplate, 'subject' | 'body'>;
