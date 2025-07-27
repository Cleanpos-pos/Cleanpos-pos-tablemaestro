
'use server';

import { addCommunicationNoteToBooking } from "@/services/bookingService";
import { revalidatePath } from "next/cache";

interface ActionResult {
    success: boolean;
    message: string;
}

export async function addCommunicationNoteAction(bookingId: string, note: string): Promise<ActionResult> {
    if (!bookingId || !note) {
        return { success: false, message: "Booking ID and note are required." };
    }
    
    try {
        await addCommunicationNoteToBooking(bookingId, note);
        // Revalidate the path to ensure the updated data is shown on the client
        revalidatePath(`/admin/bookings/edit/${bookingId}`);
        return { success: true, message: "Communication note added successfully." };
    } catch (error) {
        console.error(`[addCommunicationNoteAction] Error adding note to booking ${bookingId}:`, error);
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
        return { success: false, message: `Failed to add note: ${errorMessage}` };
    }
}
