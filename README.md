# Firebase Studio

This is a NextJS starter in Firebase Studio.

To get started, take a look at src/app/page.tsx.

## Important: Firestore Security Rules

To ensure your application functions correctly and securely, you **MUST** configure your Firestore security rules in the Firebase console.

An example set of rules is provided in the `firestore.rules.example` file in the root of this project. Review this example and adapt it to your needs.

**Key considerations for your `firestore.rules`:**

1.  **User-Specific Data:** The application stores restaurant-specific configurations (settings, schedule, email templates, tables) under `restaurantConfig/{userId}/...`. Your rules should ensure that only the authenticated user (`userId`) can read and write their own data. The example rule is:
    ```firestore
    match /restaurantConfig/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    ```

2.  **Public Data:** The homepage and public booking pages may need to read configuration from a "public" restaurant document (e.g., `restaurantConfig/mainRestaurant`). Ensure your rules allow public `get` access to this document. The example rule is:
    ```firestore
    match /restaurantConfig/mainRestaurant { // Or your PUBLIC_RESTAURANT_ID
      allow get: if true;
      allow list, create, update, delete: if false; // Prevent public writes
    }
    ```

3.  **Bookings Data:** The `bookings` collection is currently a root collection. For a multi-tenant application, you should ensure that bookings are associated with a specific restaurant owner (e.g., by adding an `ownerUID` field to each booking) and write rules to enforce that owners can only manage their own bookings. The provided example has a basic rule for authenticated users, which you will likely need to enhance for production.

**Failure to set up appropriate security rules will result in "Permission Denied" errors when your application tries to read or write data.**

Go to your Firebase project -> Firestore Database -> Rules tab to edit and deploy your rules.
