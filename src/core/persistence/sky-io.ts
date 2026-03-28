import type { Diagram } from '../types';
import { getFramework } from '../../frameworks/registry';
import { validateGraph } from '../graph/validation';
import { migrate, validateDiagramShape } from './schema';
import { isSkyJson, convertSkyJson, diagramToSkyJson } from './causal-json';

function defaultFilename(diagram: Diagram): string {
  const name = diagram.name?.trim() || 'diagram';
  const safe = name.replace(/[^a-zA-Z0-9_\- ]/g, '').replace(/\s+/g, '-');
  return `${safe}.sky`;
}

// Modern File System Access API types
interface FilePickerOptions {
  suggestedName?: string;
  types?: { description: string; accept: Record<string, string[]> }[];
}

interface FileSystemWritableFileStream {
  write(data: Blob): Promise<void>;
  close(): Promise<void>;
}

interface FileSystemFileHandle {
  createWritable(): Promise<FileSystemWritableFileStream>;
}

export async function saveSkyFile(diagram: Diagram): Promise<void> {
  const skyJson = diagramToSkyJson(diagram);
  const json = JSON.stringify(skyJson, null, 2);
  const blob = new Blob([json], { type: 'application/json' });

  // Try modern File System Access API first
  if ('showSaveFilePicker' in window) {
    try {
      const opts: FilePickerOptions = {
        suggestedName: defaultFilename(diagram),
        types: [
          {
            description: 'Sketchy Project',
            accept: { 'application/json': ['.sky'] },
          },
        ],
      };
      const handle: FileSystemFileHandle = await (
        window as unknown as { showSaveFilePicker: (opts: FilePickerOptions) => Promise<FileSystemFileHandle> }
      ).showSaveFilePicker(opts);
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return;
    } catch (err) {
      // User cancelled the picker — that's fine, just return
      if (err instanceof DOMException && err.name === 'AbortError') return;
      // Fall through to legacy method
    }
  }

  // Legacy fallback: blob download
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = defaultFilename(diagram);
  a.click();
  URL.revokeObjectURL(url);
}

export interface LoadResult {
  diagram: Diagram;
  warnings: string[];
  needsLayout: boolean;
}

export async function loadSkyFile(file: File): Promise<LoadResult> {
  const text = await file.text();
  const warnings: string[] = [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('File is not valid JSON. The file may be corrupted.');
  }

  let diagram: Diagram;
  let needsLayout = false;

  // New unified format (flat JSON with nodes[].label)
  if (isSkyJson(parsed)) {
    const result = convertSkyJson(parsed);
    diagram = result.diagram;
    needsLayout = result.needsLayout;
  }
  // Legacy .sky wrapper format (has format: 'sky')
  else if (
    typeof parsed === 'object' &&
    parsed !== null &&
    (parsed as Record<string, unknown>).format === 'sky'
  ) {
    const skyFile = parsed as Record<string, unknown>;
    const inner = skyFile.diagram;
    if (!validateDiagramShape(inner)) {
      throw new Error('Invalid .sky project. The diagram data is missing or malformed.');
    }
    diagram = migrate(inner as unknown as Record<string, unknown>);
  }
  // Legacy raw diagram JSON (has schemaVersion)
  else if (validateDiagramShape(parsed)) {
    diagram = migrate(parsed as unknown as Record<string, unknown>);
  } else {
    throw new Error('Unrecognized file format. Expected a .sky project file.');
  }

  // Check framework
  if (!getFramework(diagram.frameworkId)) {
    warnings.push(
      `Unknown framework "${diagram.frameworkId}" — loading as generic diagram`,
    );
  }

  // Validate graph
  const graphResult = validateGraph(diagram.nodes, diagram.edges);
  if (!graphResult.valid) {
    diagram.edges = diagram.edges.filter(
      (e) => !graphResult.droppedEdges.some((d) => d.id === e.id),
    );
    warnings.push(
      `Dropped ${graphResult.droppedEdges.length} invalid edge(s): ${graphResult.reasons.join('; ')}`,
    );
  }

  return { diagram, warnings, needsLayout };
}
