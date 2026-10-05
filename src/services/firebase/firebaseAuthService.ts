import { signInWithEmailAndPassword, signInAnonymously, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { getFirebaseAuth } from './firebaseClient';

export function subscribeToFirebaseUser(listener: (user: User | null) => void) {
  const auth = getFirebaseAuth();
  if (!auth) { listener(null); return () => undefined; }
  return onAuthStateChanged(auth, listener);
}

/** Reuse the signed-in user or create a transparent anonymous identity for Chat. */
export async function getFirebaseAIIdToken() {
  const auth = getFirebaseAuth();
  if (!auth) throw new Error('firebase_auth_not_configured');
  try {
    const user = auth.currentUser ?? (await signInAnonymously(auth)).user;
    return await user.getIdToken();
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
    if (code === 'auth/operation-not-allowed') throw new Error('firebase_anonymous_auth_disabled');
    if (code.startsWith('auth/')) throw new Error(`firebase_auth_failed:${code}`);
    throw new Error('firebase_auth_failed');
  }
}

export async function signInAdmin(email: string, password: string) {
  const auth = getFirebaseAuth();
  if (!auth) throw new Error('Firebase is not configured');
  const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
  const token = await credential.user.getIdTokenResult(true);
  if (token.claims.admin !== true) { await signOut(auth); throw new Error('This account is not an admin'); }
  return credential.user;
}

export async function signOutAdmin() {
  const auth = getFirebaseAuth();
  if (auth) await signOut(auth);
}
