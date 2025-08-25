import { HierarchicalNSW } from 'hnswlib-node';
import stableStringify from 'json-stable-stringify';
import { isPlainObject } from 'lodash';
import { JSONPath } from 'jsonpath-plus';
import {
  SemanticAtom,
  CognitiveItem,
  UUID,
  TruthValue,
  newCognitiveItemId,
  SemanticAtomMetadata,
} from './types';
import { createSemanticAtomId } from './utils';

// --- Interfaces and Default Implementations ---

export interface BeliefRevisionEngine {
  merge(existing: TruthValue, neu: TruthValue): TruthValue;
  detect_conflict(a: TruthValue, b: TruthValue): boolean;
}

export class DefaultBeliefRevisionEngine implements BeliefRevisionEngine {
  merge(existing: TruthValue, neu: TruthValue): TruthValue {
    const w1 = existing.confidence;
    const w2 = neu.confidence;
    const totalWeight = w1 + w2;

    if (totalWeight === 0) {
      return {
        frequency: (existing.frequency + neu.frequency) / 2,
        confidence: 0,
      };
    }

    const frequency =
      (w1 * existing.frequency + w2 * neu.frequency) / totalWeight;
    const confidence = Math.min(0.99, (w1 + w2) / 2 + 0.1);

    return { frequency, confidence };
  }

  detect_conflict(a: TruthValue, b: TruthValue): boolean {
    return (
      Math.abs(a.frequency - b.frequency) > 0.5 &&
      a.confidence > 0.7 &&
      b.confidence > 0.7
    );
  }
}

export type CognitiveSchema = {
  atom_id: UUID;
  apply: (a: CognitiveItem, b: CognitiveItem) => CognitiveItem[];
};

export interface WorldModel {
  add_atom(atom: SemanticAtom): UUID;
  add_item(item: CognitiveItem): void;

  get_atom(id: UUID): SemanticAtom | null;
  get_item(id: UUID): CognitiveItem | null;
  update_item(id: UUID, item: CognitiveItem): void;

  find_or_create_atom(content: any, partial_meta: Partial<SemanticAtomMetadata>): SemanticAtom;

  query_by_semantic(embedding: number[], k: number): CognitiveItem[];
  query_by_symbolic(pattern: any, k?: number): CognitiveItem[];
  query_by_structure(pattern: string, k?: number): CognitiveItem[];

  revise_belief(new_item: CognitiveItem): CognitiveItem | null;
  register_schema_atom(atom: SemanticAtom): CognitiveSchema | null;
}

// --- WorldModel Implementation with Indexing ---

const HNSW_SPACE = 'cosine';

export class WorldModelImpl implements WorldModel {
  // Core Storage
  private atoms: Map<UUID, SemanticAtom> = new Map();
  private items: Map<UUID, CognitiveItem> = new Map();

  // Indexes
  private semanticIndex: HierarchicalNSW;
  private symbolicIndex: Map<string, UUID> = new Map(); // content hash -> atom ID
  private structuralIndex: Map<UUID, any> = new Map(); // atom ID -> structured content
  private atomIdToItemIds: Map<UUID, Set<UUID>> = new Map();
  private hnswLabelToAtomId: Map<number, UUID> = new Map();
  private nextHnswLabel: number = 0;

  // Modules
  private beliefRevisionEngine: BeliefRevisionEngine;

  // Schema Storage
  private schemas: Map<UUID, CognitiveSchema> = new Map();

  constructor(embeddingDimension: number, revisionEngine?: BeliefRevisionEngine) {
    this.beliefRevisionEngine =
      revisionEngine || new DefaultBeliefRevisionEngine();

    // Initialize the semantic index
    this.semanticIndex = new HierarchicalNSW(HNSW_SPACE, embeddingDimension);
    this.semanticIndex.initIndex(1000); // Initial max elements
  }

  // --- Atom and Item Management ---

