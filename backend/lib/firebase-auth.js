import { createRemoteJWKSet, jwtVerify } from 'jose';

const FIREBASE_SIGNING_KEYS_URL = new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com');
const MAX_AUTH_TIME_SKEW_SECONDS = 60;
let remoteJwks;

function getRemoteJwks() {
  remoteJwks ??= createRemoteJWKSet(FIREBASE_SIGNING_KEYS_URL);
  return remoteJwks;
}

/** Verify a Firebase Authentication ID token and return only the trusted UID. */
export async function verifyFirebaseIdToken(token, projectId, jwks = getRemoteJwks()) {
  if (typeof token !== 'string' || !token || typeof projectId !== 'string' || !projectId.trim()) return null;

  const { payload } = await jwtVerify(token, jwks, {
    algorithms: ['RS256'],
    audience: projectId.trim(),
    issuer: `https://securetoken.google.com/${projectId.trim()}`,
    requiredClaims: ['exp', 'iat', 'auth_time', 'sub'],
    maxTokenAge: '1 hour',
    clockTolerance: 5,
  });

  if (typeof payload.sub !== 'string' || !payload.sub || payload.sub.length > 128) return null;
  if (typeof payload.auth_time !== 'number' || payload.auth_time > Math.floor(Date.now() / 1000) + MAX_AUTH_TIME_SKEW_SECONDS) return null;
  return { uid: payload.sub };
}
