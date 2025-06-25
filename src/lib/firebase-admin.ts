/**
 * IMPORTANT:
 * ----------
 * This file is used for server-side Firebase operations.
 * It initializes the Firebase Admin SDK.
 *
 * How it works:
 * - In a Google Cloud environment (like Firebase App Hosting), the SDK automatically
 *   discovers the necessary credentials.
 * - For local development, you must set up a service account:
 *   1. Go to your Firebase project settings > Service accounts.
 *   2. Generate a new private key (JSON file).
 *   3. Save this file somewhere safe (e.g., outside the `src` folder) and ensure
 *      it is listed in your .gitignore file to prevent it from being committed.
 *   4. Set an environment variable named `GOOGLE_APPLICATION_CREDENTIALS` to the
 *      path of this JSON file. For example, in a `.env.local` file:
 *      GOOGLE_APPLICATION_CREDENTIALS="./path/to/your/serviceAccountKey.json"
 */
import admin from 'firebase-admin';

function getInitializedAdmin() {
  if (admin.apps.length === 0) {
    try {
      // When deployed to a Google Cloud environment or with GOOGLE_APPLICATION_CREDENTIALS
      // set, the SDK automatically discovers the necessary credentials.
      admin.initializeApp();
      console.log("Firebase Admin SDK initialized successfully.");
    } catch (error: any) {
      console.error('Firebase admin initialization error:', error.stack);
      throw new Error(
        'Failed to initialize Firebase Admin SDK. ' +
        'For local development, ensure the GOOGLE_APPLICATION_CREDENTIALS environment variable is set correctly. ' +
        'In production, ensure your hosting environment has access to the default service account.'
      );
    }
  }
  return admin;
}

// Get the initialized admin instance. This will throw if it fails.
const initializedAdmin = getInitializedAdmin();
const auth = initializedAdmin.auth();
const db = initializedAdmin.firestore();

// Export the original admin module for things like `admin.firestore.FieldValue`
// and the initialized services.
export { admin, auth, db };
