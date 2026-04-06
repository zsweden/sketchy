import { z } from 'zod';
import type { Framework } from './framework-types';

const junctionOptionSchema = z.object({
  id: z.string().min(1),
  symbol: z.string(),
  label: z.string().min(1),
  description: z.string().min(1),
});

const nodeTagSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  shortName: z.string().min(1),
  color: z.string().regex(/^#/),
  description: z.string().min(1),
  exclusive: z.boolean(),
});

const derivedIndicatorSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  shortName: z.string().min(1),
  color: z.string().regex(/^#/),
  condition: z.enum(['indegree-zero', 'leaf', 'indegree-and-outdegree']),
  description: z.string().min(1),
});

export const frameworkSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  abbreviation: z.string().min(1),
  description: z.string().min(1),
  defaultLayoutDirection: z.enum(['TB', 'BT', 'LR', 'RL']),
  supportsJunctions: z.boolean(),
  allowsCycles: z.boolean().optional(),
  supportsEdgePolarity: z.boolean().optional(),
  supportsNodeValues: z.boolean().optional(),
  supportsEdgeDelay: z.boolean().optional(),
  junctionOptions: z.array(junctionOptionSchema).optional(),
  nodeTags: z.array(nodeTagSchema),
  derivedIndicators: z.array(derivedIndicatorSchema),
  edgeLabel: z.string().optional(),
  systemPromptHint: z.string().optional(),
});

/** Validate and return a Framework, or throw with details. */
export function validateFramework(data: unknown, source?: string): Framework {
  const result = frameworkSchema.safeParse(data);
  if (!result.success) {
    const location = source ? ` (from ${source})` : '';
    throw new Error(`Invalid framework${location}: ${result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ')}`);
  }
  return result.data as Framework;
}
