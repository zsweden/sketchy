import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { isNonChatModel, fetchAvailableModels, clearModelCache } from '../model-fetcher';

describe('isNonChatModel', () => {
  it('blocks embedding models', () => {
    expect(isNonChatModel('text-embedding-3-small')).toBe(true);
    expect(isNonChatModel('text-embedding-ada-002')).toBe(true);
  });

  it('blocks tts, dall-e, whisper, legacy completion models', () => {
    expect(isNonChatModel('tts-1')).toBe(true);
    expect(isNonChatModel('tts-1-hd')).toBe(true);
    expect(isNonChatModel('dall-e-3')).toBe(true);
    expect(isNonChatModel('whisper-1')).toBe(true);
    expect(isNonChatModel('davinci-002')).toBe(true);
    expect(isNonChatModel('babbage-002')).toBe(true);
    expect(isNonChatModel('curie')).toBe(true);
  });

  it('passes through chat models from various providers', () => {
    expect(isNonChatModel('gpt-4o')).toBe(false);
    expect(isNonChatModel('gpt-4.1-mini')).toBe(false);
    expect(isNonChatModel('o3-mini')).toBe(false);
    expect(isNonChatModel('o4-mini')).toBe(false);
    expect(isNonChatModel('claude-3-opus')).toBe(false);
    expect(isNonChatModel('llama-3.1-70b')).toBe(false);
    expect(isNonChatModel('mistral-large')).toBe(false);
    expect(isNonChatModel('gemma-2-9b')).toBe(false);
    expect(isNonChatModel('chatgpt-4o-latest')).toBe(false);
  });
});

describe('fetchAvailableModels', () => {
  const mockModelsResponse = {
    data: [
      { id: 'gpt-4o', owned_by: 'openai' },
      { id: 'gpt-4o-mini', owned_by: 'openai' },
      { id: 'text-embedding-3-small', owned_by: 'openai' },
      { id: 'tts-1', owned_by: 'openai' },
      { id: 'dall-e-3', owned_by: 'openai' },
      { id: 'o3-mini', owned_by: 'openai' },
    ],
  };

  beforeEach(() => {
    clearModelCache();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fetches and filters to chat models only, sorted alphabetically', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockModelsResponse),
    }));

    const models = await fetchAvailableModels('https://api.openai.com/v1', 'sk-test');
    expect(models.map((m) => m.id)).toEqual(['gpt-4o', 'gpt-4o-mini', 'o3-mini']);
  });

  it('sends Authorization header when apiKey is provided', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [] }),
    });
    vi.stubGlobal('fetch', mockFetch);

    await fetchAvailableModels('https://api.openai.com/v1', 'sk-test');
    expect(mockFetch.mock.calls[0][1].headers['Authorization']).toBe('Bearer sk-test');
  });

  it('omits Authorization header when apiKey is empty', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [] }),
    });
    vi.stubGlobal('fetch', mockFetch);

    await fetchAvailableModels('http://localhost:11434/v1', '');
    expect(mockFetch.mock.calls[0][1].headers['Authorization']).toBeUndefined();
  });

  it('returns cached results on second call within TTL', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockModelsResponse),
    });
    vi.stubGlobal('fetch', mockFetch);

    await fetchAvailableModels('https://api.openai.com/v1', 'sk-test');
    await fetchAvailableModels('https://api.openai.com/v1', 'sk-test');
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('re-fetches after cache TTL expires', async () => {
    vi.useFakeTimers();
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockModelsResponse),
    });
    vi.stubGlobal('fetch', mockFetch);

    await fetchAvailableModels('https://api.openai.com/v1', 'sk-test');
    vi.advanceTimersByTime(5 * 60 * 1000 + 1);
    await fetchAvailableModels('https://api.openai.com/v1', 'sk-test');
    expect(mockFetch).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });

  it('uses separate cache entries for different baseUrl/apiKey', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [] }),
    });
    vi.stubGlobal('fetch', mockFetch);

    await fetchAvailableModels('https://api.openai.com/v1', 'sk-a');
    await fetchAvailableModels('http://localhost:11434/v1', '');
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('throws on non-200 response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
    }));

    await expect(fetchAvailableModels('https://api.openai.com/v1', 'bad-key'))
      .rejects.toThrow('Failed to fetch models (401)');
  });

  it('strips trailing slashes from baseUrl', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [] }),
    });
    vi.stubGlobal('fetch', mockFetch);

    await fetchAvailableModels('https://api.openai.com/v1/', 'sk-test');
    expect(mockFetch.mock.calls[0][0]).toBe('https://api.openai.com/v1/models');
  });
});
