import type { EdgeConfidence, EdgePolarity, JunctionType } from './types';

export type SkillKind = 'ai' | 'template';

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

export interface TemplateSkillNode {
  id: string;
  label: string;
  tags?: string[];
  notes?: string;
  junctionType?: JunctionType;
}

export interface TemplateSkillEdge {
  source: string;
  target: string;
  edgeTag?: string;
  notes?: string;
  polarity?: EdgePolarity;
  confidence?: EdgeConfidence;
}

export interface TemplateSkill extends BaseSkill {
  kind: 'template';
  template: {
    nodes: TemplateSkillNode[];
    edges: TemplateSkillEdge[];
  };
}

export type Skill = AISkill | TemplateSkill;
