import { CognitiveItem, UUID } from '../types.js';
import { WorldModel } from '../world-model.js';
import { cosineSimilarity } from '../utils.js';

export interface ResonanceModule {
  find_context(item: CognitiveItem, world_model: WorldModel, k: number): Promise<CognitiveItem[]>;
}

export class ResonanceModuleImpl implements ResonanceModule {
  async find_context(item: CognitiveItem, world_model: WorldModel, k: number): Promise<CognitiveItem[]> {
    const contextItems: CognitiveItem[] = [];

    // 1. Semantic Search (using item's atom embedding)
    const itemAtom = world_model.get_atom(item.atom_id);
    if (itemAtom && itemAtom.embedding && itemAtom.embedding.length > 0) {
      const semanticResults = world_model.query_by_semantic(itemAtom.embedding, k);
      contextItems.push(...semanticResults);
    }

    // 2. Symbolic Search (using item's content/label)
    if (itemAtom && itemAtom.content) {
      const symbolicResults = world_model.query_by_symbolic(itemAtom.content, k);
      contextItems.push(...symbolicResults);
    }

    // 3. Structural Search (if item content is an object)
    if (itemAtom && typeof itemAtom.content === 'object' && itemAtom.content !== null) {
      // For now, a simple structural search might look for items with similar top-level keys
      // A more advanced implementation would use JSONPath patterns derived from the item's structure
      const structuralResults = world_model.query_by_structure('$..*', k); // Broad search
      contextItems.push(...structuralResults);
    }

    // 4. Goal relevance search
    if (item.goal_parent_id) {
      // Find items related to the same goal
      const goalRelatedItems = world_model.get_all_items().filter(ci => 
        ci.goal_parent_id === item.goal_parent_id || ci.id === item.goal_parent_id
      );
      contextItems.push(...goalRelatedItems);
    }

    // 5. Recency filter - prioritize recent items
    const now = Date.now();
    const recentItems = world_model.get_all_items().filter(ci => 
      (now - ci.stamp.timestamp) < 3600000 // Items from last hour
    );
    contextItems.push(...recentItems);

    // Deduplicate and sort by a combined score
    const uniqueContextItems = Array.from(new Map(contextItems.map(ci => [ci.id, ci])).values());

    // Scoring includes: Semantic similarity, symbolic overlap, goal relevance, recency, trust
    uniqueContextItems.sort((a, b) => {
      // Calculate scores for each item
      const scoreA = this.calculateContextScore(item, a, world_model);
      const scoreB = this.calculateContextScore(item, b, world_model);
      
      return scoreB - scoreA; // Descending order
    });

    return uniqueContextItems.slice(0, k);
  }

  private calculateContextScore(targetItem: CognitiveItem, candidateItem: CognitiveItem, world_model: WorldModel): number {
    let score = 0;
    
    // 1. Attention/Priority boost (0-0.3)
    score += candidateItem.attention.priority * 0.3;
    
    // 2. Recency boost (0-0.2)
    const timeDiff = Date.now() - candidateItem.stamp.timestamp;
    const recencyScore = Math.max(0, 1 - (timeDiff / (24 * 60 * 60 * 1000))); // Normalize to 24 hours
    score += recencyScore * 0.2;
    
    // 3. Trust score boost (0-0.2)
    const atom = world_model.get_atom(candidateItem.atom_id);
    const trustScore = atom?.meta.trust_score || 0.5;
    score += trustScore * 0.2;
    
    // 4. Goal relevance boost (0-0.2)
    if (targetItem.goal_parent_id && 
        (candidateItem.goal_parent_id === targetItem.goal_parent_id || 
         candidateItem.id === targetItem.goal_parent_id)) {
      score += 0.2;
    }
    
    // 5. Type compatibility boost (0-0.1)
    if (targetItem.type === candidateItem.type) {
      score += 0.1;
    }

    // 6. Constraint Compliance boost (0-0.5, strong boost)
    if (targetItem.type === 'GOAL' && targetItem.constraints?.required_sources) {
        const requiredSources = targetItem.constraints.required_sources;
        const candidateSource = atom?.meta.source;
        const candidateTrust = atom?.meta.trust_score ?? 0;

        if (candidateSource && requiredSources[candidateSource] && candidateTrust >= requiredSources[candidateSource]) {
            // Give a strong boost if the source is required and meets the trust threshold
            score += 0.5;
        }
    }
    
    return score;
  }
}