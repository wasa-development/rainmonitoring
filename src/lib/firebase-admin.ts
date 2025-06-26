/**
 * IMPORTANT:
 * ----------
 * This file is used for server-side Firebase operations and initializes the Firebase Admin SDK.
 *
 * How it works:
 *
 * 1. Production Environment (e.g., Firebase App Hosting):
 *    The SDK automatically discovers the necessary service account credentials. No configuration is needed.
 *
 * 2. Local Development (Choose ONE of the following methods):
 *
 *    Method A: Using a Service Account JSON file (Recommended for most setups)
 *    ---------------------------------------------------------------------
 *    1. Go to your Firebase project settings > Service accounts.
 *    2. Generate a new private key (a JSON file).
 *    3. Save this file somewhere safe OUTSIDE the `src` folder (e.g., in the root directory).
 *    4. IMPORTANT: Add the JSON file's name to your `.gitignore` file to prevent it from being committed.
 *    5. Create a `.env.local` file in your project's root directory.
 *    6. Add the following line to `.env.local`, replacing the path with the actual path to your file:
 *       GOOGLE_APPLICATION_CREDENTIALS="./your-service-account-file.json"
 *
 *    Method B: Using Direct Environment Variables
 *    ---------------------------------------------
 *    As an alternative, you can add the credentials directly to your `.env.local` file.
 *    Open your service account JSON file and find the following values:
 *    - project_id
 *    - client_email
 *    - private_key (This is a long string that includes `-----BEGIN PRIVATE KEY-----\n...` )
 *
 *    Then, add them to your `.env.local` file like this:
 *    FIREBASE_PROJECT_ID="your-project-id"
 *    FIREBASE_CLIENT_EMAIL="your-client-email"
 *    FIREBASE_PRIVATE_KEY="your-private-key-with-newlines-as-\\n"
 *
 *    NOTE: When copying the private_key, you must replace all newline characters with `\n`.
 */
import admin from 'firebase-admin';

// Function to create credentials from environment variables (Method B)
function createCredentialsFromEnv() {
    if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
        return {
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            // The private key from .env needs to have its escaped newlines replaced with actual newlines
            privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        };
    }
    return null;
}

function getInitializedAdmin() {
  if (admin.apps.length > 0) {
    return admin;
  }
  
  const serviceAccount = createCredentialsFromEnv();

  try {
    // Initialize with service account from env vars if they exist (Method B),
    // otherwise, initialize with default credentials (which checks GOOGLE_APPLICATION_CREDENTIALS for local dev,
    // or uses the built-in service account in production).
    admin.initializeApp({
      credential: serviceAccount ? admin.credential.cert(serviceAccount) : undefined,
    });
    console.log("Firebase Admin SDK initialized successfully.");
  } catch (error: any) {
    console.error('Firebase admin initialization error:', error.stack);
    throw new Error(
      'Failed to initialize Firebase Admin SDK. Please check your setup. ' +
      'For local development, ensure you have configured either Method A (GOOGLE_APPLICATION_CREDENTIALS) or Method B (direct environment variables) as described in the comments in src/lib/firebase-admin.ts. ' +
      'In production, ensure your hosting environment has access to the default service account.'
    );
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
