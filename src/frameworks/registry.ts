import type { Framework } from '../core/framework-types';

const frameworks = new Map<string, Framework>();

// Auto-discover all framework files in this directory (excluding registry + tests).
// Drop a new .ts file here that exports a Framework const and it registers automatically.
const modules = import.meta.glob<Record<string, unknown>>('./*.ts', { eager: true });

for (const [path, mod] of Object.entries(modules)) {
  if (path === './registry.ts') continue;
  for (const exp of Object.values(mod)) {
    const fw = exp as Framework;
    if (fw && typeof fw === 'object' && typeof fw.id === 'string' && Array.isArray(fw.nodeTags)) {
      frameworks.set(fw.id, fw);
    }
  }
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
  frameworks.set(fw.id, fw);
}
