
'use server';

import { sendEmail, type SendEmailInput, type SendEmailOutput } from '@/ai/flows/sendEmailFlow';
import { 
    getEmailTemplate, 
    BOOKING_ACCEPTED_TEMPLATE_ID,
    NO_AVAILABILITY_TEMPLATE_ID,
    WAITING_LIST_TEMPLATE_ID
} from '@/services/templateService';
import { renderSimpleTemplate } from '@/lib/templateUtils';
import type { CombinedSettings } from '@/lib/types';
import { getSettingsById } from '@/services/settingsService'; // Changed to getSettingsById
import { format } from 'date-fns';

interface SendTestEmailResult {
  success: boolean;
  message: string;
}

// Fetches settings for a specific adminUserUID to populate dummy data
async function getDummyDataForTemplate(templateId: string, adminUserUID: string): Promise<Record<string, any>> {
  let restaurantName = "My Restaurant"; // Fallback if settings not found or name is missing
  try {
    console.log(`[sendTestEmailAction][getDummyDataForTemplate] Fetching settings for adminUserUID: ${adminUserUID}`);
    const settings: CombinedSettings | null = await getSettingsById(adminUserUID); 
    if (settings?.restaurantName) {
        restaurantName = settings.restaurantName;
        console.log(`[sendTestEmailAction][getDummyDataForTemplate] Found restaurant name: "${restaurantName}" for UID: ${adminUserUID}`);
    } else {
        console.warn(`[sendTestEmailAction][getDummyDataForTemplate] Restaurant name not found or null for UID: ${adminUserUID}. Using fallback "${restaurantName}". Settings object:`, settings);
    }
  } catch (settingsError) {
      console.warn(`[sendTestEmailAction][getDummyDataForTemplate] Could not fetch settings for UID: ${adminUserUID}. Using fallback. Error:`, settingsError);
  }

  const commonData = {
    guestName: 'Test Guest',
    restaurantName: restaurantName,
  };
  const currentDate = new Date();

  switch (templateId) {
    case BOOKING_ACCEPTED_TEMPLATE_ID:
      return {
        ...commonData,
        bookingDate: format(currentDate, 'MMMM d, yyyy'),
        bookingTime: '07:00 PM',
        partySize: 2,
        notes: 'This is a test booking with some special notes.',
      };
    case NO_AVAILABILITY_TEMPLATE_ID:
      return {
        ...commonData,
        requestedDate: format(currentDate, 'MMMM d, yyyy'),
        requestedTime: '08:00 PM',
        requestedPartySize: 4,
      };
    case WAITING_LIST_TEMPLATE_ID:
      return {
        ...commonData,
        requestedDate: format(currentDate, 'MMMM d, yyyy'),
        requestedTime: '07:30 PM',
        partySize: 3,
        estimatedWaitTime: '30-45 minutes',
      };
    default:
      return commonData;
  }
}

export async function sendTestEmailAction(
  templateId: string,
  recipientEmail: string,
  adminUserUID: string // Added adminUserUID parameter
): Promise<SendTestEmailResult> {
  console.log(`[sendTestEmailAction] Initiated for templateId: ${templateId}, recipient: ${recipientEmail}, adminUID: ${adminUserUID}`);

  if (!adminUserUID) {
    return { success: false, message: "Admin user ID is missing. Cannot determine correct restaurant settings." };
  }
  if (!recipientEmail || !recipientEmail.includes('@')) {
    return { success: false, message: "Invalid recipient email address provided." };
  }

  try {
    const template = await getEmailTemplate(templateId); // This fetches the template structure (subject/body strings)
    if (!template || !template.subject || !template.body) {
      return { success: false, message: `Template "${templateId}" not found or is incomplete.` };
    }
    
    // Fetch dummy data, including the admin's specific restaurantName
    const dummyData = await getDummyDataForTemplate(templateId, adminUserUID); 
    const adminRestaurantName = dummyData.restaurantName; // This will be the admin's configured name

    const renderedSubject = renderSimpleTemplate(template.subject, dummyData);
    const renderedBody = renderSimpleTemplate(template.body, dummyData);

    if (!renderedSubject.trim() || !renderedBody.trim()) {
        console.error(`[sendTestEmailAction] Rendered subject or body is empty for templateId: ${templateId}. Subject: "${renderedSubject}", Body (first 100 chars): "${renderedBody.substring(0,100)}..."`);
        return { success: false, message: `Rendered subject or body for template "${templateId}" became empty after processing placeholders. Please check your template content and placeholders in the admin settings.` };
    }

    const emailInput: SendEmailInput = {
      to: recipientEmail,
      subject: renderedSubject,
      htmlContent: renderedBody,
      // Use the admin's specific restaurant name for the senderName in test emails
      senderName: adminRestaurantName, 
      // senderEmail will use defaults from sendEmailFlow if not specified
    };

    console.log(`[sendTestEmailAction] Calling sendEmail flow with input:`, {to: emailInput.to, subject: emailInput.subject.substring(0,50) + "...", senderName: emailInput.senderName});
    const result: SendEmailOutput = await sendEmail(emailInput);

    if (result.success) {
      console.log(`[sendTestEmailAction] Test email sent successfully. Message ID: ${result.messageId}`);
      return { success: true, message: `Test email sent successfully to ${recipientEmail} from "${adminRestaurantName}". Brevo Message ID: ${result.messageId || 'N/A'}` };
    } else {
      console.error(`[sendTestEmailAction] Failed to send test email: ${result.error}`);
      return { success: false, message: `Failed to send test email: ${result.error || 'Unknown error from email flow'}` };
    }
  } catch (error) {
    console.error('[sendTestEmailAction] Unexpected error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { success: false, message: `Error sending test email: ${errorMessage}` };
  }
}

