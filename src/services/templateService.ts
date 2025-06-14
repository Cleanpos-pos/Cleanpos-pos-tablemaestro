
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

export const BOOKING_ACCEPTED_TEMPLATE_ID = 'bookingAccepted';
export const NO_AVAILABILITY_TEMPLATE_ID = 'noAvailability';
export const WAITING_LIST_TEMPLATE_ID = 'waitingList';

export const defaultBookingAcceptedPlaceholders = [
  '{{guestName}}', 
  '{{bookingDate}}', 
  '{{bookingTime}}', 
  '{{partySize}}', 
  '{{restaurantName}}',
  '{{notes}}'
];
const defaultBookingAcceptedTemplateContent: EmailTemplateInput = {
  subject: 'Your booking at {{restaurantName}} is confirmed!',
  body: `Dear {{guestName}},\n\nThank you for your booking at {{restaurantName}}.\n\nYour reservation details are:\nDate: {{bookingDate}}\nTime: {{bookingTime}}\nParty Size: {{partySize}}\n{{#if notes}}Special Requests: {{notes}}\n{{/if}}\nWe look forward to welcoming you!\n\nSincerely,\nThe {{restaurantName}} Team`,
};

export const defaultNoAvailabilityPlaceholders = [
  '{{guestName}}',
  '{{requestedDate}}',
  '{{requestedTime}}',
  '{{requestedPartySize}}',
  '{{restaurantName}}',
  // Consider adding a link to your booking page or contact info
  // '{{bookingPageLink}}',
  // '{{restaurantPhone}}'
];
const defaultNoAvailabilityTemplateContent: EmailTemplateInput = {
  subject: 'Regarding your booking request at {{restaurantName}}',
  body: `Dear {{guestName}},\n\nThank you for your interest in dining at {{restaurantName}}.\n\nUnfortunately, we do not have availability for {{requestedPartySize}} guests on {{requestedDate}} at {{requestedTime}}.\n\nWe apologize for any inconvenience. Please feel free to try booking for another date or time, or contact us directly.\n\nSincerely,\nThe {{restaurantName}} Team`,
};

export const defaultWaitingListPlaceholders = [
  '{{guestName}}',
  '{{requestedDate}}',
  '{{requestedTime}}',
  '{{partySize}}',
  '{{restaurantName}}',
  '{{estimatedWaitTime}}', // e.g., "approximately 30-45 minutes"
  // Consider a link to check status or how they'll be notified
  // '{{waitlistStatusLink}}'
];
const defaultWaitingListTemplateContent: EmailTemplateInput = {
  subject: 'You\'ve been added to the waitlist at {{restaurantName}}',
  body: `Dear {{guestName}},\n\nYou have been added to the waitlist for {{restaurantName}} for {{partySize}} guests for {{requestedDate}} around {{requestedTime}}.\n\nYour estimated wait time is {{estimatedWaitTime}}.\n\nWe will notify you as soon as a table becomes available.\n\nSincerely,\nThe {{restaurantName}} Team`,
};


const getTemplateDocRef = (templateId: string) => {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("User not authenticated to access email templates.");
  }
  if (!templateId || typeof templateId !== 'string' || templateId.trim() === '') {
    throw new Error("Invalid templateId provided.");
  }
  return doc(db, `restaurantConfig/${user.uid}/${TEMPLATES_COLLECTION_NAME}`, templateId);
};

const getDefaultContentForTemplate = (templateId: string): { content: EmailTemplateInput, placeholders: string[] } => {
  switch (templateId) {
    case BOOKING_ACCEPTED_TEMPLATE_ID:
      return { content: defaultBookingAcceptedTemplateContent, placeholders: defaultBookingAcceptedPlaceholders };
    case NO_AVAILABILITY_TEMPLATE_ID:
      return { content: defaultNoAvailabilityTemplateContent, placeholders: defaultNoAvailabilityPlaceholders };
    case WAITING_LIST_TEMPLATE_ID:
      return { content: defaultWaitingListTemplateContent, placeholders: defaultWaitingListPlaceholders };
    default:
      // Fallback to accepted/confirmation if ID is unknown, though UI should prevent this
      console.warn(`[templateService] Unknown templateId "${templateId}" in getDefaultContent. Falling back to bookingAccepted.`);
      return { content: defaultBookingAcceptedTemplateContent, placeholders: defaultBookingAcceptedPlaceholders };
  }
};

export const getEmailTemplate = async (templateId: string): Promise<EmailTemplate> => {
  const user = auth.currentUser;
  const { content: defaultContent, placeholders: defaultPlaceholders } = getDefaultContentForTemplate(templateId);
  
  const baseTemplate = {
    id: templateId,
    subject: defaultContent.subject,
    body: defaultContent.body,
    placeholders: defaultPlaceholders,
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
        ...baseTemplate,
        subject: data.subject || defaultContent.subject,
        body: data.body || defaultContent.body,
        updatedAt: updatedAt,
      };
    } else {
      console.log(`[templateService] Template ${templateId} not found for user ${user.uid}. Returning default.`);
      return baseTemplate;
    }
  } catch (error) {
    console.error(`[templateService] Error fetching email template ${templateId} for user ${user.uid}: `, error);
    return { ...baseTemplate, subject: "Error loading template", body: "Could not load template content."};
  }
};

export const saveEmailTemplate = async (
  templateId: string,
  data: EmailTemplateInput
): Promise<void> => {
  const templateRef = getTemplateDocRef(templateId); 
  try {
    await setDoc(templateRef, {
      subject: data.subject,
      body: data.body,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  } catch (error) {
    console.error(`[templateService] Error saving email template ${templateId}: `, error);
    throw error;
  }
};
