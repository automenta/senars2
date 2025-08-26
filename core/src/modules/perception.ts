import { CognitiveItem, newCognitiveItemId, PartialCognitiveItem, SemanticAtomMetadata, UUID } from '../types.js';
import { WorldModel } from '../world-model.js';
import { AttentionModule } from './attention.js';

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
    let explicitMeta: Partial<SemanticAtomMetadata & { confidence: number; schema_id: UUID }> = {};

    // 1. Check for and parse explicit metadata from a JSON block
    const metaRegex = /\s*({.*})\s*$/;
    const metaMatch = data.match(metaRegex);

    if (metaMatch) {
      try {
        explicitMeta = JSON.parse(metaMatch[1]);
        itemContent = data.substring(0, metaMatch.index).trim();
      } catch (e) {
        console.warn('Could not parse metadata JSON, treating it as content.', data);
        itemContent = data; // Reset content if parsing fails
      }
    }

    // 2. Determine item type from prefix
    if (itemContent.startsWith('GOAL:')) {
      itemType = 'GOAL';
      itemContent = itemContent.substring(6).trim();
    } else if (itemContent.startsWith('BELIEF:')) {
      itemType = 'BELIEF';
      itemContent = itemContent.substring(8).trim();
    } else if (itemContent.startsWith('QUERY:')) {
      itemType = 'QUERY';
      itemContent = itemContent.substring(7).trim();
    }

    // 3. Create atom with merged metadata
    const baseMeta: SemanticAtomMetadata = {
      type: 'Observation',
      source: 'user_input',
      timestamp: new Date().toISOString(),
      trust_score: 0.6,
      domain: 'general',
    };
    // Use explicitMeta to override baseMeta properties
    const finalMeta: SemanticAtomMetadata = {
      type: baseMeta.type,
      source: explicitMeta.source || baseMeta.source,
      timestamp: explicitMeta.timestamp || baseMeta.timestamp,
      trust_score: explicitMeta.trust_score ?? baseMeta.trust_score,
      domain: explicitMeta.domain || baseMeta.domain,
    };
    const atom = this.worldModel.find_or_create_atom(itemContent, finalMeta);

    // 4. Create CognitiveItem, using explicit values if provided
    const confidence = explicitMeta.confidence ?? (itemType === 'BELIEF' ? 0.6 : undefined);
    const schema_id = explicitMeta.schema_id ?? ('user-input-schema' as UUID);

    const label = (itemType === 'GOAL')
      ? itemContent
      : itemContent.substring(0, 70) + (itemContent.length > 70 ? '...' : '');

    const partialItem: PartialCognitiveItem = {
      atom_id: atom.id,
      type: itemType,
      truth: itemType === 'BELIEF' ? { frequency: 1.0, confidence } : undefined,
      stamp: {
        timestamp: Date.now(),
        parent_ids: [],
        schema_id: schema_id,
        module: 'Perception',
      },
      label,
    };

    const newItem: CognitiveItem = {
      id: newCognitiveItemId(),
      atom_id: atom.id,
      type: itemType,
      truth: partialItem.truth,
      attention: this.attentionModule.calculate_initial(partialItem),
      stamp: partialItem.stamp,
      label: partialItem.label,
      goal_status: itemType === 'GOAL' ? 'active' : undefined,
    };

    return [newItem];
  }
}

// --- New Transducer for Codebase Files ---

export type CodebaseFileInput = {
  type: 'codebase_file';
  path: string;
  content: string;
};

export class CodebaseTransducer implements Transducer {
  private worldModel: WorldModel;
  private attentionModule: AttentionModule;

  constructor(worldModel: WorldModel, attentionModule: AttentionModule) {
    this.worldModel = worldModel;
    this.attentionModule = attentionModule;
  }

  can_process(data: any): boolean {
    return data && data.type === 'codebase_file' && typeof data.path === 'string' && typeof data.content === 'string';
  }

  async process(data: CodebaseFileInput): Promise<CognitiveItem[]> {
    const { path, content } = data;

    const finalMeta: SemanticAtomMetadata = {
      type: 'Code',
      source: 'file_system',
      timestamp: new Date().toISOString(),
      trust_score: 1.0, // We trust our own files
      domain: 'software_development',
      path: path, // Add file path to metadata
    };

    const atom = this.worldModel.find_or_create_atom(content, finalMeta);

    const label = `File: ${path}`;

    const partialItem: PartialCognitiveItem = {
      atom_id: atom.id,
      type: 'BELIEF',
      truth: { frequency: 1.0, confidence: 1.0 }, // The belief that the file exists and has this content is certain
      stamp: {
        timestamp: Date.now(),
        parent_ids: [],
        schema_id: 'codebase-transducer-schema' as UUID,
        module: 'Perception',
      },
      label,
    };

    const newItem: CognitiveItem = {
      id: newCognitiveItemId(),
      atom_id: atom.id,
      type: 'BELIEF',
      truth: partialItem.truth,
      attention: this.attentionModule.calculate_initial(partialItem),
      stamp: partialItem.stamp,
      label: partialItem.label,
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
    this.registerTransducer(new CodebaseTransducer(this.worldModel, this.attentionModule));
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

  public async perceiveFile(filePath: string, fileContent: string): Promise<CognitiveItem[]> {
    const fileInput: CodebaseFileInput = {
      type: 'codebase_file',
      path: filePath,
      content: fileContent,
    };
    return this.process(fileInput);
  }
}