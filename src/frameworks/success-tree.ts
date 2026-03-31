import type { Framework } from '../core/framework-types';

export const successTreeFramework: Framework = {
  id: 'success-tree',
  name: 'Success Tree',
  description: 'Explain how multiple contributing factors led to a successful outcome',
  defaultLayoutDirection: 'BT',
  supportsJunctions: true,
  edgeLabel: 'contributed to',
  nodeTags: [
    {
      id: 'factor',
      name: 'Success Factor',
      shortName: 'FAC',
      color: '#66BB6A',
      description: 'A condition, decision, or action that helped produce the outcome',
      exclusive: false,
    },
    {
      id: 'achievement',
      name: 'Achievement',
      shortName: 'WIN',
      color: '#42A5F5',
      description: 'A positive outcome, milestone, or result worth explaining',
      exclusive: false,
    },
  ],
  derivedIndicators: [
    {
      id: 'foundation',
      name: 'Foundation',
      shortName: 'Base',
      color: '#5C8DB5',
      condition: 'indegree-zero',
      description: 'No incoming edges — a foundational contributor to the success',
    },
    {
      id: 'contributor',
      name: 'Contributor',
      shortName: 'Contrib',
      color: '#9E9E9E',
      condition: 'indegree-and-outdegree',
      description: 'Has both incoming and outgoing edges — an intermediate contributor',
    },
    {
      id: 'outcome',
      name: 'Outcome',
      shortName: 'Outcome',
      color: '#26A69A',
      condition: 'leaf',
      description: 'No outgoing edges — a success or achievement being explained',
    },
  ],
};
