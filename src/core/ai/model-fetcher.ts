// --- Types ---

export interface ModelInfo {
  id: string;
  owned_by: string;
  created: number | null;
}

interface CacheEntry {
  models: ModelInfo[];
  timestamp: number;
}

// --- Cache ---

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function cacheKey(baseUrl: string, apiKey: string): string {
  return `${baseUrl}|${apiKey}`;
}

export function clearModelCache(): void {
  cache.clear();
}

// --- Filter ---

const NON_CHAT_PATTERNS = [
  /^text-embedding/,
  /^tts-/,
  /^dall-e/,
  /^whisper/,
  /^davinci/,
  /^babbage/,
  /^curie/,
  /^ada(?:-|$)/,
  /^moderation/,
  /^text-moderation/,
  /^omni-moderation/,
  /^codex-/,
];

export function isNonChatModel(modelId: string): boolean {
  return NON_CHAT_PATTERNS.some((re) => re.test(modelId));
}

// --- Format ---

export function formatModelDate(created: number | null): string {
  if (!created) return '';
  const d = new Date(created * 1000);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// --- Known models (fallback for providers that block CORS) ---

const KNOWN_MODELS: Record<string, ModelInfo[]> = {
  anthropic: [
    { id: 'claude-opus-4-latest', owned_by: 'anthropic', created: null },
    { id: 'claude-sonnet-4-5-latest', owned_by: 'anthropic', created: null },
    { id: 'claude-sonnet-4-latest', owned_by: 'anthropic', created: null },
    { id: 'claude-haiku-4-5-latest', owned_by: 'anthropic', created: null },
  ],
};

// --- Auth headers ---

function buildHeaders(apiKey: string, provider: string): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (!apiKey) return headers;

  if (provider === 'anthropic') {
    headers['x-api-key'] = apiKey;
    headers['anthropic-version'] = '2023-06-01';
    headers['anthropic-dangerous-direct-browser-access'] = 'true';
  } else {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }
  return headers;
}

export { buildHeaders };

// --- Fetch ---

export async function fetchAvailableModels(
  baseUrl: string,
  apiKey: string,
  signal?: AbortSignal,
  provider: string = 'openai',
): Promise<ModelInfo[]> {
  const key = cacheKey(baseUrl, apiKey);
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.models;
  }

  let chatModels: ModelInfo[];

  try {
    const url = `${baseUrl.replace(/\/+$/, '')}/models`;
    const headers = buildHeaders(apiKey, provider);

    const res = await fetch(url, { headers, signal });
    if (!res.ok) {
      throw new Error(`Failed to fetch models (${res.status})`);
    }

    const json = await res.json();
    const all: ModelInfo[] = (json.data ?? []).map(
      (m: { id: string; owned_by?: string; created?: number }) => ({
        id: m.id,
        owned_by: m.owned_by ?? 'unknown',
        created: m.created ?? null,
      }),
    );

    chatModels = all.filter((m) => !isNonChatModel(m.id));
    chatModels.sort((a, b) => (b.created ?? 0) - (a.created ?? 0));
  } catch (err) {
    // Fall back to known models for providers that block CORS
    if (KNOWN_MODELS[provider]) {
      chatModels = KNOWN_MODELS[provider];
    } else {
      throw err;
    }
  }

  cache.set(key, { models: chatModels, timestamp: Date.now() });
  return chatModels;
}
