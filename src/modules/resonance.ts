import { ResonanceModule as IResonanceModule, WorldModel, CognitiveItem, SemanticAtom, UUID } from '@cognitive-arch/types';
import { cosineSimilarity } from '../lib/utils';

type ScoredItem = {
    item: CognitiveItem;
    score: number;
}

export class ResonanceModule implements IResonanceModule {
    async find_context(item: CognitiveItem, world_model: WorldModel, k: number): Promise<CognitiveItem[]> {
        const sourceAtom = await world_model.get_atom(item.atom_id);
        if (!sourceAtom) {
            console.warn(`ResonanceModule: Could not find atom for item ${item.id}`);
            return [];
        }

        const candidateItems = new Map<UUID, CognitiveItem>();

        // 1. Semantic Resonance
        if (sourceAtom.embedding && sourceAtom.embedding.length > 0) {
            const semanticMatches = await world_model.query_by_semantic(sourceAtom.embedding, k * 2);
            semanticMatches.forEach(match => {
                if (match.id !== item.id) {
                    candidateItems.set(match.id, match);
                }
            });
        }

        // 2. Symbolic Resonance (by item type)
        const symbolicMatches = await world_model.query_by_symbolic({ type: item.type }, k * 2);
        symbolicMatches.forEach(match => {
            if (match.id !== item.id) {
                candidateItems.set(match.id, match);
            }
        });

        // 3. Re-rank candidates
        const scoredCandidates: ScoredItem[] = [];
        for (const candidate of candidateItems.values()) {
            const score = await this.calculate_resonance_score(sourceAtom, candidate, world_model);
            scoredCandidates.push({ item: candidate, score });
        }

        scoredCandidates.sort((a, b) => b.score - a.score);

        return scoredCandidates.slice(0, k).map(scored => scored.item);
    }

    private async calculate_resonance_score(sourceAtom: SemanticAtom, candidateItem: CognitiveItem, world_model: WorldModel): Promise<number> {
        const candidateAtom = await world_model.get_atom(candidateItem.atom_id);
        if (!candidateAtom) return 0;

        // Weights for different scoring factors
        const W_SEMANTIC = 0.5;
        const W_ATTENTION = 0.3;
        const W_TRUST = 0.2;

        // a. Semantic Score
        let semanticScore = 0;
        if (sourceAtom.embedding && sourceAtom.embedding.length > 0 && candidateAtom.embedding && candidateAtom.embedding.length > 0) {
            semanticScore = cosineSimilarity(sourceAtom.embedding, candidateAtom.embedding);
        }

        // b. Attention Score (average of priority and durability)
        const attentionScore = (candidateItem.attention.priority + candidateItem.attention.durability) / 2;

        // c. Trust Score
        const trustScore = candidateAtom.meta.trust_score;

        // Combined score
        const totalScore = (W_SEMANTIC * semanticScore) + (W_ATTENTION * attentionScore) + (W_TRUST * trustScore);

        return totalScore;
    }
}
