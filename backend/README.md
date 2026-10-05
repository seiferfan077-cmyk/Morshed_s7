# Murshid AI Backend

This folder is a standalone Vercel Node.js Functions project. Set the Vercel project **Root Directory** to `backend`; this keeps the Expo app and the existing support website untouched. The chat route is `POST /api/ai/chat` and the health route is `GET /api/health`.

## Server environment variables

Add these in Vercel Project Settings → Environment Variables. Do not commit actual values or put the Gemini key in an Expo `EXPO_PUBLIC_*` variable.

- `GEMINI_API_KEY`: Gemini API key for the server-side Murshid backend. If the key is publicly exposed or committed to source control, revoke it and create a replacement.
- `MURSHID_API_TOKEN`: a separate random access token required by the app when it calls this backend.
- `GEMINI_MODEL`: optional; defaults to `gemini-3.8-flash`.

Generate a new app access token locally with `openssl rand -hex 32`, then configure the same value as `MURSHID_API_TOKEN` in Vercel and `EXPO_PUBLIC_MURSHID_API_TOKEN` in the personal app build environment. Do not commit either value.

For the personal Expo build, set `EXPO_PUBLIC_API_BASE_URL` to the deployed Vercel origin (no trailing slash) and `EXPO_PUBLIC_MURSHID_API_TOKEN` to the same app access token before building. Keep local `.env` files out of Git. Expo public variables are bundled in the client app; this shared token is a guard for a personal/private build, not strong authentication against someone who can extract the app. Do not distribute a build using this shared-token scheme publicly; add real user authentication (for example verified Firebase ID tokens) first.

## Privacy and request contract

- The server sends the last 12 user/assistant messages and only context explicitly included by the client.
- Gemini is called through the current Interactions API using `x-goog-api-key` on the server only.
- `store: false` is set for each interaction; the backend does not persist conversations.
- The server validates request sizes, roles, context limits, app token, and method. It does not log prompts or credentials.
- BYOK remains separate: each user may connect their own Gemini or other supported provider key in the app. BYOK keys remain in that user's SecureStore and the request goes directly from that device to the selected provider.

## Local checks

From the repository root, run `npm run backend:test`. The tests mock Gemini and do not require a real API key.
