import type { Diagram } from '../types';
import { isProjectJson, convertProjectJson, diagramToProjectJson } from './causal-json';
import { migrateDiagramShape, normalizeLoadedDiagram } from './load-helpers';
import { getFramework } from '../../frameworks/registry';

function defaultFilename(diagram: Diagram): string {
  const name = diagram.name?.trim() || 'diagram';
  const safe = name.replace(/[^a-zA-Z0-9_\- ]/g, '').replace(/\s+/g, '-');
  const framework = getFramework(diagram.frameworkId);
  const abbrev = framework?.abbreviation ?? diagram.frameworkId.toUpperCase().slice(0, 3);
  return `${safe}_${abbrev}.json`;
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

export async function saveProjectFile(diagram: Diagram): Promise<void> {
  const projectJson = diagramToProjectJson(diagram);
  const json = JSON.stringify(projectJson, null, 2);
  const blob = new Blob([json], { type: 'application/json' });

  // Try modern File System Access API first
  if ('showSaveFilePicker' in window) {
    try {
      const opts: FilePickerOptions = {
        suggestedName: defaultFilename(diagram),
        types: [
          {
            description: 'Sketchy Project',
            accept: { 'application/json': ['.json'] },
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

interface LoadResult {
  diagram: Diagram;
  warnings: string[];
  needsLayout: boolean;
}

export async function loadProjectFile(file: File): Promise<LoadResult> {
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

  if (isProjectJson(parsed)) {
    const result = convertProjectJson(parsed);
    diagram = result.diagram;
    needsLayout = result.needsLayout;
  } else {
    const legacyDiagram = migrateDiagramShape(parsed);
    if (!legacyDiagram) {
      throw new Error('Unrecognized file format. Expected a Sketchy .json project file.');
    }
    diagram = legacyDiagram;
  }

  const normalized = normalizeLoadedDiagram(
    diagram,
    (droppedCount) =>
      `File contained errors and was sanitized: removed ${droppedCount} invalid connection(s) referencing non-existent nodes.`,
  );

  return {
    diagram: normalized.diagram,
    warnings: [...warnings, ...normalized.warnings],
    needsLayout,
  };
}
