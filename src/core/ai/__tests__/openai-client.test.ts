import { describe, it, expect, vi } from 'vitest';
import type { Framework } from '../../framework-types';
import type { Diagram } from '../../types';
import { createEmptyDiagram } from '../../types';

// We test the internal helpers by importing the module and testing through
// the public streamChatMessage function with mocked fetch.

const mockFrameworkCRT: Framework = {
  id: 'crt',
  name: 'Current Reality Tree',
  description: 'Map cause-and-effect to find root causes',
  defaultLayoutDirection: 'BT',
  supportsJunctions: true,
  edgeLabel: 'causes',
  nodeTags: [
    { id: 'ude', name: 'Undesirable Effect', shortName: 'UDE', color: '#E57373', description: 'Bad thing', exclusive: false },
  ],
  derivedIndicators: [],
};

const mockFrameworkCLD: Framework = {
  id: 'cld',
  name: 'Causal Loop Diagram',
  description: 'Model feedback loops with signed causal links',
  defaultLayoutDirection: 'TB',
  supportsJunctions: false,
  allowsCycles: true,
  supportsEdgePolarity: true,
  supportsEdgeDelay: true,
  edgeLabel: 'influences',
  nodeTags: [],
  derivedIndicators: [],
};

const mockFrameworkFRT: Framework = {
  id: 'frt',
  name: 'Future Reality Tree',
  description: 'Validate a proposed solution',
  defaultLayoutDirection: 'BT',
  supportsJunctions: true,
  edgeLabel: 'leads to',
  nodeTags: [
    { id: 'injection', name: 'Injection', shortName: 'INJ', color: '#4CAF50', description: 'A change', exclusive: false },
    { id: 'de', name: 'Desirable Effect', shortName: 'DE', color: '#42A5F5', description: 'Good thing', exclusive: false },
  ],
  derivedIndicators: [],
};

function makeDiagram(): Diagram {
  const d = createEmptyDiagram('crt');
  d.nodes = [
    { id: 'n1', type: 'entity', position: { x: 0, y: 0 }, data: { label: 'Cause', tags: [], junctionType: 'or' } },
    { id: 'n2', type: 'entity', position: { x: 0, y: 100 }, data: { label: 'Effect', tags: ['ude'], junctionType: 'or' } },
  ];
  d.edges = [{ id: 'e1', source: 'n1', target: 'n2' }];
  return d;
}

// Helper: create a mock SSE response from an array of data lines
function mockSSEResponse(lines: string[]): Response {
  const body = lines.map((l) => `data: ${l}`).join('\n') + '\ndata: [DONE]\n';
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(body));
      controller.close();
    },
  });
  return new Response(stream, { status: 200 });
}

// Helper: create SSE response with chunked delivery (simulates streaming)
function mockChunkedSSEResponse(chunks: string[]): Response {
  const encoder = new TextEncoder();
  let i = 0;
  const stream = new ReadableStream({
    pull(controller) {
      if (i < chunks.length) {
        controller.enqueue(encoder.encode(chunks[i]));
        i++;
      } else {
        controller.close();
      }
    },
  });
  return new Response(stream, { status: 200 });
}

