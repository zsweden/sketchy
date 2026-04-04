import { describe, it, expect, vi } from 'vitest';
import type { StreamCallbacks } from '../ai-types';
import { finalizeToolCalls } from '../stream-parsers';

function makeCallbacks() {
  return {
    onToken: vi.fn(),
    onDone: vi.fn(),
    onError: vi.fn(),
  } satisfies StreamCallbacks;
}

describe('finalizeToolCalls', () => {
  it('returns text-only when no tool calls', () => {
    const cb = makeCallbacks();
    finalizeToolCalls([], 'Hello world', cb);
    expect(cb.onDone).toHaveBeenCalledWith({ text: 'Hello world' });
  });

  it('handles modify_diagram tool calls', () => {
    const cb = makeCallbacks();
    finalizeToolCalls(
      [{ name: 'modify_diagram', args: JSON.stringify({ explanation: 'Added node', addNodes: [{ id: 'new_1', label: 'Test' }] }) }],
      '',
      cb,
    );
    expect(cb.onDone).toHaveBeenCalledWith(
      expect.objectContaining({
        text: 'Added node',
        modifications: expect.objectContaining({
          addNodes: [{ id: 'new_1', label: 'Test' }],
        }),
      }),
    );
  });

  describe('suggest_frameworks', () => {
    it('parses a single suggestion', () => {
      const cb = makeCallbacks();
      const args = JSON.stringify({
        suggestions: [
          { frameworkId: 'crt', frameworkName: 'Current Reality Tree', reason: 'Root cause analysis' },
        ],
      });
      finalizeToolCalls([{ name: 'suggest_frameworks', args }], 'Some text', cb);
      expect(cb.onDone).toHaveBeenCalledWith({
        text: 'Some text',
        suggestions: [
          { frameworkId: 'crt', frameworkName: 'Current Reality Tree', reason: 'Root cause analysis' },
        ],
      });
    });

    it('parses multiple suggestions', () => {
      const cb = makeCallbacks();
      const args = JSON.stringify({
        suggestions: [
          { frameworkId: 'crt', frameworkName: 'Current Reality Tree', reason: 'Root causes' },
          { frameworkId: 'frt', frameworkName: 'Future Reality Tree', reason: 'Solution validation' },
          { frameworkId: 'prt', frameworkName: 'Prerequisite Tree', reason: 'Obstacle mapping' },
        ],
      });
      finalizeToolCalls([{ name: 'suggest_frameworks', args }], '', cb);
      const result = cb.onDone.mock.calls[0][0];
      expect(result.suggestions).toHaveLength(3);
      expect(result.suggestions![0].frameworkId).toBe('crt');
      expect(result.suggestions![2].frameworkId).toBe('prt');
    });

    it('falls back gracefully on invalid JSON', () => {
      const cb = makeCallbacks();
      finalizeToolCalls([{ name: 'suggest_frameworks', args: '{invalid' }], 'fallback text', cb);
      expect(cb.onDone).toHaveBeenCalledWith({ text: 'fallback text' });
      expect(cb.onDone.mock.calls[0][0].suggestions).toBeUndefined();
    });

    it('uses fallback message when no text and invalid JSON', () => {
      const cb = makeCallbacks();
      finalizeToolCalls([{ name: 'suggest_frameworks', args: '{bad' }], '', cb);
      expect(cb.onDone.mock.calls[0][0].text).toContain('Could not parse');
    });

    it('prioritizes modify_diagram over suggest_frameworks', () => {
      const cb = makeCallbacks();
      finalizeToolCalls(
        [
          { name: 'modify_diagram', args: JSON.stringify({ explanation: 'Change' }) },
          { name: 'suggest_frameworks', args: JSON.stringify({ suggestions: [{ frameworkId: 'crt', frameworkName: 'CRT', reason: 'x' }] }) },
        ],
        '',
        cb,
      );
      const result = cb.onDone.mock.calls[0][0];
      expect(result.modifications).toBeDefined();
      expect(result.suggestions).toBeUndefined();
    });
  });
});
