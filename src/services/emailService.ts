
'use server';
/**
 * @fileOverview A service for sending transactional emails via Brevo API.
 */
import { getPublicRestaurantSettings } from '@/services/settingsService';
import type { CombinedSettings } from '@/lib/types';

const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';
const DEFAULT_SENDER_EMAIL = 'info@posso.uk';
const DEFAULT_FALLBACK_RESTAURANT_NAME = "My Restaurant";

export interface SendEmailInput {
  to: string;
  subject: string;
  htmlContent: string;
  senderName?: string;
  senderEmail?: string;
}

export interface SendEmailOutput {
  success: boolean;
  messageId?: string;
  error?: string;
}

async function getDynamicSenderInfo(): Promise<{ name: string, email: string }> {
  try {
    const settings: CombinedSettings | null = await getPublicRestaurantSettings();
    const restaurantName = settings?.restaurantName || DEFAULT_FALLBACK_RESTAURANT_NAME;
    return { name: restaurantName, email: DEFAULT_SENDER_EMAIL };
  } catch (error) {
    console.warn("[emailService] Could not fetch public restaurant settings for sender name, using default. Error:", error);
    return { name: DEFAULT_FALLBACK_RESTAURANT_NAME, email: DEFAULT_SENDER_EMAIL };
  }
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailOutput> {
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
    console.log(`[emailService] Preparing to send email to: ${payload.to[0].email}`);
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
      console.error('[emailService] Brevo API error response:', errorBody);
      const errorMessage = errorBody?.message || `Brevo API request failed with status ${response.status}`;
      return { success: false, error: errorMessage };
    }

    const result = await response.json();
    console.log('[emailService] Email sent successfully via Brevo. Result:', result);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error('[emailService] Error sending email via Brevo:', error);
    return { success: false, error: error instanceof Error ? error.message : 'An unknown error occurred while sending email.' };
  }
}
