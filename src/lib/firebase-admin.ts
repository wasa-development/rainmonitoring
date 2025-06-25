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

// Ensure the private key is formatted correctly, especially when deployed.
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: privateKey,
      }),
    });
    console.log("Firebase Admin SDK initialized successfully.");
  } catch (error: any) {
    console.error('Firebase admin initialization error', error.stack);
  }
}

export const auth = admin.auth();
export const db = admin.firestore();
