import { describe, it, expect } from 'vitest';
import { loadSkyFile } from '../sky-io';
import { createEmptyDiagram, SCHEMA_VERSION } from '../../types';
import type { Diagram } from '../../types';

function makeFile(content: string, name = 'test.sky'): File {
  return new File([content], name, { type: 'application/json' });
}

function makeDiagram(): Diagram {
  const d = createEmptyDiagram('crt', 'test-id');
  d.nodes = [
    {
      id: 'n1',
      type: 'entity',
      position: { x: 0, y: 0 },
      pinned: false,
      data: { label: 'Node 1', tags: ['ude'], junctionType: 'and' },
    },
    {
      id: 'n2',
      type: 'entity',
      position: { x: 0, y: 100 },
      pinned: false,
      data: { label: 'Node 2', tags: [], junctionType: 'and' },
    },
  ];
  d.edges = [{ id: 'e1', source: 'n1', target: 'n2' }];
  return d;
}

describe('loadSkyFile', () => {
  it('loads a .sky format file', async () => {
    const diagram = makeDiagram();
    const skyFile = {
      format: 'sky',
      version: SCHEMA_VERSION,
      createdAt: new Date().toISOString(),
      diagram,
    };

    const result = await loadSkyFile(makeFile(JSON.stringify(skyFile)));

    expect(result.diagram.id).toBe('test-id');
    expect(result.diagram.nodes).toHaveLength(2);
    expect(result.diagram.edges).toHaveLength(1);
    expect(result.warnings).toHaveLength(0);
  });

  it('loads a raw diagram JSON (backwards compat)', async () => {
    const diagram = makeDiagram();
    const result = await loadSkyFile(makeFile(JSON.stringify(diagram)));

    expect(result.diagram.id).toBe('test-id');
    expect(result.diagram.nodes).toHaveLength(2);
    expect(result.warnings).toHaveLength(0);
  });

  it('rejects invalid JSON', async () => {
    await expect(loadSkyFile(makeFile('not json'))).rejects.toThrow(
      'not valid JSON',
    );
  });

  it('rejects unrecognized format', async () => {
    await expect(
      loadSkyFile(makeFile(JSON.stringify({ foo: 'bar' }))),
    ).rejects.toThrow('Unrecognized file format');
  });

  it('rejects .sky file with malformed diagram', async () => {
    const skyFile = {
      format: 'sky',
      version: 1,
      diagram: { broken: true },
    };

    await expect(
      loadSkyFile(makeFile(JSON.stringify(skyFile))),
    ).rejects.toThrow('missing or malformed');
  });

  it('drops invalid edges and warns', async () => {
    const diagram = makeDiagram();
    // Add a cyclic edge
    diagram.edges.push({ id: 'e2', source: 'n2', target: 'n1' });
    // And add another edge that creates a duplicate
    diagram.edges.push({ id: 'e3', source: 'n1', target: 'n2' });

    const skyFile = {
      format: 'sky',
      version: SCHEMA_VERSION,
      createdAt: new Date().toISOString(),
      diagram,
    };

    const result = await loadSkyFile(makeFile(JSON.stringify(skyFile)));

    expect(result.diagram.edges).toHaveLength(1);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain('Dropped');
  });

  it('warns about unknown framework', async () => {
    const diagram = makeDiagram();
    diagram.frameworkId = 'unknown-framework';

    const result = await loadSkyFile(makeFile(JSON.stringify(diagram)));

    expect(result.warnings.some((w) => w.includes('Unknown framework'))).toBe(
      true,
    );
  });

  it('preserves tags and node data through save/load', async () => {
    const diagram = makeDiagram();
    const skyFile = {
      format: 'sky',
      version: SCHEMA_VERSION,
      createdAt: new Date().toISOString(),
      diagram,
    };

    const result = await loadSkyFile(makeFile(JSON.stringify(skyFile)));

    const node1 = result.diagram.nodes.find((n) => n.id === 'n1');
    expect(node1?.data.tags).toEqual(['ude']);
    expect(node1?.data.label).toBe('Node 1');
  });
});
