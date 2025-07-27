
'use client';

import { db, auth } from '@/config/firebase';
import {
  collection,
  addDoc,
  onSnapshot,
  doc,
  getDocs,
  query,
  where
} from 'firebase/firestore';

// =================================================================================
// Price IDs from your Stripe account.
// Make sure these are the correct IDs for the mode (Test vs. Live)
// that your Firebase extension is configured with.
//
// Starter Plan: Corresponds to £20/month price
// Pro Plan: Corresponds to £40/month price
// =================================================================================
const priceIds = {
  starter: 'price_1RpVuKBIjn0fCSSg59S4Fx0M',
  pro: 'price_1RpVv5BIjn0fCSSgxeDxX4DW',
};
type PlanId = keyof typeof priceIds;


/**
 * Verifies if a given Price ID has been synced from Stripe to Firestore.
 * @param priceId The Stripe Price ID to check.
 * @returns {Promise<boolean>} True if the price exists, false otherwise.
 */
async function verifyPriceExistsInFirestore(priceId: string): Promise<boolean> {
  try {
    // The extension creates a `products` collection with sub-collections for `prices`.
    const pricesQuery = query(
      collection(db, 'products'),
      where('active', '==', true)
    );
    const productsSnapshot = await getDocs(pricesQuery);

    for (const productDoc of productsSnapshot.docs) {
      const priceRef = doc(db, productDoc.ref.path, 'prices', priceId);
      const priceSnap = await getDoc(priceRef);
      if (priceSnap.exists()) {
        console.log(`[paymentService] Verified priceId "${priceId}" exists in Firestore for product "${productDoc.id}".`);
        return true;
      }
    }
    console.warn(`[paymentService] PriceId "${priceId}" was NOT found in the 'prices' sub-collection of any active product.`);
    return false;
  } catch (error) {
    console.error("[paymentService] Error verifying price in Firestore:", error);
    // If we can't verify, it's safer to assume it doesn't exist to prevent calls with bad IDs.
    return false;
  }
}


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

  if (!selectedPriceId) {
      const errorMessage = `Invalid plan ID "${plan}" provided. No matching Price ID found.`;
      console.error(errorMessage);
      alert(errorMessage);
      throw new Error(errorMessage);
  }

  // Verify the price exists in Firestore before proceeding
  const priceExists = await verifyPriceExistsInFirestore(selectedPriceId);
  if (!priceExists) {
    const errorMessage = `The price for plan "${plan}" (ID: ${selectedPriceId}) was not found in the database. This could be due to a misconfiguration:
1. Ensure the Price ID is correct and active in your Stripe Dashboard.
2. Check that your Stripe webhook is correctly configured and syncing products to Firestore.
3. Verify your Firebase extension is connected to the correct Stripe mode (Test vs. Live).`;
    console.error(`[paymentService] Pre-flight check failed: ${errorMessage}`);
    alert(errorMessage);
    return;
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
