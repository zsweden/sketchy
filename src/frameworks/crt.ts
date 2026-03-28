import type { Framework } from '../core/framework-types';

export const crtFramework: Framework = {
  id: 'crt',
  name: 'Current Reality Tree',
  description: 'Map cause-and-effect to find root causes of undesirable effects',
  defaultLayoutDirection: 'BT',
  supportsJunctions: true,
  edgeLabel: 'causes',
  nodeTags: [
    {
      id: 'ude',
      name: 'Undesirable Effect',
      shortName: 'UDE',
      color: '#E57373',
      description: 'Something you want to eliminate',
      exclusive: false,
    },
  ],
  derivedIndicators: [
    {
      id: 'root-cause',
      name: 'Root Cause',
      shortName: 'Root',
      color: '#5C8DB5',
      condition: 'indegree-zero',
      description: 'No incoming edges — a fundamental driver',
    },
    {
      id: 'intermediate',
      name: 'Intermediate Effect',
      shortName: 'Inter',
      color: '#9E9E9E',
      condition: 'indegree-and-outdegree',
      description: 'Has both incoming and outgoing edges',
    },
  ],
};
