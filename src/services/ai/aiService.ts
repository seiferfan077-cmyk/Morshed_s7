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

/** The mobile app never receives a provider secret. Configure the backend URL outside source control. */
export class BackendAIProvider implements AIProvider {
  constructor(private readonly baseUrl: string) {}

  async sendMessage(messages: AIMessage[], signal?: AbortSignal, context?: AIRequestContext) {
    const response = await fetch(`${this.baseUrl}/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, conversationId: context?.conversationId, memory: context?.memory, activeGoals: context?.activeGoals, activeTasks: context?.activeTasks }),
      signal,
    });
    if (!response.ok) throw new Error(`AI request failed (${response.status})`);
    return (await response.json()) as AIMessage;
  }
}
