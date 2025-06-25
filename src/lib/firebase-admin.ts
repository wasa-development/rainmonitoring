/**
 * IMPORTANT:
 * ----------
 * This file is used for server-side Firebase operations.
 * It initializes the Firebase Admin SDK, which requires special service account credentials.
 * 
 * To get this working, you need to:
 * 1. Go to your Firebase project settings > Service accounts.
 * 2. Generate a new private key (JSON file).
 * 3. Copy the values from the JSON file into your environment variables (.env.local).
 *    You will need:
 *    - NEXT_PUBLIC_FIREBASE_PROJECT_ID
 *    - FIREBASE_CLIENT_EMAIL
 *    - FIREBASE_PRIVATE_KEY
 * 
 *    Note: When you copy the private key, it will have newline characters (\n).
 *    You might need to replace them with literal newlines in your .env.local file
 *    or handle it as shown below.
 */
import admin from 'firebase-admin';

/**
 * Initializes the Firebase Admin SDK if it hasn't been initialized yet.
 * This function is designed to be idempotent.
 * @returns The initialized Firebase Admin module.
 * @throws {Error} If Firebase credentials are not set or initialization fails.
 */
function getInitializedAdmin() {
  if (admin.apps.length === 0) {
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

    if (projectId && clientEmail && privateKey) {
      try {
        admin.initializeApp({
          credential: admin.credential.cert({
            projectId,
            clientEmail,
            privateKey,
          }),
        });
        console.log("Firebase Admin SDK initialized successfully.");
      } catch (error: any) {
        console.error('Firebase admin initialization error:', error.stack);
        // Throw an error to prevent the app from starting in a broken state.
        throw new Error('Failed to initialize Firebase Admin SDK.');
      }
    } else {
      // Throw a clear error if credentials are missing.
      // This stops the server from crashing silently and provides a clear debug message.
      throw new Error(
          'Firebase Admin credentials are not fully set in environment variables. ' +
          'Required: NEXT_PUBLIC_FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY'
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
