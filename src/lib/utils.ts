/**
 * Safely retrieves a nested property from an object using a dot-notation path.
 * @param obj The object to query.
 * @param path The dot-notation path to the property (e.g., 'meta.domain').
 * @returns The property value, or undefined if the path is invalid.
 */
import { CognitiveItem, SemanticAtom, UUID } from "../types/data";
import { createHash } from 'crypto';

export function getProperty(obj: any, path: string): any {
    return path.split('.').reduce((o, key) => (o && o[key] !== undefined ? o[key] : undefined), obj);
}


/**
 * Checks if a CognitiveItem and its corresponding SemanticAtom match a given pattern object.
 * @param item The CognitiveItem to check.
 * @param atom The corresponding SemanticAtom.
 * @param pattern A pattern object where keys are dot-notation paths and values are the expected values.
 * @returns True if the item/atom pair matches the pattern, false otherwise.
 */
export function itemMatchesPattern(item: CognitiveItem, atom: SemanticAtom, pattern: any): boolean {
    if (!pattern) return true; // No pattern means it always matches.
    for (const key in pattern) {
        const expectedValue = pattern[key];
        // Check item properties (e.g., "type") or atom properties (e.g., "atom.meta.domain")
        const path = key.startsWith('atom.') ? key.substring(5) : key;
        const targetObj = key.startsWith('atom.') ? atom : item;
        const actualValue = getProperty(targetObj, path);

        if (actualValue !== expectedValue) {
            return false;
        }
    }
    return true;
}

/**
 * Creates a content-addressable SHA-256 ID for a new SemanticAtom.
 * @param content The content of the atom.
 * @param meta The metadata of the atom.
 * @returns A hex-encoded SHA-256 hash.
 */
export function createAtomId(content: any, meta: any): UUID {
    const hash = createHash('sha256');
    hash.update(JSON.stringify(content) + JSON.stringify(meta));
    return hash.digest('hex');
}

/**
 * Calculates the cosine similarity between two vectors.
 * @param vecA The first vector.
 * @param vecB The second vector.
 * @returns The cosine similarity score, from -1 to 1.
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length || vecA.length === 0) {
        return 0;
    }
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }
    if (normA === 0 || normB === 0) {
        return 0;
    }
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
