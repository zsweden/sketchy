import type { Diagram } from '../types';
import type { Framework } from '../framework-types';
import { buildHeaders } from './model-fetcher';
import type { ChatMessage, StreamCallbacks } from './ai-types';
import {
  buildSystemPrompt,
  buildGuideSystemPrompt,
  modifyDiagramTool,
  anthropicModifyDiagramTool,
  suggestFrameworksTool,
  anthropicSuggestFrameworksTool,
} from './system-prompt';
import type { ParseState } from './stream-parsers';
import { processOpenAILine, processAnthropicLine, finalizeToolCalls } from './stream-parsers';

export type { ChatDocument, ChatImage, ChatMessage, DiagramModification } from './ai-types';

// --- Conversation pruning ---

const MAX_HISTORY_MESSAGES = 16; // ~8 exchanges (user + assistant pairs)

function pruneHistory(messages: ChatMessage[]): ChatMessage[] {
  if (messages.length <= MAX_HISTORY_MESSAGES) return messages;
  return messages.slice(-MAX_HISTORY_MESSAGES);
}

// --- Request builders ---

function buildOpenAIRequest(
  baseUrl: string,
  apiKey: string,
  model: string,
  systemPrompt: string,
  messages: ChatMessage[],
  tools: unknown[],
): { url: string; headers: Record<string, string>; body: string } {
  const apiMessages = [
    { role: 'system' as const, content: systemPrompt },
    ...pruneHistory(messages).map((m) => {
      const hasMedia = m.images?.length || m.documents?.length;
      if (hasMedia) {
        return {
          role: m.role,
          content: [
            { type: 'text' as const, text: m.content },
            ...(m.images ?? []).map((img) => ({
              type: 'image_url' as const,
              image_url: { url: `data:${img.mediaType};base64,${img.base64}` },
            })),
            ...(m.documents ?? []).map((doc) => ({
              type: 'file' as const,
              file: {
                filename: doc.filename,
                file_data: `data:${doc.mediaType};base64,${doc.base64}`,
              },
            })),
          ],
        };
      }
      return { role: m.role, content: m.content };
    }),
  ];
  return {
    url: `${baseUrl.replace(/\/+$/, '')}/chat/completions`,
    headers: buildHeaders(apiKey, 'openai'),
    body: JSON.stringify({
      model,
      messages: apiMessages,
      tools,
      tool_choice: 'auto',
      stream: true,
    }),
  };
}

function buildAnthropicRequest(
  baseUrl: string,
  apiKey: string,
  model: string,
  systemPrompt: string,
  messages: ChatMessage[],
  tools: unknown[],
): { url: string; headers: Record<string, string>; body: string } {
  const userMessages = pruneHistory(messages)
    .filter((m) => m.role !== 'system')
    .map((m) => {
      const hasMedia = m.images?.length || m.documents?.length;
      if (hasMedia) {
        return {
          role: m.role,
          content: [
            { type: 'text' as const, text: m.content },
            ...(m.images ?? []).map((img) => ({
              type: 'image' as const,
              source: { type: 'base64' as const, media_type: img.mediaType, data: img.base64 },
            })),
            ...(m.documents ?? []).map((doc) => ({
              type: 'document' as const,
              source: { type: 'base64' as const, media_type: doc.mediaType, data: doc.base64 },
            })),
          ],
        };
      }
      return { role: m.role, content: m.content };
    });
  return {
    url: `${baseUrl.replace(/\/+$/, '')}/messages`,
    headers: buildHeaders(apiKey, 'anthropic'),
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      system: systemPrompt,
      messages: userMessages,
      tools,
      stream: true,
    }),
  };
}

// --- Streaming API call ---

export function streamChatMessage(
  apiKey: string,
  baseUrl: string,
  model: string,
  diagram: Diagram,
  framework: Framework,
  messages: ChatMessage[],
  callbacks: StreamCallbacks,
  provider: string = 'openai',
  guideMode: boolean = false,
  responseStyle: 'concise' | 'detailed' = 'concise',
): AbortController {
  const controller = new AbortController();
  const systemPrompt = guideMode
    ? buildGuideSystemPrompt(diagram, framework, responseStyle)
    : buildSystemPrompt(diagram, framework, responseStyle);

  const isAnthropic = provider === 'anthropic';
  const openaiTools = guideMode
    ? [modifyDiagramTool, suggestFrameworksTool]
    : [modifyDiagramTool];
  const anthropicTools = guideMode
    ? [anthropicModifyDiagramTool, anthropicSuggestFrameworksTool]
    : [anthropicModifyDiagramTool];
  const req = isAnthropic
    ? buildAnthropicRequest(baseUrl, apiKey, model, systemPrompt, messages, anthropicTools)
    : buildOpenAIRequest(baseUrl, apiKey, model, systemPrompt, messages, openaiTools);

  const processLine = isAnthropic ? processAnthropicLine : processOpenAILine;

  fetch(req.url, {
    method: 'POST',
    headers: req.headers,
    body: req.body,
    signal: controller.signal,
  })
    .then(async (res) => {
      if (!res.ok) {
        const errorBody = await res.text();
        throw new Error(`API error (${res.status}): ${errorBody}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';
      const state: ParseState = { contentText: '', toolCalls: [] };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          processLine(line, state, callbacks);
        }
      }

      if (buffer.trim()) {
        processLine(buffer, state, callbacks);
      }

      finalizeToolCalls(state.toolCalls, state.contentText, callbacks);
    })
    .catch((err) => {
      if (err.name === 'AbortError') return;
      callbacks.onError(err instanceof Error ? err : new Error(String(err)));
    });

  return controller;
}
