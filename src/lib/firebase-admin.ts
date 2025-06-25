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

// Check if admin is already initialized
if (!admin.apps.length) {
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  // Only attempt to initialize if all credentials are provided
  if (projectId && clientEmail && privateKey) {
    try {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: projectId,
          clientEmail: clientEmail,
          privateKey: privateKey,
        }),
      });
      console.log("Firebase Admin SDK initialized successfully.");
    } catch (error: any) {
      console.error('Firebase admin initialization error:', error.stack);
    }
  } else {
    // This provides a clear warning if credentials are not in the environment.
    if (process.env.NODE_ENV !== 'production') {
        console.warn(
            'Firebase Admin credentials are not fully set in .env.local. Skipping initialization. ' +
            'Required: NEXT_PUBLIC_FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY'
        );
    }
  }
}

const auth = admin.auth();
const db = admin.firestore();

export { admin, auth, db };