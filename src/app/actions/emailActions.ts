
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
import { getRestaurantSettings } from '@/services/settingsService';
import { format } from 'date-fns';

interface SendTestEmailResult {
  success: boolean;
  message: string;
}

function getDummyDataForTemplate(templateId: string, restaurantName: string): Record<string, any> {
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
  recipientEmail: string
): Promise<SendTestEmailResult> {
  console.log(`[sendTestEmailAction] Initiated for templateId: ${templateId}, recipient: ${recipientEmail}`);

  if (!recipientEmail || !recipientEmail.includes('@')) {
    return { success: false, message: "Invalid recipient email address provided." };
  }

  try {
    const template = await getEmailTemplate(templateId);
    if (!template || !template.subject || !template.body) {
      return { success: false, message: `Template "${templateId}" not found or is incomplete.` };
    }
    
    let restaurantName = "My Restaurant"; // Default, updated from previous "Your Restaurant"
    try {
        const settings: CombinedSettings | null = await getRestaurantSettings();
        if (settings?.restaurantName) {
            restaurantName = settings.restaurantName;
        }
    } catch (settingsError) {
        console.warn("[sendTestEmailAction] Could not fetch restaurant settings for dummy data. Using default. Error:", settingsError);
    }

    const dummyData = getDummyDataForTemplate(templateId, restaurantName);

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
      // senderName and senderEmail will use defaults from sendEmailFlow if not specified
    };

    console.log(`[sendTestEmailAction] Calling sendEmail flow with input:`, {to: emailInput.to, subject: emailInput.subject.substring(0,50) + "..."});
    const result: SendEmailOutput = await sendEmail(emailInput);

    if (result.success) {
      console.log(`[sendTestEmailAction] Test email sent successfully. Message ID: ${result.messageId}`);
      return { success: true, message: `Test email sent successfully to ${recipientEmail}. Brevo Message ID: ${result.messageId || 'N/A'}` };
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

