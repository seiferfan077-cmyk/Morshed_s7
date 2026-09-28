export interface AuthSession { accessToken: string; refreshToken?: string; expiresAt?: number; userId: string; }
export interface AuthProvider { signIn(identifier: string, password: string): Promise<AuthSession>; signOut(): Promise<void>; getSession(): Promise<AuthSession | null>; refreshSession(): Promise<AuthSession | null>; }

/** Provider-neutral contract. A Supabase/Firebase adapter can be added without changing screens. */
export class UnconfiguredAuthProvider implements AuthProvider {
  async signIn(_identifier: string, _password: string): Promise<AuthSession> { throw new Error('Authentication provider is not configured'); }
  async signOut() { return undefined; }
  async getSession() { return null; }
  async refreshSession() { return null; }
}
