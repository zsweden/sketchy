import type { Framework } from '../core/framework-types';
import { validateFramework } from '../core/framework-schema';

const frameworks = new Map<string, Framework>();

// Auto-discover all framework JSON files in this directory.
// Drop a new .json file here and it registers automatically — no code changes needed.
const modules = import.meta.glob<Record<string, unknown>>('./*.json', { eager: true });

for (const [path, mod] of Object.entries(modules)) {
  const data = (mod as { default?: unknown }).default ?? mod;
  const fw = validateFramework(data, path);
  frameworks.set(fw.id, fw);
}

export function getFramework(id: string): Framework | undefined {
  return frameworks.get(id);
}

export function listFrameworks(): Framework[] {
  return Array.from(frameworks.values());
}

/** Returns the first framework alphabetically by name. */
export function getDefaultFramework(): Framework {
  const sorted = listFrameworks().sort((a, b) => a.name.localeCompare(b.name));
  if (sorted.length === 0) throw new Error('No frameworks registered');
  return sorted[0];
}

export function registerFramework(fw: Framework): void {
  validateFramework(fw);
  frameworks.set(fw.id, fw);
}
