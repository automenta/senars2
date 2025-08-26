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
