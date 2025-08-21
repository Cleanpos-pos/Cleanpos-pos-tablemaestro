
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
import { getSettingsById } from '@/services/settingsService';
import { auth } from '@/config/firebase';

const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';
const DEFAULT_SENDER_EMAIL = 'info@posso.uk';
const DEFAULT_FALLBACK_RESTAURANT_NAME = "My Restaurant";

const SendEmailInputSchema = z.object({
  to: z.string().email().describe('The recipient\'s email address.'),
  subject: z.string().describe('The subject line of the email.'),
  htmlContent: z.string().describe('The HTML content of the email body.'),
  // In a multi-tenant app, ownerUID is crucial to fetch the correct settings.
  ownerUID: z.string().optional().describe('The UID of the restaurant owner to fetch settings for. Defaults to the currently authenticated user.'),
});
export type SendEmailInput = z.infer<typeof SendEmailInputSchema>;

const SendEmailOutputSchema = z.object({
  success: z.boolean().describe('Whether the email was sent successfully.'),
  messageId: z.string().optional().describe('The message ID from Brevo if successful.'),
  error: z.string().optional().describe('Error message if sending failed.'),
});
export type SendEmailOutput = z.infer<typeof SendEmailOutputSchema>;


async function getDynamicSenderInfo(ownerId: string | undefined): Promise<{name: string, email: string}> {
    const user = auth.currentUser;
    const targetOwnerId = ownerId || user?.uid;

    if (!targetOwnerId) {
        console.warn("[sendEmailFlow] No ownerUID provided and no user is authenticated. Cannot fetch tenant-specific sender name. Using default.");
        return { name: DEFAULT_FALLBACK_RESTAURANT_NAME, email: DEFAULT_SENDER_EMAIL };
    }

    try {
        const settings: CombinedSettings | null = await getSettingsById(targetOwnerId);
        const restaurantName = settings?.restaurantName || DEFAULT_FALLBACK_RESTAURANT_NAME;

        return { name: restaurantName, email: DEFAULT_SENDER_EMAIL };
    } catch (error) {
        console.warn(`[sendEmailFlow] Could not fetch settings for owner ${targetOwnerId} to get sender name, using default. Error:`, error);
        return { name: DEFAULT_FALLBACK_RESTAURANT_NAME, email: DEFAULT_SENDER_EMAIL };
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
    
    // The sender name is now dynamically fetched based on the owner of the content.
    const dynamicSender = await getDynamicSenderInfo(input.ownerUID);

    const payload = {
      sender: { email: dynamicSender.email, name: dynamicSender.name },
      to: [{ email: input.to }],
      subject: input.subject,
      htmlContent: input.htmlContent,
    };

    try {
      // Enhanced logging
      console.log(`[sendEmailFlow] Preparing to send email for owner: ${input.ownerUID || 'authed_user'}.`);
      console.log(`[sendEmailFlow] To: ${payload.to[0].email}`);
      console.log(`[sendEmailFlow] Subject: ${payload.subject.substring(0, 100)}...`);
      console.log(`[sendEmailFlow] Sender: ${payload.sender.name} <${payload.sender.email}>`);
      
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
        console.error('[sendEmailFlow] Brevo API error response:', errorBody);
        const errorMessage = errorBody?.message || `Brevo API request failed with status ${response.status}`;
        return { success: false, error: errorMessage };
      }

      const result = await response.json();
      console.log('[sendEmailFlow] Email sent successfully via Brevo. Result:', result);
      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error('[sendEmailFlow] Error sending email via Brevo:', error);
      return { success: false, error: error instanceof Error ? error.message : 'An unknown error occurred while sending email.' };
    }
  }
);


export async function sendEmail(input: SendEmailInput): Promise<SendEmailOutput> {
  return sendEmailFlow(input);
}
