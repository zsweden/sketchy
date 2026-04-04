import type { Framework } from '../core/framework-types';

export const kpiTreeFramework: Framework = {
  id: 'kpi-tree',
  name: 'KPI Tree',
  description: 'Decompose a north-star metric into the sub-metrics that drive it',
  defaultLayoutDirection: 'BT',
  supportsJunctions: true,
  edgeLabel: 'drives',
  nodeTags: [
    {
      id: 'leading',
      name: 'Leading Indicator',
      shortName: 'Lead',
      color: '#26A69A',
      description: 'A predictive metric you can influence before outcomes materialize',
      exclusive: false,
    },
    {
      id: 'lagging',
      name: 'Lagging Indicator',
      shortName: 'Lag',
      color: '#E57373',
      description: 'An outcome metric that reflects past performance',
      exclusive: false,
    },
  ],
  derivedIndicators: [
    {
      id: 'north-star',
      name: 'North Star',
      shortName: 'Star',
      color: '#5C8DB5',
      condition: 'indegree-zero',
      description: 'No incoming edges — the top-level metric everything rolls up to',
    },
    {
      id: 'driver',
      name: 'Driver',
      shortName: 'Drv',
      color: '#9E9E9E',
      condition: 'indegree-and-outdegree',
      description: 'Has both incoming and outgoing edges — an intermediate roll-up metric',
    },
    {
      id: 'actionable',
      name: 'Actionable Metric',
      shortName: 'Act',
      color: '#26A69A',
      condition: 'leaf',
      description: 'No outgoing edges — a metric teams can directly influence',
    },
  ],
};
