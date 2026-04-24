import type { StoreApi } from 'zustand';
import type {
  PersistableChatState,
  PersistedChatState,
} from './chat-store-types';

const CHAT_STORAGE_KEY = 'sketchy_chat';

function clearPersistedChatState(): void {
  try {
    window.sessionStorage.removeItem(CHAT_STORAGE_KEY);
  } catch {
    // Ignore storage cleanup failures
  }
}

export function getInitialChatState(): PersistableChatState {
  if (typeof window === 'undefined') {
    return { messages: [], aiModifiedNodeIds: new Set(), pendingSuggestions: null };
  }

  try {
    const raw = window.sessionStorage.getItem(CHAT_STORAGE_KEY);
    if (!raw) {
      return { messages: [], aiModifiedNodeIds: new Set(), pendingSuggestions: null };
    }

    const parsed = JSON.parse(raw) as Partial<PersistedChatState>;
    return {
      messages: Array.isArray(parsed.messages) ? parsed.messages : [],
      aiModifiedNodeIds: new Set(
        Array.isArray(parsed.aiModifiedNodeIds)
          ? parsed.aiModifiedNodeIds.filter(
            (id): id is string => typeof id === 'string',
          )
          : [],
      ),
      pendingSuggestions: parsed.pendingSuggestions ?? null,
    };
  } catch {
    clearPersistedChatState();
    return { messages: [], aiModifiedNodeIds: new Set(), pendingSuggestions: null };
  }
}

export function serializeChatState(state: PersistableChatState): string {
  return JSON.stringify({
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    messages: state.messages.map(({ images, documents, ...rest }) => rest),
    aiModifiedNodeIds: Array.from(state.aiModifiedNodeIds),
    pendingSuggestions: state.pendingSuggestions,
  } satisfies PersistedChatState);
}

export function persistChatState(state: PersistableChatState): void {
  if (typeof window === 'undefined') return;

  try {
    window.sessionStorage.setItem(CHAT_STORAGE_KEY, serializeChatState(state));
  } catch {
    // Ignore storage quota / availability issues
  }
}

export function installChatStorePersistence<T extends PersistableChatState>(
  store: Pick<StoreApi<T>, 'getState' | 'subscribe'>,
): void {
  if (typeof window === 'undefined') return;

  let lastPersistedState = serializeChatState(store.getState());

  store.subscribe((state) => {
    const nextSerialized = serializeChatState(state);
    if (nextSerialized === lastPersistedState) return;

    lastPersistedState = nextSerialized;
    persistChatState(state);
  });
}
