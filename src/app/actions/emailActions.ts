
'use server';

import { sendEmail, type SendEmailInput, type SendEmailOutput } from '@/services/emailService';
import { 
    getEmailTemplate, 
    BOOKING_ACCEPTED_TEMPLATE_ID,
    NO_AVAILABILITY_TEMPLATE_ID,
    WAITING_LIST_TEMPLATE_ID,
    UPGRADE_PLAN_TEMPLATE_ID,
    defaultBookingAcceptedPlaceholders, 
    defaultNoAvailabilityPlaceholders,
    defaultWaitingListPlaceholders,
    defaultUpgradePlanPlaceholders
} from '@/services/templateService';
import { renderSimpleTemplate } from '@/lib/templateUtils';
// getSettingsById is removed as adminRestaurantName is passed directly
import { format, parseISO, isValid } from 'date-fns';

interface ActionResult {
  success: boolean;
  message: string;
}

// Dummy data generator for the main Email Templates admin page (test sends)
function getDummyDataForTemplate(
  templateId: string, 
  adminRestaurantName: string 
): Record<string, any> {
  
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
        }
    default:
      return commonData;
  }
}

// Action for the Email Templates admin page
export async function sendTestEmailAction(
  templateId: string,
  recipientEmail: string,
  adminUserUID: string, 
  adminRestaurantName: string 
): Promise<ActionResult> {
  console.log(`[sendTestEmailAction] Initiated for templateId: ${templateId}, recipient: ${recipientEmail}, adminUID: ${adminUserUID}, adminRestaurantName: "${adminRestaurantName}"`);

  if (!adminUserUID) { 
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
      senderName: adminRestaurantName, 
    };

    console.log(`[sendTestEmailAction] Calling sendEmail with input:`, {to: emailInput.to, subject: emailInput.subject.substring(0,50) + "...", senderName: emailInput.senderName});
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
  adminUserUID: string; // Still useful for logging or future admin-specific logic
  adminRestaurantName: string; // Passed from client
  bookingDetails: {
    guestName: string;
    date: string; // YYYY-MM-DD string
    time: string; // HH:MM
    partySize: number;
    notes?: string; // Added for confirmation email
  };
}

