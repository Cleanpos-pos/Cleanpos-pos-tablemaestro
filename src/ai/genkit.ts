'use server';

import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-ai';
// import { firebase } from 'genkit/firebase'; // Uncomment if you plan to use Firebase for trace/flow state storage

// Initialize Genkit with the Google AI plugin.
// The googleAI() plugin will automatically look for an API key
// in the environment variable GEMINI_API_KEY.
export const ai = genkit({
  plugins: [
    googleAI(),
    // firebase(), // Example: if you want to use Firebase for trace/flow state storage
  ],
  // flowStateStore: 'firebase', // Example store flow state in Firestore
  // traceStore: 'firebase',    // Example store traces in Firestore
  // enableTracing: true, // Recommended for development to see traces
  // logUsage: true,      // Recommended for development to see usage logs
});
