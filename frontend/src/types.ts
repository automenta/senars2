import { CognitiveItem as CoreCognitiveItem } from '../../packages/types/src';

// Extend the core CognitiveItem with frontend-specific properties
export type CognitiveItem = CoreCognitiveItem & {
  raw_data: string;
};
