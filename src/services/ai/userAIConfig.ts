import * as SecureStore from 'expo-secure-store';

export type AIProviderKind = 'openai-compatible' | 'gemini';

export interface AIProviderPreset {
  id: string;
  name: string;
  kind: AIProviderKind;
  baseUrl: string;
  model: string;
  apiUrl: string;
  docsUrl: string;
}

export interface UserAIConfig {
  providerId: string;
  providerName: string;
  kind: AIProviderKind;
  apiKey: string;
  baseUrl: string;
  model: string;
  apiUrl: string;
}

const CONFIG_KEY = '@murshid/user-ai-config';

/**
 * Presets are editable connection templates. The generic adapter is the source
 * of truth; a preset never claims that a provider supports a non-compatible API.
 */
export const AI_PROVIDER_PRESETS: AIProviderPreset[] = [
  { id: 'openai', name: 'OpenAI', kind: 'openai-compatible', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini', apiUrl: 'https://platform.openai.com/api-keys', docsUrl: 'https://platform.openai.com/docs/api-reference' },
  { id: 'gemini', name: 'Google Gemini', kind: 'gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta', model: 'gemini-3.8-flash', apiUrl: 'https://aistudio.google.com/apikey', docsUrl: 'https://ai.google.dev/gemini-api/docs/interactions-overview' },
  { id: 'xai', name: 'xAI / Grok', kind: 'openai-compatible', baseUrl: 'https://api.x.ai/v1', model: 'grok-3-mini', apiUrl: 'https://console.x.ai/', docsUrl: 'https://docs.x.ai/docs' },
  { id: 'openrouter', name: 'OpenRouter', kind: 'openai-compatible', baseUrl: 'https://openrouter.ai/api/v1', model: 'openai/gpt-4o-mini', apiUrl: 'https://openrouter.ai/settings/keys', docsUrl: 'https://openrouter.ai/docs/api-reference/overview' },
  { id: 'groq', name: 'Groq', kind: 'openai-compatible', baseUrl: 'https://api.groq.com/openai/v1', model: 'llama-3.3-70b-versatile', apiUrl: 'https://console.groq.com/keys', docsUrl: 'https://console.groq.com/docs/openai' },
  { id: 'deepseek', name: 'DeepSeek', kind: 'openai-compatible', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat', apiUrl: 'https://platform.deepseek.com/api_keys', docsUrl: 'https://api-docs.deepseek.com/' },
  { id: 'mistral', name: 'Mistral AI', kind: 'openai-compatible', baseUrl: 'https://api.mistral.ai/v1', model: 'mistral-small-latest', apiUrl: 'https://console.mistral.ai/api-keys/', docsUrl: 'https://docs.mistral.ai/api/' },
  { id: 'together', name: 'Together AI', kind: 'openai-compatible', baseUrl: 'https://api.together.xyz/v1', model: 'meta-llama/Llama-3.3-70B-Instruct-Turbo', apiUrl: 'https://api.together.ai/settings/api-keys', docsUrl: 'https://docs.together.ai/docs/openai-api-compatibility' },
  { id: 'fireworks', name: 'Fireworks AI', kind: 'openai-compatible', baseUrl: 'https://api.fireworks.ai/inference/v1', model: 'accounts/fireworks/models/llama-v3p1-8b-instruct', apiUrl: 'https://fireworks.ai/account/api-keys', docsUrl: 'https://docs.fireworks.ai/tools-sdks/firedworksai-llms/openai-compatibility' },
  { id: 'perplexity', name: 'Perplexity', kind: 'openai-compatible', baseUrl: 'https://api.perplexity.ai', model: 'sonar', apiUrl: 'https://www.perplexity.ai/settings/api', docsUrl: 'https://docs.perplexity.ai/' },
  { id: 'cerebras', name: 'Cerebras', kind: 'openai-compatible', baseUrl: 'https://api.cerebras.ai/v1', model: 'llama-3.3-70b', apiUrl: 'https://cloud.cerebras.ai/platform', docsUrl: 'https://inference-docs.cerebras.ai/' },
  { id: 'sambanova', name: 'SambaNova', kind: 'openai-compatible', baseUrl: 'https://api.sambanova.ai/v1', model: 'Meta-Llama-3.3-70B-Instruct', apiUrl: 'https://cloud.sambanova.ai/apis', docsUrl: 'https://docs.sambanova.ai/' },
  { id: 'nvidia', name: 'NVIDIA NIM', kind: 'openai-compatible', baseUrl: 'https://integrate.api.nvidia.com/v1', model: 'meta/llama-3.1-8b-instruct', apiUrl: 'https://build.nvidia.com/', docsUrl: 'https://docs.api.nvidia.com/nim/reference' },
  { id: 'cloudflare', name: 'Cloudflare Workers AI', kind: 'openai-compatible', baseUrl: 'https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/v1', model: '@cf/meta/llama-3.1-8b-instruct', apiUrl: 'https://dash.cloudflare.com/', docsUrl: 'https://developers.cloudflare.com/workers-ai/configuration/open-ai-compatibility/' },
  { id: 'huggingface', name: 'Hugging Face', kind: 'openai-compatible', baseUrl: 'https://router.huggingface.co/v1', model: 'meta-llama/Llama-3.1-8B-Instruct', apiUrl: 'https://huggingface.co/settings/tokens', docsUrl: 'https://huggingface.co/docs/huggingface_hub/guides/inference' },
  { id: 'azure-openai', name: 'Azure OpenAI', kind: 'openai-compatible', baseUrl: 'https://YOUR_RESOURCE.openai.azure.com/openai', model: 'YOUR_DEPLOYMENT_NAME', apiUrl: 'https://portal.azure.com/', docsUrl: 'https://learn.microsoft.com/azure/ai-services/openai/' },
  { id: 'github-models', name: 'GitHub Models', kind: 'openai-compatible', baseUrl: 'https://models.inference.ai.azure.com', model: 'gpt-4o-mini', apiUrl: 'https://github.com/settings/tokens', docsUrl: 'https://docs.github.com/github-models' },
  { id: 'replicate', name: 'Replicate', kind: 'openai-compatible', baseUrl: 'https://api.replicate.com/v1', model: 'meta/meta-llama-3-8b-instruct', apiUrl: 'https://replicate.com/account/api-tokens', docsUrl: 'https://replicate.com/docs' },
  { id: 'novita', name: 'Novita AI', kind: 'openai-compatible', baseUrl: 'https://api.novita.ai/v3/openai', model: 'meta-llama/llama-3.1-8b-instruct', apiUrl: 'https://novita.ai/settings/key-management', docsUrl: 'https://novita.ai/docs/api-reference/model-apis/openai-compatible-apis' },
  { id: 'siliconflow', name: 'SiliconFlow', kind: 'openai-compatible', baseUrl: 'https://api.siliconflow.cn/v1', model: 'Qwen/Qwen2.5-7B-Instruct', apiUrl: 'https://cloud.siliconflow.cn/account/ak', docsUrl: 'https://docs.siliconflow.cn/' },
  { id: 'zhipu', name: 'Zhipu AI / GLM', kind: 'openai-compatible', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4-flash', apiUrl: 'https://open.bigmodel.cn/usercenter/apikeys', docsUrl: 'https://open.bigmodel.cn/dev/api' },
  { id: 'moonshot', name: 'Moonshot AI / Kimi', kind: 'openai-compatible', baseUrl: 'https://api.moonshot.ai/v1', model: 'moonshot-v1-8k', apiUrl: 'https://platform.moonshot.ai/console/api-keys', docsUrl: 'https://platform.moonshot.ai/docs' },
  { id: 'qwen', name: 'Alibaba Qwen / DashScope', kind: 'openai-compatible', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus', apiUrl: 'https://bailian.console.aliyun.com/', docsUrl: 'https://help.aliyun.com/zh/model-studio/developer-reference/compatibility-of-openai-with-dashscope' },
  { id: 'lmstudio', name: 'LM Studio', kind: 'openai-compatible', baseUrl: 'http://localhost:1234/v1', model: 'local-model', apiUrl: 'https://lmstudio.ai/', docsUrl: 'https://lmstudio.ai/docs/developers/openai-compat' },
  { id: 'ollama', name: 'Ollama', kind: 'openai-compatible', baseUrl: 'http://localhost:11434/v1', model: 'llama3.2', apiUrl: 'https://ollama.com/', docsUrl: 'https://github.com/ollama/ollama/blob/main/docs/openai.md' },
  { id: 'vllm', name: 'vLLM', kind: 'openai-compatible', baseUrl: 'http://localhost:8000/v1', model: 'local-model', apiUrl: 'https://docs.vllm.ai/', docsUrl: 'https://docs.vllm.ai/en/latest/serving/openai_compatible_server.html' },
  { id: 'litellm', name: 'LiteLLM Gateway', kind: 'openai-compatible', baseUrl: 'http://localhost:4000', model: 'openai/gpt-4o-mini', apiUrl: 'https://docs.litellm.ai/', docsUrl: 'https://docs.litellm.ai/docs/providers/openai_compatible' },
  { id: 'custom', name: 'مزود مخصص OpenAI-compatible', kind: 'openai-compatible', baseUrl: 'https://example.com/v1', model: 'your-model', apiUrl: '', docsUrl: 'https://platform.openai.com/docs/api-reference' },
];

export async function getUserAIConfig(): Promise<UserAIConfig | null> {
  const raw = await SecureStore.getItemAsync(CONFIG_KEY);
  if (!raw) return null;
  try {
    const config = JSON.parse(raw) as UserAIConfig;
    return config.apiKey && config.baseUrl && config.model ? config : null;
  } catch {
    return null;
  }
}

export async function saveUserAIConfig(config: UserAIConfig) {
  await SecureStore.setItemAsync(CONFIG_KEY, JSON.stringify(config), { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
}

export async function clearUserAIConfig() {
  await SecureStore.deleteItemAsync(CONFIG_KEY);
}

export function getPreset(providerId: string) {
  return AI_PROVIDER_PRESETS.find((provider) => provider.id === providerId) ?? AI_PROVIDER_PRESETS[AI_PROVIDER_PRESETS.length - 1];
}
