import { signInWithEmailAndPassword, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { getFirebaseAuth } from './firebaseClient';

export function subscribeToFirebaseUser(listener: (user: User | null) => void) {
  const auth = getFirebaseAuth();
  if (!auth) { listener(null); return () => undefined; }
  return onAuthStateChanged(auth, listener);
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
