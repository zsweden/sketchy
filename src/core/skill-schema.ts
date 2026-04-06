import { z } from 'zod';
import type { Skill } from './skill-types';

const skillSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  startingFramework: z.string().min(1),
  endingFramework: z.string().optional(),
  instructions: z.string().min(1),
});

/** Validate and return a Skill, or throw with details. */
export function validateSkill(data: unknown, source?: string): Skill {
  const result = skillSchema.safeParse(data);
  if (!result.success) {
    const location = source ? ` (from ${source})` : '';
    throw new Error(`Invalid skill${location}: ${result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ')}`);
  }
  return result.data as Skill;
}
