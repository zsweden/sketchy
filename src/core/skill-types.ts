import type { EdgeConfidence, EdgeHandleSide, EdgePolarity, JunctionType } from './types';
import type { LayoutDirection } from './framework-types';

type SkillKind = 'ai' | 'template';

interface BaseSkill {
  id: string;
  name: string;
  startingFramework: string;
  kind: SkillKind;
}

export interface AISkill extends BaseSkill {
  kind: 'ai';
  endingFramework?: string;
  instructions: string;
}

interface TemplateSkillNode {
  id: string;
  label: string;
  x: number;
  y: number;
  tags?: string[];
  notes?: string;
  junctionType?: JunctionType;
}

interface TemplateSkillEdge {
  source: string;
  target: string;
  sourceSide?: EdgeHandleSide;
  targetSide?: EdgeHandleSide;
  edgeTag?: string;
  notes?: string;
  polarity?: EdgePolarity;
  confidence?: EdgeConfidence;
}

export interface TemplateSkill extends BaseSkill {
  kind: 'template';
  template: {
    layoutDirection?: LayoutDirection;
    nodes: TemplateSkillNode[];
    edges: TemplateSkillEdge[];
  };
}

export type Skill = AISkill | TemplateSkill;
