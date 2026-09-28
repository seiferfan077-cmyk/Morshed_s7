export type FirebaseConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
};

const readPublicConfig = (): FirebaseConfig | null => {
  const values: FirebaseConfig = {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? '',
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? '',
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? '',
    storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ?? '',
    messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '',
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID ?? '',
  };
  return Object.values(values).every(Boolean) ? values : null;
};

export const firebaseConfig = readPublicConfig();
export const isFirebaseConfigured = firebaseConfig !== null;

/** These are Firebase Web SDK identifiers, not server secrets. Never put Admin SDK credentials here. */
export const firebaseConfigStatus = {
  configured: isFirebaseConfigured,
  missing: firebaseConfig ? [] : ['EXPO_PUBLIC_FIREBASE_* configuration'],
};