describe('streamChatMessage', () => {
  it('streams plain text response', async () => {
    const { streamChatMessage } = await import('../openai-client');

    const tokens: string[] = [];
    let result: { text: string } | null = null;

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      mockSSEResponse([
        JSON.stringify({ choices: [{ delta: { content: 'Hello' } }] }),
        JSON.stringify({ choices: [{ delta: { content: ' world' } }] }),
      ]),
    ));

    await new Promise<void>((resolve) => {
      streamChatMessage('key', 'https://api.test.com/v1', 'gpt-4o', makeDiagram(), mockFrameworkCRT, [], {
        onToken: (t) => tokens.push(t),
        onDone: (r) => { result = r; resolve(); },
        onError: () => resolve(),
      });
    });

    expect(tokens).toEqual(['Hello', ' world']);
    expect(result!.text).toBe('Hello world');
    vi.unstubAllGlobals();
  });

  it('parses single tool call', async () => {
    const { streamChatMessage } = await import('../openai-client');

    let result: { text: string; modifications?: unknown } | null = null;

    const toolCallArgs = JSON.stringify({
      explanation: 'Adding a node',
      addNodes: [{ id: 'new_1', label: 'Test node' }],
    });

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      mockSSEResponse([
        JSON.stringify({ choices: [{ delta: { tool_calls: [{ index: 0, function: { name: 'modify_diagram', arguments: '' } }] } }] }),
        JSON.stringify({ choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: toolCallArgs } }] } }] }),
        JSON.stringify({ choices: [{ delta: {}, finish_reason: 'tool_calls' }] }),
      ]),
    ));

    await new Promise<void>((resolve) => {
      streamChatMessage('key', 'https://api.test.com/v1', 'gpt-4o', makeDiagram(), mockFrameworkCRT, [], {
        onToken: () => {},
        onDone: (r) => { result = r; resolve(); },
        onError: () => resolve(),
      });
    });

    expect(result!.text).toBe('Adding a node');
    expect(result!.modifications).toBeDefined();
    const mods = result!.modifications as { addNodes: { id: string; label: string }[] };
    expect(mods.addNodes).toHaveLength(1);
    expect(mods.addNodes[0].label).toBe('Test node');
    vi.unstubAllGlobals();
  });

  it('assembles streamed tool call arguments across chunks', async () => {
    const { streamChatMessage } = await import('../openai-client');

    let result: { text: string; modifications?: unknown } | null = null;

    // Split the JSON across multiple SSE lines to simulate real streaming
    const part1 = '{"explanation":"Chunked"';
    const part2 = ',"addNodes":[{"id":"n1"';
    const part3 = ',"label":"Split"}]}';

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      mockSSEResponse([
        JSON.stringify({ choices: [{ delta: { tool_calls: [{ index: 0, function: { name: 'modify_diagram', arguments: part1 } }] } }] }),
        JSON.stringify({ choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: part2 } }] } }] }),
        JSON.stringify({ choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: part3 } }] } }] }),
      ]),
    ));

    await new Promise<void>((resolve) => {
      streamChatMessage('key', 'https://api.test.com/v1', 'gpt-4o', makeDiagram(), mockFrameworkCRT, [], {
        onToken: () => {},
        onDone: (r) => { result = r; resolve(); },
        onError: () => resolve(),
      });
    });

    expect(result!.text).toBe('Chunked');
    const mods = result!.modifications as { addNodes: { id: string; label: string }[] };
    expect(mods.addNodes[0].label).toBe('Split');
    vi.unstubAllGlobals();
  });

  it('processes remaining buffer when stream ends without trailing newline', async () => {
    const { streamChatMessage } = await import('../openai-client');

    let result: { text: string; modifications?: unknown } | null = null;

    const args = JSON.stringify({ explanation: 'Buffer test', addNodes: [{ id: 'n1', label: 'Buffered' }] });

    // Last chunk has no trailing newline — tests the buffer flush fix
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      mockChunkedSSEResponse([
        `data: ${JSON.stringify({ choices: [{ delta: { tool_calls: [{ index: 0, function: { name: 'modify_diagram', arguments: args } }] } }] })}\n`,
        `data: [DONE]`, // no trailing newline
      ]),
    ));

    await new Promise<void>((resolve) => {
      streamChatMessage('key', 'https://api.test.com/v1', 'gpt-4o', makeDiagram(), mockFrameworkCRT, [], {
        onToken: () => {},
        onDone: (r) => { result = r; resolve(); },
        onError: () => resolve(),
      });
    });

    expect(result!.text).toBe('Buffer test');
    expect(result!.modifications).toBeDefined();
    vi.unstubAllGlobals();
  });

  it('gracefully handles malformed tool call JSON', async () => {
    const { streamChatMessage } = await import('../openai-client');

    let result: { text: string } | null = null;

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      mockSSEResponse([
        JSON.stringify({ choices: [{ delta: { content: 'Some text. ' } }] }),
        JSON.stringify({ choices: [{ delta: { tool_calls: [{ index: 0, function: { name: 'modify_diagram', arguments: '{"broken":' } }] } }] }),
      ]),
    ));

    await new Promise<void>((resolve) => {
      streamChatMessage('key', 'https://api.test.com/v1', 'gpt-4o', makeDiagram(), mockFrameworkCRT, [], {
        onToken: () => {},
        onDone: (r) => { result = r; resolve(); },
        onError: () => resolve(),
      });
    });

    // Should fall back gracefully — not crash
    expect(result).toBeDefined();
    expect(result!.text).toBeTruthy();
    vi.unstubAllGlobals();
  });

  it('handles data: prefix without space', async () => {
    const { streamChatMessage } = await import('../openai-client');

    const tokens: string[] = [];

    // Some providers send "data:" without a trailing space
    const encoder = new TextEncoder();
    const body = `data:${JSON.stringify({ choices: [{ delta: { content: 'no-space' } }] })}\ndata:[DONE]\n`;
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(body));
        controller.close();
      },
    });

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(stream, { status: 200 })));

    await new Promise<void>((resolve) => {
      streamChatMessage('key', 'https://api.test.com/v1', 'gpt-4o', makeDiagram(), mockFrameworkCRT, [], {
        onToken: (t) => tokens.push(t),
        onDone: () => resolve(),
        onError: () => resolve(),
      });
    });

    expect(tokens).toEqual(['no-space']);
    vi.unstubAllGlobals();
  });

  it('merges multiple tool calls into one modification', async () => {
    const { streamChatMessage } = await import('../openai-client');

    let result: { text: string; modifications?: unknown } | null = null;

    const args1 = JSON.stringify({ explanation: 'First', addNodes: [{ id: 'a', label: 'A' }] });
    const args2 = JSON.stringify({ explanation: 'Second', addEdges: [{ source: 'a', target: 'n1' }] });

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      mockSSEResponse([
        JSON.stringify({ choices: [{ delta: { tool_calls: [{ index: 0, function: { name: 'modify_diagram', arguments: args1 } }] } }] }),
        JSON.stringify({ choices: [{ delta: { tool_calls: [{ index: 1, function: { name: 'modify_diagram', arguments: args2 } }] } }] }),
      ]),
    ));

    await new Promise<void>((resolve) => {
      streamChatMessage('key', 'https://api.test.com/v1', 'gpt-4o', makeDiagram(), mockFrameworkCRT, [], {
        onToken: () => {},
        onDone: (r) => { result = r; resolve(); },
        onError: () => resolve(),
      });
    });

    expect(result!.text).toBe('First Second');
    const mods = result!.modifications as { addNodes: unknown[]; addEdges: unknown[] };
    expect(mods.addNodes).toHaveLength(1);
    expect(mods.addEdges).toHaveLength(1);
    vi.unstubAllGlobals();
  });
});

