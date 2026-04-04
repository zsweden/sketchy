import { describe, it, expect } from 'vitest';
import { buildAutoModeSystemPrompt, suggestFrameworksTool } from '../system-prompt';
import { createEmptyDiagram } from '../../types';
import { listFrameworks } from '../../../frameworks/registry';

const emptyDiagram = createEmptyDiagram('crt');

describe('auto-mode system prompt', () => {
  it('includes all framework names', () => {
    const prompt = buildAutoModeSystemPrompt(emptyDiagram);
    const frameworks = listFrameworks();

    for (const fw of frameworks) {
      expect(prompt).toContain(fw.name);
      expect(prompt).toContain(fw.id);
    }
  });

  it('instructs to call suggest_frameworks tool', () => {
    const prompt = buildAutoModeSystemPrompt(emptyDiagram);
    expect(prompt).toContain('MUST call the suggest_frameworks tool');
  });

  it('includes diagram content when nodes exist', () => {
    const diagram = {
      ...emptyDiagram,
      nodes: [
        { id: 'n1', type: 'entity' as const, position: { x: 0, y: 0 }, data: { label: 'Deploy failures', tags: [], junctionType: 'or' as const } },
      ],
      edges: [],
    };
    const prompt = buildAutoModeSystemPrompt(diagram);
    expect(prompt).toContain('Deploy failures');
    expect(prompt).toContain('already has content');
  });

  it('omits diagram section when diagram is empty', () => {
    const prompt = buildAutoModeSystemPrompt(emptyDiagram);
    expect(prompt).not.toContain('already has content');
  });
});

describe('suggestFrameworksTool', () => {
  it('has correct tool name', () => {
    expect(suggestFrameworksTool.function.name).toBe('suggest_frameworks');
  });

  it('requires suggestions array', () => {
    const params = suggestFrameworksTool.function.parameters;
    expect(params.required).toContain('suggestions');
    expect(params.properties.suggestions.type).toBe('array');
    expect(params.properties.suggestions.minItems).toBe(1);
    expect(params.properties.suggestions.maxItems).toBe(3);
  });

  it('has frameworkId enum matching registered frameworks', () => {
    const frameworks = listFrameworks();
    const enumValues = suggestFrameworksTool.function.parameters.properties.suggestions.items.properties.frameworkId.enum;
    expect(enumValues).toEqual(frameworks.map((fw) => fw.id));
  });

  it('requires frameworkId, frameworkName, and reason', () => {
    const required = suggestFrameworksTool.function.parameters.properties.suggestions.items.required;
    expect(required).toContain('frameworkId');
    expect(required).toContain('frameworkName');
    expect(required).toContain('reason');
  });
});
