
'use server';
/**
 * @fileOverview A service for sending transactional emails via a Genkit Flow.
 * This service has been refactored for a multi-tenant architecture.
 * The actual email sending logic, including fetching tenant-specific sender names,
 * is now handled in the sendEmailFlow to keep this service layer clean.
 */

import { sendEmail as sendEmailViaFlow, type SendEmailInput, type SendEmailOutput } from '@/ai/flows/sendEmailFlow';

// Re-exporting the types for convenience
export type { SendEmailInput, SendEmailOutput };

/**
 * Sends an email by invoking the central Genkit email flow.
 * The flow is responsible for handling tenant-specific details like sender name.
 * @param input - The details for the email to be sent.
 * @returns A promise that resolves with the output from the email flow.
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailOutput> {
  console.log(`[emailService] Relaying email request to sendEmailFlow. To: ${input.to}, Subject: ${input.subject}`);
  return sendEmailViaFlow(input);
}
