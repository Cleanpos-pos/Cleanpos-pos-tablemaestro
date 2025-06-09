// src/ai/flows/waitlist-optimization.ts
'use server';

/**
 * @fileOverview AI-powered waitlist management tool that optimizes seating arrangements based on reservation data and suggests optimal seating arrangements.
 *
 * - waitlistOptimization - A function that handles the waitlist optimization process.
 * - WaitlistOptimizationInput - The input type for the waitlistOptimization function.
 * - WaitlistOptimizationOutput - The return type for the waitlistOptimization function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const WaitlistOptimizationInputSchema = z.object({
  reservationData: z
    .string()
    .describe('JSON string containing reservation details including party size, arrival time, and special requests.'),
  tableAvailability: z
    .string()
    .describe('JSON string representing current table availability and table sizes.'),
  customerWaitlist: z
    .string()
    .describe('JSON string including waitlist customer details: name, party size and arrival time.'),
});
export type WaitlistOptimizationInput = z.infer<typeof WaitlistOptimizationInputSchema>;

const WaitlistOptimizationOutputSchema = z.object({
  suggestedSeatingArrangements: z
    .string()
    .describe('JSON string of suggested seating arrangements, optimizing for maximum occupancy and minimal wait times.'),
  estimatedWaitTimes: z
    .string()
    .describe('JSON string containing estimated wait times for each party on the waitlist.'),
  occupancyRate: z
    .number()
    .describe('The predicted occupancy rate (%) with the suggested seating arrangement.'),
});
export type WaitlistOptimizationOutput = z.infer<typeof WaitlistOptimizationOutputSchema>;

export async function waitlistOptimization(input: WaitlistOptimizationInput): Promise<WaitlistOptimizationOutput> {
  return waitlistOptimizationFlow(input);
}

const prompt = ai.definePrompt({
  name: 'waitlistOptimizationPrompt',
  input: {schema: WaitlistOptimizationInputSchema},
  output: {schema: WaitlistOptimizationOutputSchema},
  prompt: `You are an AI restaurant seating optimization expert. Given the following restaurant data, reservation information, and waitlist, provide an optimal seating arrangement to maximize occupancy and minimize guest wait times.

Reservation Data: {{{reservationData}}}

Table Availability: {{{tableAvailability}}}

Customer Waitlist: {{{customerWaitlist}}}

Consider all data to provide a JSON-formatted suggested seating arrangement, estimated wait times for each party on the waitlist, and the predicted occupancy rate with your suggested arrangement.

Output should be a JSON object conforming to: ${JSON.stringify(WaitlistOptimizationOutputSchema.shape)}`,
});

const waitlistOptimizationFlow = ai.defineFlow(
  {
    name: 'waitlistOptimizationFlow',
    inputSchema: WaitlistOptimizationInputSchema,
    outputSchema: WaitlistOptimizationOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
