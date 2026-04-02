import type { Diagram } from '../types';
import type { Framework } from '../framework-types';
import { getFramework } from '../../frameworks/registry';

export interface SkyFileMeta {
  app: string;
  fileFormat: string;
  framework: {
    name: string;
    description: string;
    edgeSemantics?: string;
  };
  junctionSemantics?: string;
  nodeTypes: Record<string, string>;
  tags: Record<string, string>;
  derivedIndicators: string;
  settings: {
    layoutDirection: string;
  };
}

function buildDerivedSummary(fw: Framework): string {
  if (fw.derivedIndicators.length === 0) return 'None defined for this framework.';

  const parts = fw.derivedIndicators.map(
    (d) => `${d.name} = ${d.description.charAt(0).toLowerCase()}${d.description.slice(1)}`,
  );
  return `Not stored in the file, computed from graph topology at render time: ${parts.join(', ')}`;
}

export function buildSkyMeta(diagram: Diagram): SkyFileMeta {
  const fw = getFramework(diagram.frameworkId);

  if (!fw) {
    return {
      app: 'Sketchy — Thinking Frameworks Diagram Editor',
      fileFormat:
        "The 'diagram' field contains all data. Everything in 'meta' is documentation only — ignored when loading.",
      framework: {
        name: diagram.frameworkId,
        description: 'Unknown framework',
      },
      nodeTypes: { entity: 'A node in the diagram' },
      tags: {},
      derivedIndicators: 'Unknown framework — cannot describe derived indicators.',
      settings: {
        layoutDirection:
          'TB = Top-to-Bottom, BT = Bottom-to-Top, LR = Left-to-Right, RL = Right-to-Left (direction of flow)',
      },
    };
  }

  const tags: Record<string, string> = {};
  for (const tag of fw.nodeTags) {
    tags[tag.id] = `${tag.name} — ${tag.description.charAt(0).toLowerCase()}${tag.description.slice(1)}`;
  }

  const meta: SkyFileMeta = {
    app: 'Sketchy — Thinking Frameworks Diagram Editor',
    fileFormat:
      "The 'diagram' field contains all data. Everything in 'meta' is documentation only — ignored when loading.",
    framework: {
      name: fw.name,
      description: fw.description,
    },
    nodeTypes: {
      entity: 'A proposition or observable condition in the diagram',
    },
    tags,
    derivedIndicators: buildDerivedSummary(fw),
    settings: {
      layoutDirection:
        'TB = Top-to-Bottom, BT = Bottom-to-Top, LR = Left-to-Right, RL = Right-to-Left (direction of flow)',
    },
  };

  if (fw.edgeLabel) {
    meta.framework.edgeSemantics = `Each edge means the source entity ${fw.edgeLabel} the target entity`;
  }

  if (fw.supportsJunctions) {
    meta.junctionSemantics =
      "When a node has 2+ incoming edges, junctionType determines logic: 'and' = all causes needed together, 'or' = each cause independently sufficient";
  }

  return meta;
}
