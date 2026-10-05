import assert from 'node:assert/strict';
import test from 'node:test';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import { verifyFirebaseIdToken } from '../lib/firebase-auth.js';

const projectId = 'murshid-auth-test';
const now = Math.floor(Date.now() / 1000);
const { privateKey, publicKey } = await generateKeyPair('RS256', { modulusLength: 2048 });
const publicJwk = await exportJWK(publicKey);
publicJwk.kid = 'test-key-1';
publicJwk.alg = 'RS256';
publicJwk.use = 'sig';
const localJwks = createLocalJWKSet({ keys: [publicJwk] });

async function signToken(overrides = {}, protectedHeader = {}) {
  const claims = {
    auth_time: now,
    ...overrides,
  };
  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'RS256', kid: 'test-key-1', ...protectedHeader })
    .setIssuer(`https://securetoken.google.com/${projectId}`)
    .setAudience(projectId)
    .setSubject('firebase-user-123')
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(privateKey);
}

test('accepts a valid Firebase ID token and returns only its verified UID', async () => {
  const token = await signToken();
  assert.deepEqual(await verifyFirebaseIdToken(token, projectId, localJwks), { uid: 'firebase-user-123' });
});

test('rejects a token for a different Firebase project', async () => {
  const token = await signToken();
  await assert.rejects(() => verifyFirebaseIdToken(token, 'another-project', localJwks));
});

test('rejects an expired token', async () => {
  const token = await new SignJWT({ auth_time: now })
    .setProtectedHeader({ alg: 'RS256', kid: 'test-key-1' })
    .setIssuer(`https://securetoken.google.com/${projectId}`)
    .setAudience(projectId)
    .setSubject('firebase-user-123')
    .setIssuedAt(now - 7200)
    .setExpirationTime(now - 3600)
    .sign(privateKey);
  await assert.rejects(() => verifyFirebaseIdToken(token, projectId, localJwks));
});

test('rejects tokens missing required Firebase authentication claims', async () => {
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: 'RS256', kid: 'test-key-1' })
    .setIssuer(`https://securetoken.google.com/${projectId}`)
    .setAudience(projectId)
    .setSubject('firebase-user-123')
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(privateKey);
  await assert.rejects(() => verifyFirebaseIdToken(token, projectId, localJwks));
});
