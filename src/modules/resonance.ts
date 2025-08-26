import { ResonanceModule as IResonanceModule, WorldModel } from '../types/interfaces';
import { CognitiveItem, UUID } from '../types/data';

export class ResonanceModule implements IResonanceModule {
    async find_context(item: CognitiveItem, world_model: WorldModel, k: number): Promise<CognitiveItem[]> {
        const atom = await world_model.get_atom(item.atom_id);
        if (!atom) {
            console.warn(`ResonanceModule: Could not find atom for item ${item.id}`);
            return [];
        }

        const contextItems = new Map<UUID, CognitiveItem>();

        // 1. Semantic Resonance
        if (atom.embedding && atom.embedding.length > 0) {
            const semanticMatches = await world_model.query_by_semantic(atom.embedding, k);
            semanticMatches.forEach(match => {
                if (match.id !== item.id) {
                    contextItems.set(match.id, match);
                }
            });
        }

        // 2. Symbolic Resonance (e.g., by domain)
        if (atom.meta.domain) {
            const symbolicMatches = await world_model.query_by_symbolic({ 'atom.meta.domain': atom.meta.domain }, k);
            symbolicMatches.forEach(match => {
                if (match.id !== item.id) {
                    contextItems.set(match.id, match);
                }
            });
        }

        // In a more advanced version, we would re-rank the combined results
        // based on a scoring model. For now, we just combine and slice.
        const results = Array.from(contextItems.values());

        return results.slice(0, k);
    }
}
