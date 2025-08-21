
'use server';

import { sendEmail, type SendEmailInput, type SendEmailOutput } from '@/services/emailService';
import { 
    getEmailTemplate, 
    BOOKING_ACCEPTED_TEMPLATE_ID,
    NO_AVAILABILITY_TEMPLATE_ID,
    WAITING_LIST_TEMPLATE_ID,
    UPGRADE_PLAN_TEMPLATE_ID
} from '@/services/templateService';
import { renderSimpleTemplate } from '@/lib/templateUtils';
import { getSettingsById } from '@/services/settingsService';
import { format, parseISO, isValid } from 'date-fns';

interface ActionResult {
  success: boolean;
  message: string;
}

// Dummy data generator for the main Email Templates admin page (test sends)
async function getDummyDataForTemplate(
  templateId: string, 
  adminUserUID: string 
): Promise<Record<string, any>> {
  
  // Fetch the admin's actual restaurant name for realistic test data
  const adminSettings = await getSettingsById(adminUserUID);
  const adminRestaurantName = adminSettings?.restaurantName || "My Restaurant";

  const commonData = {
    guestName: 'Test Guest',
    restaurantName: adminRestaurantName, 
  };
  const currentDate = new Date();
  let bookingDate = 'N/A';
  try {
    bookingDate = format(currentDate, 'MMMM d, yyyy');
  } catch (e) {/* no-op, keep N/A */}


  switch (templateId) {
    case BOOKING_ACCEPTED_TEMPLATE_ID:
      return {
        ...commonData,
        bookingDate: bookingDate,
        bookingTime: '07:00 PM',
        partySize: 2,
        notes: 'This is a test booking with some special notes.',
      };
    case NO_AVAILABILITY_TEMPLATE_ID:
      return {
        ...commonData,
        requestedDate: bookingDate,
        requestedTime: '08:00 PM',
        requestedPartySize: 4,
      };
    case WAITING_LIST_TEMPLATE_ID:
      return {
        ...commonData,
        requestedDate: bookingDate, 
        bookingDate: bookingDate, 
        requestedTime: '07:30 PM', 
        bookingTime: '07:30 PM',   
        partySize: 3,
        estimatedWaitTime: '30-45 minutes',
      };
    case UPGRADE_PLAN_TEMPLATE_ID:
        return {
            ...commonData,
            bookingLimit: 30,
            currentBookingCount: 25,
        };
    default:
      return commonData;
  }
}

// Action for the Email Templates admin page
export async function sendTestEmailAction(
  templateId: string,
  recipientEmail: string,
  adminUserUID: string
): Promise<ActionResult> {
  console.log(`[sendTestEmailAction] Initiated for templateId: ${templateId}, recipient: ${recipientEmail}, adminUID: ${adminUserUID}`);

  if (!adminUserUID) { 
    return { success: false, message: "Admin user ID is missing." };
  }
  if (!recipientEmail || !recipientEmail.includes('@')) {
    return { success: false, message: "Invalid recipient email address provided." };
  }

  try {
    const template = await getEmailTemplate(templateId); 
    if (!template || !template.subject || !template.body) {
      return { success: false, message: `Template "${templateId}" not found or is incomplete.` };
    }
    
    const dummyData = await getDummyDataForTemplate(templateId, adminUserUID); 

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
      ownerUID: adminUserUID, // Pass owner UID to flow for correct sender name
    };

    const adminSettings = await getSettingsById(adminUserUID);
    const adminRestaurantName = adminSettings?.restaurantName || "My Restaurant";

    console.log(`[sendTestEmailAction] Calling sendEmail with input for owner ${adminUserUID}`);
    const result: SendEmailOutput = await sendEmail(emailInput);

    if (result.success) {
      console.log(`[sendTestEmailAction] Test email sent successfully. Message ID: ${result.messageId}`);
      return { success: true, message: `Test email sent successfully to ${recipientEmail} from "${adminRestaurantName}". Brevo Message ID: ${result.messageId || 'N/A'}` };
    } else {
      console.error(`[sendTestEmailAction] Failed to send test email: ${result.error}`);
      return { success: false, message: `Failed to send test email: ${result.error || 'Unknown error from email service'}` };
    }
  } catch (error) {
    console.error('[sendTestEmailAction] Unexpected error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { success: false, message: `Error sending test email: ${errorMessage}` };
  }
}


// --- Actions for Edit Booking Page ---

export interface BookingEmailParams {
  recipientEmail: string;
  adminUserUID: string; 
  bookingDetails: {
    guestName: string;
    date: string; // YYYY-MM-DD string
    time: string; // HH:MM
    partySize: number;
    notes?: string; // Added for confirmation email
  };
}

