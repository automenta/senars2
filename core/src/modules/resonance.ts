import { CognitiveItem } from '../types';
import { WorldModel } from '../world-model';

export interface ResonanceModule {
  find_context(item: CognitiveItem, world_model: WorldModel, k: number): Promise<CognitiveItem[]>;
}

export class ResonanceModuleImpl implements ResonanceModule {
  async find_context(item: CognitiveItem, world_model: WorldModel, k: number): Promise<CognitiveItem[]> {
    const itemAtom = world_model.get_atom(item.atom_id);
    if (!itemAtom) {
      return [];
    }

    // 1. Perform semantic query
    const semanticMatches = itemAtom.embedding?.length > 0
      ? world_model.query_by_semantic(itemAtom.embedding, k)
      : [];

    // 2. Perform symbolic query
    const symbolicMatches = world_model.query_by_symbolic(itemAtom.content, k);

    // 3. Combine and deduplicate results
    const combinedResults = new Map<string, CognitiveItem>();

    for (const match of [...semanticMatches, ...symbolicMatches]) {
      // Don't include the item itself in its context
      if (match.id === item.id) {
        continue;
      }
      if (!combinedResults.has(match.id)) {
        combinedResults.set(match.id, match);
      }
    }

    // 4. Score and rank the results (naive scoring for now)
    // A real implementation would use a more sophisticated scoring function as
    // described in core.md (semantic similarity, symbolic overlap, goal relevance, etc.)
    const scoredResults = Array.from(combinedResults.values()).map(match => {
      let score = 0;
      // Give higher score to items that appeared in both searches
      const inSemantic = semanticMatches.some(m => m.id === match.id);
      const inSymbolic = symbolicMatches.some(m => m.id === match.id);
      if (inSemantic) score += 0.5;
      if (inSymbolic) score += 0.5;

      // Add base attention priority to score
      score += match.attention.priority;

      return { item: match, score };
    });

    // 5. Return top k results
    return scoredResults
      .sort((a, b) => b.score - a.score)
      .slice(0, k)
      .map(r => r.item);
  }
}
