import type { Framework } from '../core/framework-types';

export const prtFramework: Framework = {
  id: 'prt',
  name: 'Prerequisite Tree',
  description: 'Map obstacles and intermediate objectives needed to reach a goal',
  defaultLayoutDirection: 'BT',
  supportsJunctions: true,
  edgeLabel: 'enables',
  nodeTags: [
    {
      id: 'obstacle',
      name: 'Obstacle',
      shortName: 'OBS',
      color: '#FB8C00',
      description: 'A barrier or constraint that blocks progress',
      exclusive: false,
    },
    {
      id: 'io',
      name: 'Intermediate Objective',
      shortName: 'IO',
      color: '#42A5F5',
      description: 'A milestone that overcomes obstacles and unlocks the next step',
      exclusive: false,
    },
    {
      id: 'goal',
      name: 'Goal',
      shortName: 'GOAL',
      color: '#7E57C2',
      description: 'The outcome the tree is intended to achieve',
      exclusive: false,
    },
  ],
  derivedIndicators: [
    {
      id: 'starting-point',
      name: 'Starting Point',
      shortName: 'Start',
      color: '#5C8DB5',
      condition: 'indegree-zero',
      description: 'No incoming edges — a place you can begin acting immediately',
    },
    {
      id: 'milestone',
      name: 'Milestone',
      shortName: 'Step',
      color: '#9E9E9E',
      condition: 'indegree-and-outdegree',
      description: 'Has both incoming and outgoing edges — an intermediate step on the path',
    },
    {
      id: 'target',
      name: 'Target Outcome',
      shortName: 'Target',
      color: '#26A69A',
      condition: 'leaf',
      description: 'No outgoing edges — an endpoint or destination in the tree',
    },
  ],
};
