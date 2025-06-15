# Firebase Studio

This is a NextJS starter in Firebase Studio.

To get started, take a look at src/app/page.tsx.

## Important: Firestore Security Rules & Indexes

### Security Rules
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

3.  **Bookings Data:** The `bookings` collection stores booking information. For a multi-tenant application, ensure that bookings are associated with a specific restaurant owner (e.g., by adding an `ownerUID` field to each booking) and write rules to enforce that owners can only manage their own bookings. The example rule is:
    ```firestore
    match /bookings/{bookingId} {
      allow create: if request.auth != null && request.resource.data.ownerUID == request.auth.uid;
      allow read, update, delete: if request.auth != null && request.auth.uid == resource.data.ownerUID;
    }
    ```
    **Note**: Your application code must add `ownerUID: request.auth.uid` to every new booking document for these rules to work.

**Failure to set up appropriate security rules will result in "Permission Denied" errors when your application tries to read or write data.**

Go to your Firebase project -> Firestore Database -> Rules tab to edit and deploy your rules.

### Firestore Indexes
As your application queries Firestore, you may encounter errors indicating that "The query requires an index." This means Firestore needs a composite index to efficiently process a specific query involving filters and sorts on multiple fields.

When this error occurs, Firestore typically provides a direct link in the error message (visible in your browser's developer console or server logs) to create the required index in the Firebase console. Click this link and follow the prompts to create the index. Index creation may take a few minutes.

Common areas that might require indexes:
- Fetching bookings sorted by date/time with filters (`ownerUID`).
- Fetching tables with specific properties.

Always check your Firebase console for index creation prompts if you see query-related permission errors or performance issues.

```