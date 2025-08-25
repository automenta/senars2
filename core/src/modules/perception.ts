import { CognitiveItem, newCognitiveItemId, SemanticAtomMetadata, UUID } from '../types';
import { WorldModel } from '../world-model';
import { AttentionModule } from './attention';

export interface Transducer {
  can_process(data: any): boolean;

  process(data: any): Promise<CognitiveItem[]>;
}

export class TextTransducer implements Transducer {
  private worldModel: WorldModel;
  private attentionModule: AttentionModule;

  constructor(worldModel: WorldModel, attentionModule: AttentionModule) {
    this.worldModel = worldModel;
    this.attentionModule = attentionModule;
  }

  can_process(data: any): boolean {
    return typeof data === 'string';
  }

  async process(data: string): Promise<CognitiveItem[]> {
    // In a real scenario, an LLM would parse the text into structured facts, goals, or queries.
    // For this example, we'll create a simple BELIEF item.

    const meta: SemanticAtomMetadata = {
      type: 'Observation',
      source: 'user_input',
      timestamp: new Date().toISOString(),
      trust_score: 0.6, // User input has a default trust score
      domain: 'general',
    };

    const atom = this.worldModel.find_or_create_atom(data, meta);

    const beliefItem: CognitiveItem = {
      id: newCognitiveItemId(),
      atom_id: atom.id,
      type: 'BELIEF',
      truth: { frequency: 1.0, confidence: 0.6 },
      attention: this.attentionModule.calculate_initial({
        id: newCognitiveItemId(), // Temporary ID for attention calculation
        atom_id: atom.id,
        type: 'BELIEF',
        label: data.substring(0, 50) + '...',
        attention: { priority: 0, durability: 0 }, // Placeholder attention
        stamp: {
          timestamp: Date.now(),
          parent_ids: [],
          schema_id: 'initial-observation-schema' as UUID,
        },
      }),
      stamp: {
        timestamp: Date.now(),
        parent_ids: [],
        schema_id: 'initial-observation-schema' as UUID, // Placeholder schema ID
        module: 'PerceptionSubsystem',
      },
      label: data.substring(0, 50) + (data.length > 50 ? '...' : ''),
    };

    return [beliefItem];
  }
}

export class PerceptionSubsystem {
  private transducers: Transducer[] = [];
  private worldModel: WorldModel;
  private attentionModule: AttentionModule;

  constructor(worldModel: WorldModel, attentionModule: AttentionModule) {
    this.worldModel = worldModel;
    this.attentionModule = attentionModule;
    this.registerTransducer(new TextTransducer(this.worldModel, this.attentionModule));
    // Register other transducers here (e.g., SensorStreamTransducer)
  }

  public registerTransducer(transducer: Transducer): void {
    this.transducers.push(transducer);
  }

  public async process(data: any): Promise<CognitiveItem[]> {
    for (const transducer of this.transducers) {
      if (transducer.can_process(data)) {
        return transducer.process(data);
      }
    }
    console.warn('No transducer found for input data:', data);
    return [];
  }
}