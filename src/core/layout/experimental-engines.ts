import type { LayoutEngine } from './layout-engine';
import {
  elkForceEngine,
  elkLayeredEngine,
  elkRadialEngine,
  elkStressEngine,
} from './elk-engine';
import { graphologyForceAtlas2Engine } from './graphology-forceatlas2-engine';

export interface ExperimentalLayoutEngineDefinition {
  id: string;
  label: string;
  engine: LayoutEngine;
}

export const experimentalLayoutEngines: ExperimentalLayoutEngineDefinition[] = [
  {
    id: 'elk-layered-direct',
    label: 'ELK Layered (Direct)',
    engine: elkLayeredEngine,
  },
  {
    id: 'elk-stress',
    label: 'ELK Stress',
    engine: elkStressEngine,
  },
  {
    id: 'elk-force',
    label: 'ELK Force',
    engine: elkForceEngine,
  },
  {
    id: 'elk-radial',
    label: 'ELK Radial',
    engine: elkRadialEngine,
  },
  {
    id: 'graphology-forceatlas2',
    label: 'Graphology ForceAtlas2',
    engine: graphologyForceAtlas2Engine,
  },
];
