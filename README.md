
# Firebase Studio

This is a NextJS starter in Firebase Studio.

To get started, take a look at src/app/page.tsx.

## Important: Firestore Security Rules & Indexes

### Security Rules
To ensure your application functions correctly and securely, you **MUST** configure your Firestore security rules in the Firebase console. **This is the most common cause of errors in the app.**

An example set of rules is provided in the `firestore.rules` file in the root of this project. Review this example and adapt it to your needs. **You must copy the contents of `firestore.rules` and deploy them in your Firebase project.**

**To deploy the rules for THIS application:**
1. Go to your Firebase project in the Firebase Console.
2. Navigate to **Firestore Database** from the left-hand menu.
3. Click on the **Rules** tab at the top.
4. Copy the entire content of the `firestore.rules` file from your project.
5. Paste it into the rules editor in the Firebase Console, overwriting any existing rules.
6. Click **Publish**.

**Failure to set up appropriate security rules will result in "Permission Denied" errors when your application tries to read or write data.**

### Key considerations for your `firestore.rules`:

1.  **Public Data**: The homepage and public booking pages need to read configuration from a "public" restaurant document (e.g., `restaurantConfig/mainRestaurant`). The rules allow public `get` access to this document.
    ```firestore
    match /restaurantConfig/mainRestaurant {
      allow get: if true;
      allow list, create, update, delete: if false; // Prevent public writes
    }
    ```

2.  **User-Specific Data**: The application stores restaurant-specific configurations (settings, schedule, tables) under `restaurantConfig/{userId}/...`. Your rules must ensure that only the authenticated user (`userId`) can read and write their own data.
    ```firestore
    match /restaurantConfig/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    ```

3.  **Bookings Data**: The `bookings` collection stores booking information. The rules ensure that owners can only manage their own bookings.
    ```firestore
    match /bookings/{bookingId} {
      allow create: if request.auth != null && request.resource.data.ownerUID == request.auth.uid;
      allow read, update, delete: if request.auth != null && request.auth.uid == resource.data.ownerUID;
    }
    ```

4.  **Stripe Payments**: The rules allow users to create checkout sessions and read their own subscription data. This is critical for the payment flow to work.
    ```firestore
    match /customers/{uid}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
    ```


### Firestore Indexes
As your application queries Firestore, you may encounter errors indicating that "The query requires an index." This means Firestore needs a composite index to efficiently process a specific query involving filters and sorts on multiple fields.

When this error occurs, Firestore typically provides a direct link in the error message (visible in your browser's developer console or server logs) to create the required index in the Firebase console. Click this link and follow the prompts to create the index. Index creation may take a few minutes.

Common areas that might require indexes:
- Fetching bookings sorted by date/time with filters (`ownerUID`).
- Fetching tables with specific properties.

Always check your Firebase console for index creation prompts if you see query-related permission errors or performance issues.
