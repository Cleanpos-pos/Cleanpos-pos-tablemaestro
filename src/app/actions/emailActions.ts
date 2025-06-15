
'use server';

import { sendEmail, type SendEmailInput, type SendEmailOutput } from '@/ai/flows/sendEmailFlow';
import { 
    getEmailTemplate, 
    BOOKING_ACCEPTED_TEMPLATE_ID,
    NO_AVAILABILITY_TEMPLATE_ID,
    WAITING_LIST_TEMPLATE_ID
} from '@/services/templateService';
import { renderSimpleTemplate } from '@/lib/templateUtils';
// No longer need getSettingsById or CombinedSettings here for fetching restaurant name
import { format } from 'date-fns';

interface SendTestEmailResult {
  success: boolean;
  message: string;
}

// No longer fetches settings here, restaurantName is passed in
function getDummyDataForTemplate(
  templateId: string, 
  adminProvidedRestaurantName: string // Directly use the passed restaurant name
): Record<string, any> {
  
  const commonData = {
    guestName: 'Test Guest',
    restaurantName: adminProvidedRestaurantName, // Use the name passed from the client/action
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
  adminUserUID: string, // Keep for potential future use or logging, but name comes from adminRestaurantName
  adminRestaurantName: string // New parameter for the admin's specific restaurant name
): Promise<SendTestEmailResult> {
  console.log(`[sendTestEmailAction] Initiated for templateId: ${templateId}, recipient: ${recipientEmail}, adminUID: ${adminUserUID}, adminRestaurantName: "${adminRestaurantName}"`);

  if (!adminUserUID) { // Still good to check for UID for other purposes if needed
    return { success: false, message: "Admin user ID is missing." };
  }
  if (!adminRestaurantName) {
    return { success: false, message: "Restaurant name for the admin was not provided." };
  }
  if (!recipientEmail || !recipientEmail.includes('@')) {
    return { success: false, message: "Invalid recipient email address provided." };
  }

  try {
    const template = await getEmailTemplate(templateId); 
    if (!template || !template.subject || !template.body) {
      return { success: false, message: `Template "${templateId}" not found or is incomplete.` };
    }
    
    // Use the adminRestaurantName passed from the client
    const dummyData = getDummyDataForTemplate(templateId, adminRestaurantName); 

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
      senderName: adminRestaurantName, // Use the admin's specific restaurant name for the senderName
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

