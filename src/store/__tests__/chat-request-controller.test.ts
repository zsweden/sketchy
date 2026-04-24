import { beforeEach, describe, expect, it } from 'vitest';
import {
  attachChatRequestController,
  beginChatRequest,
  cancelActiveChatRequest,
  isChatRequestActive,
  releaseChatRequestController,
  resetChatRequestControllerForTests,
} from '../chat-request-controller';

describe('chat-request-controller', () => {
  beforeEach(() => {
    resetChatRequestControllerForTests();
  });

  it('tracks request activity against the current diagram id', () => {
    const request = beginChatRequest('diagram-1');

    expect(isChatRequestActive(request, 'diagram-1')).toBe(true);
    expect(isChatRequestActive(request, 'diagram-2')).toBe(false);
  });

  it('aborts the previous controller when a new request opts in', () => {
    const first = beginChatRequest('diagram-1');
    const firstController = new AbortController();
    attachChatRequestController(first, firstController);

    beginChatRequest('diagram-2', { abortPrevious: true });

    expect(firstController.signal.aborted).toBe(true);
  });

  it('releases the active controller without invalidating the request', () => {
    const request = beginChatRequest('diagram-1');
    const controller = new AbortController();
    attachChatRequestController(request, controller);

    releaseChatRequestController(request, controller);

    expect(isChatRequestActive(request, 'diagram-1')).toBe(true);
  });

  it('cancels the active request and makes it inactive', () => {
    const request = beginChatRequest('diagram-1');
    const controller = new AbortController();
    attachChatRequestController(request, controller);

    cancelActiveChatRequest();

    expect(controller.signal.aborted).toBe(true);
    expect(isChatRequestActive(request, 'diagram-1')).toBe(false);
  });
});
