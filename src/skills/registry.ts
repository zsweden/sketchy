import type { Skill } from '../core/skill-types';
import { validateSkill } from '../core/skill-schema';

const skills: Skill[] = [];

// Auto-discover all skill JSON files in this directory.
// Drop a new .json file here and it registers automatically — no code changes needed.
const modules = import.meta.glob<Record<string, unknown>>('./*.json', { eager: true });

for (const [path, mod] of Object.entries(modules)) {
  const data = (mod as { default?: unknown }).default ?? mod;
  const skill = validateSkill(data, path);
  skills.push(skill);
}

/** Return all skills available for a given framework. */
export function getSkillsForFramework(frameworkId: string): Skill[] {
  return skills.filter((s) => s.startingFramework === frameworkId);
}

/** Return all registered skills. */
export function listSkills(): Skill[] {
  return [...skills];
}
