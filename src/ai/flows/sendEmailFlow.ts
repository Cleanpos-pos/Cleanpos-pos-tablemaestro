
'use server';
/**
 * @fileOverview A Genkit flow for sending transactional emails via Brevo API.
 *
 * - sendEmail - A function that handles sending an email.
 * - SendEmailInput - The input type for the sendEmailFlow.
 * - SendEmailOutput - The return type for the sendEmailFlow.
 */

import { ai } from '@/ai/genkit'; 
import { z } from 'genkit'; 
import type { CombinedSettings } from '@/lib/types';
import { getRestaurantSettings } from '@/services/settingsService'; 

const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';
const DEFAULT_SENDER_EMAIL = 'noreply@yourrestaurant.com'; 

const SendEmailInputSchema = z.object({
  to: z.string().email().describe('The recipient\'s email address.'),
  subject: z.string().describe('The subject line of the email.'),
  htmlContent: z.string().describe('The HTML content of the email body.'),
  senderName: z.string().optional().describe('Optional sender name. Defaults to restaurant name from settings or "Table Maestro".'),
  senderEmail: z.string().email().optional().describe(`Optional sender email. Defaults to ${DEFAULT_SENDER_EMAIL}. Must be a verified sender in Brevo.`),
});
export type SendEmailInput = z.infer<typeof SendEmailInputSchema>;

const SendEmailOutputSchema = z.object({
  success: z.boolean().describe('Whether the email was sent successfully.'),
  messageId: z.string().optional().describe('The message ID from Brevo if successful.'),
  error: z.string().optional().describe('Error message if sending failed.'),
});
export type SendEmailOutput = z.infer<typeof SendEmailOutputSchema>;


async function getDynamicSenderInfo(): Promise<{name: string, email: string}> {
    try {
        const settings: CombinedSettings | null = await getRestaurantSettings();
        const restaurantName = settings?.restaurantName || "Table Maestro";
        
        return { name: restaurantName, email: DEFAULT_SENDER_EMAIL };
    } catch (error) {
        console.warn("[sendEmailFlow] Could not fetch restaurant settings for sender name, using default. Error:", error);
        return { name: "Table Maestro", email: DEFAULT_SENDER_EMAIL };
    }
}


const sendEmailFlow = ai.defineFlow(
  {
    name: 'sendEmailFlow',
    inputSchema: SendEmailInputSchema,
    outputSchema: SendEmailOutputSchema,
  },
  async (input: SendEmailInput): Promise<SendEmailOutput> => {
    const apiKey = process.env.BREVO_API_KEY;

    if (!apiKey) {
      console.error('BREVO_API_KEY is not set in environment variables.');
      return { success: false, error: 'Email service is not configured (missing API key).' };
    }

    const dynamicSender = await getDynamicSenderInfo();
    const resolvedSenderEmail = input.senderEmail || dynamicSender.email;
    const resolvedSenderName = input.senderName || dynamicSender.name;


    const payload = {
      sender: { email: resolvedSenderEmail, name: resolvedSenderName },
      to: [{ email: input.to }],
      subject: input.subject,
      htmlContent: input.htmlContent,
    };

    try {
      console.log(`[sendEmailFlow] Sending email to: ${input.to} with subject: ${input.subject.substring(0,50)}...`);
      const response = await fetch(BREVO_API_URL, {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'api-key': apiKey,
          'content-type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorBody = await response.json();
        console.error('Brevo API error response:', errorBody);
        const errorMessage = errorBody?.message || `Brevo API request failed with status ${response.status}`;
        return { success: false, error: errorMessage };
      }

      const result = await response.json();
      console.log('[sendEmailFlow] Email sent successfully via Brevo. Result:', result);
      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error('Error sending email via Brevo:', error);
      return { success: false, error: error instanceof Error ? error.message : 'An unknown error occurred while sending email.' };
    }
  }
);


export async function sendEmail(input: SendEmailInput): Promise<SendEmailOutput> {
  return sendEmailFlow(input);
}

