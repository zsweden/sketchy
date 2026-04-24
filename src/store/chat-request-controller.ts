export interface ChatRequestHandle {
  requestId: number;
  diagramId: string;
}

let activeController: AbortController | null = null;
let activeRequestId = 0;

export function beginChatRequest(
  diagramId: string,
  options: { abortPrevious?: boolean } = {},
): ChatRequestHandle {
  if (options.abortPrevious && activeController) {
    activeController.abort();
  }

  activeRequestId += 1;
  activeController = null;

  return {
    requestId: activeRequestId,
    diagramId,
  };
}

export function isChatRequestActive(
  request: ChatRequestHandle,
  currentDiagramId: string,
): boolean {
  return activeRequestId === request.requestId && request.diagramId === currentDiagramId;
}

export function attachChatRequestController(
  request: ChatRequestHandle,
  controller: AbortController,
): void {
  if (activeRequestId === request.requestId) {
    activeController = controller;
  }
}

export function releaseChatRequestController(
  request: ChatRequestHandle,
  controller: AbortController,
): void {
  if (activeRequestId === request.requestId && activeController === controller) {
    activeController = null;
  }
}

export function cancelActiveChatRequest(): void {
  if (activeController) {
    activeController.abort();
  }

  activeController = null;
  activeRequestId += 1;
}

export function resetChatRequestControllerForTests(): void {
  activeController = null;
  activeRequestId = 0;
}
