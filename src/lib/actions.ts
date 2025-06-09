"use server";

import { waitlistOptimization, type WaitlistOptimizationInput, type WaitlistOptimizationOutput } from "@/ai/flows/waitlist-optimization";
import { z } from "zod";

const WaitlistOptimizationFormSchema = z.object({
  reservationData: z.string().min(1, "Reservation data is required."),
  tableAvailability: z.string().min(1, "Table availability data is required."),
  customerWaitlist: z.string().min(1, "Customer waitlist data is required."),
});

export interface WaitlistFormState {
  message?: string;
  errors?: {
    reservationData?: string[];
    tableAvailability?: string[];
    customerWaitlist?: string[];
    _form?: string[];
  };
  output?: WaitlistOptimizationOutput;
}

export async function optimizeWaitlistAction(
  prevState: WaitlistFormState,
  formData: FormData
): Promise<WaitlistFormState> {
  const validatedFields = WaitlistOptimizationFormSchema.safeParse({
    reservationData: formData.get("reservationData"),
    tableAvailability: formData.get("tableAvailability"),
    customerWaitlist: formData.get("customerWaitlist"),
  });

  if (!validatedFields.success) {
    return {
      message: "Validation failed. Please check the input fields.",
      errors: validatedFields.error.flatten().fieldErrors,
    };
  }

  const inputData: WaitlistOptimizationInput = validatedFields.data;

  try {
    const result = await waitlistOptimization(inputData);
    return {
      message: "Waitlist optimization successful!",
      output: result,
    };
  } catch (error) {
    console.error("Error in waitlist optimization:", error);
    let errorMessage = "An unexpected error occurred during optimization.";
    if (error instanceof Error) {
        errorMessage = error.message;
    }
    return {
      message: "Optimization Failed.",
      errors: { _form: [errorMessage] },
    };
  }
}

// Add other server actions here as needed for other forms
