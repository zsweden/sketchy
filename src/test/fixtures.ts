/**
 * Shared test fixtures for mock frameworks and diagrams.
 *
 * These are lightweight stubs that satisfy the Framework and Diagram
 * interfaces without depending on the real JSON manifests or registry.
 */
import type { Framework } from '../core/framework-types';
import type { Diagram } from '../core/types';
import { createEmptyDiagram } from '../core/types';

// ---------------------------------------------------------------------------
// Mock frameworks
// ---------------------------------------------------------------------------

export const mockFrameworkCRT: Framework = {
  id: 'crt',
  name: 'Current Reality Tree',
  abbreviation: 'CRT',
  description: 'Map cause-and-effect to find root causes',
  defaultLayoutDirection: 'BT',
  supportsJunctions: true,
  edgeLabel: 'causes',
  nodeTags: [
    { id: 'ude', name: 'Undesirable Effect', shortName: 'UDE', color: '#E57373', description: 'Bad thing', exclusive: false },
  ],
  derivedIndicators: [],
};

export const mockFrameworkCLD: Framework = {
  id: 'cld',
  name: 'Causal Loop Diagram',
  abbreviation: 'CLD',
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

export const mockFrameworkFRT: Framework = {
  id: 'frt',
  name: 'Future Reality Tree',
  abbreviation: 'FRT',
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

// ---------------------------------------------------------------------------
// Mock diagrams
// ---------------------------------------------------------------------------

/** A simple 2-node CRT diagram with one edge. */
export function makeCRTDiagram(): Diagram {
  const d = createEmptyDiagram('crt');
  d.nodes = [
    { id: 'n1', type: 'entity', position: { x: 0, y: 0 }, data: { label: 'Cause', tags: [], junctionType: 'or' } },
    { id: 'n2', type: 'entity', position: { x: 0, y: 100 }, data: { label: 'Effect', tags: ['ude'], junctionType: 'or' } },
  ];
  d.edges = [{ id: 'e1', source: 'n1', target: 'n2' }];
  return d;
}

// ---------------------------------------------------------------------------
// SSE test helpers
// ---------------------------------------------------------------------------

/** Create a mock SSE response from an array of data lines. */
export function mockSSEResponse(lines: string[]): Response {
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

/** Create SSE response with chunked delivery (simulates streaming). */
export function mockChunkedSSEResponse(chunks: string[]): Response {
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
