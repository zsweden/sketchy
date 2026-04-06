import { describe, it, expect } from 'vitest';
import { buildSystemPrompt, buildGuideSystemPrompt, suggestFrameworksTool } from '../system-prompt';
import { createEmptyDiagram } from '../../types';
import { listFrameworks, getFramework } from '../../../frameworks/registry';

const crtFramework = getFramework('crt')!;
const emptyDiagram = createEmptyDiagram('crt');

describe('guide-mode system prompt', () => {
  it('includes alternative framework names (all except current)', () => {
    const prompt = buildGuideSystemPrompt(emptyDiagram, crtFramework);
    const frameworks = listFrameworks();

    for (const fw of frameworks) {
      if (fw.id === 'crt') continue;
      expect(prompt).toContain(fw.name);
    }
  });

  it('includes the current framework context', () => {
    const prompt = buildGuideSystemPrompt(emptyDiagram, crtFramework);
    expect(prompt).toContain('Current Reality Tree');
    expect(prompt).toContain('GUIDE MODE IS ON');
  });

  it('includes modify_diagram instructions from base prompt', () => {
    const prompt = buildGuideSystemPrompt(emptyDiagram, crtFramework);
    expect(prompt).toContain('modify_diagram');
  });

  it('includes diagram content when nodes exist', () => {
    const diagram = {
      ...emptyDiagram,
      nodes: [
        { id: 'n1', type: 'entity' as const, position: { x: 0, y: 0 }, data: { label: 'Deploy failures', tags: [], junctionType: 'or' as const } },
      ],
      edges: [],
    };
    const prompt = buildGuideSystemPrompt(diagram, crtFramework);
    expect(prompt).toContain('Deploy failures');
  });
});

describe('responseStyle', () => {
  it('concise style omits "explain your reasoning" and adds brevity instruction', () => {
    const prompt = buildSystemPrompt(emptyDiagram, crtFramework, 'concise');
    expect(prompt).not.toContain('Always explain your reasoning');
    expect(prompt).toContain('concise');
  });

  it('detailed style includes "explain your reasoning"', () => {
    const prompt = buildSystemPrompt(emptyDiagram, crtFramework, 'detailed');
    expect(prompt).toContain('Always explain your reasoning');
  });

  it('defaults to concise when no style provided', () => {
    const prompt = buildSystemPrompt(emptyDiagram, crtFramework);
    expect(prompt).not.toContain('Always explain your reasoning');
  });

  it('guide mode prompt respects responseStyle', () => {
    const concise = buildGuideSystemPrompt(emptyDiagram, crtFramework, 'concise');
    const detailed = buildGuideSystemPrompt(emptyDiagram, crtFramework, 'detailed');
    expect(concise).not.toContain('Always explain your reasoning');
    expect(detailed).toContain('Always explain your reasoning');
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
