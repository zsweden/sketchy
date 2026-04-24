import { describe, expect, it } from 'vitest';
import { buildConversationHistory } from '../chat-conversation';

describe('buildConversationHistory', () => {
  it('excludes assistant retry bubbles from request history', () => {
    expect(buildConversationHistory([
      { id: 'u1', role: 'user', content: 'Hello' },
      { id: 'a1', role: 'assistant', content: 'Error: boom', retryText: 'Hello' },
      { id: 'u2', role: 'user', content: 'Try again' },
    ])).toEqual([
      { role: 'user', content: 'Hello' },
      { role: 'user', content: 'Try again' },
    ]);
  });

  it('preserves images and documents on user messages', () => {
    expect(buildConversationHistory([
      {
        id: 'u1',
        role: 'user',
        content: 'See attachment',
        images: [{ mediaType: 'image/png', base64: 'abc' }],
        documents: [{ filename: 'note.txt', mediaType: 'text/plain', base64: 'xyz' }],
      },
    ])).toEqual([
      {
        role: 'user',
        content: 'See attachment',
        images: [{ mediaType: 'image/png', base64: 'abc' }],
        documents: [{ filename: 'note.txt', mediaType: 'text/plain', base64: 'xyz' }],
      },
    ]);
  });
});
