import type { Framework } from '../core/framework-types';
import { cldFramework } from './cld';
import { crtFramework } from './crt';
import { frtFramework } from './frt';
import { prtFramework } from './prt';
import { successTreeFramework } from './success-tree';
import { sttFramework } from './stt';

const frameworks = new Map<string, Framework>();

frameworks.set(cldFramework.id, cldFramework);
frameworks.set(crtFramework.id, crtFramework);
frameworks.set(frtFramework.id, frtFramework);
frameworks.set(prtFramework.id, prtFramework);
frameworks.set(successTreeFramework.id, successTreeFramework);
frameworks.set(sttFramework.id, sttFramework);

export function getFramework(id: string): Framework | undefined {
  return frameworks.get(id);
}

export function listFrameworks(): Framework[] {
  return Array.from(frameworks.values());
}

export function registerFramework(fw: Framework): void {
  frameworks.set(fw.id, fw);
}
