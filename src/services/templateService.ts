
import { db, auth } from '@/config/firebase';
import type { EmailTemplate, EmailTemplateInput } from '@/lib/types';
import {
  doc,
  setDoc,
  getDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';

const TEMPLATES_COLLECTION_NAME = 'emailTemplates';
export const BOOKING_CONFIRMATION_TEMPLATE_ID = 'bookingConfirmation';

export const defaultBookingConfirmationTemplatePlaceholders = [
  '{{guestName}}', 
  '{{bookingDate}}', 
  '{{bookingTime}}', 
  '{{partySize}}', 
  '{{restaurantName}}',
  '{{notes}}'
];

const defaultBookingConfirmationTemplateContent: EmailTemplateInput = {
  subject: 'Your booking at {{restaurantName}} is confirmed!',
  body: `Dear {{guestName}},\n\nThank you for your booking at {{restaurantName}}.\n\nYour reservation details are:\nDate: {{bookingDate}}\nTime: {{bookingTime}}\nParty Size: {{partySize}}\n{{#if notes}}Special Requests: {{notes}}\n{{/if}}\nWe look forward to welcoming you!\n\nSincerely,\nThe {{restaurantName}} Team`,
};

const getTemplateDocRef = (templateId: string) => {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("User not authenticated to access email templates.");
  }
  // Ensure templateId is a non-empty string
  if (!templateId || typeof templateId !== 'string' || templateId.trim() === '') {
    throw new Error("Invalid templateId provided.");
  }
  return doc(db, `restaurantConfig/${user.uid}/${TEMPLATES_COLLECTION_NAME}`, templateId);
};

export const getEmailTemplate = async (templateId: string = BOOKING_CONFIRMATION_TEMPLATE_ID): Promise<EmailTemplate> => {
  const user = auth.currentUser;
  
  const baseTemplate = {
    id: templateId,
    subject: defaultBookingConfirmationTemplateContent.subject,
    body: defaultBookingConfirmationTemplateContent.body,
    placeholders: defaultBookingConfirmationTemplatePlaceholders,
  };

  if (!user) {
    console.warn(`[templateService] User not authenticated for getEmailTemplate(${templateId}). Returning default template.`);
    return baseTemplate;
  }

  try {
    const templateRef = getTemplateDocRef(templateId);
    const docSnap = await getDoc(templateRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      const updatedAt = data.updatedAt instanceof Timestamp ? data.updatedAt.toDate().toISOString() : undefined;
      return {
        ...baseTemplate, // Start with defaults (especially for placeholders)
        subject: data.subject || defaultBookingConfirmationTemplateContent.subject,
        body: data.body || defaultBookingConfirmationTemplateContent.body,
        updatedAt: updatedAt,
      };
    } else {
      console.log(`[templateService] Template ${templateId} not found for user ${user.uid}. Returning default.`);
      return baseTemplate;
    }
  } catch (error) {
    console.error(`[templateService] Error fetching email template ${templateId} for user ${user.uid}: `, error);
    // In case of error, return default to allow UI to function
    return { ...baseTemplate, subject: "Error loading template", body: "Could not load template content."};
  }
};

export const saveEmailTemplate = async (
  templateId: string = BOOKING_CONFIRMATION_TEMPLATE_ID,
  data: EmailTemplateInput
): Promise<void> => {
  // getTemplateDocRef will throw if user is not authenticated
  const templateRef = getTemplateDocRef(templateId); 
  try {
    await setDoc(templateRef, {
      subject: data.subject,
      body: data.body,
      updatedAt: serverTimestamp(),
    }, { merge: true }); // merge:true creates the document if it doesn't exist, or updates if it does.
  } catch (error) {
    console.error(`[templateService] Error saving email template ${templateId}: `, error);
    throw error; // Re-throw to be caught by the calling UI
  }
};
