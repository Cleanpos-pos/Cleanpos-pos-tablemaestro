import RestaurantDetailsCard from "@/components/public/RestaurantDetailsCard";
import BookingForm from "@/components/public/BookingForm";
import type { RestaurantDetails as RestaurantDetailsType } from "@/lib/types";

// Mock data for restaurant details
const restaurantDetailsData: RestaurantDetailsType = {
  name: "The Gourmet Table",
  address: "123 Culinary Avenue, Foodville, CA 90210",
  phone: "(555) 123-4567",
  cuisine: "Modern European",
  description: "Experience exquisite Modern European cuisine in a sophisticated and welcoming atmosphere. Our chefs use only the freshest seasonal ingredients to create memorable dishes.",
  imageUrl: "https://placehold.co/1200x600.png", // data-ai-hint="restaurant exterior" is in component
  rating: 4.8,
};

// Mock schedule and settings for BookingForm. In a real app, fetch this.
// These would be fetched from a database or CMS.
const mockSchedule = [
  { dayOfWeek: 'monday', isOpen: true, openTime: '17:00', closeTime: '22:00' },
  { dayOfWeek: 'tuesday', isOpen: true, openTime: '17:00', closeTime: '22:00' },
  { dayOfWeek: 'wednesday', isOpen: true, openTime: '17:00', closeTime: '22:00' },
  { dayOfWeek: 'thursday', isOpen: true, openTime: '17:00', closeTime: '22:00' },
  { dayOfWeek: 'friday', isOpen: true, openTime: '17:00', closeTime: '23:00' },
  { dayOfWeek: 'saturday', isOpen: true, openTime: '12:00', closeTime: '23:00' },
  { dayOfWeek: 'sunday', isOpen: false },
];

const mockSettings = {
  minAdvanceReservationHours: 2,
  maxReservationDurationHours: 2.5,
  maxGuestsPerBooking: 8,
  timeSlotIntervalMinutes: 30,
  bookingLeadTimeDays: 60,
};


export default function PublicBookingPage() {
  return (
    <div className="space-y-12">
      <div>
        <RestaurantDetailsCard details={restaurantDetailsData} />
      </div>
      <div>
        <BookingForm schedule={mockSchedule} settings={mockSettings} />
      </div>
    </div>
  );
}
