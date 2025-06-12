
"use server";

import { z } from 'zod';
import type { WaitlistOptimizationInput, WaitlistOptimizationOutput } from '@/ai/flows/waitlist-optimization';
import { waitlistOptimization } from '@/ai/flows/waitlist-optimization';

// Zod schema for form data validation
const WaitlistFormSchema = z.object({
  reservationData: z.string().min(1, 'Reservation data JSON is required.'),
  tableAvailability: z.string().min(1, 'Table availability JSON is required.'),
  customerWaitlist: z.string().min(1, 'Customer waitlist JSON is required.'),
});

export interface WaitlistFormState {
  message?: string;
  errors?: {
    reservationData?: string[];
    tableAvailability?: string[];
    customerWaitlist?: string[];
    _form?: string[]; // For general form errors or errors from the AI flow
  };
  output?: WaitlistOptimizationOutput;
}

export async function optimizeWaitlistAction(
  prevState: WaitlistFormState,
  formData: FormData
): Promise<WaitlistFormState> {
  const validatedFields = WaitlistFormSchema.safeParse({
    reservationData: formData.get('reservationData'),
    tableAvailability: formData.get('tableAvailability'),
    customerWaitlist: formData.get('customerWaitlist'),
  });

  if (!validatedFields.success) {
    return {
      message: "Validation failed. Please check the JSON data in all fields.",
      errors: validatedFields.error.flatten().fieldErrors,
    };
  }

  // Basic JSON validation
  try {
    JSON.parse(validatedFields.data.reservationData);
  } catch (e) {
    return {
      message: "Invalid JSON in Reservation Data.",
      errors: { reservationData: ["Must be valid JSON."] }
    };
  }
  try {
    JSON.parse(validatedFields.data.tableAvailability);
  } catch (e) {
    return {
      message: "Invalid JSON in Table Availability.",
      errors: { tableAvailability: ["Must be valid JSON."] }
    };
  }
  try {
    JSON.parse(validatedFields.data.customerWaitlist);
  } catch (e) {
    return {
      message: "Invalid JSON in Customer Waitlist.",
      errors: { customerWaitlist: ["Must be valid JSON."] }
    };
  }


  try {
    const input: WaitlistOptimizationInput = {
      reservationData: validatedFields.data.reservationData,
      tableAvailability: validatedFields.data.tableAvailability,
      customerWaitlist: validatedFields.data.customerWaitlist,
    };

    // Call the Genkit flow
    const result = await waitlistOptimization(input);

    return {
      message: "Waitlist optimization analysis complete!",
      output: result,
      errors: {} // Clear previous errors
    };
  } catch (error) {
    console.error("Error in optimizeWaitlistAction:", error);
    let errorMessage = "An unknown error occurred during waitlist optimization.";
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    return {
      message: "Optimization Failed.",
      errors: { _form: [errorMessage] },
    };
  }
}
