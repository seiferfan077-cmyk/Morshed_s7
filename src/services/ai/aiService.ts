import { MemoryContextItem } from '../../types/memory';

export interface AIMessage { role: 'user' | 'assistant' | 'system'; content: string; }

export interface AIRequestContext {
  conversationId?: string;
  memory?: MemoryContextItem[];
  activeGoals?: string[];
  activeTasks?: string[];
}

export interface AIProvider {
  sendMessage(messages: AIMessage[], signal?: AbortSignal, context?: AIRequestContext): Promise<AIMessage>;
}

/** Provider keys stay server-side; each backend request carries the Firebase user's ID token. */
export class BackendAIProvider implements AIProvider {
  constructor(private readonly baseUrl: string, private readonly getAccessToken: () => Promise<string>) {}

  async sendMessage(messages: AIMessage[], signal?: AbortSignal, context?: AIRequestContext) {
    const baseUrl = this.baseUrl.trim().replace(/\/+$/, '');
    const accessToken = await this.getAccessToken();
    if (!accessToken) throw new Error('firebase_auth_missing_token');
    const headers: Record<string, string> = { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` };
    const response = await fetch(`${baseUrl}/api/ai/chat`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ messages, conversationId: context?.conversationId, memory: context?.memory, activeGoals: context?.activeGoals, activeTasks: context?.activeTasks }),
      signal,
    });

    let payload: { role?: string; content?: string; error?: { code?: string } };
    try {
      payload = await response.json() as typeof payload;
    } catch {
      throw new Error(`Murshid backend returned an invalid response (${response.status})`);
    }
    if (!response.ok) {
      const code = payload.error?.code;
      throw new Error(`Murshid backend request failed (${response.status})${code ? `: ${code}` : ''}`);
    }
    if (payload.role !== 'assistant' || typeof payload.content !== 'string' || !payload.content.trim()) {
      throw new Error('Backend returned no assistant message');
    }
    return { role: 'assistant' as const, content: payload.content };
  }
}

/** Prefer Murshid's centrally managed backend; a user-key provider is optional fallback only. */
export function selectAIProvider(baseUrl: string | undefined, getAccessToken: (() => Promise<string>) | undefined, fallback: AIProvider | null): AIProvider | null {
  const normalizedBaseUrl = baseUrl?.trim();
  if (normalizedBaseUrl && !normalizedBaseUrl.includes('api.example.com') && getAccessToken) {
    return new BackendAIProvider(normalizedBaseUrl, getAccessToken);
  }
  return fallback;
}