describe('buildSystemPrompt framework-agnostic', () => {
  // We test that the system prompt includes framework-specific tags by
  // intercepting the fetch call and inspecting the system message body.

  it('includes CRT tags in system prompt', async () => {
    const { streamChatMessage } = await import('../openai-client');

    let systemContent = '';

    vi.stubGlobal('fetch', vi.fn().mockImplementation((_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string);
      systemContent = body.messages[0].content;
      return Promise.resolve(mockSSEResponse([
        JSON.stringify({ choices: [{ delta: { content: 'ok' } }] }),
      ]));
    }));

    await new Promise<void>((resolve) => {
      streamChatMessage('key', 'https://api.test.com/v1', 'gpt-4o', makeDiagram(), mockFrameworkCRT, [], {
        onToken: () => {},
        onDone: () => resolve(),
        onError: () => resolve(),
      });
    });

    expect(systemContent).toContain('Current Reality Tree');
    expect(systemContent).toContain('ude (Undesirable Effect)');
    expect(systemContent).toContain('source causes target');
    expect(systemContent).toContain('Current label[node:<node-id>]');
    expect(systemContent).toContain('Current Source -> Current Target[edge:<edge-id>]');
    expect(systemContent).toContain('R1[loop:<loop-id>]');
    expect(systemContent).toContain('Reply in plain text only. Do not use Markdown formatting');
    vi.unstubAllGlobals();
  });

  it('includes FRT tags in system prompt', async () => {
    const { streamChatMessage } = await import('../openai-client');

    let systemContent = '';

    vi.stubGlobal('fetch', vi.fn().mockImplementation((_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string);
      systemContent = body.messages[0].content;
      return Promise.resolve(mockSSEResponse([
        JSON.stringify({ choices: [{ delta: { content: 'ok' } }] }),
      ]));
    }));

    const diagram = makeDiagram();
    diagram.frameworkId = 'frt';

    await new Promise<void>((resolve) => {
      streamChatMessage('key', 'https://api.test.com/v1', 'gpt-4o', diagram, mockFrameworkFRT, [], {
        onToken: () => {},
        onDone: () => resolve(),
        onError: () => resolve(),
      });
    });

    expect(systemContent).toContain('Future Reality Tree');
    expect(systemContent).toContain('injection (Injection)');
    expect(systemContent).toContain('de (Desirable Effect)');
    expect(systemContent).toContain('source leads to target');
    // "Available tags" line should NOT mention UDE
    expect(systemContent).not.toContain('ude (Undesirable Effect)');
    vi.unstubAllGlobals();
  });

  it('includes edge confidence in system prompt', async () => {
    const { streamChatMessage } = await import('../openai-client');

    let systemContent = '';

    vi.stubGlobal('fetch', vi.fn().mockImplementation((_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string);
      systemContent = body.messages[0].content;
      return Promise.resolve(mockSSEResponse([
        JSON.stringify({ choices: [{ delta: { content: 'ok' } }] }),
      ]));
    }));

    const diagram = makeDiagram();
    diagram.edges[0].confidence = 'medium';

    await new Promise<void>((resolve) => {
      streamChatMessage('key', 'https://api.test.com/v1', 'gpt-4o', diagram, mockFrameworkCRT, [], {
        onToken: () => {},
        onDone: () => resolve(),
        onError: () => resolve(),
      });
    });

    expect(systemContent).toContain('confidence=medium');
    vi.unstubAllGlobals();
  });

  it('describes CLD polarity and cycle rules in the system prompt', async () => {
    const { streamChatMessage } = await import('../openai-client');

    let systemContent = '';

    vi.stubGlobal('fetch', vi.fn().mockImplementation((_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string);
      systemContent = body.messages[0].content;
      return Promise.resolve(mockSSEResponse([
        JSON.stringify({ choices: [{ delta: { content: 'ok' } }] }),
      ]));
    }));

    const diagram = createEmptyDiagram('cld');
    diagram.nodes = [
      { id: 'n1', type: 'entity', position: { x: 0, y: 0 }, data: { label: 'Demand', tags: [], junctionType: 'or' } },
      { id: 'n2', type: 'entity', position: { x: 0, y: 100 }, data: { label: 'Growth', tags: [], junctionType: 'or' } },
      { id: 'n3', type: 'entity', position: { x: 0, y: 200 }, data: { label: 'Adoption', tags: [], junctionType: 'or' } },
    ];
    diagram.edges = [
      { id: 'e1', source: 'n1', target: 'n2', polarity: 'positive' },
      { id: 'e2', source: 'n2', target: 'n3', polarity: 'negative', delay: true },
      { id: 'e3', source: 'n3', target: 'n1', polarity: 'positive' },
    ];

    await new Promise<void>((resolve) => {
      streamChatMessage('key', 'https://api.test.com/v1', 'gpt-4o', diagram, mockFrameworkCLD, [], {
        onToken: () => {},
        onDone: () => resolve(),
        onError: () => resolve(),
      });
    });

    expect(systemContent).toContain('Cycles and feedback loops are allowed');
    expect(systemContent).toContain('polarity=negative');
    expect(systemContent).toContain('delay=true');
    expect(systemContent).toContain('Detected feedback loops:');
    expect(systemContent).toContain('B1[loop:n1>n2>n3]: Demand');
    expect(systemContent).toContain('refer to them by the provided R#/B# names');
    expect(systemContent).toContain('suggest flywheel rewrites or simplifications');
    vi.unstubAllGlobals();
  });
});
