import { HierarchicalNSW } from 'hnswlib-node';
import stableStringify from 'json-stable-stringify';
import { isPlainObject } from 'lodash';
import { JSONPath } from 'jsonpath-plus';
import { CognitiveItem, newCognitiveItemId, SemanticAtom, SemanticAtomMetadata, TruthValue, UUID } from './types';
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

import { CognitiveItem, SemanticAtom, SemanticAtomMetadata, TruthValue, UUID } from './types';
import { createSemanticAtomId } from './utils';

// NOTE: CognitiveSchema type and its related logic have been moved to `modules/schema.ts`.
// The WorldModel is now only responsible for storing the raw SemanticAtoms for schemas.

export interface WorldModel {
  add_atom(atom: SemanticAtom): UUID;
  add_item(item: CognitiveItem): void;
  update_item(id: UUID, item: CognitiveItem): void;
  get_atom(id: UUID): SemanticAtom | null;
  get_item(id: UUID): CognitiveItem | null;
  get_all_atoms(): SemanticAtom[];
  get_all_items(): CognitiveItem[];

  query_by_semantic(embedding: number[], k: number): CognitiveItem[];
  query_by_symbolic(pattern: any, k?: number): CognitiveItem[];
  query_by_structure(pattern: any, k?: number): CognitiveItem[];

  revise_belief(new_item: CognitiveItem): CognitiveItem | null;
  find_or_create_atom(content: any, meta: SemanticAtomMetadata): SemanticAtom;
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

  get_all_atoms(): SemanticAtom[] {
    return Array.from(this.atoms.values());
  }

  get_all_items(): CognitiveItem[] {
    return Array.from(this.items.values());
  }

  update_item(id: UUID, item: CognitiveItem): void {
    if (this.items.has(id)) {
      this.items.set(id, item);
    }
  }

  find_or_create_atom(content: any, meta: SemanticAtomMetadata): SemanticAtom {
    // Set timestamp if not provided
    if (!meta.timestamp) {
      meta.timestamp = new Date().toISOString();
    }

    // Create the ID based on content and metadata
    const id = createSemanticAtomId(content, meta);

    // Check if atom already exists
    const existingAtom = this.atoms.get(id);
    if (existingAtom) {
      return existingAtom;
    }

    // Create a new atom with a zero embedding (will be updated by embedding service)
    const atom: SemanticAtom = {
      id,
      content,
      embedding: [], // Will be filled by embedding service
      meta,
    };

    // Add the atom to the world model
    this.add_atom(atom);
    return atom;
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
        const result = JSONPath({ path: pattern, json: content });
        // JSONPath returns an array of matches. If it's not empty, the atom matches.
        if (result && result.length > 0) {
          matchingAtomIds.add(atomId);
        }
      } catch (e) {
        console.error(`Error applying JSONPath pattern "${pattern}" to atom ${atomId}:`, e);
      }
    }

    const results: CognitiveItem[] = [];
    for (const atomId of matchingAtomIds) {
      const itemIds = this.atomIdToItemIds.get(atomId);
      if (itemIds) {
        for (const itemId of itemIds) {
          const item = this.get_item(itemId);
          if (item) {
            results.push(item);
            if (k && results.length >= k) {
              return results; // Return early if we have enough items
            }
          }
        }
      }
    }

    return results;
  }

  // --- Higher-level operations ---

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
    for (const itemId of itemsToSearch) {
      const item = this.get_item(itemId);
      if (item && item.type === 'BELIEF') {
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
      new_item.truth,
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
}

