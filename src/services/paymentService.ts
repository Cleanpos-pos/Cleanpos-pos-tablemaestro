
import { app } from '@/config/firebase';
import { getStripePayments, createCheckoutSession } from '@stripe/firestore-stripe-payments';
import { getAuth } from 'firebase/auth';

// Define your product price IDs from your Stripe dashboard
// IMPORTANT: Replace these placeholder IDs with your actual Stripe Price IDs
const priceIds = {
  starter: 'price_xxxxxxxxxxxxxxxxx', // Example: price_1PGaFzBf1234abcd5678efgh
  pro: 'price_yyyyyyyyyyyyyyyyy',     // Example: price_1PGaGXBf1234abcd9101ijkl
};
type PlanId = keyof typeof priceIds;

// Initialize the Stripe Payments client
const payments = getStripePayments(app, {
  productsCollection: 'products',
  customersCollection: 'customers',
});

/**
 * Redirects the currently signed-in user to the Stripe checkout for a given plan.
 * @param plan The ID of the plan the user is subscribing to ('starter' or 'pro').
 */
export const goToCheckout = async (plan: string): Promise<void> => {
  const auth = getAuth(app);
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
    const session = await createCheckoutSession(payments, {
      price: priceIds[planId],
      success_url: `${window.location.origin}/admin/dashboard?payment_success=true`,
      cancel_url: `${window.location.origin}/pricing?payment_cancelled=true`,
      // You can add `trial_from_plan: true` if your Stripe plan has a trial period.
    });
    
    // Redirect the user to the Stripe-hosted checkout page
    window.location.assign(session.url);
  } catch (error) {
    console.error("Error creating Stripe checkout session:", error);
    // You could show an alert to the user here
    alert(`Error: Could not proceed to payment. Please try again. Details: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
};
