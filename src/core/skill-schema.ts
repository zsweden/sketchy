import { z } from 'zod';
import type { Skill } from './skill-types';

const aiSkillSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  kind: z.literal('ai'),
  startingFramework: z.string().min(1),
  endingFramework: z.string().optional(),
  instructions: z.string().min(1),
});

const templateNodeSchema = z.object({
  id: z.string().min(1),
  label: z.string(),
  tags: z.array(z.string()).optional(),
  notes: z.string().optional(),
  junctionType: z.enum(['and', 'or', 'add', 'multiply']).optional(),
});

const templateEdgeSchema = z.object({
  source: z.string().min(1),
  target: z.string().min(1),
  edgeTag: z.string().optional(),
  notes: z.string().optional(),
  polarity: z.enum(['positive', 'negative']).optional(),
  confidence: z.enum(['high', 'medium', 'low']).optional(),
});

const templateSkillSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  kind: z.literal('template'),
  startingFramework: z.string().min(1),
  template: z.object({
    nodes: z.array(templateNodeSchema).min(1),
    edges: z.array(templateEdgeSchema),
  }),
});

const skillSchema = z.discriminatedUnion('kind', [aiSkillSchema, templateSkillSchema]);

/** Validate and return a Skill, or throw with details. */
export function validateSkill(data: unknown, source?: string): Skill {
  const result = skillSchema.safeParse(data);
  if (!result.success) {
    const location = source ? ` (from ${source})` : '';
    throw new Error(`Invalid skill${location}: ${result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ')}`);
  }
  return result.data as Skill;
}
