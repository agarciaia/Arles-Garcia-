import { providers, providerStatus } from './providers.mjs';

const DEFAULT_MODELS = {
  openrouter: 'openrouter/free',
  groq: 'openai/gpt-oss-20b',
  nvidia: 'deepseek-ai/deepseek-v4-flash',
  mistral: 'mistral-small-latest',
  huggingface: 'openai/gpt-oss-120b:fastest',
  vercelai: 'openai/gpt-5.4-mini',
  cerebras: 'gpt-oss-120b',
  cohere: 'command-a-plus-05-2026',
  cloudflare: '@cf/openai/gpt-oss-120b'
};

export const DEFAULT_FALLBACK_ORDER = [
  'openrouter', 'groq', 'cerebras', 'mistral', 'gemini',
  'huggingface', 'nvidia', 'cohere', 'vercelai', 'cloudflare'
];

function configured(name) {
  try { return providerStatus(name).configured; } catch { return false; }
}

function modelFor(name, override) {
  if (override) return override;
  const p = providers[name];
  return (p?.modelEnv && process.env[p.modelEnv]) || DEFAULT_MODELS[name];
}

function normalizeMessages({ prompt, messages = [], system }) {
  const out = [];
  if (system) out.push({ role: 'system', content: system });
  if (messages.length) out.push(...messages);
  if (prompt) out.push({ role: 'user', content: prompt });
  if (!out.length) throw new Error('Debes enviar prompt o messages.');
  return out;
}

async function parseJson(res) {
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    const error = new Error(`HTTP ${res.status} ${res.statusText}`);
    error.status = res.status;
    error.data = data;
    throw error;
  }
  return data;
}

function extractOpenAIText(data) {
  return data?.choices?.[0]?.message?.content ?? data?.choices?.[0]?.text ?? '';
}

async function callOpenAICompatible(name, input) {
  const p = providers[name];
  const key = process.env[p.env];
  let baseUrl = p.baseUrl;
  if (name === 'cloudflare') {
    baseUrl = `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/ai/v1`;
  }
  const model = modelFor(name, input.model);
  const body = {
    model,
    messages: normalizeMessages(input),
    temperature: input.temperature ?? 0.2
  };
  if (input.maxTokens) body.max_tokens = input.maxTokens;
  const headers = { Authorization: `Bearer ${key || process.env.CLOUDFLARE_API_TOKEN}`, 'Content-Type': 'application/json' };
  if (name === 'openrouter') {
    if (process.env.OPENROUTER_SITE_URL) headers['HTTP-Referer'] = process.env.OPENROUTER_SITE_URL;
    if (process.env.OPENROUTER_APP_NAME) headers['X-OpenRouter-Title'] = process.env.OPENROUTER_APP_NAME;
  }
  const data = await parseJson(await fetch(`${baseUrl}/chat/completions`, { method: 'POST', headers, body: JSON.stringify(body) }));
  return { provider: name, model: data?.model || model, text: extractOpenAIText(data), raw: data };
}

async function callCohere(input) {
  const model = modelFor('cohere', input.model);
  const data = await parseJson(await fetch(`${providers.cohere.baseUrl}/chat`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.COHERE_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages: normalizeMessages(input), temperature: input.temperature ?? 0.2 })
  }));
  return { provider: 'cohere', model, text: data?.message?.content?.map?.((x) => x.text || '').join('') || '', raw: data };
}

async function callGemini(input) {
  const model = input.model || process.env.GEMINI_MODEL || 'gemini-3.8-flash';
  const prompt = normalizeMessages(input).map((m) => `${m.role}: ${m.content}`).join('\n');
  const data = await parseJson(await fetch(`${providers.gemini.baseUrl}/interactions`, {
    method: 'POST',
    headers: { 'x-goog-api-key': process.env.GEMINI_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, input: prompt })
  }));
  const text = data?.outputs?.map?.((x) => x.text || x.content || '').join('') || data?.output_text || '';
  return { provider: 'gemini', model, text, raw: data };
}

export async function chatWithProvider(provider, input = {}) {
  if (!configured(provider)) throw new Error(`${provider} no está configurado.`);
  if (provider === 'gemini') return callGemini(input);
  if (provider === 'cohere') return callCohere(input);
  if (providers[provider]?.openAICompatible) return callOpenAICompatible(provider, input);
  throw new Error(`Proveedor LLM no soportado por el router: ${provider}`);
}

export async function chatAuto(input = {}, options = {}) {
  const order = options.providers || DEFAULT_FALLBACK_ORDER;
  const errors = [];
  for (const provider of order) {
    if (!configured(provider)) continue;
    try {
      return { ...(await chatWithProvider(provider, input)), attempts: errors.length + 1, previousErrors: errors };
    } catch (error) {
      errors.push({ provider, message: error.message, status: error.status });
    }
  }
  const error = new Error('Ningún proveedor LLM configurado respondió correctamente.');
  error.attempts = errors;
  throw error;
}

export async function transcribeWithGroq(audioBlob, { filename = 'audio.webm', model = 'whisper-large-v3-turbo', language = 'es' } = {}) {
  if (!configured('groq')) throw new Error('Groq no está configurado.');
  const form = new FormData();
  form.append('file', audioBlob, filename);
  form.append('model', model);
  if (language) form.append('language', language);
  const data = await parseJson(await fetch(`${providers.groq.baseUrl}/audio/transcriptions`, {
    method: 'POST', headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` }, body: form
  }));
  return { provider: 'groq', model, text: data?.text || '', raw: data };
}

export function activeLlmProviders() {
  return DEFAULT_FALLBACK_ORDER.map((name) => ({ name, configured: configured(name), model: modelFor(name) }));
}
