/**
 * IMPORTANT:
 * ----------
 * This file is used for server-side Firebase operations and initializes the Firebase Admin SDK.
 * It's designed to be robust for both production and local development.
 *
 * How it works:
 *
 * 1. Production Environment (e.g., Firebase App Hosting, Cloud Run):
 *    The SDK automatically discovers the necessary service account credentials. No configuration is needed.
 *
 * 2. Local Development (Choose ONE of the following methods):
 *
 *    Method A: Using a Service Account JSON file (Recommended for most setups)
 *    ---------------------------------------------------------------------
 *    1. Go to your Firebase project settings > Service accounts.
 *    2. Generate a new private key and save the JSON file.
 *    3. IMPORTANT: Save this file somewhere safe OUTSIDE the `src` folder (e.g., in the project's root).
 *       Add the JSON file's name to your `.gitignore` file to prevent it from being committed to source control.
 *    4. Create a `.env.local` file in your project's root directory (if it doesn't exist).
 *    5. Add this line to `.env.local`, replacing the path with the actual path to your file:
 *       GOOGLE_APPLICATION_CREDENTIALS="./your-service-account-file.json"
 *
 *    Method B: Using Direct Environment Variables (Alternative)
 *    ----------------------------------------------------------
 *    You can also add the credentials directly to your `.env.local` file.
 *    Open your service account JSON file and copy the following values:
 *    - project_id
 *    - client_email
 *    - private_key (This is a long string that includes `-----BEGIN PRIVATE KEY-----\n...` )
 *
 *    Then, add them to your `.env.local` file like this:
 *    FIREBASE_PROJECT_ID="your-project-id"
 *    FIREBASE_CLIENT_EMAIL="your-client-email"
 *    FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----\\n"
 *
 *    NOTE: When copying the `private_key`, you MUST replace all literal newline characters with `\n`.
 */
import admin from 'firebase-admin';

// Function to create credentials from environment variables (Method B)
function createCredentialsFromEnv() {
    if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
        console.log("Found FIREBASE_... environment variables. Attempting to initialize Admin SDK with them.");
        return {
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            // The private key from .env needs to have its escaped newlines replaced with actual newlines
            privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        };
    }
    return null;
}

// This function ensures the Admin SDK is initialized only once.
function getInitializedAdmin() {
  if (admin.apps.length > 0) {
    return admin;
  }
  
  const serviceAccount = createCredentialsFromEnv();

  try {
    if (serviceAccount) {
      // Initialize with service account from env vars if they exist (Method B)
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      console.log("Firebase Admin SDK initialized successfully using direct environment variables.");
    } else {
      // Otherwise, initialize with Application Default Credentials (ADC).
      // This will check for GOOGLE_APPLICATION_CREDENTIALS (Method A) locally,
      // or use the built-in service account in a production environment.
      console.log("Attempting to initialize Admin SDK using Application Default Credentials...");
      admin.initializeApp();
      console.log("Firebase Admin SDK initialized successfully using Application Default Credentials.");
    }
  } catch (error: any) {
    console.error('Firebase admin initialization error:', error.stack);
    // This loud error helps diagnose setup issues.
    throw new Error(
      'Failed to initialize Firebase Admin SDK. Please check your setup. ' +
      'For local development, ensure you have correctly configured either Method A (GOOGLE_APPLICATION_CREDENTIALS) or Method B (direct environment variables) as described in the comments in src/lib/firebase-admin.ts. ' +
      'This error usually means your credentials are not set up correctly.'
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
