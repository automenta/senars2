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
    let itemType: CognitiveItem['type'] = 'BELIEF';
    let itemContent = data;

    if (data.startsWith('GOAL:')) {
      itemType = 'GOAL';
      itemContent = data.substring(6).trim();
    } else if (data.startsWith('BELIEF:')) {
      itemType = 'BELIEF';
      itemContent = data.substring(8).trim();
    } else if (data.startsWith('QUERY:')) {
      itemType = 'QUERY';
      itemContent = data.substring(7).trim();
    }

    const meta: SemanticAtomMetadata = {
      type: 'Observation',
      source: 'user_input',
      timestamp: new Date().toISOString(),
      trust_score: 0.6,
      domain: 'general',
    };

    const atom = this.worldModel.find_or_create_atom(itemContent, meta);

    const partialItem = {
      type: itemType,
      truth: itemType === 'BELIEF' ? { frequency: 1.0, confidence: 0.6 } : undefined,
      stamp: {
        timestamp: Date.now(),
        parent_ids: [],
        schema_id: 'user-input-schema' as UUID,
        module: 'Perception',
      },
    };

    const newItem: CognitiveItem = {
      id: newCognitiveItemId(),
      atom_id: atom.id,
      type: itemType,
      truth: itemType === 'BELIEF' ? { frequency: 1.0, confidence: 0.6 } : undefined,
      attention: this.attentionModule.calculate_initial(partialItem),
      stamp: partialItem.stamp,
      label: itemContent.substring(0, 70) + (itemContent.length > 70 ? '...' : ''),
      goal_status: itemType === 'GOAL' ? 'active' : undefined,
    };

    return [newItem];
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