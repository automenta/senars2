import { CognitiveItem as CoreCognitiveItem } from '@cognitive-arch/types';

// Extend the core CognitiveItem with frontend-specific properties
export type CognitiveItem = CoreCognitiveItem & {
  raw_data: string;
};
