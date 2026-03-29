// --- Types ---

export interface ModelInfo {
  id: string;
  owned_by: string;
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

// --- Fetch ---

export async function fetchAvailableModels(
  baseUrl: string,
  apiKey: string,
  signal?: AbortSignal,
): Promise<ModelInfo[]> {
  const key = cacheKey(baseUrl, apiKey);
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.models;
  }

  const url = `${baseUrl.replace(/\/+$/, '')}/models`;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  const res = await fetch(url, { headers, signal });
  if (!res.ok) {
    throw new Error(`Failed to fetch models (${res.status})`);
  }

  const json = await res.json();
  const all: ModelInfo[] = (json.data ?? []).map(
    (m: { id: string; owned_by?: string }) => ({
      id: m.id,
      owned_by: m.owned_by ?? 'unknown',
    }),
  );

  const chatModels = all.filter((m) => !isNonChatModel(m.id));
  chatModels.sort((a, b) => a.id.localeCompare(b.id));

  cache.set(key, { models: chatModels, timestamp: Date.now() });
  return chatModels;
}
