import { AIMessage, AIProvider, AIRequestContext } from './aiService';
import { UserAIConfig } from './userAIConfig';

function cleanBaseUrl(baseUrl: string) {
  return baseUrl.trim().replace(/\/+$/, '').replace(/\/(?:chat\/completions|interactions)$/, '');
}

function throwProviderError(response: Response) {
  if (response.status === 401 || response.status === 403) throw new Error('API key rejected by provider');
  if (response.status === 429) throw new Error('Provider rate limit reached');
  throw new Error(`Provider request failed (${response.status})`);
}

export function providerErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? '');
  if (message.includes('backend_not_configured')) return 'Backend مرشد غير مكتمل الإعداد. أضف إعدادات مزود الذكاء الاصطناعي ورمز الوصول في الاستضافة.';
  if (message.includes('unauthorized')) return 'رمز الوصول إلى Backend غير صحيح أو غير مضبوط في إعداد البناء الشخصي.';
  if (message.includes('provider_auth_failed')) return 'مزود الذكاء الاصطناعي رفض المفتاح أو لا يملك صلاحية استخدام API. تحقق من المفتاح والنموذج.';
  if (message.includes('API key rejected by provider')) return 'المزوّد رفض مفتاح API أو لا يملك صلاحية استخدام النموذج. تحقق من المفتاح والصلاحيات.';
  if (message.includes('provider_rate_limited') || message.includes('Provider rate limit reached')) return 'وصلت إلى حد الاستخدام أو نفد الرصيد لدى المزوّد. تحقق من لوحة حسابك ثم أعد المحاولة.';
  if (message.includes('provider_unavailable')) return 'خدمة الذكاء الاصطناعي غير متاحة مؤقتًا. تحقق من الاتصال ثم أعد المحاولة.';
  const status = message.match(/\((\d{3})\)/)?.[1];
  if (status === '402') return 'المزوّد يطلب تفعيل الفوترة أو إضافة رصيد.';
  if (status === '400' || status === '404') return 'تحقق من اسم النموذج وBase URL؛ قد لا يدعم المزوّد هذا النموذج أو المسار.';
  if (/network request failed|fetch failed|network/i.test(message)) return 'تعذّر الوصول إلى المزوّد. تحقق من اتصال الإنترنت ثم أعد المحاولة.';
  if (message.includes('no assistant message') || message.includes('no text response')) return 'اتصل التطبيق بالمزوّد لكن لم يصل رد نصي. تحقق من النموذج وإعداداته.';
  return 'تعذّر استلام الرد من المزوّد. تحقق من المفتاح والنموذج والاتصال ثم حاول مجددًا.';
}

function providerMessages(messages: AIMessage[], context?: AIRequestContext) {
  const sections: string[] = [];
  const memoryLines = context?.memory?.map((item) => `- ${item.content}`).join('\n');
  const goalLines = context?.activeGoals?.map((item) => `- ${item}`).join('\n');
  const taskLines = context?.activeTasks?.map((item) => `- ${item}`).join('\n');
  if (memoryLines) sections.push(`ذكريات وافق المستخدم على استخدامها، استعن بها عند الصلة فقط:\n${memoryLines}`);
  if (goalLines) sections.push(`أهداف المستخدم ذات الصلة:\n${goalLines}`);
  if (taskLines) sections.push(`مهام المستخدم ذات الصلة:\n${taskLines}`);
  if (!sections.length) return messages;
  return [{ role: 'system' as const, content: `أنت مرشد، مساعد شخصي دقيق. استخدم السياق التالي عند ارتباطه بالسؤال فقط:\n${sections.join('\n\n')}` }, ...messages];
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
    const payload = await response.json() as { choices?: { message?: { content?: string } }[] };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) throw new Error('Provider returned no assistant message');
    return { role: 'assistant' as const, content };
  }
}

interface GeminiInteraction {
  status?: string;
  steps?: { type?: string; content?: { type?: string; text?: string }[] }[];
}

export class UserKeyGeminiProvider implements AIProvider {
  constructor(private readonly config: UserAIConfig) {}

  async sendMessage(messages: AIMessage[], signal?: AbortSignal, context?: AIRequestContext) {
    const preparedMessages = providerMessages(messages, context);
    const systemInstruction = preparedMessages.filter((message) => message.role === 'system').map((message) => message.content).join('\n\n');
    const history = preparedMessages.filter((message) => message.role !== 'system');
    const firstUserIndex = history.findIndex((message) => message.role === 'user');
    if (firstUserIndex < 0) throw new Error('Gemini requires a user message');
    const input = history.slice(firstUserIndex).map((message) => ({
      type: message.role === 'assistant' ? 'model_output' : 'user_input',
      content: [{ type: 'text', text: message.content }],
    }));
    const response = await fetch(`${cleanBaseUrl(this.config.baseUrl)}/interactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': this.config.apiKey },
      body: JSON.stringify({ model: this.config.model, input, system_instruction: systemInstruction || undefined, store: false }),
      signal,
    });
    if (!response.ok) throwProviderError(response);
    const payload = await response.json() as GeminiInteraction;
    const content = payload.steps
      ?.filter((step) => step.type === 'model_output')
      .flatMap((step) => step.content ?? [])
      .filter((part) => part.type === 'text')
      .map((part) => part.text ?? '')
      .join('')
      .trim();
    if (!content) throw new Error('Gemini returned no assistant message');
    return { role: 'assistant' as const, content };
  }
}

export function createUserKeyProvider(config: UserAIConfig): AIProvider {
  return config.kind === 'gemini' ? new UserKeyGeminiProvider(config) : new UserKeyOpenAICompatibleProvider(config);
}
