import type { Framework } from '../core/framework-types';
import { crtFramework } from './crt';
import { frtFramework } from './frt';

const frameworks = new Map<string, Framework>();

frameworks.set(crtFramework.id, crtFramework);
frameworks.set(frtFramework.id, frtFramework);

export function getFramework(id: string): Framework | undefined {
  return frameworks.get(id);
}

export function listFrameworks(): Framework[] {
  return Array.from(frameworks.values());
}

export function registerFramework(fw: Framework): void {
  frameworks.set(fw.id, fw);
}
