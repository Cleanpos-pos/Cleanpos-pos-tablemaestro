
'use client';

import { db, auth } from '@/config/firebase';
import {
  collection,
  addDoc,
  onSnapshot,
  doc,
} from 'firebase/firestore';

// Define your product price IDs from your Stripe dashboard
// IMPORTANT: Replace these placeholder IDs with your actual Stripe Price IDs
const priceIds = {
  starter: 'price_1PGaFzBFs8b6A123xABCdEFg', // Example: price_1PGaFzBf1234abcd5678efgh
  pro: 'price_1PGaGXBzXyZ1234abcd9101ijkl',     // Example: price_1PGaGXBf1234abcd9101ijkl
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
  if (!priceIds[planId]) {
      console.error(`Invalid planId: "${plan}". Cannot find matching price ID.`);
      throw new Error(`Invalid plan specified.`);
  }

  try {
    // 1. Create a new document in the 'checkout_sessions' collection for the user.
    const checkoutSessionRef = await addDoc(
      collection(db, 'customers', user.uid, 'checkout_sessions'),
      {
        price: priceIds[planId],
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
