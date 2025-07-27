
'use client';

import { db, auth } from '@/config/firebase';
import {
  collection,
  addDoc,
  onSnapshot,
  doc,
} from 'firebase/firestore';

// =================================================================================
// Price IDs from your Stripe account.
// Starter Plan: Corresponds to £20/month price
// Pro Plan: Corresponds to £40/month price
// =================================================================================
const priceIds = {
  starter: 'price_1RpVuKBIjn0fCSSg59S4Fx0M',
  pro: 'price_1RpVv5BIjn0fCSSgxeDxX4DW',
};
type PlanId = keyof typeof priceIds;

/**
 * Creates a checkout session document in Firestore and redirects the user to the Stripe Checkout page.
 * @param plan The ID of the plan the user is subscribing to ('starter' or 'pro').
 */
export const createCheckoutRedirect = async (plan: string): Promise<void> => {
  const user = auth.currentUser;

  if (!user) {
    throw new Error('User must be signed in to initiate checkout.');
  }

  const planId = plan as PlanId;
  const selectedPriceId = priceIds[planId];

  if (!selectedPriceId || selectedPriceId.startsWith('REPLACE_WITH')) {
      const errorMessage = `Invalid or placeholder price ID for plan "${plan}". Please update the priceIds in src/services/paymentService.ts with your actual Stripe Price IDs.`;
      console.error(errorMessage);
      alert(errorMessage);
      throw new Error(errorMessage);
  }

  try {
    // 1. Create a new document in the 'checkout_sessions' collection for the user.
    const checkoutSessionRef = await addDoc(
      collection(db, 'customers', user.uid, 'checkout_sessions'),
      {
        price: selectedPriceId,
        success_url: `${window.location.origin}/admin/dashboard?payment_success=true`,
        cancel_url: `${window.location.origin}/pricing?payment_cancelled=true`,
      }
    );

    // 2. Listen for the 'url' field to be added to the document by the Stripe Firebase Extension.
    onSnapshot(checkoutSessionRef, (snap) => {
      const data = snap.data();
      if (data) {
        const { error, url } = data;
        if (error) {
          // Show an error to your customer and inspect your Cloud Function logs in the Firebase console.
          console.error(`An error occurred: ${error.message}`);
          alert(`An error occurred: ${error.message}`);
        }
        if (url) {
          // We have a Stripe Checkout URL, let's redirect.
          window.location.assign(url);
        }
      }
    });

  } catch (error) {
    console.error("Error creating Firestore checkout session document:", error);
    alert(`Error: Could not initiate payment. Please try again. Details: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
};
