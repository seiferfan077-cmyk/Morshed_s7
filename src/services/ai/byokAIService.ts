import { AIMessage, AIProvider, AIRequestContext } from './aiService';
import { UserAIConfig } from './userAIConfig';

function cleanBaseUrl(baseUrl: string) {
  return baseUrl.trim().replace(/\/+$/, '').replace(/\/chat\/completions$/, '');
}

function throwProviderError(response: Response) {
  if (response.status === 401 || response.status === 403) throw new Error('API key rejected by provider');
  if (response.status === 429) throw new Error('Provider rate limit reached');
  throw new Error(`Provider request failed (${response.status})`);
}

function providerMessages(messages: AIMessage[], context?: AIRequestContext) {
  const memoryLines = context?.memory?.map((item) => `- ${item.content}`).join('\n');
  if (!memoryLines) return messages;
  return [{ role: 'system' as const, content: `سياق ذاكرة وافق عليه المستخدم، استخدمه عند الصلة فقط:\n${memoryLines}` }, ...messages];
}

export class UserKeyOpenAICompatibleProvider implements AIProvider {
  constructor(private readonly config: UserAIConfig) {}

  async sendMessage(messages: AIMessage[], signal?: AbortSignal, context?: AIRequestContext) {
    const preparedMessages = providerMessages(messages, context);
    const response = await fetch(`${cleanBaseUrl(this.config.baseUrl)}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.config.apiKey}` },
      body: JSON.stringify({ model: this.config.model, messages: preparedMessages, user: context?.conversationId }),
      signal,
    });
    if (!response.ok) throwProviderError(response);
    const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) throw new Error('Provider returned no assistant message');
    return { role: 'assistant' as const, content };
  }
}

export class UserKeyGeminiProvider implements AIProvider {
  constructor(private readonly config: UserAIConfig) {}

  async sendMessage(messages: AIMessage[], signal?: AbortSignal, context?: AIRequestContext) {
    const preparedMessages = providerMessages(messages, context);
    const contents = preparedMessages.filter((message) => message.role !== 'system').map((message) => ({ role: message.role === 'assistant' ? 'model' : 'user', parts: [{ text: message.content }] }));
    const systemInstruction = preparedMessages.find((message) => message.role === 'system');
    const url = `${cleanBaseUrl(this.config.baseUrl)}/models/${encodeURIComponent(this.config.model)}:generateContent?key=${encodeURIComponent(this.config.apiKey)}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction.content }] } : undefined, contents, generationConfig: { responseMimeType: 'text/plain' }, metadata: context?.conversationId ? { user: context.conversationId } : undefined }),
      signal,
    });
    if (!response.ok) throwProviderError(response);
    const payload = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    const content = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('').trim();
    if (!content) throw new Error('Gemini returned no assistant message');
    return { role: 'assistant' as const, content };
  }
}

export function createUserKeyProvider(config: UserAIConfig): AIProvider {
  return config.kind === 'gemini' ? new UserKeyGeminiProvider(config) : new UserKeyOpenAICompatibleProvider(config);
}
