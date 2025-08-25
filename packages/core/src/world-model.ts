import { HierarchicalNSW } from 'hnswlib-node';
import stableStringify from 'json-stable-stringify';
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
  compiled: any;
};

export interface WorldModel {
  add_atom(atom: SemanticAtom): UUID;
  add_item(item: CognitiveItem): void;

  get_atom(id: UUID): SemanticAtom | null;
  get_item(id: UUID): CognitiveItem | null;

  query_by_semantic(embedding: number[], k: number): CognitiveItem[];
  query_by_symbolic(pattern: any, k?: number): CognitiveItem[];
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
  private atomIdToItemIds: Map<UUID, Set<UUID>> = new Map();

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
      // The label for HNSW is a number, so we need a mapping.
      // For simplicity, we'll use the number of items in the index as the label.
      // A more robust implementation would manage labels explicitly.
      const label = this.semanticIndex.getCurrentCount();
      this.semanticIndex.addPoint(atom.embedding, label);
      // We need a way to map this label back to our UUID.
      // Let's assume for now the retrieval gives us enough info or we can map back.
      // For this implementation, we'll retrieve by label and then lookup the atom.
      // This is a simplification. A real system might need a label<->UUID map.
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

  // --- Querying ---

  query_by_semantic(embedding: number[], k: number): CognitiveItem[] {
    const searchResult = this.semanticIndex.searchKnn(embedding, k);
    const neighbors = searchResult.neighbors;
    const distances = searchResult.distances;

    // This part is tricky because HNSW gives us numeric labels, not UUIDs.
    // This requires a mapping from the numeric label back to our atom.
    // For now, this is a placeholder for that logic.
    // A simple (but not robust) way is to get all atoms and find the ones at those indices.
    const allAtomsWithEmbeddings = Array.from(this.atoms.values()).filter(a => a.embedding && a.embedding.length > 0);

    const resultAtoms = neighbors.map(label => allAtomsWithEmbeddings[label]).filter(Boolean);

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
}
