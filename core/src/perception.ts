import { WorldModel } from './world-model';
import { AttentionModule } from './modules/attention';
import { CognitiveItem, CognitiveItemType, newCognitiveItemId, SemanticAtomMetadata } from './types';

// --- S-Expression Parser ---

/**
 * Tokenizes an S-expression string.
 * (a b (c)) -> ['(', 'a', 'b', '(', 'c', ')', ')']
 */
function tokenize(text: string): string[] {
  return text.replace(/\(/g, ' ( ').replace(/\)/g, ' ) ').trim().split(/\s+/);
}

/**
 * Recursively parses a list of tokens into a nested array structure.
 */
function parseFromTokens(tokens: string[]): any {
  if (tokens.length === 0) {
    throw new Error('Unexpected EOF while parsing');
  }
  const token = tokens.shift();
  if (token === '(') {
    const list = [];
    while (tokens.length > 0 && tokens[0] !== ')') {
      list.push(parseFromTokens(tokens));
    }
    if (tokens.length === 0) {
      throw new Error('Missing \')\'');
    }
    tokens.shift(); // Consume ')'
    return list;
  } else if (token === ')') {
    throw new Error('Unexpected \')\'');
  } else {
    return token; // It's an atom
  }
}

/**
 * Parses a string containing a single S-expression into a nested array.
 * @param text The S-expression string, e.g., "(is_toxic_to chocolate dog)"
 */
function parseSExpression(text: string): any {
  const tokens = tokenize(text);
  if (tokens.length === 0) {
    return null;
  }
  return parseFromTokens(tokens);
}


// --- Perception Module ---

export class PerceptionModule {
  private worldModel: WorldModel;
  private attentionModule: AttentionModule;

  constructor(worldModel: WorldModel, attentionModule: AttentionModule) {
    this.worldModel = worldModel;
    this.attentionModule = attentionModule;
  }

  /**
   * Processes a structured string input and converts it into a CognitiveItem.
   * @param input The string to process, e.g., "BELIEF: (chocolate is_toxic_to dog)"
   * @returns A new CognitiveItem, or null if parsing fails.
   */
  public process(input: string): CognitiveItem | null {
    // 1. Parse the input string, e.g., "BELIEF: (content)"
    const parts = input.split(/:\s*(.*)/s);
    if (parts.length < 2) {
      console.error(`Invalid input format for "${input}". Expected 'TYPE: (content)'.`);
      return null;
    }

    const type = parts[0].toUpperCase() as CognitiveItemType;
    const contentStr = parts[1];

    if (!['BELIEF', 'GOAL', 'QUERY'].includes(type)) {
      console.error(`Invalid cognitive item type: ${type}`);
      return null;
    }

    // 2. Parse the content string into a data structure
    let content: any;
    try {
      content = parseSExpression(contentStr);
    } catch (e: any) {
      console.error(`Failed to parse S-expression "${contentStr}": ${e.message}`);
      return null;
    }

    // 3. Find or create a SemanticAtom for the content
    const meta: Partial<SemanticAtomMetadata> = {
      type: 'Fact', // All user input is treated as a Fact for now
      source: 'user_input',
    };
    const atom = this.worldModel.find_or_create_atom(content, meta);

    // 4. Create the CognitiveItem
    const partialItem = { type, truth: type === 'BELIEF' ? { frequency: 1.0, confidence: 0.9 } : undefined };
    const item: CognitiveItem = {
      id: newCognitiveItemId(),
      atom_id: atom.id,
      type: type,
      label: `${type}: ${contentStr.trim()}`,
      truth: partialItem.truth,
      attention: this.attentionModule.calculate_initial(partialItem as CognitiveItem),
      stamp: {
        timestamp: Date.now(),
        parent_ids: [],
        schema_id: 'user-input' as any, // Special identifier for direct input
      },
    };

    // 5. Add the new item to the world model so it's part of the agent's "memory"
    this.worldModel.add_item(item);

    return item;
  }
}
