export interface AIMessage { role: 'user' | 'assistant' | 'system'; content: string; }
export interface AIProvider { sendMessage(messages: AIMessage[], signal?: AbortSignal): Promise<AIMessage>; }

/** The mobile app never receives a provider secret. Configure the backend URL outside source control. */
export class BackendAIProvider implements AIProvider {
  constructor(private readonly baseUrl: string) {}
  async sendMessage(messages: AIMessage[], signal?: AbortSignal) {
    const response = await fetch(`${this.baseUrl}/ai/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages }), signal });
    if (!response.ok) throw new Error(`AI request failed (${response.status})`);
    return (await response.json()) as AIMessage;
  }
}
