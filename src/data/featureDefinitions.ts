import { FeatureDefinition, FeatureType } from '../types';

export const FEATURE_LIBRARY: Record<FeatureType, FeatureDefinition> = {
  tank: {
    type: 'tank',
    name: 'Simulated Tank',
    symbol: '◇',
    shape: 'diamond',
    defaultLabel: 'SIM TANK 01',
    description: 'Exercise armored combat vehicle',
    color: '#ef4444', // Red-orange HUD accent
  },
  bunker: {
    type: 'bunker',
    name: 'Simulated Bunker',
    symbol: '▣',
    shape: 'square',
    defaultLabel: 'SIM BUNKER ALPHA',
    description: 'Exercise fortified defensive position',
    color: '#f59e0b', // Amber
  },
  gun: {
    type: 'gun',
    name: 'Simulated Gun',
    symbol: '✚',
    shape: 'cross',
    defaultLabel: 'SIM ARTY 01',
    description: 'Simulated artillery / direct-fire weapon position',
    color: '#ec4899', // Pinkish magenta
  },
  comm: {
    type: 'comm',
    name: 'Communications Equipment',
    symbol: '☊',
    shape: 'comm',
    defaultLabel: 'SIM COMM NODE',
    description: 'Simulated tactical communications relay / antenna',
    color: '#3b82f6', // Blue
  },
  personnel: {
    type: 'personnel',
    name: 'Simulated Personnel',
    symbol: '◉',
    shape: 'circle',
    defaultLabel: 'SIM PERS 01',
    description: 'Simulated infantry / dismounted squad',
    color: '#10b981', // Emerald
  },
  vehicle: {
    type: 'vehicle',
    name: 'Simulated Vehicle',
    symbol: '▭',
    shape: 'rectangle',
    defaultLabel: 'SIM LOG VEH',
    description: 'Exercise utility / support transport vehicle',
    color: '#eab308', // Yellow
  },
  observation_post: {
    type: 'observation_post',
    name: 'Observation Post',
    symbol: '△',
    shape: 'triangle',
    defaultLabel: 'SIM OP 01',
    description: 'Simulated elevated forward observation post',
    color: '#06b6d4', // Cyan
  },
  headquarters: {
    type: 'headquarters',
    name: 'Headquarters',
    symbol: '★',
    shape: 'star',
    defaultLabel: 'SIM EXERCISE HQ',
    description: 'Exercise command & tactical operations center',
    color: '#a855f7', // Purple
  },
  custom: {
    type: 'custom',
    name: 'Custom Symbol (SVG/JPG)',
    symbol: '⊞',
    shape: 'custom',
    defaultLabel: 'CUSTOM SYMBOL 01',
    description: 'Custom imported SVG or JPG tactical mark',
    color: '#38bdf8', // Sky
  },
};