// Reusable function to send a booking-related email
async function sendBookingEmail(templateId: string, params: BookingEmailParams): Promise<ActionResult> {
  const { recipientEmail, adminUserUID, bookingDetails } = params;
  
  if (!recipientEmail || !recipientEmail.includes('@')) return { success: false, message: "Invalid recipient email." };
  if (!adminUserUID) return { success: false, message: "Admin user ID missing." };

  try {
    const [template, adminSettings] = await Promise.all([
      getEmailTemplate(templateId),
      getSettingsById(adminUserUID)
    ]);

    if (!template || !template.subject || !template.body) {
      return { success: false, message: `Template "${templateId}" not found or incomplete.` };
    }
    const adminRestaurantName = adminSettings?.restaurantName || "My Restaurant";

    let formattedDate = 'N/A';
    if (bookingDetails.date) {
        try {
            const parsedDate = parseISO(bookingDetails.date);
            if (isValid(parsedDate)) {
                formattedDate = format(parsedDate, 'MMMM d, yyyy');
            }
        } catch (e) { console.warn(`Invalid date for email: ${bookingDetails.date}`); }
    }

    const templateData: Record<string, any> = {
      guestName: bookingDetails.guestName,
      restaurantName: adminRestaurantName,
      bookingDate: formattedDate,
      bookingTime: bookingDetails.time,
      partySize: bookingDetails.partySize,
      notes: bookingDetails.notes,
      requestedDate: formattedDate,
      requestedTime: bookingDetails.time,
      requestedPartySize: bookingDetails.partySize,
      estimatedWaitTime: "Please contact us for current wait times.",
    };
    
    const subject = renderSimpleTemplate(template.subject, templateData);
    let body = renderSimpleTemplate(template.body, templateData);

    if (templateId === BOOKING_ACCEPTED_TEMPLATE_ID) {
      const conditionalRegex = /\{\{#if\s+notes\}\}([\s\S]*?)\{\{\/if\s*\}\}/g;
      if (bookingDetails.notes && bookingDetails.notes.trim() !== '') {
          if (conditionalRegex.test(body)) {
               body = body.replace(conditionalRegex, renderSimpleTemplate('$1', templateData));
          }
      } else {
           body = body.replace(conditionalRegex, '');
      }
    }

    if (!subject.trim() || !body.trim()) {
      return { success: false, message: "Rendered subject or body is empty. Check template and data." };
    }

    const emailInput: SendEmailInput = { 
      to: recipientEmail, 
      subject, 
      htmlContent: body, 
      ownerUID: adminUserUID // Pass owner UID to flow for correct sender name
    };
    const result = await sendEmail(emailInput);

    return result.success 
      ? { success: true, message: `Email sent to ${recipientEmail}.` }
      : { success: false, message: `Failed to send email: ${result.error || 'Unknown error'}` };

  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Unknown server error.';
    console.error(`[sendBookingEmail: ${templateId}] Error:`, error);
    return { success: false, message: `Error sending email: ${errMsg}` };
  }
}


export async function sendBookingConfirmationEmailAction(params: BookingEmailParams): Promise<ActionResult> {
    console.log(`[sendBookingConfirmationEmailAction] Initiated for ${params.recipientEmail}`);
    return sendBookingEmail(BOOKING_ACCEPTED_TEMPLATE_ID, params);
}

export async function sendNoAvailabilityEmailForBookingAction(params: BookingEmailParams): Promise<ActionResult> {
    console.log(`[sendNoAvailabilityEmailForBookingAction] Initiated for ${params.recipientEmail}`);
    return sendBookingEmail(NO_AVAILABILITY_TEMPLATE_ID, params);
}

export async function sendWaitingListEmailForBookingAction(params: BookingEmailParams): Promise<ActionResult> {
    console.log(`[sendWaitingListEmailForBookingAction] Initiated for ${params.recipientEmail}`);
    return sendBookingEmail(WAITING_LIST_TEMPLATE_ID, params);
}


export async function sendUpgradePlanEmailAction(
    recipientEmail: string,
    restaurantName: string,
    currentBookingCount: number,
    bookingLimit: number
): Promise<ActionResult> {
    const templateId = UPGRADE_PLAN_TEMPLATE_ID;
    const user = auth.currentUser;
    console.log(`[sendUpgradePlanEmailAction] Initiated for ${recipientEmail}`);
    if (!user) {
        return { success: false, message: "Action requires an authenticated user." };
    }

    try {
        const template = await getEmailTemplate(templateId);
        if (!template) {
            return { success: false, message: `Upgrade email template not found.` };
        }

        const templateData = {
            restaurantName,
            bookingLimit,
            currentBookingCount,
        };

        const subject = renderSimpleTemplate(template.subject, templateData);
        const body = renderSimpleTemplate(template.body, templateData);
        
        const result = await sendEmail({ 
            to: recipientEmail, 
            subject, 
            htmlContent: body,
            ownerUID: user.uid,
        });

        if (result.success) {
            console.log(`[sendUpgradePlanEmailAction] Upgrade email sent successfully to ${recipientEmail}.`);
            return { success: true, message: `Upgrade email sent.` };
        } else {
            console.error(`[sendUpgradePlanEmailAction] Failed to send upgrade email:`, result.error);
            return { success: false, message: result.error || "Unknown error sending upgrade email." };
        }
    } catch (error) {
        console.error(`[sendUpgradePlanEmailAction] Error:`, error);
        return { success: false, message: error instanceof Error ? error.message : "Unknown error." };
    }
}