export async function sendBookingConfirmationEmailAction(params: BookingEmailParams): Promise<ActionResult> {
  const { recipientEmail, adminUserUID, adminRestaurantName, bookingDetails } = params;
  const templateId = BOOKING_ACCEPTED_TEMPLATE_ID;
  console.log(`[sendBookingConfirmationEmailAction] Initiated for ${recipientEmail}, admin: ${adminUserUID}, booking guest: ${bookingDetails.guestName}`);

  if (!recipientEmail || !recipientEmail.includes('@')) return { success: false, message: "Invalid recipient email." };
  if (!adminUserUID) return { success: false, message: "Admin user ID missing." };
  if (!adminRestaurantName) return { success: false, message: "Admin restaurant name missing."};

  try {
    const template = await getEmailTemplate(templateId); 
    if (!template || !template.subject || !template.body) {
      return { success: false, message: `"${templateId}" template not found or incomplete.` };
    }
    
    let formattedDate = 'N/A';
    if (bookingDetails.date) {
        try {
            const parsedDate = parseISO(bookingDetails.date);
            if (isValid(parsedDate)) {
                formattedDate = format(parsedDate, 'MMMM d, yyyy');
            }
        } catch (e) { console.warn(`Invalid date for Confirmation email: ${bookingDetails.date}`); }
    }

    const templateData: Record<string, any> = {
      guestName: bookingDetails.guestName,
      restaurantName: adminRestaurantName,
      bookingDate: formattedDate,
      bookingTime: bookingDetails.time,
      partySize: bookingDetails.partySize,
      notes: bookingDetails.notes
    };
    
    const subject = renderSimpleTemplate(template.subject, templateData);
    
    // Manually render the body to bypass issues with the conditional notes field.
    let body = renderSimpleTemplate(template.body, templateData);
    if (bookingDetails.notes && bookingDetails.notes.trim() !== '') {
        // This is a robust way to handle the conditional part if the simple renderer fails
        // We find the conditional block and replace it if it's still there.
        const conditionalRegex = /\{\{#if\s+notes\}\}([\s\S]*?)\{\{\/if\s*\}\}/g;
        if (conditionalRegex.test(body)) {
             body = body.replace(conditionalRegex, renderSimpleTemplate('$1', templateData));
        } else {
            // If the template was changed and no longer has the #if block, we might append it.
            // For now, we assume the notes placeholder is present.
            // This part is a safety net; the main replacement is handled by renderSimpleTemplate.
        }
    } else {
        // If no notes, ensure the conditional block is removed entirely.
         const conditionalRegex = /\{\{#if\s+notes\}\}([\s\S]*?)\{\{\/if\s*\}\}/g;
         body = body.replace(conditionalRegex, '');
    }


    if (!subject.trim() || !body.trim()) {
      return { success: false, message: "Rendered subject or body is empty for confirmation. Check template and data." };
    }

    const emailInput: SendEmailInput = { to: recipientEmail, subject, htmlContent: body, senderName: adminRestaurantName };
    const result = await sendEmail(emailInput);

    return result.success 
      ? { success: true, message: `Booking Confirmation email sent to ${recipientEmail}.` }
      : { success: false, message: `Failed to send Booking Confirmation email: ${result.error || 'Unknown error'}` };

  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Unknown server error.';
    console.error(`[sendBookingConfirmationEmailAction] Error:`, error);
    return { success: false, message: `Error sending email: ${errMsg}` };
  }
}


export async function sendNoAvailabilityEmailForBookingAction(params: BookingEmailParams): Promise<ActionResult> {
  const { recipientEmail, adminUserUID, adminRestaurantName, bookingDetails } = params;
  const templateId = NO_AVAILABILITY_TEMPLATE_ID;
  console.log(`[sendNoAvailabilityEmailForBookingAction] Initiated for ${recipientEmail}, admin: ${adminUserUID}, booking guest: ${bookingDetails.guestName}`);

  if (!recipientEmail || !recipientEmail.includes('@')) return { success: false, message: "Invalid recipient email." };
  if (!adminUserUID) return { success: false, message: "Admin user ID missing." };
  if (!adminRestaurantName) return { success: false, message: "Admin restaurant name missing."};


  try {
    const template = await getEmailTemplate(templateId);
    if (!template || !template.subject || !template.body) {
      return { success: false, message: `"${templateId}" template not found or incomplete.` };
    }
    
    let formattedDate = 'N/A';
    if (bookingDetails.date) {
        try {
            const parsedDate = parseISO(bookingDetails.date);
            if (isValid(parsedDate)) {
                formattedDate = format(parsedDate, 'MMMM d, yyyy');
            }
        } catch (e) { console.warn(`Invalid date for No Availability email: ${bookingDetails.date}`); }
    }

    const templateData = {
      guestName: bookingDetails.guestName,
      restaurantName: adminRestaurantName,
      requestedDate: formattedDate,
      requestedTime: bookingDetails.time,
      requestedPartySize: bookingDetails.partySize,
    };

    const subject = renderSimpleTemplate(template.subject, templateData);
    const body = renderSimpleTemplate(template.body, templateData);

    if (!subject.trim() || !body.trim()) {
      return { success: false, message: "Rendered subject or body is empty. Check template and data." };
    }

    const emailInput: SendEmailInput = { to: recipientEmail, subject, htmlContent: body, senderName: adminRestaurantName };
    const result = await sendEmail(emailInput);

    return result.success 
      ? { success: true, message: `No Availability email sent to ${recipientEmail}.` }
      : { success: false, message: `Failed to send No Availability email: ${result.error || 'Unknown error'}` };

  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Unknown server error.';
    console.error(`[sendNoAvailabilityEmailForBookingAction] Error:`, error);
    return { success: false, message: `Error sending email: ${errMsg}` };
  }
}

export async function sendWaitingListEmailForBookingAction(params: BookingEmailParams): Promise<ActionResult> {
  const { recipientEmail, adminUserUID, adminRestaurantName, bookingDetails } = params;
  const templateId = WAITING_LIST_TEMPLATE_ID;
  console.log(`[sendWaitingListEmailForBookingAction] Initiated for ${recipientEmail}, admin: ${adminUserUID}, booking guest: ${bookingDetails.guestName}`);

  if (!recipientEmail || !recipientEmail.includes('@')) return { success: false, message: "Invalid recipient email." };
  if (!adminUserUID) return { success: false, message: "Admin user ID missing." };
  if (!adminRestaurantName) return { success: false, message: "Admin restaurant name missing."};

  try {
    const template = await getEmailTemplate(templateId);
    if (!template || !template.subject || !template.body) {
      return { success: false, message: `"${templateId}" template not found or incomplete.` };
    }

    let formattedDate = 'N/A';
    if (bookingDetails.date) {
        try {
            const parsedDate = parseISO(bookingDetails.date);
             if (isValid(parsedDate)) {
                formattedDate = format(parsedDate, 'MMMM d, yyyy');
            }
        } catch (e) { console.warn(`Invalid date for Waiting List email: ${bookingDetails.date}`); }
    }
    
    const templateData = {
      guestName: bookingDetails.guestName,
      restaurantName: adminRestaurantName,
      requestedDate: formattedDate, 
      bookingDate: formattedDate,   
      requestedTime: bookingDetails.time, 
      bookingTime: bookingDetails.time,   
      partySize: bookingDetails.partySize,
      estimatedWaitTime: "Please contact us for current wait times.", 
    };

    const subject = renderSimpleTemplate(template.subject, templateData);
    const body = renderSimpleTemplate(template.body, templateData);
    
    if (!subject.trim() || !body.trim()) {
      return { success: false, message: "Rendered subject or body is empty. Check template and data." };
    }

    const emailInput: SendEmailInput = { to: recipientEmail, subject, htmlContent: body, senderName: adminRestaurantName };
    const result = await sendEmail( emailInput );

    return result.success 
      ? { success: true, message: `Waiting List email sent to ${recipientEmail}.` }
      : { success: false, message: `Failed to send Waiting List email: ${result.error || 'Unknown error'}` };

  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Unknown server error.';
    console.error(`[sendWaitingListEmailForBookingAction] Error:`, error);
    return { success: false, message: `Error sending email: ${errMsg}` };
  }
}


export async function sendUpgradePlanEmailAction(
    recipientEmail: string,
    restaurantName: string,
    currentBookingCount: number,
    bookingLimit: number
): Promise<ActionResult> {
    const templateId = UPGRADE_PLAN_TEMPLATE_ID;
    console.log(`[sendUpgradePlanEmailAction] Initiated for ${recipientEmail}`);

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
        
        const result = await sendEmail({ to: recipientEmail, subject, htmlContent: body, senderName: restaurantName });

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