  add_atom(atom: SemanticAtom): UUID {
    if (this.atoms.has(atom.id)) {
      return atom.id; // Atom already exists
    }

    this.atoms.set(atom.id, atom);

    // 1. Add to symbolic index (content hash -> ID)
    const contentHash = stableStringify(atom.content);
    if (contentHash) {
      this.symbolicIndex.set(contentHash, atom.id);
    }

    // 2. Add to semantic index (if it has an embedding)
    if (atom.embedding && atom.embedding.length > 0) {
      const label = this.nextHnswLabel++;
      this.hnswLabelToAtomId.set(label, atom.id);
      this.semanticIndex.addPoint(atom.embedding, label);
    }

    // 3. Add to structural index (if it is a plain object)
    if (isPlainObject(atom.content)) {
      this.structuralIndex.set(atom.id, atom.content);
    }

    return atom.id;
  }

  add_item(item: CognitiveItem): void {
    if (this.items.has(item.id)) {
      console.warn(`Item with ID ${item.id} already exists. Overwriting.`);
    }
    this.items.set(item.id, item);

    // Update the atomID -> itemID index
    const itemIds = this.atomIdToItemIds.get(item.atom_id) || new Set();
    itemIds.add(item.id);
    this.atomIdToItemIds.set(item.atom_id, itemIds);
  }

  get_atom(id: UUID): SemanticAtom | null {
    return this.atoms.get(id) ?? null;
  }

  get_item(id: UUID): CognitiveItem | null {
    return this.items.get(id) ?? null;
  }

  update_item(id: UUID, item: CognitiveItem): void {
    if (!this.items.has(id)) {
        // In a real system, we might throw an error or handle this differently.
        // For now, we'll log a warning and add it as a new item.
        console.warn(`Attempted to update non-existent item with ID ${id}. Adding it instead.`);
    }
    this.items.set(id, item);
  }

  // --- Querying ---

  query_by_semantic(embedding: number[], k: number): CognitiveItem[] {
    const searchResult = this.semanticIndex.searchKnn(embedding, k);
    const neighbors = searchResult.neighbors;

    const resultAtoms: SemanticAtom[] = [];
    for (const label of neighbors) {
        const atomId = this.hnswLabelToAtomId.get(label);
        if (atomId) {
            const atom = this.get_atom(atomId);
            if (atom) {
                resultAtoms.push(atom);
            }
        }
    }

    const resultItems: CognitiveItem[] = [];
    for (const atom of resultAtoms) {
      const itemIds = this.atomIdToItemIds.get(atom.id);
      if (itemIds) {
        itemIds.forEach(id => {
          const item = this.get_item(id);
          if (item) resultItems.push(item);
        });
      }
    }

    return resultItems.slice(0, k);
  }

  query_by_symbolic(pattern: any, k?: number): CognitiveItem[] {
    const contentHash = stableStringify(pattern);
    if (!contentHash) {
      return [];
    }
    const atomId = this.symbolicIndex.get(contentHash);

    if (!atomId) {
      return [];
    }

    const itemIds = this.atomIdToItemIds.get(atomId);
    if (!itemIds) {
      return [];
    }

    const results: CognitiveItem[] = [];
    for (const itemId of itemIds) {
      const item = this.get_item(itemId);
      if (item) {
        results.push(item);
        if (k && results.length >= k) {
          break;
        }
      }
    }
    return results;
  }

  query_by_structure(pattern: string, k?: number): CognitiveItem[] {
    const matchingAtomIds = new Set<UUID>();

    for (const [atomId, content] of this.structuralIndex.entries()) {
      try {
        // Wrap the content in an array to allow root-level filters like $[?(@.type=='animal')]
        const result = JSONPath({ path: pattern, json: [content] });
        if (result && result.length > 0) {
          matchingAtomIds.add(atomId);
        }
      } catch (e) {
        // Ignore errors in JSONPath parsing for now
        // console.error(`Error applying JSONPath pattern "${pattern}" to atom ${atomId}`, e);
      }
    }

    const results: CognitiveItem[] = [];
    for (const atomId of matchingAtomIds) {
      const itemIds = this.atomIdToItemIds.get(atomId);
      if (itemIds) {
        for (const itemId of itemIds) {
          if (k && results.length >= k) {
            break;
          }
          const item = this.get_item(itemId);
          if (item) {
            results.push(item);
          }
        }
      }
      if (k && results.length >= k) {
        break;
      }
    }

    return results;
  }

  // --- Higher-level operations ---

