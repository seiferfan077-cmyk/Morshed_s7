import { FirebaseApp, getApps, initializeApp } from 'firebase/app';
import { Auth, getAuth, initializeAuth } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Firestore, getFirestore } from 'firebase/firestore';
import { Platform } from 'react-native';
import { firebaseConfig, isFirebaseConfigured } from './firebaseConfig';

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let firestore: Firestore | null = null;

export function getFirebaseApp(): FirebaseApp | null {
  if (!isFirebaseConfigured || !firebaseConfig) return null;
  if (!app) app = getApps()[0] ?? initializeApp(firebaseConfig);
  return app;
}

export function getFirebaseAuth(): Auth | null {
  const firebaseApp = getFirebaseApp();
  if (!firebaseApp) return null;
  if (auth) return auth;
  if (Platform.OS === 'web') {
    auth = getAuth(firebaseApp);
    return auth;
  }
  try {
    // React Native exposes this persistence adapter; the browser entrypoint does not.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const nativeAuth = require('@firebase/auth') as {
      getReactNativePersistence?: (storage: typeof AsyncStorage) => Parameters<typeof initializeAuth>[1] extends { persistence?: infer T } ? T : never;
    };
    const persistence = nativeAuth.getReactNativePersistence?.(AsyncStorage);
    auth = persistence ? initializeAuth(firebaseApp, { persistence }) : getAuth(firebaseApp);
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
    if (code.includes('already-initialized')) auth = getAuth(firebaseApp);
    else throw error;
  }
  return auth;
}

export function getFirebaseFirestore(): Firestore | null {
  const firebaseApp = getFirebaseApp();
  if (!firebaseApp) return null;
  return firestore ?? (firestore = getFirestore(firebaseApp));
}
