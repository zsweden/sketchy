import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getInitialChatState,
  installChatStorePersistence,
  serializeChatState,
} from '../chat-store-persistence';

describe('chat-store-persistence', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it('hydrates persisted chat state from sessionStorage', () => {
    window.sessionStorage.setItem('sketchy_chat', JSON.stringify({
      messages: [{ id: 'm1', role: 'assistant', content: 'Saved' }],
      aiModifiedNodeIds: ['n1'],
      pendingSuggestions: [{ frameworkId: 'crt', frameworkName: 'CRT', reason: 'fit' }],
    }));

    const state = getInitialChatState();

    expect(state.messages).toEqual([{ id: 'm1', role: 'assistant', content: 'Saved' }]);
    expect(Array.from(state.aiModifiedNodeIds)).toEqual(['n1']);
    expect(state.pendingSuggestions).toEqual([
      { frameworkId: 'crt', frameworkName: 'CRT', reason: 'fit' },
    ]);
  });

  it('clears corrupt persisted state and falls back to an empty snapshot', () => {
    window.sessionStorage.setItem('sketchy_chat', '{bad json');

    const state = getInitialChatState();

    expect(state).toEqual({
      messages: [],
      aiModifiedNodeIds: new Set(),
      pendingSuggestions: null,
    });
    expect(window.sessionStorage.getItem('sketchy_chat')).toBeNull();
  });

  it('serializes state without attachment payloads', () => {
    expect(JSON.parse(serializeChatState({
      messages: [{
        id: 'm1',
        role: 'user',
        content: 'Hello',
        images: [{ mediaType: 'image/png', base64: 'abc' }],
        documents: [{ filename: 'note.txt', mediaType: 'text/plain', base64: 'xyz' }],
      }],
      aiModifiedNodeIds: new Set(['n1']),
      pendingSuggestions: null,
    }))).toEqual({
      messages: [{ id: 'm1', role: 'user', content: 'Hello' }],
      aiModifiedNodeIds: ['n1'],
      pendingSuggestions: null,
    });
  });

  it('persists store updates when the serialized state changes', () => {
    const subscribe = vi.fn((listener: (state: {
      messages: Array<{ id: string; role: 'assistant'; content: string }>;
      aiModifiedNodeIds: Set<string>;
      pendingSuggestions: null;
    }) => void) => {
      listener({
        messages: [{ id: 'm1', role: 'assistant', content: 'Hello' }],
        aiModifiedNodeIds: new Set(['n1']),
        pendingSuggestions: null,
      });
      return () => {};
    });

    installChatStorePersistence({
      getState: () => ({
        messages: [],
        aiModifiedNodeIds: new Set(),
        pendingSuggestions: null,
      }),
      subscribe,
    });

    expect(JSON.parse(window.sessionStorage.getItem('sketchy_chat') ?? 'null')).toEqual({
      messages: [{ id: 'm1', role: 'assistant', content: 'Hello' }],
      aiModifiedNodeIds: ['n1'],
      pendingSuggestions: null,
    });
  });
});
