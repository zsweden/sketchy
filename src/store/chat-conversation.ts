import type { ConversationHistoryMessage, DisplayMessage } from './chat-store-types';

export function buildConversationHistory(
  messages: DisplayMessage[],
): ConversationHistoryMessage[] {
  return messages
    .filter((message) => !(message.role === 'assistant' && message.retryText))
    .map((message) => ({
      role: message.role,
      content: message.content,
      ...(message.images?.length ? { images: message.images } : {}),
      ...(message.documents?.length ? { documents: message.documents } : {}),
    }));
}