  find_or_create_atom(content: any, partial_meta: Partial<SemanticAtomMetadata>): SemanticAtom {
    const contentHash = stableStringify(content);
    if (contentHash) {
      const existingAtomId = this.symbolicIndex.get(contentHash);
      if (existingAtomId) {
        const atom = this.atoms.get(existingAtomId);
        if (atom) return atom;
      }
    }

    const meta: SemanticAtomMetadata = {
        type: "Fact", // Default type
        ...partial_meta,
        timestamp: partial_meta.timestamp || new Date().toISOString(),
    };

    // Embedding would be calculated here by an external service/model
    const embedding: number[] = []; // Placeholder

    const newAtom: SemanticAtom = {
        id: createSemanticAtomId(content, meta),
        content,
        embedding,
        meta,
    };

    this.add_atom(newAtom);
    return newAtom;
  }

  revise_belief(new_item: CognitiveItem): CognitiveItem | null {
    // This implementation remains the same as before, but it now benefits from
    // faster querying if we were to use it to find the existing item.
    // For now, it still does a linear scan to find the item to revise.
    // This could be optimized by querying for the item by its atom_id.

    if (new_item.type !== 'BELIEF' || !new_item.truth) {
      return null;
    }

    const itemsToSearch = this.atomIdToItemIds.get(new_item.atom_id);
    if (!itemsToSearch) {
      this.add_item(new_item);
      return null;
    }

    let existingItem: CognitiveItem | null = null;
    for(const itemId of itemsToSearch) {
        const item = this.get_item(itemId);
        if(item && item.type === 'BELIEF') {
            existingItem = item;
            break;
        }
    }

    if (!existingItem || !existingItem.truth) {
      this.add_item(new_item);
      return null;
    }

    const mergedTruth = this.beliefRevisionEngine.merge(
      existingItem.truth,
      new_item.truth
    );

    const updatedItem: CognitiveItem = {
      ...existingItem,
      truth: mergedTruth,
    };
    this.items.set(updatedItem.id, updatedItem); // Overwrite existing item

    if (this.beliefRevisionEngine.detect_conflict(existingItem.truth, new_item.truth)) {
      console.log(`Conflict detected for atom ${new_item.atom_id}`);
    }

    return updatedItem;
  }

  register_schema_atom(atom: SemanticAtom): CognitiveSchema | null {
    if (atom.meta.type !== 'CognitiveSchema') {
      console.error(
        `Attempted to register atom ${atom.id} as a schema, but its type is ${atom.meta.type}`
      );
      return null;
    }

    try {
      const definition = atom.content;
      if (!definition || !definition.if || !definition.then) {
        throw new Error('Schema content must include "if" and "then" clauses.');
      }

      const compiledSchema: CognitiveSchema = {
        atom_id: atom.id,
        apply: (a: CognitiveItem, b: CognitiveItem): CognitiveItem[] => {
          // Check if the types of the incoming items match the schema's 'if' condition
          const isMatchA = a.type === definition.if.a?.type;
          const isMatchB = b.type === definition.if.b?.type;

          if (isMatchA && isMatchB) {
            const thenClause = definition.then;
            let label = thenClause.label_template || 'New Derived Item';
            if (label.includes('{{a.label}}')) {
              label = label.replace('{{a.label}}', a.label || '');
            }
            if (label.includes('{{b.label}}')) {
              label = label.replace('{{b.label}}', b.label || '');
            }

            const newItem: CognitiveItem = {
              id: newCognitiveItemId(),
              atom_id: thenClause.atom_id_from === 'a' ? a.atom_id : b.atom_id,
              type: thenClause.type || 'BELIEF',
              label,
              truth: thenClause.truth || { frequency: 1.0, confidence: 0.9 },
              attention: thenClause.attention || { priority: 0.8, durability: 0.8 },
              stamp: {
                timestamp: Date.now(),
                parent_ids: [a.id, b.id],
                schema_id: atom.id,
              },
            };
            return [newItem];
          }
          return [];
        },
      };

      this.schemas.set(atom.id, compiledSchema);
      return compiledSchema;
    } catch (e: any) {
      console.error(`Failed to compile schema ${atom.id}: ${e.message}`);
      return null;
    }
  }
}
