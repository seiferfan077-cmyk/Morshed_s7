import { timingSafeEqual } from 'node:crypto';

const GEMINI_INTERACTIONS_URL = 'https://generativelanguage.googleapis.com/v1beta/interactions';
const DEFAULT_MODEL = 'gemini-3.8-flash';
const MAX_BODY_BYTES = 128_000;
const MAX_MESSAGES = 12;
const MAX_MESSAGE_LENGTH = 4_000;
const MAX_TOTAL_MESSAGE_LENGTH = 48_000;
const MAX_CONTEXT_ITEMS = 5;

function json(body, status = 200) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

function errorResponse(status, code) {
  return json({ error: { code } }, status);
}

function matchesSecret(received, expected) {
  if (typeof received !== 'string' || typeof expected !== 'string' || !received || !expected) return false;
  const receivedBytes = Buffer.from(received);
  const expectedBytes = Buffer.from(expected);
  return receivedBytes.length === expectedBytes.length && timingSafeEqual(receivedBytes, expectedBytes);
}

function stringList(value, maxItems, maxLength) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > maxItems) return null;
  if (value.some((item) => typeof item !== 'string' || item.trim().length > maxLength)) return null;
  return value.map((item) => item.trim()).filter(Boolean);
}

function normalizeMessages(value) {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_MESSAGES) return null;
  if (value.some((item) => !item || !['user', 'assistant'].includes(item.role) || typeof item.content !== 'string' || !item.content.trim() || item.content.length > MAX_MESSAGE_LENGTH)) return null;
  const messages = value.map(({ role, content }) => ({ role, content: content.trim() }));
  const totalLength = messages.reduce((total, item) => total + item.content.length, 0);
  if (totalLength > MAX_TOTAL_MESSAGE_LENGTH) return null;
  const firstUserIndex = messages.findIndex((item) => item.role === 'user');
  if (firstUserIndex < 0) return null;
  return messages.slice(firstUserIndex);
}

function normalizeMemory(value) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > MAX_CONTEXT_ITEMS) return null;
  if (value.some((item) => !item || typeof item.content !== 'string' || item.content.trim().length > 1_000)) return null;
  return value.map((item) => item.content.trim()).filter(Boolean);
}

function buildSystemInstruction(memory, goals, tasks) {
  const sections = [
    'أنت مُرشد، مساعد شخصي عربي ودود ودقيق. أجب بلغة المستخدم، وكن واضحًا وعمليًا. لا تدّعِ تنفيذ إجراءات لم تنفذها.',
    'قد يتضمن السياق التالي معلومات وافق المستخدم على استخدامها. اعتبره سياقًا خاصًا بالمستخدم، واستخدمه فقط عندما يكون ذا صلة بالسؤال الحالي.',
  ];
  if (memory.length) sections.push(`ذكريات ذات صلة وافق المستخدم على حفظها:\n${memory.map((item) => `- ${item}`).join('\n')}`);
  if (goals.length) sections.push(`أهداف المستخدم ذات الصلة:\n${goals.map((item) => `- ${item}`).join('\n')}`);
  if (tasks.length) sections.push(`مهام المستخدم ذات الصلة:\n${tasks.map((item) => `- ${item}`).join('\n')}`);
  return sections.join('\n\n');
}

function extractOutputText(interaction) {
  if (interaction?.status && interaction.status !== 'completed') return '';
  const steps = Array.isArray(interaction?.steps) ? interaction.steps : [];
  return steps
    .filter((step) => step?.type === 'model_output' && Array.isArray(step.content))
    .flatMap((step) => step.content)
    .filter((content) => content?.type === 'text' && typeof content.text === 'string')
    .map((content) => content.text)
    .join('')
    .trim();
}

export async function handleChatRequest(request, { env = process.env, fetchImpl = globalThis.fetch } = {}) {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: { code: 'method_not_allowed' } }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', Allow: 'POST', 'Cache-Control': 'no-store' },
    });
  }

  const backendToken = env.MURSHID_API_TOKEN?.trim();
  const geminiKey = env.GEMINI_API_KEY?.trim();
  if (!backendToken || !geminiKey) return errorResponse(503, 'backend_not_configured');

  const authorization = request.headers.get('authorization') ?? '';
  const bearer = authorization.match(/^Bearer\s+(.+)$/i)?.[1] ?? '';
  if (!matchesSecret(bearer, backendToken)) return errorResponse(401, 'unauthorized');

  const contentLength = Number(request.headers.get('content-length') ?? 0);
  if (contentLength > MAX_BODY_BYTES) return errorResponse(413, 'request_too_large');
  if (!request.headers.get('content-type')?.toLowerCase().includes('application/json')) return errorResponse(415, 'json_required');

  let body;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, 'invalid_json');
  }

  const messages = normalizeMessages(body?.messages);
  const memory = normalizeMemory(body?.memory);
  const activeGoals = stringList(body?.activeGoals, MAX_CONTEXT_ITEMS, 300);
  const activeTasks = stringList(body?.activeTasks, MAX_CONTEXT_ITEMS, 300);
  if (!messages || !memory || !activeGoals || !activeTasks) return errorResponse(400, 'invalid_request');

  const input = messages.map((message) => ({
    type: message.role === 'assistant' ? 'model_output' : 'user_input',
    content: [{ type: 'text', text: message.content }],
  }));
  const model = env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;

  try {
    const upstream = await fetchImpl(GEMINI_INTERACTIONS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': geminiKey },
      body: JSON.stringify({
        model,
        input,
        system_instruction: buildSystemInstruction(memory, activeGoals, activeTasks),
        store: false,
      }),
      signal: AbortSignal.timeout(25_000),
    });

    if (!upstream.ok) {
      if (upstream.status === 429) return errorResponse(429, 'provider_rate_limited');
      if (upstream.status === 401 || upstream.status === 403) return errorResponse(502, 'provider_auth_failed');
      if (upstream.status >= 500) return errorResponse(502, 'provider_unavailable');
      return errorResponse(502, 'provider_request_failed');
    }

    let interaction;
    try {
      interaction = await upstream.json();
    } catch {
      return errorResponse(502, 'provider_invalid_response');
    }
    const content = extractOutputText(interaction);
    if (!content) return errorResponse(502, 'provider_empty_response');
    return json({ role: 'assistant', content });
  } catch {
    return errorResponse(502, 'provider_unavailable');
  }
}

export function handleHealthRequest(request, { env = process.env } = {}) {
  if (request.method !== 'GET') return errorResponse(405, 'method_not_allowed');
  return json({ ok: true, configured: Boolean(env.MURSHID_API_TOKEN && env.GEMINI_API_KEY) });
}
